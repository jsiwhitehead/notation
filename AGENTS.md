# Agents

## Mission and boundaries

- Make minimal, correct, repo-consistent changes.
- Prefer the smallest viable diff and minimum necessary exploration.
- Do not refactor unless explicitly requested.
- Do not introduce style churn beyond local tidy passes.
- Do not invent new public APIs or contracts without explicit direction.

## Non-negotiables checklist

- Do not violate architecture invariants: `docs/architecture.md`.
- Follow contributor workflow and formatting conventions: `CONTRIBUTING.md`.
- Keep diffs small, scoped, and reviewable.
- Do not rename or move files unless required.
- Update the authoritative docs when behavior or contracts change.

## Before you change anything

- Find an existing local pattern in the nearest relevant file and follow it.
- Do not read all docs by default; open only what is needed for the task.
- Treat `docs/architecture.md` as the authoritative source for architecture invariants.
- Choose the smallest possible change that solves the task.
- If unsure, prefer existing rules and patterns over inventing new structure.

## After you change something

- Run the relevant subset of canonical validation commands from `CONTRIBUTING.md`.
- Run the full validation set only when required.
- Do not guess validation commands.
- Confirm no architecture invariant regressions against `docs/architecture.md`.
- Summarize the change, rationale, and risk areas.

## Tests policy

- Do not add new tests unless explicitly requested.
- If a fix is regression-prone, propose a focused test.

## Documentation update triggers

- Architecture invariants or boundaries changed: `docs/architecture.md`.
- Contributor workflow or conventions changed: `CONTRIBUTING.md`.

## Pointers

- `AGENTS.md`
- `CONTRIBUTING.md`
- `docs/architecture.md`
