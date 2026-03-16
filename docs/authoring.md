# Authoring

This document defines the authored-input side of the system: the main authored forms explored so far, the kinds of guidance they may contain, and the rule that they must normalize into the canonical input model used by the harmonic engine.

## Architectural rule

The authored input language remains open so long as it can be normalized into the canonical input model consumed by the harmonic engine.

`engine.md` is authoritative for the current canonical input contract consumed by the engine.

In the current repository, authored material is represented directly in that canonical model. Richer authored forms remain open so long as they normalize into the same contract.

## Authored input approaches

Previous iterations explored several authored input approaches above the same canonical input model.

One approach used a compact symbolic score language. A piece is entered as a sequence of usually bar-like segments, each with optional harmonic labeling followed by authored events. Single notes, grouped simultaneous notes, and explicit gaps are entered textually, with octave marked lightly rather than through full absolute pitch notation.

Another approach used direct structured data. The piece is already written as arrays or objects containing bars or segments, one or more lines of event material, durations, notes, rests, and optional harmonic hints. Some variants also included presentational conveniences such as pre-authored harmonic block hints.

A third approach used rolling note-stream input. The system receives recent note material over time and infers a sequence of local musical states from that stream. This is the sparsest authored form and shows that harmonic unification can begin from recent musical evidence alone.

Taken together, the archived codebases explored three broad authored styles:

- text-first input
- structure-first input
- evidence-first input

## Authored guidance

The earlier codebases also explored different balances of authored guidance.

Inputs might contain:

- event material only
- event material plus harmonic hints
- stronger structural aids such as authored block cues
- piece-level metadata such as coarse time-grid declarations, height hints, or global bias flags

These are all authored guidance rather than derived harmonic structure.
