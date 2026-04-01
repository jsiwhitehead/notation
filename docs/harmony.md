# Harmony

This document defines the harmony stage as it exists in this repository. It takes canonical input, derives harmonic structure for each segment, and passes that structure to projection and rendering.

## Canonical input

In the current code, the harmony stage consumes a simple canonical input:

- `PieceInput`
- ordered `SegmentInput[]`
- `EventInput[]` inside each segment
- optional timed `chordSymbols` entries on each segment, each with `offset` and `symbol`
- optional `timeSignature` on each segment

`EventInput` currently covers:

- `note`
- `chord`
- `rest`

The canonical input contains authored input only:

- notes
- chord events
- rests
- durations
- optional local timing and layer organization
- optional segment-local meter declarations
- optional chord-symbol strings interpreted as local harmonic evidence
- optional timed chord-symbol changes interpreted as local harmonic evidence

The canonical input does not contain harmonic structure. Harmonic structure is derived by the harmony stage.

## Output contract

The stable harmony-stage output is harmonic structure. In the current code, that shape is `HarmonicStructure`, with one harmonic structure per input segment.

Each harmonic segment contains:

- `field`: a singular harmonic region in fifths-space that describes the broader local harmonic context
- `center`: a singular harmonic region in fifths-space that describes the immediate harmonic settlement
- `grounding`: optional grounding pair with `root` and `ground` that primarily orients the `center`
- `harmonicSlices`: one or more segment-local slice analyses, each carrying `startOffset`, `duration`, and a slice-local harmonic segment

`field` and `center` are represented as harmonic spans. These remain analysis-native harmonic objects rather than final renderer-facing pitch-space spans. Pitch-class collections are derived from those spans when needed for scoring, comparison, and coloring.

`center` and `field` are the same kind of object inferred at different scopes. In the simplest cases they may be identical.

`grounding` orients the `center` without reducing the result to a single chord symbol. `root` names the harmonic orientation within the `center`; `ground` names the actual supporting ground or bass orientation when it differs.

## Harmony principles

The harmony stage follows these principles:

- Preserve authored input and derive harmonic structure later.
- Treat chord symbols as local harmonic evidence for the current segment. In the current baseline, a chord symbol contributes local pitch classes and optional root/ground grounding.
- Prefer clear local evidence boundaries even when the current implementation uses simple merged evidence for some decisions.
- Settle local harmonic structure into a stable canonical form in fifths-space before any downstream pitch-space projection.
- Keep baseline region-shape validity and canonical pair-lane interpretation in the harmony stage rather than rediscovering them downstream.
- Derive harmonic structure rather than only a chord symbol.
- Use one fifths-space harmonic orientation for both `center` and `field`, while allowing local settlement and broader continuity to play different roles.
- Keep grounding explicit when it can be inferred, primarily at the `center` level.
- Fail gracefully: malformed chord symbols or weak harmonic evidence should not break the harmony stage.

Projection is the next stage after the harmony stage. It takes the analysis-native harmonic structure emitted here, including segment-local `harmonicSlices`, and organizes it into visible pitch-space for rendering.

`HarmonicSlice` is a segment-local timing object:

- `startOffset`
- `duration`
- `harmonic`

## Current implementation

The current harmony stage is local and deterministic. It derives each segment’s `center` from current-segment evidence and currently sets `field = center`. This section describes the current implementation, not a permanent architectural guarantee.

The current implementation proceeds as follows:

1. Collect event pitch-class evidence from notes and chord events.
2. Normalize optional timed chord symbols into committed chord-derived pitch-class sets plus optional root and ground grounding.
3. Combine event evidence and chord-derived evidence into one local duration-weighted harmonic evidence model for the segment or slice. Event pitch classes contribute their authored durations. Chord-symbol pitch classes contribute the duration that each active chord symbol covers.
4. Derive a local `center` from that local evidence as a span-based harmonic region.
5. Derive `grounding` for that `center` only from trusted chord-symbol grounding when available.
6. Set `field = center` for the current implementation.
7. If timed chord-symbol changes are present, use those authored change offsets as the segment-local harmonic slice boundaries. Otherwise, evaluate candidate intra-segment harmonic slice boundaries from authored onsets, preferring one unsplit segment unless a stronger single split clearly improves harmonic fit.
8. Emit the segment’s canonical harmonic structure in fifths-space.

`center` is therefore the immediate local settlement for a segment: a fifths-space region derived from the local notes available at that moment, including pitch classes contributed by the active chord symbol. In the current baseline, the harmony stage emits span-based regions directly and falls back through three levels when evidence is weak: full local evidence, subset-backed candidate selection, then singleton spans for the local evidence pitch classes. `field` currently mirrors `center`. Projection still repeats these span classes across the visible range and resolves join geometry between adjacent regions, but the harmony stage now owns the baseline region-shape decisions.

For the current baseline, each active chord symbol contributes one committed set of local pitch classes for the duration that it covers. Timed chord-symbol changes may therefore change the active local grounding and weighted evidence inside one segment when slice analysis splits that segment. When direct local evidence does not admit a valid center, any rescue search is performed over the full local evidence set rather than event-only subsets. Segment-level grounding is only emitted when one unambiguous timed chord symbol governs the segment-level evidence; otherwise slice-level grounding may still be present while segment-level grounding remains undefined. The harmony stage does not yet model a second level of chord-implied support such as a probable but defeasible fifth separate from committed chord-symbol content. Non-baseline shapes such as augmented and diminished collections are therefore handled by the current span-cover fallback and weighted candidate selection rather than by dedicated exception rules.
