# Notation

Notation is a TypeScript project for harmonic analysis, projection, and music rendering using a custom notation system. It is currently organized as a staged pipeline from canonical authored input through harmonic settlement, projection, and rendering.

## Quickstart

```sh
bun install
bun run app
```

## Validation (run from repo root)

```sh
bun run typecheck
bun test
bun run format
```

## Repo map (at a glance)

- `src/`: TypeScript source files.
- `static/index.html`: app entry HTML.
- `static/styles.css`: app styles.
- `docs/`: focused architecture, stage, and authored-input docs.

## Key docs

- `docs/architecture.md`: canonical architecture and invariant contracts.
- `docs/authoring.md`: authored-input boundary and current authored chord-symbol model.
- `docs/engine.md`: harmonic-engine contract and current implementation.
- `docs/projection.md`: projection contract and current pitch-space organization.
- `docs/render.md`: rendering contract and current SVG renderer behavior.
- `CONTRIBUTING.md`: contributor workflow and review expectations.
- `AGENTS.md`: coding-agent guardrails for safe, repo-consistent changes.

## Common tasks (links-first)

- Understand system invariants: `docs/architecture.md`
- Understand authored-input boundaries: `docs/authoring.md`
- Understand harmonic analysis output: `docs/engine.md`
- Understand pitch-space projection: `docs/projection.md`
- Understand SVG rendering behavior: `docs/render.md`
- Check contributor workflow: `CONTRIBUTING.md`
- Check agent guardrails: `AGENTS.md`
