/**
 * pi-agents — A pi extension providing Claude Code-style autonomous sub-agents.
 *
 * Tools:
 *   Agent             — LLM-callable: spawn a sub-agent
 *   get_subagent_result  — LLM-callable: check background agent status/result
 *   steer_subagent       — LLM-callable: send a steering message to a running agent
 *
 * Commands:
 *   /agents                 — Interactive agent management menu
 */

import { join } from "node:path";
import { defineTool, type ExtensionAPI, getAgentDir } from "@earendil-works/pi-coding-agent";
import { AgentManager } from "./agent-manager.js";
import { getAgentConversation, getDefaultMaxTurns, getGraceTurns, setDefaultMaxTurns, setGraceTurns, steerAgent } from "./agent-runner.js";
import { getAgentConfig, getAvailableTypes, getDefaultAgentNames, getUserAgentNames, registerAgents, } from "./agent-types.js";
import { loadCustomAgents } from "./custom-agents.js";
import { type ModelRegistry, resolveModel } from "./model-resolver.js";
import { buildEventData, createNotificationSystem } from "./notification.js";
import { createNotificationRenderer } from "./renderer.js";
import { publishSubagentsService, unpublishSubagentsService } from "./service.js";
import { createSubagentsService } from "./service-adapter.js";
import { applyAndEmitLoaded, saveAndEmitChanged } from "./settings.js";
import { createAgentTool } from "./tools/agent-tool.js";
import { createGetResultTool } from "./tools/get-result-tool.js";
import { getModelLabelFromConfig, } from "./tools/helpers.js";
import { createSteerTool } from "./tools/steer-tool.js";
import { type NotificationDetails, } from "./types.js";
import { createAgentsMenuHandler } from "./ui/agent-menu.js";
import {
  type AgentActivity,
  AgentWidget,
  type UICtx,
} from "./ui/agent-widget.js";





export default function (pi: ExtensionAPI) {
  // ---- Register custom notification renderer ----
  pi.registerMessageRenderer<NotificationDetails>("subagent-notification", createNotificationRenderer());

  /** Reload agents from .pi/agents/*.md and merge with defaults (called on init and each Agent invocation). */
  const reloadCustomAgents = () => {
    const userAgents = loadCustomAgents(process.cwd());
    registerAgents(userAgents);
  };

  // Initial load
  reloadCustomAgents();

  // ---- Agent activity tracking ----
  const agentActivity = new Map<string, AgentActivity>();

  // ---- Notification system ----
  // Widget assigned after AgentManager construction; arrow closures capture by reference.
  let widget: AgentWidget;
  const notifications = createNotificationSystem({
    sendMessage: (msg, opts) => pi.sendMessage(msg as any, opts as any),
    agentActivity,
    markFinished: (id) => widget.markFinished(id),
    updateWidget: () => widget.update(),
  });

  // Background completion: emit lifecycle event and delegate to notification system
  const manager = new AgentManager((record) => {
    // Emit lifecycle event based on terminal status
    const isError = record.status === "error" || record.status === "stopped" || record.status === "aborted";
    const eventData = buildEventData(record);
    if (isError) {
      pi.events.emit("subagents:failed", eventData);
    } else {
      pi.events.emit("subagents:completed", eventData);
    }

    // Persist final record for cross-extension history reconstruction
    pi.appendEntry("subagents:record", {
      id: record.id, type: record.type, description: record.description,
      status: record.status, result: record.result, error: record.error,
      startedAt: record.startedAt, completedAt: record.completedAt,
    });

    // Skip notification if result was already consumed via get_subagent_result
    if (record.resultConsumed) {
      notifications.cleanupCompleted(record.id);
      return;
    }

    notifications.sendCompletion(record);
  }, undefined, (record) => {
    // Emit started event when agent transitions to running (including from queue)
    pi.events.emit("subagents:started", {
      id: record.id,
      type: record.type,
      description: record.description,
    });
  }, (record, info) => {
    // Emit compacted event when agent's session compacts (preserves count on record).
    pi.events.emit("subagents:compacted", {
      id: record.id,
      type: record.type,
      description: record.description,
      reason: info.reason,
      tokensBefore: info.tokensBefore,
      compactionCount: record.compactionCount,
    });
  });

  // Typed service published via Symbol.for() for cross-extension access.
  // Consumers: const { getSubagentsService } = await import("@gotgenes/pi-subagents");
  let currentCtx: { pi: unknown; ctx: unknown } | undefined;
  const service = createSubagentsService({
    manager,
    resolveModel,
    getCtx: () => currentCtx,
    getModelRegistry: () => (currentCtx?.ctx as { modelRegistry?: ModelRegistry } | undefined)?.modelRegistry,
  });
  publishSubagentsService(service);

  pi.on("session_start", async (_event, ctx) => {
    currentCtx = { pi, ctx };
    manager.clearCompleted();
  });

  pi.on("session_before_switch", () => {
    manager.clearCompleted();
  });

  // On shutdown, abort all agents immediately and clean up.
  // If the session is going down, there's nothing left to consume agent results.
  pi.on("session_shutdown", async () => {
    unpublishSubagentsService();
    currentCtx = undefined;
    manager.abortAll();
    notifications.dispose();
    manager.dispose();
  });

  // Live widget: show running agents above editor
  widget = new AgentWidget(manager, agentActivity);

  // Grab UI context from first tool execution + clear lingering widget on new turn
  pi.on("tool_execution_start", async (_event, ctx) => {
    widget.setUICtx(ctx.ui as UICtx);
    widget.onTurnStart();
  });

  /** Build the full type list text dynamically from the unified registry. */
  const buildTypeListText = () => {
    const defaultNames = getDefaultAgentNames();
    const userNames = getUserAgentNames();

    const defaultDescs = defaultNames.map((name) => {
      const cfg = getAgentConfig(name);
      const modelSuffix = cfg?.model ? ` (${getModelLabelFromConfig(cfg.model)})` : "";
      return `- ${name}: ${cfg?.description ?? name}${modelSuffix}`;
    });

    const customDescs = userNames.map((name) => {
      const cfg = getAgentConfig(name);
      return `- ${name}: ${cfg?.description ?? name}`;
    });

    return [
      "Default agents:",
      ...defaultDescs,
      ...(customDescs.length > 0 ? ["", "Custom agents:", ...customDescs] : []),
      "",
      `Custom agents can be defined in .pi/agents/<name>.md (project) or ${getAgentDir()}/agents/<name>.md (global) — they are picked up automatically. Project-level agents override global ones. Creating a .md file with the same name as a default agent overrides it.`,
    ].join("\n");
  };



  const typeListText = buildTypeListText();

  // Apply persisted settings on startup and emit `subagents:settings_loaded`.
  // Global + project merged; missing → defaults; corrupt file emits a warning
  // to stderr and falls back to defaults.
  applyAndEmitLoaded(
    {
      setMaxConcurrent: (n) => manager.setMaxConcurrent(n),
      setDefaultMaxTurns,
      setGraceTurns,
    },
    (event, payload) => pi.events.emit(event, payload),
  );

  // ---- Agent tool ----

  pi.registerTool(defineTool(createAgentTool({
    manager: {
      spawn: (ctx, type, prompt, opts) => manager.spawn(pi, ctx, type, prompt, opts),
      spawnAndWait: (ctx, type, prompt, opts) => manager.spawnAndWait(pi, ctx, type, prompt, opts),
      resume: (id, prompt, signal) => manager.resume(id, prompt, signal),
      getRecord: (id) => manager.getRecord(id),
      getMaxConcurrent: () => manager.getMaxConcurrent(),
      listAgents: () => manager.listAgents(),
    },
    widget: {
      setUICtx: (ctx) => widget.setUICtx(ctx as UICtx),
      ensureTimer: () => widget.ensureTimer(),
      update: () => widget.update(),
      markFinished: (id) => widget.markFinished(id),
    },
    agentActivity,
    emitEvent: (name, data) => pi.events.emit(name, data),
    reloadCustomAgents,
    typeListText,
    availableTypesText: getAvailableTypes().join(", "),
    agentDir: getAgentDir(),
  })));

  // ---- get_subagent_result tool ----

  pi.registerTool(defineTool(createGetResultTool({
    getRecord: (id) => manager.getRecord(id),
    cancelNudge: (key) => notifications.cancelNudge(key),
    getConversation: (session) => getAgentConversation(session),
  })));

  // ---- steer_subagent tool ----

  pi.registerTool(defineTool(createSteerTool({
    getRecord: (id) => manager.getRecord(id),
    emitEvent: (name, data) => pi.events.emit(name, data),
    steerAgent: (session, message) => steerAgent(session, message),
  })));

  // ---- /agents interactive menu ----

  const agentsMenuHandler = createAgentsMenuHandler({
    manager: {
      listAgents: () => manager.listAgents(),
      getRecord: (id) => manager.getRecord(id),
      spawnAndWait: (piArg, ctx, type, prompt, opts) => manager.spawnAndWait(piArg ?? pi, ctx, type, prompt, opts),
      getMaxConcurrent: () => manager.getMaxConcurrent(),
      setMaxConcurrent: (n) => manager.setMaxConcurrent(n),
    },
    reloadCustomAgents,
    agentActivity,
    getModelLabel: (type, registry) => {
      const cfg = getAgentConfig(type);
      if (!cfg?.model) return 'inherit';
      if (registry) {
        const resolved = resolveModel(cfg.model, registry);
        if (typeof resolved === 'string') return 'inherit';
      }
      return getModelLabelFromConfig(cfg.model);
    },
    snapshotSettings: () => ({
      maxConcurrent: manager.getMaxConcurrent(),
      defaultMaxTurns: getDefaultMaxTurns() ?? 0,
      graceTurns: getGraceTurns(),
    }),
    saveSettings: (settings, successMsg) => saveAndEmitChanged(
      settings,
      successMsg,
      (event, payload) => pi.events.emit(event, payload),
    ),
    emitEvent: (name, data) => pi.events.emit(name, data),
    personalAgentsDir: join(getAgentDir(), 'agents'),
  });

  pi.registerCommand('agents', {
    description: 'Manage agents',
    handler: async (_args, ctx) => { await agentsMenuHandler(ctx); },
  });
}
