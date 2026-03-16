# Engine

This document defines the harmonic engine as it exists in this repository. It takes canonical musical input, settles per-segment canonical harmonic structure, and produces the bounded harmonic field used by downstream placement and rendering.

## Canonical input

The engine consumes a simple canonical input model:

- `PieceInput`
- ordered `SegmentInput[]`
- `EventInput[]` inside each segment
- optional `harmonyHint` string on each segment

`EventInput` currently covers:

- `note`
- `chord`
- `rest`

The input model preserves authored facts only:

- notes
- simultaneities
- rests
- durations
- optional local timing and layer organization
- optional harmonic hint strings

The input model does not contain derived harmonic structure. Harmony is settled by the engine, not pre-encoded in the input.

## Output contract

The engine emits `HarmonicOutput`, whose `segments` array contains one harmonic result per input segment.

Each harmonic segment contains:

- `regions`: zero or more non-wrapping principal harmonic regions for the segment
- `core`: structurally central pitch classes
- `grounding`: optional grounding pair with `root` and `base`

`regions` define the bounded harmonic field of the segment. Each region is emitted as a simple non-wrapping span with `start <= end`.

`core` names the structurally central pitch classes within that field.

`grounding` orients that field without reducing the result to a single symbolic chord label.

## Engine principles

The engine follows these core principles:

- Preserve authored facts and derive harmonic structure later.
- Treat harmonic hints as evidence, not authority.
- Keep event evidence and hint evidence distinct internally for as long as practical.
- Settle local harmonic structure into a stable canonical form.
- Derive a bounded harmonic field rather than only a symbolic chord label.
- Distinguish the field itself from the structurally central material within it.
- Keep grounding explicit when it can be inferred.
- Fail gracefully: malformed hints or weak evidence should not break analysis.

## Current process

The current engine is local and deterministic. It analyzes each segment independently. This section describes the current implementation flow, not a permanent algorithmic guarantee.

For each segment:

1. Collect event-derived pitch-class evidence from notes and simultaneities.
2. Normalize the optional harmonic hint into hint-derived pitch-class evidence plus optional root and bass grounding.
3. Choose region evidence, preferring event evidence when events are present and falling back to hint evidence otherwise.
4. Derive a small set of non-wrapping harmonic regions from the chosen region evidence.
5. Derive `core` material from event evidence first, using hint evidence as support.
6. Derive `grounding` from trusted hint grounding when possible, otherwise use a simple region-based fallback.
7. Emit the segment’s canonical harmonic structure.

## Open areas

The following parts of the engine remain intentionally open to refinement:

- the exact region-derivation algorithm
- the exact `core` selection heuristic
- fallback `grounding` inference when hints are weak or absent
- how much special-case handling to give augmented-like or diminished-like collections
- how to choose among musically equivalent local field orientations or realizations
- whether implied support such as probable fifth completion should be added
- whether contextual enrichment across neighboring segments should be introduced later

These are analysis-policy choices rather than fixed architectural truths.

Earlier codebases explored richer variants in these areas, including:

- stronger separation of notes, chord-note content, melody, root, and base
- stronger chord-hint expansion with implied tones and probable fifth support
- block- and guide-based fields rather than only region-style ones
- contextual passes using neighboring segments
- special handling for augmented-like and diminished-like collections

Durable lessons from those experiments:

- preserve evidence-source distinctions
- treat hints as evidence rather than authority
- output a spatial harmonic field rather than a display label
- distinguish central from peripheral harmonic material
- keep grounding explicit
