# Music Notation Rendering Research

This document collects research from mature notation systems and related standards that inform this repository. It is a supporting companion to the core spec docs, not an authoritative spec for the codebase. The authoritative architectural contracts live in `docs/architecture.md`, `docs/authoring.md`, `docs/harmony.md`, `docs/projection.md`, and `docs/render.md`.

## Role in this repo

This document is most useful as:

- a record of lessons adopted from mature systems
- a reference for future renderer and layout work
- a place to capture useful downstream design guidance before it becomes part of the core spec
- a map of source systems and references worth consulting when the codebase grows

It should not act as a second architecture spec or a parallel roadmap.

## Adopted lessons already visible in the codebase

The following ideas are already meaningfully embodied, either fully or in clear direction, in the repository:

- musical meaning stays separate from visual realization
- shared temporal structure is part of the architectural backbone
- projection acts as an intermediate representation between analysis and rendering
- layout works on intermediate structures rather than drawing directly from raw musical input
- drawing happens after layout decisions are established
- paint order is explicit
- SMuFL metadata is used as a source of glyph vocabulary, metrics, and anchors
- attachment and ownership are made explicit where rendering should not rediscover them
- focused layout and rendering modules are preferred over one monolithic routine

These ideas belong in the core architecture docs once they become stable project commitments. This document exists to support and extend that architectural direction, especially for downstream visual work.

The current codebase centers that downstream architectural balance on `Projection` as the strongest intermediate musical representation between analysis and rendering. Future work may introduce richer graphic or layout-side structures, but the value of the mature-system lessons collected here is in helping that evolution clarify stage boundaries rather than blur them.

## Reference architectural pattern

One robust reference pattern for notation systems is:

`music -> graphic objects -> positioned graphic objects -> rendered output`

In architectural terms:

1. **Semantic model**
   What the music is: notes, rests, durations, voices, tuplets, attachments, grouping, ownership.
2. **Graphic model**
   What visual notation objects exist: noteheads, stems, beams, rests, modifiers, spanners, text, anchors, extents, collision shapes.
3. **Layout system**
   How graphic objects become positioned graphic objects.
4. **Output layer**
   How positioned graphic objects are rendered or exported.

This pattern is a useful reference model for downstream design. It is not, by itself, the spec of this repository.

## Future downstream guidance

The following sections are primarily guidance for rendering and layout work that is not yet fully embodied in the codebase.

### Architecture

- layout works on a dedicated graphic representation, not directly on the semantic model.
- horizontal layout is organized around shared temporal structure.
- layout decisions are dependency-ordered.
- spacing, collision, alignment, and attachment are shared infrastructure, not per-symbol hacks.

### Design direction

- use focused layout modules rather than one monolithic layout routine.
- build spacing around shared time positions before local symbol placement.
- centralize layout infrastructure.
- use SMuFL as the default source of glyph vocabulary, metrics, and anchors, and add project-specific engraving data only where needed.
- make attachment ownership explicit.
- use scoring or bounded iterative refinement for hard local geometry such as beam slope and slur shape.
- treat system breaking, page breaking, and vertical justification as layout modules, not renderer behavior.

### Engineering principles

- use metadata-based measurement rather than DOM measurement.
- keep one internal engraving unit and convert at the output boundary.
- define one uniform collision contract early.
- treat SMuFL as an input foundation, not as the internal architecture.
- keep paint order explicit.
- test visual behavior, not just data flow.

## Open design choices

The following questions remain open design choices rather than fixed architectural commitments:

- exact spacing formula
- lazy versus eager evaluation
- exact collision geometry representation
- how explicit the internal graphic model should be
- how much layout happens in one stage versus several tightly cooperating stages

Those choices should sit behind stable interfaces.

## Critical contract

The main architectural risk is failing to establish a clean contract between semantic ownership, shared time structure, vertical reference, attachment behavior, and late collision-aware shaping.

## Reference model for downstream visual stages

The following sections describe a reference model for graphic representation and layout drawn from mature systems.

Use them as:

- design guidance for future work
- evaluation criteria for downstream visual architecture
- reference material to compare against the core spec docs

They are not, by themselves, normative contracts for this repository unless the core architecture docs adopt them explicitly.

### Graphic model

The graphic model is the intermediate engraved representation. It should be explicit enough that layout modules work on shared objects rather than on assumptions in rendering.

### Object families

- **Core glyph objects**
  Noteheads, rests, flags, accidentals, dots, articulation glyphs, dynamic glyphs.
- **Core note/rest objects**
  A note or rest plus its base geometry and ownership.
- **Modifier groups**
  Left, right, above, or below attachments whose widths and collisions affect spacing.
- **Beam groups**
  Rhythmic groups with shared beam geometry and final stem-tip positions.
- **Spanners**
  Ties, slurs, tuplets, hairpins, and related across-time objects.
- **Collision geometry**
  Bounding boxes initially, with a path to profile or skyline geometry later.

### Rules

- noteheads are the core graphic object for pitched events.
- stems, flags, beams, dots, accidentals, and articulations attach to note geometry rather than inventing their own local reference frames.
- all graphic objects that participate in layout SHOULD expose measurement and collision geometry through a uniform contract.
- all attachment-bearing objects SHOULD know what they are attached to.

### Measurement

Measurement SHOULD be metadata-based:

- use SMuFL glyph metrics and anchors as the default authoritative source.
- keep all engraving geometry in staff-space units internally.
- convert to SVG or px only at the output boundary.

Reuse SMuFL wherever it already solves the problem, and add only the extra project-specific metrics or anchors it does not provide. Internally, layout SHOULD depend on authoritative measurement data rather than runtime guesswork.

## Reference layout system

This is where most complexity lives.

Structure:

- **layout modules**
  Feature-specific decision logic.
- **shared layout services**
  Reusable infrastructure used by many modules.

### Shared layout services

These SHOULD be first-class from the start:

- temporal grouping.
- measurement.
- spacing.
- collision and clearance.
- alignment.
- attachment and anchoring.
- line and page breaking.
- staff and system spacing.
- policy/default lookup.
- candidate scoring or iterative refinement helpers.

### Dependency order

Use this dependency order:

1. rhythmic grouping and shared temporal structure
2. core note/chord/rest shaping
3. stem geometry
4. beam grouping and beam slope
5. modifier measurement and stacking
6. horizontal spacing
7. spanner shaping
8. collision and clearance adjustment
9. text, dynamics, and late outside-object positioning
10. line breaking, system breaking, and page breaking
11. staff and system spacing, vertical justification, and final page layout
12. drawing/export

Treat this as a dependency graph, not as a rigid implementation recipe.

### Modules

Noteheads:

- choose glyph by duration and head style.
- resolve seconds via displacement.
- allow unison sharing only under strict conditions.
- expose anchors and base extents for downstream modules.

Stems:

- stems are deterministic where possible.
- multi-voice stem direction conventions are effectively standard.
- stem attachment SHOULD come from notehead anchor data.
- stem geometry MUST be stable enough for beams and flags to consume.

Flags:

- flags are downstream stem attachments.
- when a beam is present, the beam replaces the flag as the duration marker.

Beams:

- treat beaming as a dedicated layout module over pre-grouped rhythmic structure.
- beam slope is best handled by candidate evaluation with penalties or another bounded search method.
- beam policy SHOULD be configurable.
  Group boundaries, rests-in-beams, flat beams, knee threshold, slope limits, style toggles.

Multi-voice and polyphony:

- solve polyphony across shared time positions, not voice-by-voice in isolation.
- stem direction, notehead sharing/displacement, and rest displacement all belong here.
- this module feeds widths and collision geometry back into spacing.

Rests:

- rests are full graphic objects with their own placement rules.
- whole and half rests keep distinct visual behavior even outside standard staff assumptions.
- multi-voice rest placement MUST consider occupied voice geometry.

Modifier placement:

This includes accidentals, dots, articulations, and similar attached symbols.

- accidentals are a left-side stacking problem and MUST be solved before final spacing.
- dots are right-side modifiers positioned by attachment plus space-occupancy rules.
- articulations start as attached modifiers and MAY promote into outside-object stacking.

Spanners:

This includes ties, slurs, tuplets, and hairpins.

- spanners SHOULD be attached semantically early and shaped graphically late.
- ties and slurs are best treated as one architectural family.
- tuplets are rhythmic spanners whose geometry depends on grouping and beam context.
- dynamics and hairpins belong to the same late outside-object family.

Horizontal spacing:

This is a shared global problem, not a local note problem.

Structure:

1. group events by shared rhythmic position
2. measure core objects and required attachments
3. compute minimum legal distances
4. distribute additional space by duration-sensitive rules
5. keep the formula replaceable

The architecture is clear; the exact math is not.

Collision handling:

Two rules matter most:

- every engravable SHOULD obey one collision contract.
- collision handling SHOULD be shareable across all modules.

Start with bounding boxes if needed, but design the contract so skyline or profile geometry can be introduced without rewriting the rest of the system.

Breaks and justification:

- line breaking, system breaking, and page breaking are part of layout, not output.
- break decisions SHOULD operate on already-measured systems rather than raw semantic events.
- vertical spacing and justification SHOULD be solved after local engraving geometry is stable.
- manual or encoded breaks SHOULD enter as constraints on the breaking stage, not as renderer exceptions.

## System-specific downstream adaptations

This system is not using a conventional staff as its primary vertical frame. SMuFL SHOULD still provide the default glyph vocabulary, metrics, and anchors wherever those map cleanly onto this system. Vertical reference, rest placement, and attachment behavior SHOULD be defined against the local pitch-space model rather than inherited from staff-middle assumptions.

- **Staff-space unit**
  Use one consistent internal engraving unit and map it from pitch-row space.
- **Stem direction reference**
  Replace staff-middle logic with a stable vertical reference for the visible pitch field.
- **Rest positioning**
  Preserve whole/half rest visual distinction, but map placement relative to the local pitch-space frame.
- **Dot positioning**
  Keep the dots-in-spaces rule, adapted to the pitch-row grid.
- **Attachment semantics**
  Build a strong attachment language early.
  Notes, pitch rows, rhythmic groups, harmonic spans, and segment subdivisions should all be possible anchors.
- **Import/export boundary**
  Keep a clean distinction between notation-as-semantics and notation-as-appearance so future interchange does not require architectural surgery.

## Reference systems and sources

### Core mature systems

- VexFlow
  Repo: [github.com/0xfe/vexflow](https://github.com/0xfe/vexflow)
  Docs: [vexflow.github.io](https://vexflow.github.io/)
  `src/formatter.ts`, `src/tickcontext.ts`, `src/modifiercontext.ts`, `src/beam.ts`, `src/stem.ts`, `src/accidental.ts`, `src/dot.ts`, `src/curve.ts`, `src/tuplet.ts`
- LilyPond
  Repo: [gitlab.com/lilypond/lilypond](https://gitlab.com/lilypond/lilypond)
  Docs: [lilypond.org](https://lilypond.org/)
  `lily/beam.cc`, `lily/beam-quanting.cc`, `lily/stem.cc`, `lily/note-collision.cc`, `lily/slur.cc`, `lily/slur-scoring.cc`, `lily/spacing-options.cc`, `lily/spacing-spanner.cc`, `lily/skyline.cc`, `lily/rest-collision.cc`, `lily/tuplet-bracket.cc`
- Verovio
  Repo: [github.com/rism-digital/verovio](https://github.com/rism-digital/verovio)
  Docs: [book.verovio.org](https://book.verovio.org/)
  `src/beam.cpp`, `src/stem.cpp`, `src/tie.cpp`, `src/slur.cpp`, `src/accid.cpp`, `src/dot.cpp`, `src/horizontalaligner.cpp`, `src/rest.cpp`, `src/tuplet.cpp`
- MuseScore
  Repo: [github.com/musescore/MuseScore](https://github.com/musescore/MuseScore)
  Site: [musescore.org](https://musescore.org/)
  `src/engraving/`, `src/notation/`, MuseScore 4.0 and 4.4 engraving notes
- GUIDOLib
  Repo: [github.com/grame-cncm/guidolib](https://github.com/grame-cncm/guidolib)
  Site: [guido.grame.fr](https://guido.grame.fr/)
  AR/GR architecture and layout model

### Standards and adjacent references

- SMuFL specification
  Spec: [w3c.github.io/smufl/latest](https://w3c.github.io/smufl/latest/)
- Bravura metadata
  Repo: [github.com/steinbergmedia/bravura](https://github.com/steinbergmedia/bravura)
- MEI
  Site: [music-encoding.org](https://music-encoding.org/)
  Repo: [github.com/music-encoding/music-encoding](https://github.com/music-encoding/music-encoding)
- MNX / W3C Music Notation Community Group
  Group: [w3.org/community/music-notation](https://www.w3.org/community/music-notation/)
  Spec: [w3c.github.io/mnx](https://w3c.github.io/mnx/)
- OpenSheetMusicDisplay
  Repo: [github.com/opensheetmusicdisplay/opensheetmusicdisplay](https://github.com/opensheetmusicdisplay/opensheetmusicdisplay)
  Site: [opensheetmusicdisplay.github.io](https://opensheetmusicdisplay.github.io/)
- abcjs
  Repo: [github.com/paulrosen/abcjs](https://github.com/paulrosen/abcjs)
  Site: [abcjs.net](https://abcjs.net/)
- abc2svg / abcm2ps
  abc2svg: [chiselapp.com/user/moinejf/repository/abc2svg](https://chiselapp.com/user/moinejf/repository/abc2svg/)
  abcm2ps: [moinejf.free.fr](https://moinejf.free.fr/)
- Lomse
  Repo: [github.com/lenmus/lomse](https://github.com/lenmus/lomse)
  Site: [lomse.org](https://www.lomse.org/)

## License note

Safe pattern:

- learn from all sources.
- reimplement clean-room.
- do not copy GPL code.
- Bravura embedding is possible under OFL compliance.
