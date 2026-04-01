# Contributing

This guide explains how to contribute effectively to this repository: workflow, review expectations, house style, and documentation conventions. `CONTRIBUTING.md` owns contributor workflow and conventions, `AGENTS.md` provides agent-specific guardrails, and `docs/architecture.md` defines architecture invariants when they exist.

## Principles for changes

- Keep changes small, scoped, and reversible.
- Prefer local reasoning and existing patterns before adding new abstractions.
- Treat docs as part of the change when behavior or contracts shift.
- Use `docs/architecture.md` as the canonical contract for architecture invariants.

### Scope and tidy policy

- Tidy passes are allowed when they are local to the files you touch.
- Avoid large repo-wide reordering unless the change is intentionally a tidy-only PR.
- Avoid renaming or moving files unless required for the change.

## Development workflow

- Start from a focused task and avoid mixing unrelated refactors.
- Follow the nearest existing pattern in the area you are changing.
- Run local validation from the repo root:

```sh
bun run typecheck
bun test
bun run format
```

- Add tests when behavior changes are regression-prone or non-trivial.
- For pull requests:
  - Keep diffs reviewable.
  - Describe what changed and which invariants might be impacted.
  - Include screenshots for visible UI changes.

## Review standards

Before requesting review:

- Validation commands pass.
- No architecture violations against `docs/architecture.md`.
- Conventions in this file are followed.
- Relevant docs are updated if contracts or behavior changed.
- Diff is scoped to the task and easy to review.
- The PR summary clearly states what changed and why.

PR checklist:

- What changed in one sentence?
- Which invariants were touched, if any?
- Which docs were updated?
- Which validation commands were run?

## Conventions

- Spelling: use American English in code and documentation.
- Naming: prefer descriptive names and keep terminology consistent within a feature.
- Constants MUST use `SCREAMING_SNAKE_CASE`.
- Imports:
  - use `import type` for type-only imports
  - group external imports, then one blank line, then internal imports
  - sort imports by module path alphabetically within each group
  - sort imported names alphabetically
- Exports:
  - prefer named exports
  - avoid default exports unless the existing file already uses them
  - avoid wildcard re-exports in public surfaces unless there is a clear reason
- Files:
  - prefer `kebab-case.ts` for TypeScript files
  - name files by responsibility, not implementation detail
  - avoid generic buckets such as `utils.ts`, `helpers.ts`, or `misc.ts` unless already established
- Functions:
  - exported functions SHOULD declare explicit return types
  - avoid boolean parameters in public functions when an options object is clearer
- Testing:
  - tests live in `test/` and use the `.test.ts` suffix
  - prefer small, focused tests and avoid duplicated helpers
- Docs:
  - keep sections short and scannable
  - link to authoritative docs instead of duplicating specs
  - if something is a technical must or must-not contract, it belongs in `docs/architecture.md`

## Canonical vocabulary

Canonical domain terms SHOULD be used consistently across code and documentation. Avoid inventing synonyms for the following concepts:

- authored input, chord symbol, canonical authored input
- piece, segment, event
- note, chord, rest
- duration, layer, offset
- pitch, pitch class, pitch range
- fifths-space, pitch-space
- harmony, evidence, region, slice
- field, center, grounding, root, ground
- projection, span
- graphic object, positioned graphic object
- rendering

## Change hygiene

- Do not mix functional changes with unrelated refactors.
- Do not document planned structure as if it already exists in the repo.
- Treat new or widened public surfaces as contract changes and document them when needed.

## Documentation conventions

- Update `docs/architecture.md` when architecture invariants or boundaries change.
- Keep documentation aligned with the codebase as it exists now, not with planned structure.
- Prefer concise docs that describe current behavior, constraints, and validation expectations.

## Appendix: Markdown formatting details

### Markdown structure and style

- Exactly one `#` title per document.
- Title followed by a 1-3 sentence scope paragraph.
- Document title MUST be Title Case.
- Section and subsection headings MUST be sentence case.
- Use unnumbered headings.
- Avoid headings deeper than `###`.
- Prefer short sections and lists.
- Prefer rules-first, rationale-second ordering.
- Use normative language consistently: MUST, MUST NOT, SHOULD, MAY.
- Code fences MUST specify language.

### Separators

- `---` MAY separate major sections when headings alone are not enough.
- Do not use `---` between routine sections.

### Label blocks

- Prefer label blocks for grouped lists.
- Common labels: `Rules:`, `Notes:`, `Examples:`, `Types:`.

### Inline code

Use backticks for:

- symbols (for example `createThing`)
- literal tokens
- CSS classes (for example `.app-shell`)
- file paths (for example `docs/architecture.md`)

### Code fence language mapping

- `ts` for TypeScript.
- `text` for trees, DOM shapes, and layouts.
- `sh` for commands.

### Lists and punctuation

- Use `-` for unordered lists and `1.` for ordered lists.
- Keep punctuation consistent within a list level.
- Sentence-style bullets SHOULD end with `.`.
- Inventory bullets may omit `.`.
- Use `:` when introducing a nested list.
- Use one blank line around lists and code fences.

### Tables

- Tables are allowed for structured comparisons.
- Keep tables simple and avoid large paragraphs inside cells.

### Markdown feature usage

- Avoid raw HTML.
- Avoid deeply nested blockquotes.
- Avoid embedding images in core technical docs.

### Links and references

- Prefer backticked repo paths for internal references.
- Use Markdown links for external references.

### Whitespace and typography

- One blank line after headings.
- One blank line around lists and code fences.
- No trailing spaces. No tabs.
- Prefer ASCII punctuation in technical docs.
