# Authoring

This document defines the authored-input side of the system: what belongs before normalization, what normalization must produce, and where the boundary between authoring and derived harmonic structure lies.

## Authoring boundary

Authoring is the stage before harmonic analysis.

It includes musical material and authored guidance supplied by a user, importer, or upstream tool. It does not include derived harmonic structure. The output of authoring is canonical authored input, which is the input contract consumed by the harmony stage.

`docs/harmony.md` defines the canonical authored input consumed here.

In code, that normalized representation is `PieceInput`.

## Principles

Authoring follows these principles:

- authored input remains separate from derived harmonic structure
- the authored input language may vary so long as it normalizes into canonical authored input
- normalization preserves authored musical intent without collapsing it into downstream analysis
- authored harmonic cues such as chord symbols remain authored evidence rather than derived harmony
- richer authored guidance may exist above normalization without becoming part of harmony-stage output

## Authored information

Authored input may contain:

- events only
- events plus chord symbols
- explicit durations and offsets
- local layer or line organization
- segment-local meter declarations
- stronger structural aids such as authored block cues
- piece-level metadata such as coarse time-grid declarations, height hints, or global bias flags

These belong on the authored side of the boundary so long as they remain authored information rather than derived harmonic analysis.

## Normalization contract

Normalization turns authored input into canonical authored input.

That normalized form:

- preserves authored notes, chords, rests, durations, offsets, and layer organization
- preserves authored chord symbols and their timing where present
- preserves authored meter declarations where present
- determines the segment structure required by downstream stages
- produces the stable musical input consumed by harmony
- does not inject derived harmonic structure

Normalization may be performed by different authoring paths, importers, or frontends. Those paths may differ in syntax or source format, but they share the same downstream contract.

Segment formation belongs to normalization. In the existing MusicXML import path, measures normalize into segments, but that is a normalization policy rather than the general definition of authoring.

In the existing MusicXML normalization path, import also:

- maps MusicXML voices into event layers
- preserves authored meter where available
- normalizes harmony elements into timed chord symbol strings
- merges multiple parts measure-by-measure into shared segment input
- merges and de-duplicates timed chord symbols across parts at matching offsets

## Authoring paths

The system may support multiple authored-input paths above the same normalization boundary.

Those paths may include:

- text-first input
- structure-first input
- imported external score formats
- live-editable authoring frontends

The architectural rule is not that one path is privileged. The rule is that each path must normalize into the same canonical authored input contract.

The repository already includes imported score input through MusicXML. That importer is one normalization path, not the architectural definition of authoring itself.

## Boundary

Authoring remains upstream of harmonic structure. It provides musical input and authored guidance, not derived analysis.

It does not:

- derive `center`, `field`, `grounding`, or `harmonicSlices`
- express harmonic analysis as if it were authored source material
- bypass the harmony stage with renderer-facing harmonic structure
