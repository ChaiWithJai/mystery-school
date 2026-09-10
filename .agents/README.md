# Curated Addy Osmani skills

Source: https://github.com/addyosmani/agent-skills
Pinned commit: `6ca0cd7db39b41b1c37e26d335c507ee92382c6d`.

Four unmodified skills were installed using the Codex skill-installer helper:
frontend-ui-engineering, browser-testing-with-devtools,
observability-and-instrumentation, and doubt-driven-development.
Their three concrete reference dependencies and full MIT license are included.
`source-lock.json` records the exact files and SHA-256 hashes. Verify offline
with `npm run skills:verify`; update the pin, files and lock together in a PR.

The `.agents/skills` layout makes the skills project-local. Both machines get
the same reviewed instructions by checking out this branch; global skills and
MCP configuration are unchanged. Codex discovers these skills on the next turn
in this repository. Mentioned upstream personas, optional sibling skills and
Claude slash commands are not installed capabilities.

The root AGENTS.md maps the subset to our actual stack and delivery priorities.
This is an engineering toolkit, not a calculus curriculum or visual art direction.
Browser and telemetry evidence support the instructional contract; they do not
establish learner outcomes or prove that the experience is fluid or compelling.

Review caveats: illustrative snippets must be checked before copying. The
upstream dialog example does not itself implement its commented focus trap;
the accessibility reference's simplified large-text rule and `npx axe-core`
example are not our executable acceptance checks. No upstream shell command
or external model invocation runs as part of installation.
