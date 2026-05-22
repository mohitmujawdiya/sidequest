# CLAUDE.md

**Load the `deepspace` skill before working in this repo.** It is the source
of truth for the SDK — invoke it via the Skill tool first, then read project
source for repo-specific details. If the skill isn't loaded in your session,
see install below.

## About this project

This is a **DeepSpace** app — a real-time collaborative app built on the
[`deepspace`](https://www.npmjs.com/package/deepspace) SDK and deployed to
Cloudflare Workers via `npx deepspace deploy`.

## Install the DeepSpace skill

Run from this project's root:

```sh
# Default — installs into this project, works with any agent:
npx skills@latest add deepdotspace/deepspace-skill

# (Equivalent explicit URL form:)
# npx skills@latest add https://github.com/deepdotspace/deepspace-skill --skill deepspace
```

If you work on DeepSpace apps frequently, you can pin the skill to Claude Code
globally instead so it's available in every project:

```sh
npx skills@latest add deepdotspace/deepspace-skill -g --agent claude-code
```

Restart your agent session after install so it picks up the new skill.

## Fallback if the skill isn't available

If you can't install the skill, read the SKILL.md directly:

- <https://github.com/deepdotspace/deepspace-skill/blob/main/skills/deepspace/SKILL.md>

## Project commands

```sh
npx deepspace login        # authenticate with app.space
npx deepspace dev          # local dev server (vite + miniflare)
npx deepspace deploy       # deploy to <app>.app.space
npx deepspace add --list   # list optional features (messaging, etc.)
npx deepspace add <feature>
```

