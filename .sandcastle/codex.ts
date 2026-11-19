import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { codex } from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";

const codexHome = () =>
  resolve(process.env.CODEX_HOME || join(homedir(), ".codex"));

export const codexAgent = (inDocker = false) =>
  codex(process.env.CODEX_MODEL || "gpt-6.2-sol", {
    env: process.env.CODEX_API_KEY
      ? { CODEX_API_KEY: process.env.CODEX_API_KEY }
      : {},
    sessionStorage: {
      hostSessionsDir: join(codexHome(), "sessions"),
      sandboxSessionsDir: inDocker
        ? "/home/agent/.codex/sessions"
        : join(codexHome(), "sessions"),
    },
  });

// Mount a writable Codex home so subscription credentials can refresh. Use a
// dedicated CODEX_HOME if you do not want to share your normal Codex config.
export const codexDocker = () => {
  const hostPath = codexHome();
  if (!process.env.CODEX_API_KEY && !existsSync(join(hostPath, "auth.json"))) {
    throw new Error(
      'Docker needs CODEX_API_KEY or a file-based login: codex -c cli_auth_credentials_store="file" login'
    );
  }
  return docker({
    env: { CODEX_HOME: "/home/agent/.codex" },
    mounts: process.env.CODEX_API_KEY
      ? []
      : [{ hostPath, sandboxPath: "/home/agent/.codex" }],
  });
};
