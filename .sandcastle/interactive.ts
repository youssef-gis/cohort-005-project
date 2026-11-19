import { interactive } from "@ai-hero/sandcastle";
import { noSandbox } from "@ai-hero/sandcastle/sandboxes/no-sandbox";
import { codexAgent } from "./codex";

await interactive({
  agent: codexAgent(),
  sandbox: noSandbox(),
  promptFile: "./.sandcastle/prompt.md",
});
