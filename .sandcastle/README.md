# Sandcastle with Codex

Run commands below from the repository root. Every entry point and factory
workflow uses Codex. The default model is `gpt-6.2-sol`; export `CODEX_MODEL` to
select another model available to your account. In Actions, set the repository
variable `CODEX_MODEL` to override it.

## Local subscription login

```bash
npm ci
npm install -g @openai/codex
unset CODEX_API_KEY
codex login
codex login status
npx tsx .sandcastle/test.ts
npx tsx .sandcastle/main.ts path/to/prd.md path/to/plan.md
```

Choose **Sign in with ChatGPT** to use your subscription. On a machine without
a browser, use `codex login --device-auth`. Local runs use your existing Codex
login, including OS credential storage, without requiring an API key.

An exported `CODEX_API_KEY` overrides the subscription login even after
`codex login` succeeds. For subscription runs, unset it in your shell and leave
it empty in `.sandcastle/.env`. If a request reports that the model is not
supported with a ChatGPT account, check `CODEX_MODEL` too; an old override can
select a model your account no longer offers.

`main.ts` and `test.ts` run directly on your machine by default. Sandcastle's
noninteractive Codex provider bypasses approvals and the Codex sandbox; run
only trusted tasks. For an interactive session, use
`npx tsx .sandcastle/interactive.ts`.

## Optional Docker isolation

The Dockerfile installs `@openai/codex`. Rebuild an old Claude image before use:

```bash
# A dedicated, gitignored Codex home limits what is shared with the container.
export CODEX_HOME="$PWD/.sandcastle/codex-home"
codex -c 'cli_auth_credentials_store="file"' login
npx sandcastle docker build-image
npx tsx .sandcastle/test.ts --docker
npx tsx .sandcastle/main.ts path/to/prd.md path/to/plan.md --docker
```

Docker mounts `CODEX_HOME` (default `~/.codex`) writable at
`/home/agent/.codex`, so Codex can refresh subscription credentials. It needs
file-based credentials; an OS keyring login alone cannot be used inside Docker.
Credentials are supplied at runtime, never baked into the image.

## GitHub Actions subscription credentials

Save the **complete `auth.json`**, including its refresh credentials, as the
repository Actions secret `CODEX_AUTH_JSON`. A bare access token is not the
format this setup expects. Create a separate file-based login and upload it
without printing its contents:

```bash
export CODEX_HOME="$PWD/.sandcastle/codex-home"
codex -c 'cli_auth_credentials_store="file"' login
gh secret set CODEX_AUTH_JSON < "$CODEX_HOME/auth.json"
```

`gh secret set` targets the current repository. Keep the existing `FACTORY_PAT`
secret for GitHub operations. The implement, implement-spec, explore, and review
workflows now install Codex and run their scripts through
`with-codex-auth.sh`. Their existing label triggers stay the same.

The wrapper creates a private temporary `CODEX_HOME`, validates and writes the
saved credentials with owner-only permissions, and removes that directory when
the command exits, including failures. The JSON secret is removed from the
child command's environment. It is never added to an artifact or cache.

Codex can refresh the temporary credentials during a run, but this wrapper
does **not** write refreshed credentials back to GitHub Secrets. If a saved
login expires, is revoked, or its refresh token becomes invalid, log in again
and repeat `gh secret set`. Avoid concurrent jobs sharing subscription refresh
credentials; use the API key option for independent unattended jobs.

For another trusted workflow, after checkout and Node/dependency setup:

```yaml
- name: Install Codex
  run: npm install -g @openai/codex
- name: Run Sandcastle
  env:
    CODEX_AUTH_JSON: ${{ secrets.CODEX_AUTH_JSON }}
    CODEX_MODEL: ${{ vars.CODEX_MODEL }}
  run: bash .sandcastle/with-codex-auth.sh npx tsx .sandcastle/test.ts
```

This follows OpenAI's documented
[headless authentication using a saved login](https://developers.openai.com/codex/auth/).
Treat the saved login as a password. Subscription limits still apply.

## API key option

For local API billing, export `CODEX_API_KEY` before running an entry point.
For Actions, store that key as the `CODEX_API_KEY` repository secret. All factory
workflows accept it; when both secrets are supplied, the API key takes
precedence. API usage is billed separately from your subscription.

`.sandcastle/.env` can supply `CODEX_API_KEY` to local Sandcastle runs, but
`--docker` checks the shell environment before Sandcastle loads that file, so
export the key for Docker runs. Keep `CODEX_MODEL` and `CODEX_HOME` in the shell
environment as well.
