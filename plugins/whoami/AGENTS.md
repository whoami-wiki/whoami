# plugins/whoami/

The agent extension that ships alongside the desktop app + CLI. When a
user installs whoami.wiki, this plugin loads into their agent harness
(Claude Code, Codex, Gemini CLI) and gives the agent the skills and
prompts it needs to do wiki work — read sources, write pages, cite
provenance, follow editorial standards.

## Important: this directory has two kinds of file

1. **Runtime agent prompts** — read by the user's agent at runtime when
   they're authoring their wiki. These are *part of the product*, not
   project documentation.
   - `CLAUDE.md` — Claude Code prompt
   - `GEMINI.md` — Gemini CLI prompt
   - `agents/*.md` — sub-agent definitions (e.g. `editor.md`)
   - `skills/*/` — skill bundles loaded by the harness

2. **Project documentation** — read by you, an agent working on the
   plugin code itself.
   - `AGENTS.md` (this file)

When you're editing this directory, you're typically editing the
runtime prompts and skill content — i.e. you're shipping a behavior
change to the user's agent. Be careful: changes here change what the
user's agent does.

## Layout

| Path                          | Purpose                                                      |
| ----------------------------- | ------------------------------------------------------------ |
| `CLAUDE.md`                   | Top-level prompt loaded by Claude Code when working in a wiki repo. Describes the wiki's structure (vault, sources, tasks, namespaces) and the agent's role. |
| `GEMINI.md`                   | Equivalent for Gemini CLI.                                   |
| `gemini-extension.json`       | Gemini extension manifest.                                   |
| `agents/editor.md`            | Editor sub-agent — definition of the agent role responsible for writing/editing pages. |
| `skills/editorial-guide/`     | Skill bundle for editorial standards (page conventions, citations, talk pages). |

## Conventions

- **Prompts are user-facing strings**. They get tokenized and rendered
  into the agent's context every turn. Treat them as you would
  product copy — clear, terse, explicit.
- **One skill per coherent capability**. A skill bundle is a folder
  with a `SKILL.md` (the skill's instructions) plus any references it
  loads. Don't mix unrelated capabilities into one skill.
- **Sub-agents are role definitions**, not procedures. The role
  describes what the sub-agent is responsible for; the procedure for a
  specific task lives in a skill or a plan.

## Testing changes to the plugin

Plugin changes are effectively prompt engineering. The way to validate a
change is the eval suite (`evals/`) — re-run the relevant fixtures
through Claude Code (or whichever harness you changed prompts for) and
check the scores.

When you make a change here, plan to follow it with an eval run. Don't
ship plugin changes without measuring impact.

## Pitfalls

- **Prompts are load-bearing for users in the wild** — vague edits can
  silently degrade their agent's performance. Be specific about what
  you're changing and why.
- **Don't conflate the runtime CLAUDE.md with project guidance** —
  the file the user's agent reads when they author their wiki is
  unrelated to "how do I edit this plugin's code." Different audiences,
  different files.
- **Cross-harness drift** — `CLAUDE.md`, `GEMINI.md`, and any other
  per-harness prompts should ideally express the same intent. Drift
  means agents under different harnesses do different things.
