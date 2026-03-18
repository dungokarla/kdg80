# Agent Instructions

- `Opus` always means `Claude Opus`, never a generic quality level, mode name, or informal nickname.
- The aliases `Opus`, `Опус`, `Claude Opus`, and `Claude Opus latest` all mean: run Claude with the `opus` model alias.
- If the user asks to "use Opus", "launch Opus", "run Opus", "call Opus", or uses the Russian equivalents, interpret that as a concrete instruction to use the Claude model alias `opus`.
- In this workspace, when the user references `Opus`, prefer `claude --model opus --effort high` or an equivalent default configuration that resolves to the latest available Claude Opus model.
- For website work, use Claude Opus with high effort as a consulting and support model for interface design, UX decisions, frontend implementation, and code-level problem solving.
- Treat Opus as the default assistant for reviewing site UI, suggesting interface improvements, validating implementation approaches, and helping with code changes when the user asks for a consultant, helper, or second opinion.
- When a command, script, or workflow needs an explicit Claude invocation for site-related UI or code tasks, prefer `claude --model opus --effort high`.
- Do not ask the user to clarify what `Opus` means unless they explicitly contrast it with another model.
- If a tool, script, or agent needs a model name, map `Opus` directly to `opus`.

## Git / Push Policy

- By default, stage, commit, and push only files directly related to the current user request.
- Never include unrelated modified files in a push, even if they are already dirty in the worktree.
- Never push secrets or local-only files such as `.env`, local credentials, machine-specific config, or ad hoc debug files.
- Treat deployment, verification, and infrastructure-adjacent files as push-blocked unless the user explicitly asks for them in the current task. This includes files such as `deploy-to-yc.sh`, `robots.txt`, `sitemap.xml`, `llms.txt`, `llms-full.txt`, verification HTML files, and similar operational/SEO artifacts.
- Generated assets may be pushed only when they are required for the requested feature and are actually referenced by the shipped code.
- Before any push, review `git status` and stage files explicitly; do not use broad staging that can sweep in unrelated changes.
- If there is any ambiguity about whether a file belongs in the push, do not push it by default.
