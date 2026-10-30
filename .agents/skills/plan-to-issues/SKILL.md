---
name: plan-to-issues
description: Split this repo's plan.md into GitHub issues with gh, one per unit of work, after a human has reviewed the split. Use when a plan is ready and has no issues yet.
---

# plan-to-issues

Turns `plan.md` into GitHub issues that workers can pick up cold. Easiest with `gh`, authenticated,
in a shell this agent can run.

## Steps

1. Read `plan.md`, `AGENTS.md` and `docs/adr/`.
2. Draft the split as a table: title · plan section · scope · done when · blocked by.
   One issue per unit of work.
3. **Stop and show the table to the human.** Publish nothing until they approve it.
4. Every issue carries the shape in **Issue shape** below. Ask the human only if they want
   something added or changed for this plan.
5. Create the plan's label if it doesn't exist yet (`gh label create plan:<plan>`), then each
   issue in dependency order, so blocked-by can cite real numbers:

   ```sh
   gh issue create --title "<title>" --label plan:<plan> --body-file <tmp.md>
   ```

6. Record every issue URL from gh's output (not from memory) and reply with the list.

## Issue shape

Label: `plan:<plan>`, the `plan:` value from `plan.md`'s frontmatter (e.g. `plan:morning-digest`).
Reviewers sort by it. Body:

```md
Source: plan.md § <n>

## Scope
<what to build, in the plan's words; the files it lives in>

## Done when
<the plan's "Done when", checkable>

## Blocked by
<#n, or "none">

## Worker
<suggested model: strongest for logic, cheaper for views and tests>
```

`Source:` is the first line, with the plan's own section number (`§ 1`, `§ 2a`). When one
section becomes two issues, both carry that section's number.

## Closing

Close an issue only when its "Done when" holds, with the closing comment from AGENTS.md:

```sh
gh issue close <n> -c "<closing comment>"
```

When "Done when" depends on a person (a reviewer looking, an owner signing off), sending them
the thing is not done. The issue stays open until they answer, and anything blocked by it waits.

## No `gh`

Steps 1–4 hold either way. GitHub reachable another way (a connector, the REST API, the web UI):
the same issues, made that way. GitHub issues out of reach altogether: write them as files in
`docs/issues/`, format in ADR 0004, then commit and push.

## Don'ts

- Don't paste the whole plan into one issue, and don't keep issues only in chat.
- Don't invent sections the plan doesn't have. If the plan is unclear, ask.
