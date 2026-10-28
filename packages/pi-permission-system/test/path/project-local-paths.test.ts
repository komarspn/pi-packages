import { describe, expect, it } from "vitest";

import { BashProgram } from "#src/access-intent/bash/program";
import { isGateDescriptor } from "#src/handlers/gates/descriptor";
import { describeExternalDirectoryGate } from "#src/handlers/gates/external-directory";
import { posixPathFlavor, win32PathFlavor } from "#src/path/path-flavor";
import { PathNormalizer } from "#src/path/path-normalizer";
import { PermissionManager } from "#src/policy/permission-manager";
import { PermissionResolver } from "#src/policy/permission-resolver";
import { SessionRules } from "#src/session/session-rules";
import { createInMemoryPolicyLoader } from "#test/helpers/manager-harness";

const cases = [
  {
    name: "POSIX",
    flavor: posixPathFlavor,
    cwd: "/projects/my-app",
    rootPaths: [
      "/projects/my-app",
      "/projects/my-app/",
      "/projects/my-app/.",
      "/projects/my-app/src/..",
    ],
    localPath: "/projects/my-app/src/index.ts",
    outsidePaths: [
      "/projects/my-app-copy/src/index.ts",
      "/projects/my-app/../other/src/index.ts",
      "/projects",
    ],
  },
  {
    name: "Windows",
    flavor: win32PathFlavor,
    cwd: "C:\\Projects\\App",
    rootPaths: [
      "C:\\Projects\\App",
      "C:\\Projects\\App\\",
      "c:/projects/app/.",
      "C:\\Projects\\App\\src\\..",
    ],
    localPath: "C:/Projects/App/src/index.ts",
    outsidePaths: [
      "C:/Projects/App-copy/src/index.ts",
      "C:/Projects/App/../Other/src/index.ts",
      "D:/Projects/App/src/index.ts",
      "C:/Projects",
    ],
  },
];

describe.each(cases)(
  "$name project-local absolute paths",
  ({ flavor, cwd, rootPaths, localPath, outsidePaths }) => {
    const normalizer = new PathNormalizer(flavor, cwd);
    const resolver = new PermissionResolver(
      new PermissionManager({
        flavor,
        policyLoader: createInMemoryPolicyLoader({
          global: {
            permission: {
              "*": "allow",
              path: { "*": "ask", ".": "allow", "src/*": "allow" },
              read: { "*": "ask", ".": "allow", "src/*": "allow" },
              external_directory: "ask",
            },
          },
        }),
      }),
      new SessionRules(),
    );

    describe("root containment", () => {
      it.each(rootPaths)("recognizes %s as the project root", (path) => {
        expect(normalizer.isWithinDirectory(path, cwd)).toBe(true);
      });
    });

    describe("local policy matching", () => {
      it.each([...rootPaths, localPath])(
        "allows %s through local rules",
        (path) => {
          for (const surface of ["read", "path_read", "path_write"]) {
            expect(
              resolver.resolve({
                kind: "access-path",
                surface,
                path: normalizer.forPath(path),
              }).state,
            ).toBe("allow");
          }
        },
      );
    });

    describe("external-directory gates", () => {
      it.each([...rootPaths, localPath])(
        "does not request permission for %s",
        (path) => {
          expect(
            describeExternalDirectoryGate(
              {
                toolName: "read",
                input: { path },
                toolCallId: "local-path",
                agentName: null,
                cwd,
              },
              { dirs: [], excludedDirs: [] },
              resolver,
              normalizer,
            ),
          ).toBeNull();
        },
      );

      it.each(outsidePaths)("still requests permission for %s", (path) => {
        expect(normalizer.isWithinDirectory(path, cwd)).toBe(false);
        const gate = describeExternalDirectoryGate(
          {
            toolName: "read",
            input: { path },
            toolCallId: "external-path",
            agentName: null,
            cwd,
          },
          { dirs: [], excludedDirs: [] },
          resolver,
          normalizer,
        );
        expect(isGateDescriptor(gate)).toBe(true);
        if (isGateDescriptor(gate)) {
          expect(gate.preCheck?.state).toBe("ask");
        }
      });

      it("keeps absolute Bash operands inside the project local", async () => {
        const program = await BashProgram.parse(
          `ls '${cwd}' '${localPath}'`,
          normalizer,
        );
        expect(program.externalAccesses()).toEqual([]);
      });
    });
  },
);
