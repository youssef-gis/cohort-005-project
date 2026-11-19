import { run } from "@ai-hero/sandcastle";
import { noSandbox } from "@ai-hero/sandcastle/sandboxes/no-sandbox";
import { codexAgent, codexDocker } from "./codex";

const inDocker = process.argv.includes("--docker");

await run({
  agent: codexAgent(inDocker),
  sandbox: inDocker ? codexDocker() : noSandbox(),
  prompt: "Hello, how are you?",
});
