import { run } from "@ai-hero/sandcastle";
import { noSandbox } from "@ai-hero/sandcastle/sandboxes/no-sandbox";
import { codexAgent, codexDocker } from "./codex";

const [prd, plan] = process.argv.slice(2).filter((arg) => arg !== "--docker");
const inDocker = process.argv.includes("--docker");

if (!prd || !plan) {
  console.error("Usage: main.ts <prd> <plan> [--docker]");
  process.exit(1);
}

await run({
  agent: codexAgent(inDocker),
  sandbox: inDocker ? codexDocker() : noSandbox(),
  promptFile: "./.sandcastle/prompt.md",
  maxIterations: 3,
  completionSignal: "<promise>NO MORE TASKS</promise>",
  promptArgs: {
    PRD_LOCATION: prd,
    PLAN_LOCATION: plan,
  },
});
