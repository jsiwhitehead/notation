# Roadmap

This document describes the main forward-looking work for the repository. It intentionally focuses on open next steps rather than repeating behavior that already exists in the current codebase.

## Canonical model and contracts

- refine the canonical input beyond its current minimal shape
- strengthen contracts for segment structure, duration, offsets, and layers
- define where piece-level metadata such as time-grid declarations, height hints, or global bias flags belongs
- define where authored structural guidance such as block cues or guide cues belongs
- define stable serialization and interchange formats for canonical input, harmonic structure, and projection
- define how contract changes should be versioned and documented as the system grows
- validate that architectural boundaries remain intact as the system grows

## Harmonic engine

- strengthen field derivation beyond the current basic neighboring-center continuity
- improve fallback grounding inference beyond the current simple center-based fallback
- define and support implied harmonic support such as probable-fifth and other implied-tone logic
- define the boundary between engine inference, projection behavior, and contextual analysis across segments
- define when harmonic structure should be expressed in a shared piece-level orientation versus purely local orientation
- define the contract between local harmonic structure and larger-scale key or scale context
- strengthen separation of harmonic evidence kinds within engine inference
- support second-level chord-implied pitch classes separate from committed chord-symbol pitch classes
- add guide-based or block-based harmonic-structure interpretations
- support more musically convincing handling of augmented-like and diminished-like collections
- define how to choose among musically equivalent local harmonic orientations
- define how harmonic structure should represent confidence, ambiguity, or multiple viable readings
- support multiple engine policies and richer harmonic-orientation descriptions on the same canonical input and harmonic structure

## Projection

- define and implement stronger register-selection and motion-aware projection policies
- improve defaults for sparse or rest-heavy segments beyond the current basic rest and range heuristics
- refine visible pitch-window and pitch-bound selection policies
- strengthen the connection between harmonic structure and event shape in projection
- refine cross-segment span alignment and join logic for harmonic shapes and boundaries
- define how root, ground, guides, blocks, and motion cues should participate in projection
- support a stronger treatment of multiple layers
- support clearer treatment of simultaneity across multiple lines or hands
- support alternate projection policies for different renderings
- support pluggable projection strategies that still emit the same projection contract

## Rendering

- preserve the current simple renderer as a baseline while introducing one richer rendering
- refine current cross-segment harmonic-shape rendering and join styling
- expand current note and rest rendering toward fuller notation-like glyph treatment
- add fuller rhythmic-detail rendering such as stems, dots, beams, ties, and grouped rests
- refine the harmonic color system for role clarity and perceptual tuning
- define a durable rendering direction, including continuity policy, repetition policy, visual-detail level, and visual-channel assignments
- support renderer overlays for analysis features such as grounding, guides, blocks, and motion cues
- support multiple renderer implementations and multiple renderings of the same projection
- support interactive overlays and analysis views
- support accessibility and legibility in different display contexts
- support export-oriented renderers for publication or interchange

## Authored input and normalization

- formalize and implement one or more first-class normalization paths into canonical input
- define which authored guidance belongs in canonical input and which belongs above normalization
- support richer segment structure without pre-encoding harmonic structure
- preserve the distinction between authored guidance and derived results
- choose which authored-input path should become first-class after direct seed data
- support piece-level metadata such as time-grid declarations, height hints, and global flags where justified
- support multi-line or multi-layer authored input that still normalizes cleanly
- add compact text parsing, richer event grouping, lightweight octave notation, and stronger authored guidance where appropriate
- support import/export adapters
- support live-editable authoring interfaces and multiple authoring frontends targeting the same canonical model
- support evidence-first or rolling-input workflows where they can normalize into the same contract

## Examples, corpus, and evaluation

- collect representative fragments and longer continuous pieces that exercise the intended notation language
- preserve successful examples in a maintained corpus
- expand the current fixture set across representative musical cases
- add side-by-side fixture comparisons across engine policies
- build side-by-side examples that compare authoring inputs, harmonic structures, projections, and rendered outputs
- formalize success criteria for engine behavior, projection behavior, and rendering legibility
- add confidence checks for ambiguous or weakly evidenced material
- support visual regression snapshots for renderer work where useful
- support comparative examples across multiple engine or renderer policies
- support benchmark examples for performance-sensitive paths if the project grows in scale
