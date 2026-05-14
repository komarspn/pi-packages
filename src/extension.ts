import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerCiFind } from "./tools/ci-find";
import { registerCiList } from "./tools/ci-list";
import { registerCiWatch } from "./tools/ci-watch";
import { registerIssueClose } from "./tools/issue-close";
import { registerReleasePrFind } from "./tools/release-pr-find";
import { registerReleasePrMerge } from "./tools/release-pr-merge";
import { registerReleaseWatch } from "./tools/release-watch";

export default function piGithubToolsExtension(pi: ExtensionAPI): void {
  registerCiFind(pi);
  registerCiWatch(pi);
  registerCiList(pi);
  registerReleasePrFind(pi);
  registerReleasePrMerge(pi);
  registerReleaseWatch(pi);
  registerIssueClose(pi);
}
