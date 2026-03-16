# Authoring

This document defines the authored-input side of the system as it exists in this repository: the normalization boundary and the kinds of authored guidance that belong on the authored side of that boundary.

## Architectural rule

The authored input language remains open so long as it normalizes into the canonical input consumed by the harmonic engine.

`docs/engine.md` is authoritative for the current canonical input contract consumed by the engine.

In the current repository, authored input is represented directly in canonical-input form. Richer authored forms remain open so long as they normalize into the same contract.

## Overview of authored input approaches

Earlier codebases explored three broad authored-input approaches above the same normalization boundary.

- text-first input, where a compact symbolic score language describes segment-like spans, harmonic guidance, notes, simultaneities, rests, and light octave marking
- structure-first input, where direct objects or arrays describe segments, events, durations, notes, rests, and optional harmonic guidance
- evidence-first input, where recent note material over time is treated as the starting point for local harmonic settlement

All three fit the same architectural rule so long as they normalize into the canonical input consumed by the harmonic engine.

## Authored guidance

Authored input might contain:

- events only
- events plus harmonic guidance
- stronger structural aids such as authored block cues
- piece-level metadata such as coarse time-grid declarations, height hints, or global bias flags

These are all authored guidance rather than harmonic structure.
