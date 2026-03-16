# Architecture

This document captures the highest-level architecture of the system and the boundaries between its main stages.

The system is organized as a simple staged pipeline:

1. musical material is authored in some input form
2. that material is normalized into the canonical input model
3. the harmonic engine settles canonical harmonic structure from that input
4. the rendering stage places event material into that harmonic structure and projects the resulting musical object visibly

The architecture is built around three distinct concerns:

- authored input, which may vary in surface form but must normalize into the canonical input model
- harmonic analysis, which derives canonical harmonic structure from authored musical facts
- placement and rendering, which turn authored event material plus harmonic structure into visible output

The main architectural boundaries are:

- authored input remains separate from derived harmonic structure
- harmonic analysis remains separate from placement and projection
- placement remains separate from rendering

Detailed specifications live in the focused docs for each part of the system:

- [authoring.md](/Users/jon/Sites/notation/docs/authoring.md): authored-input approaches and the normalization boundary
- [engine.md](/Users/jon/Sites/notation/docs/engine.md): canonical harmonic-engine input, output, principles, and current process
- [render.md](/Users/jon/Sites/notation/docs/render.md): placement and rendering principles, current approach, and open areas
