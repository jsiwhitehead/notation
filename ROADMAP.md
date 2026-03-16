# Roadmap

This document describes the main work ahead for the repository. It is intentionally forward-looking: it focuses on sequencing and open directions rather than the current architectural contract.

## Canonical model and contracts

This section covers the shared models and contracts that connect authored input, the harmonic engine, placement, and rendering.

- refine the canonical input beyond its current minimal shape
- define stronger contracts for segment structure, duration, offsets, and layers
- define the placement contract more explicitly so multiple placement policies can target the same shape
- define which renderer-facing concepts belong in placement versus rendering-only code
- define where piece-level metadata such as time-grid declarations, height hints, or global bias flags belongs
- define where authored structural guidance such as block cues or guide cues belongs
- define stable serialization and interchange formats for canonical input, harmonic structure, and placement
- define how contract changes should be versioned and documented as the system grows
- validate that architectural boundaries remain intact as the system grows

## Harmonic engine

This section covers harmonic engine behavior.

- refine region derivation
- refine center selection
- improve fallback grounding inference
- define how implied harmonic support such as probable fifth completion should appear
- define the boundary between engine inference, placement behavior, and contextual analysis across segments
- define when harmonic structure should be expressed in a shared piece-level orientation versus purely local orientation
- define the contract between local harmonic structure and larger-scale key or scale context
- strengthen separation of harmonic evidence kinds
- add implied-tone and probable-fifth logic
- add guide-based or block-based harmonic-structure interpretations
- add circle-of-fifths-based harmonic-orientation ideas
- add contextual analysis across neighboring segments
- support more musically convincing handling of augmented-like and diminished-like collections
- define how to choose among musically equivalent local harmonic orientations
- define how harmonic structure should represent confidence, ambiguity, or multiple viable readings
- support multiple engine policies and richer harmonic-orientation descriptions on the same canonical input and harmonic structure

## Placement

This section covers placement behavior.

- add continuity-aware register selection
- add nearest-note or leading-aware placement behavior
- improve handling of cross-segment motion
- define how vertical or register placement should be chosen beyond explicitly authored pitch
- improve defaults for sparse or rest-heavy segments
- define the continuity policy for placement versus rendering-specific behavior
- define how visible pitch windows and pitch bounds should be chosen
- add range and bounds logic
- add melodic continuity and movement-aware note placement
- strengthen the connection between harmonic structure and event shape in placement
- add cross-segment alignment and curve logic for harmonic shapes and boundaries
- define how root, ground, guides, blocks, and motion cues should participate in placement
- support a stronger treatment of multiple layers
- support clearer treatment of simultaneity across multiple lines or hands
- support alternate placement policies for different renderings
- support pluggable placement strategies that still emit the same placement contract

## Rendering

This section covers rendering.

- separate renderer concerns from placement concerns more sharply where needed
- improve legibility of duration, rests, harmonic regions, center material, and grounding
- preserve the current simple renderer as a baseline while introducing one richer rendering
- add stronger cross-segment harmonic-shape rendering
- add more notation-like glyph rendering
- add fuller rhythmic-detail rendering such as stems, dots, beams, ties, and grouped rests
- add color systems derived from harmonic identity
- define a durable rendering direction from the current visual language and the main renderings
- define the boundary between placement continuity and visible continuity in rendering
- define the role of visible harmonic repetition in rendering
- define how much visual detail should be used for duration, rests, and harmonic structure
- define which visual channels belong to harmonic identity, function, confidence, or continuity
- support renderer overlays for analysis features such as grounding, guides, blocks, and motion cues
- support multiple renderings and renderer implementations sharing one placement
- support multiple renderings of the same placement
- support interactive overlays and analysis views
- support accessibility and legibility in different display contexts
- support export-oriented renderers for publication or interchange

## Authored input and normalization

This section covers authored input and normalization. This area intentionally follows engine, placement, and rendering work.

- define one or more first-class normalization paths into canonical input
- define which authored guidance belongs in canonical input and which belongs above normalization
- support richer segment structure without pre-encoding harmonic structure
- preserve the distinction between authored guidance and derived results
- define which authored-input path should become first-class after direct seed data
- support piece-level metadata such as time-grid declarations, height hints, and global flags where justified
- support multi-line or multi-layer authored input that still normalizes cleanly
- add compact text parsing and normalization
- add richer event grouping and lightweight octave notation
- add stronger authored guidance where appropriate
- define which authored-input ideas fit the current contract
- support import/export adapters
- support live-editable authoring interfaces and multiple authoring frontends targeting the same canonical model
- support evidence-first or rolling-input workflows where they can normalize into the same contract

## Examples, corpus, and evaluation

This section covers examples, comparisons, and evaluation material.

- collect representative fragments and longer continuous pieces that exercise the intended notation language
- preserve successful examples in a maintained corpus
- build fixture sets across representative musical cases
- add engine fixtures based on musically meaningful examples
- add side-by-side fixture comparisons across engine policies
- build side-by-side examples that compare authoring inputs, harmonic structures, placements, and rendered outputs
- define what counts as a successful result for engine behavior, placement behavior, and rendering legibility
- add confidence checks for ambiguous or weakly evidenced material
- support visual regression snapshots for renderer work where useful
- support comparative examples across multiple engine or renderer policies
- support benchmark examples for performance-sensitive paths if the project grows in scale
