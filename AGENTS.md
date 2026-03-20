# Agent Instructions

- `Opus` always means `Claude Opus`, never a generic quality level, mode name, or informal nickname.
- The aliases `Opus`, `Опус`, `Claude Opus`, and `Claude Opus latest` all mean: run Claude with the `opus` model alias.
- Gemini CLI may be used in this workspace as a consultation model for implementation planning, code review, debugging, second opinions, and strategy checks.
- Prefer Gemini for routine consultations and quick external validation more often than Opus. Use it proactively for ordinary consulting passes unless the user explicitly asks for Opus or there is a clear reason to escalate beyond Gemini.
- If the user asks to "use Opus", "launch Opus", "run Opus", "call Opus", or uses the Russian equivalents, interpret that as a concrete instruction to use the Claude model alias `opus`.
- In this workspace, when the user references `Opus`, prefer `claude --model opus --effort high` or an equivalent default configuration that resolves to the latest available Claude Opus model.
- When a command, script, or workflow needs an explicit Gemini consultation invocation, prefer headless Gemini CLI via `gemini -p "<prompt>" --output-format text`. Add `-m <model>` only when a specific Gemini model is required and known to work in this workspace.
- For website work, use Claude Opus with high effort as a consulting and support model for interface design, UX decisions, frontend implementation, and code-level problem solving.
- Treat Opus as the specialist assistant for site UI review, interface improvement work, deeper UX validation, and website-specific implementation consultation when the user asks for Opus or when a Gemini pass is not enough.
- For general-purpose consultation, second opinions, implementation validation, and non-visual code strategy, prefer Gemini first and use Opus as a follow-up when the user requests it or Gemini's answer is insufficient.
- When a command, script, or workflow needs an explicit Claude invocation for site-related UI or code tasks, prefer `claude --model opus --effort high`.
- Do not ask the user to clarify what `Opus` means unless they explicitly contrast it with another model.
- If a tool, script, or agent needs a model name, map `Opus` directly to `opus`.

## Opus Consultation Wait Policy

- When the user explicitly asks to use `Opus` for consultation, do not use short exploratory timeouts that are likely to cut off a valid response.
- Default to a generous wait budget for `Claude Opus` consultations. Prefer a single well-scoped request with a timeout in the several-minutes range rather than repeated short retries.
- For substantial site, UX, frontend, or strategy consultations, prefer waiting up to `10 minutes` before treating the run as stalled, unless the user asked for a faster cut-off.
- Do not retry `Opus` with a shorter timeout after an earlier timeout. If a rerun is needed, keep or increase the wait budget and improve the prompt instead of shrinking the limit.
- Avoid repeated paid consultation attempts that are unlikely to finish. Make one deliberate request, wait properly, and only launch another run if the previous result is clearly unusable or the user asks for another angle.
- If `Opus` appears blocked or unhealthy, report that transparently to the user, including the actual timeout used, instead of silently replacing the consultation with the agent's own opinion.

## Gemini Consultation Wait Policy

- When the user asks to use `Gemini` for consultation, do not use short exploratory timeouts that are likely to cut off a valid answer.
- Prefer a single deliberate headless request over multiple quick retries. Improve the prompt before rerunning; do not spam Gemini with repeated partial attempts.
- For lightweight validation or second-opinion checks, allow enough time for Gemini CLI initialization and response generation instead of treating the first silent seconds as failure.
- For substantial implementation, debugging, code review, or strategy consultations, prefer a wait budget in the several-minutes range before treating the run as stalled.
- If Gemini fails because of auth, model selection, CLI initialization, or environment issues, report the actual command pattern and the concrete error instead of silently replacing the consultation with the agent's own opinion.

## Skill Usage Policy

- For any interface, frontend, layout, visual, UX, landing page, or design-related work, always use the `ui-ux-pro-max` skill.
- For any interface or website work that can affect discoverability, page structure, content presentation, metadata, internal linking, or search performance, also use the `seo` skill.
- For any interface or website work, also use the `seo-geo` skill to account for AI search visibility, AI Overviews, ChatGPT web search, and Perplexity-style citation patterns.
- If the task is explicitly about GEO, AI visibility, AI citations, LLM discoverability, `llms.txt`, crawler access, or structured discoverability for AI systems, additionally use the `geo` skill.
- Default workflow for site UI tasks: use `ui-ux-pro-max` + `seo` + `seo-geo`; add `geo` whenever the task touches AI-search readiness or GEO outcomes.

## Visual Verification Policy

- For any website, frontend, layout, or visual task, do not mark the work complete until you have done a visual verification pass through Playwright CLI or an equivalent Playwright command-line workflow.
- Always verify both desktop and mobile views for visual tasks before saying the issue is fixed.
- The verification pass must check the actual rendered result, not only the code or static CSS diff.
- When the user reports a visual defect, re-open the affected screens in Playwright, capture fresh screenshots, and compare the result against the reported problem before closing the task.

## Git / Push Policy

- Keep the cloud/remote repository reasonably up to date during normal work.
- After every second user request, stage, commit, and push all durable project changes so the remote repository stays current.
- Exclude temporary artifacts, cache files, build output that is not part of the shipped product, local debug files, machine-specific files, and other non-durable working artifacts from those pushes.
- By default, stage, commit, and push only files directly related to the current user request.
- Never include unrelated modified files in a push, even if they are already dirty in the worktree.
- Never push secrets or local-only files such as `.env`, local credentials, machine-specific config, or ad hoc debug files.
- Treat deployment, verification, and infrastructure-adjacent files as push-blocked unless the user explicitly asks for them in the current task. This includes files such as `deploy-to-yc.sh`, `robots.txt`, `sitemap.xml`, `llms.txt`, `llms-full.txt`, verification HTML files, and similar operational/SEO artifacts.
- Generated assets may be pushed only when they are required for the requested feature and are actually referenced by the shipped code.
- Before any push, review `git status` and stage files explicitly; do not use broad staging that can sweep in unrelated changes.
- If there is any ambiguity about whether a file belongs in the push, do not push it by default.

## GitHub 403 Recovery

- In this workspace, if `git push` to GitHub returns `403`, do not keep retrying with the default Codespaces `GITHUB_TOKEN`.
- First check `gh auth status`. If `gh` has a real user token with `repo` scope, prefer that over the Codespaces token.
- Read the persistent `gho_...` token from `/home/codespace/.config/gh/hosts.yml` and use it for `fetch`/`push` via `git -c credential.helper= -c core.askPass= -c http.https://github.com/.extraheader="AUTHORIZATION: basic ..."` so git stops using the wrong token.
- If push then fails with `non-fast-forward`, fetch `origin`, create a clean `worktree` from `origin/main`, replay only the intended durable commits there, drop accidentally staged files, and push from that clean worktree instead of forcing from the dirty main worktree.
- Never stop at “403” as the final state if a valid `gh` user token is available locally; recover the correct auth path and finish the sync.
