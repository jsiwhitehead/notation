# Roadmap

This document lists the main open problems that still matter for the repository. It intentionally omits work that is already present in the current codebase and avoids vague items that do not identify a concrete next step.

## Canonical model and contracts

- define the first stable canonical-input contract for segments, events, layers, offsets, and durations
- define where piece-level metadata such as time-grid declarations, height hints, and global flags belongs
- define where authored structural guidance such as guides and blocks belongs without collapsing it into derived harmonic structure
- define stable serialization formats for canonical input, harmonic structure, and projection
- define how contract changes should be versioned and documented as the system grows
- validate that architectural boundaries remain intact as the system grows

## Harmony stage

- define when `field` should diverge from `center` and implement the first non-trivial field policy
- improve fallback grounding inference beyond the current chord-symbol-only grounding baseline
- add second-level implied harmonic support that is distinct from committed chord-symbol pitch classes
- define which harmony decisions stay local and which may use cross-segment context
- define when harmonic structure should be expressed in a shared piece-level orientation rather than only local orientation
- define the contract between local harmonic structure and larger-scale key or scale context
- define how harmony output should represent confidence, ambiguity, or multiple viable readings
- define how to choose among musically equivalent local harmonic orientations
- support multiple harmony-stage policies that preserve one output contract
- add guide-based and block-based harmonic interpretation without bypassing the harmony stage

## Projection

- add stronger register-selection policies that use motion and context rather than only current local heuristics
- define visible pitch-window and rest-anchor policy for sparse, extreme, or uneven material
- define how event shape, motion, and local support should influence projection without moving that logic back into harmony
- define `join` policy for ambiguous or partial continuations across slice and segment boundaries
- define clearer projection behavior for multiple layers or lines that need distinct but compatible treatment
- support alternate projection policies that still emit the same projection contract

## Rendering

- introduce one richer renderer while preserving the current renderer as a simple baseline
- add remaining rhythmic-detail rendering such as ties and grouped rests
- define a stronger harmonic color policy for role clarity and perceptual tuning
- support renderer overlays for grounding, guides, blocks, motion cues, and related analysis features
- support multiple renderers for different purposes such as analysis, publication, or experimentation
- support accessibility improvements and export-oriented rendering where useful

## Authored input and normalization

- choose the first first-class authored-input path beyond direct seed data
- define which authored guidance belongs above normalization and which belongs in canonical input
- support richer segment structure, multi-line or multi-layer input, and compact text authoring without pre-encoding harmonic structure
- add import and export adapters where they strengthen the canonical-model workflow
- support live-editable authoring workflows that target the same canonical model from multiple frontends

## Examples, corpus, and evaluation

- maintain a representative example corpus spanning short fragments and longer continuous pieces
- define success criteria for harmony behavior, projection behavior, and rendering legibility
- build side-by-side comparisons of authoring inputs, harmonic structures, projections, and renderings for the same material
- support fixture comparisons across alternate harmony, projection, or rendering policies
- add visual regression coverage for renderer behavior where the maintenance cost is justified
- add evaluation cases that specifically exercise weak evidence, ambiguity, and multiple viable readings
- add performance benchmarks for search-heavy or layout-heavy paths if project scale increases materially
