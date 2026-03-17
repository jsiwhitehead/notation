# Authoring

This document defines the authored-input side of the system as it exists in this repository: the normalization boundary and the kinds of authored inputs that belong on the authored side of that boundary.

## Principles

The authored input language remains open so long as it normalizes into the canonical input consumed by the harmonic engine.

`docs/engine.md` is authoritative for the current canonical input contract consumed by the engine.

The harmonic engine is the next stage after authored input normalization. Authoring remains upstream of harmonic structure and does not contain derived harmonic analysis.

## Authored inputs

Authored input might contain:

- events only
- events plus chord symbols
- stronger structural aids such as authored block cues
- piece-level metadata such as coarse time-grid declarations, height hints, or global bias flags

These are all authored inputs rather than harmonic structure.

## Current implementation

This section describes the current authored-input state in the repository. It is an implementation note, not a permanent architectural guarantee.

In the current repository, authored input is represented directly in canonical-input form.

## Explored approaches

Earlier codebases explored three broad authored-input approaches above the same normalization boundary:

- text-first input, where a compact symbolic score language describes segment-like spans, chord symbols, notes, simultaneities, rests, and light octave marking
- structure-first input, where direct objects or arrays describe segments, events, durations, notes, rests, and optional chord symbols
- evidence-first input, where recent note material over time is treated as the starting point for local harmonic settlement

All three fit the same architectural rule so long as they normalize into the canonical input consumed by the harmonic engine.
