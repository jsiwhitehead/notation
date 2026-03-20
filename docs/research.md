# Music Notation Rendering Research

Research into VexFlow, LilyPond, Verovio, MuseScore, GUIDOLib, and related systems and standards. Synthesised for application to this system's event rendering layer. Stave-specific conventions are noted where adaptation is required.

---

## Contents

1. [Architecture and Design Philosophy](#architecture-and-design-philosophy)
2. [Field Arc of Learning and Frontiers](#field-arc-of-learning-and-frontiers)
3. [Sources](#sources)
4. [SMuFL — The Universal Glyph Standard](#smufl--the-universal-glyph-standard)
5. [Noteheads](#noteheads)
6. [Stems](#stems)
7. [Flags](#flags)
8. [Beams](#beams)
9. [Multi-voice and Polyphony](#multi-voice-and-polyphony)
10. [Rests](#rests)
11. [Augmentation Dots](#augmentation-dots)
12. [Accidentals](#accidentals)
13. [Ties and Slurs](#ties-and-slurs)
14. [Tuplets](#tuplets)
15. [Horizontal Spacing](#horizontal-spacing)
16. [Articulations](#articulations)
17. [Dynamics](#dynamics)
18. [Key Constants Reference](#key-constants-reference)
19. [Testing, Performance, and Determinism](#testing-performance-and-determinism)
20. [Adaptation Notes for This System](#adaptation-notes-for-this-system)

---

## Architecture and Design Philosophy

This section synthesises the high-level structural patterns that consistently appear across all mature notation systems. These are the most transferable lessons — not algorithm specifics, but architectural commitments.

### The three-model separation

Every serious notation engine separates at least three concerns:

1. **Semantic model** — what the music *means*: pitches, durations, voices, phrasing intent
2. **Layout / engraving model** — how elements are positioned: glyphs, stems, beams, collision-avoided offsets, bounding boxes, anchors
3. **Drawing model** — actual output commands: SVG paths, canvas calls, PostScript

Layout objects are not semantic objects (they don't know what chord they represent), and they are not drawing commands (they don't know about SVG). The layout layer is the "engraved geometry."

| System       | Semantic model                      | Layout model                          | Drawing model        |
| ------------ | ----------------------------------- | ------------------------------------- | -------------------- |
| LilyPond     | Music expressions / contexts        | Grobs (graphical objects)             | Stencils             |
| Verovio      | MEI document tree                   | Positioned elements + functor results | SVG drawing functor  |
| VexFlow      | Notes / voices / stave items        | TickContexts / ModifierContexts       | SVG / Canvas context |
| GUIDO        | AR (Abstract Representation)        | GR (Graphic Representation)           | Drawing device       |
| This system  | Authored events + harmonic analysis | *[target: engraved geometry layer]*   | SVG renderer         |

Do not let render-time geometry leak backward into the musical model; do not let musical inference happen in the renderer.

### GUIDO: the AR→GR pattern

GUIDO makes the semantic/layout separation the explicit design principle. The Abstract Representation (AR) is a tree of score objects with musical semantics. The GR conversion produces a distinct tree of Graphic Representation objects with concrete positions, bounding boxes, and drawing instructions. Crucially the GR layer is a new data structure — not an in-place mutation of AR.

Mapping onto this system:
- **AR equivalent**: engine output (harmonic structure, events with pitch/duration/voice)
- **GR equivalent**: engraved events (glyph IDs, x/y positions, stem rects, beam polygons, anchors, collision shapes)
- **Drawing**: renderer consumes GR, emits SVG

### LilyPond: grobs and stencils

LilyPond's full pipeline:

1. **Music expressions** — pitches, durations, logical structure (Scheme data)
2. **Contexts** (Score → Staff → Voice) — hierarchical processing containers
3. **Engravers** — convert music expressions into graphical objects (grobs)
4. **Grobs** — layout objects with lazily-evaluated properties
5. **Stencils** — actual drawing instructions

Properties are computed via callbacks on demand. A stem's direction is only computed when requested, allowing later stages to influence earlier decisions without re-running the full pipeline. This lazy evaluation is key to managing interdependent layout decisions.

### Verovio: functor visitor passes

All layout passes are independent functors that traverse the object tree in sequence:

- `CalcStemFunctor` — stem directions and lengths
- `CalcBeamFunctor` — beam slopes and positions
- `CalcSlurFunctor` — slur control points
- `CalcAccidsFunctor` — accidental stacking
- `AdjustDotsFunctor` — dot vertical positioning
- `HorizontalAligner` — x-coordinate assignment
- `SpacingFunctor` — proportional spacing

Each functor is a single focused pass, easy to reason about in isolation and to reorder when needed.

### VexFlow: TickContexts and ModifierContexts

A **TickContext** groups all notes at the same beat position across all voices. Spacing is computed once per tick context, not per note. A **ModifierContext** groups all modifiers (accidentals, dots, articulations) for all notes at the same tick and formats them in a fixed sequence.

`Formatter.format()` phases:

1. `preFormat()` — calculate width for each tickable and its modifiers
2. `postFormat()` — position all contexts horizontally using softmax spacing
3. Apply final positions to stave elements

### Pass-based layout: the canonical order

All mature systems decompose layout into focused sequential passes. Each pass assumes prior passes are complete. The canonical dependency order:

1. **Rhythmic grouping** — identify beat groups, beam candidates, meter context
2. **Core note / chord / rest shaping** — choose notehead glyphs, stem direction, flag count
3. **Stem geometry** — compute lengths and attachment points via SMuFL anchors
4. **Beam grouping and slope** — compute beam polygons, adjust per-note stem tips
5. **Modifier measurement** — measure accidentals, dots, articulations; assign to columns
6. **Horizontal spacing** — assign x-positions using duration-proportional spacing + hard minima from modifier widths
7. **Tie / slur shaping** — initial control point placement
8. **Collision resolution** — adjust spanners, articulations, outside-staff items; stack as needed
9. **Text / dynamics** — position last (depend on everything else for clearance)
10. **Drawing** — consume completed layout objects, emit SVG

Step 5 (modifier measurement) must precede step 6 (spacing); step 6 must precede step 7 (spanners); everything must precede step 10. This ordering is a dependency DAG, not a convention.

### Candidate scoring for hard layout decisions

LilyPond's most transferable idea: for decisions where the right answer depends on many interacting constraints, **generate plausible candidates and score them** rather than encoding all rules as a deterministic if-else tree.

- **Beam slope**: both VexFlow (iterate slope values with a cost function) and LilyPond (penalty-weighted quantised position search) use this
- **Slur control points**: LilyPond scores slur configurations against penalties for collisions, staff-line proximity, and shape quality
- **Beam quantisation**: LilyPond avoids beams straddling staff lines by scoring positions against preferred types (inter, sit, hang, straddle)

Pattern: enumerate positions or slopes within a search range → compute an ugliness score for each → pick the minimum. The score encodes hard constraints (via high penalties) and soft preferences (via lower penalties). When you encounter an edge case, you add a new penalty term — not a new branch in an if-else tree.

### Layout objects data model

A robust engraved-geometry layer needs these object types:

**EngravedGlyph**
```ts
{ glyphName: string, codepoint: number, x: number, y: number, scale: number, bbox: Rect, anchors: SMuFLAnchors }
```
One drawn glyph — notehead, rest, accidental, flag, articulation. Position and size sourced from SMuFL metadata.

**NoteCore**
```ts
{ notehead: EngravedGlyph, stem?: StemRect, flag?: EngravedGlyph, voice: number, eventRef: EventId }
```
A notehead with its stem and optional flag. Position is fixed before modifiers are computed. Corresponds to VexFlow's "tickable" — the core positioned element that modifiers attach to.

**ModifierColumn**
```ts
{ side: 'left' | 'right' | 'above' | 'below', items: EngravedGlyph[], totalWidth: number }
```
Accidentals stack left; dots right; articulations above/below. Each column is measured before spacing runs so spacing can respect modifier widths.

**BeamGroup**
```ts
{ notes: NoteCore[], slope: number, yIntercept: number, beamLines: BeamLine[], perNoteStemTips: number[] }
```
Computed by the beam sub-engine after note positions are fixed. Contains the beam polygon(s) and per-note adjusted stem endpoints.

**Spanner**
```ts
{ type: 'tie' | 'slur' | 'hairpin', startRef: EventId, endRef: EventId, controlPoints: Point[], direction: 'above' | 'below' }
```
Curves with collision-adjusted control points. Computed last so the collision scan sees all notes, beams, and articulations.

**CollisionShape**
```ts
{ type: 'bbox' | 'skyline', bounds: Rect | SkylineProfile }
```
Every engraved object exports a collision shape. Start with bounding boxes; upgrade to skyline profiles when element density demands it.

### SVG layer ordering

Paint order, bottom-to-top (later elements visually on top):

1. Background, filled regions (harmonic spans)
2. Staff lines, ledger lines
3. Noteheads
4. Stems
5. Beams
6. Flags
7. Dots, accidentals, articulations
8. Ties, slurs — always above other note elements
9. Text labels, dynamics, chord symbols, annotations

### SVG precision and coordinates

VexFlow renders to 3 decimal places (`RENDER_PRECISION_PLACES = 3`). Coordinates use internal pen state (pen.x, pen.y) in screen coordinates (Y increases downward). Scaling via SVG `viewBox`, not CSS transforms. All paths use moveTo / lineTo / bezierCurveTo / arc primitives.

### Integration blueprint for this system

Two viable options for adding engraved event geometry:

**Option A — extend projection to emit engraved geometry (recommended if renderer stays thin)**

Projection already owns pitch-space placement. Extend it to also compute glyph IDs, stem rects, beam polygons, modifier columns, and collision shapes. Renderer becomes a thin "draw what you're given" layer. Mirrors the GUIDO AR→GR step.

*Trade-off:* engraving style parameters (font choice, beam policy, slope limits) become projection configuration. Clean architecture; projection grows.

**Option B — insert a dedicated engraving stage between projection and renderer**

Projection emits musical placements (pitch-row + time coordinates, voice assignments). A new engraving stage converts those to glyph geometry using SMuFL metadata and engraving defaults. Renderer remains thin.

*Trade-off:* an additional pipeline stage, but enables multiple renderers (SVG, canvas, PDF, interactive) consuming the same engraved output without re-engraving.

In both options, the engraving layer consumes event pitch-row positions, event durations and voices, and SMuFL metadata; and emits the layout object graph plus a layer-ordered draw list.

---

## Field Arc of Learning and Frontiers

### The arc: from approximate placement to principled layout

The clearest overall arc in digital notation: the field has moved from placing symbols at approximate positions toward encoding musical intent, deriving layout objects, and solving placement through a mixture of hard constraints and scored heuristics against a standardised glyph and metric system.

Key milestones:

1. **Shared glyph standards** — SMuFL established a universal vocabulary plus anchor metadata, ending the era of per-system font assumptions. MuseScore 4.6 added support for any SMuFL-compliant music font; Verovio, VexFlow, and OSMD all converged on Bravura/SMuFL.

2. **Cleaner architecture** — all mature systems converged on the three-model separation (semantic → layout → drawing). This was implicit in early systems; it is now explicit and enforced by module boundaries.

3. **Better collision and spacing models** — from ad hoc bounding-box checks to skyline profiles (LilyPond), shared modifier contexts (VexFlow), and iterative constraint solving (MuseScore). MuseScore 4.0 listed substantial improvements to beams, slurs, ties, horizontal spacing, and page layout as its flagship engraving improvements.

4. **Attachment semantics** — mature systems now track *what* a marking is attached to, at what rhythmic scope, and with what reflow behaviour. MuseScore 4.4 introduced arbitrary rhythmic anchor points: dynamics and text can attach to beat subdivisions and remain stable across layout changes. Earlier versions only supported note/rest attachment.

5. **Interoperability** — MusicXML, MEI, and now MNX have become part of the shared infrastructure. Verovio's importance is partly as a conversion hub (MEI, MusicXML, Humdrum, ABC → SVG). Interchange is no longer an afterthought.

### Seven key learnings

1. **Three-model separation is essential.** The harmonic/musical model must not become the glyph model; the glyph model must not become the SVG model.

2. **Standard glyph metadata is the single biggest quality lever.** Using SMuFL anchors and advance widths instead of guessed geometry is the difference between approximation and professional placement.

3. **Organise layout as focused passes.** Separating rhythmic grouping, note shaping, stem/beam geometry, modifier measurement, spacing, spanners, collision, and drawing is the strongest cross-system agreement. Ad hoc "do everything at once" approaches consistently produce fragile code.

4. **Use mixed strategies: rules + scored optimisation.** Use deterministic rules for things that are always the same (voice 1 stems up, dots in spaces). Use scored candidate search for things that depend on local context (beam slope, slur shape). LilyPond's ugliness scoring, VexFlow's slope cost function, and MuseScore's iterative slur adjustment are all expressions of the same insight.

5. **Collision handling needs shared infrastructure.** Once you have beams, rests, ties, articulations, and text, per-symbol collision hacks become unmaintainable. A skyline abstraction or at least reusable occupied-profile geometry is worth building early. LilyPond's skyline primitives are the most mature reference; VexFlow's modifier contexts are the most pragmatic starting point.

6. **Attachment semantics before you need them.** Knowing *what* a symbol is attached to, at what rhythmic granularity, and with what reflow behaviour is more important than the symbol's visual properties. Systems that didn't build this early had to do expensive retrofits.

7. **Manual overrides should sit on top of good defaults.** Improving defaults in MuseScore 4.0 invalidated old manual adjustments — exactly what happens when defaults were previously weak. Strong automatic placement first; store small user deltas relative to computed anchors.

### Active frontiers

**MNX interchange format** — the W3C Music Notation Community Group is still actively refining MNX. Core concepts like beaming semantics and full-measure rest representation are still being debated as of 2025–2026. The field has not fully converged on encoding engraving intent independently of appearance.

**Non-standard staves** — MEI explicitly supports notation beyond the five-line staff, but most engraving engines assume traditional staff geometry. How much of traditional engraving logic should remain invariant when the stave is custom is an open problem. This system is a direct example of this frontier.

**Beat-subdivision attachment** — MuseScore 4.4's arbitrary beat anchor points are a leading example of a still-evolving area. For a harmonic notation system, anchors tied to segment subdivisions, harmonic spans, and analysis objects will be at least as important as note-attached anchors.

**Quality at scale in interactive environments** — LilyPond's engraving quality comes partly from the freedom to spend more time on batch layout. VexFlow and Verovio prioritise responsiveness and portability. MuseScore must balance real-time editing, playback, and professional output. The best design choice depends on whether this system is primarily an editor, a renderer, or a batch engraver.

---

## Sources

### VexFlow

Repository: https://github.com/0xfe/vexflow
License: MIT

Key source files consulted:

- `src/beam.ts` — beam slope algorithm, secondary beams, stem extension, flat beams
- `src/stem.ts` — stem direction, length, attachment constants (`STEM_HEIGHT`, `STEM_WIDTH`)
- `src/formatter.ts` — softmax spacing, TickContext/ModifierContext pipeline, `format()` phases
- `src/tickcontext.ts` — beat-position grouping, width calculation
- `src/modifiercontext.ts` — modifier layout ordering, `total_width`
- `src/accidental.ts` — accidental stacking algorithm, clearance thresholds, `accidentalColumnsTable`
- `src/dot.ts` — dot placement, vertical position rules, chord dot stacking
- `src/curve.ts` — tie/slur Bézier defaults, direction rules
- `src/stavenote.ts` — notehead collision for seconds, ledger line logic, displaced noteheads
- `src/tables.ts` / `src/common_metrics.ts` — `NOTATION_FONT_SCALE`, `STAVE_LINE_DISTANCE`, glyph name mappings
- `src/svgcontext.ts` — SVG rendering, `RENDER_PRECISION_PLACES`, layer/group structure
- `src/tuplet.ts` — bracket rendering, number placement, ratioed tuplets

### LilyPond

Repository: https://gitlab.com/lilypond/lilypond
License: GPL 3 (study algorithms; do not copy code)

Key source files consulted:

- `lily/beam.cc` + `lily/beam-quanting.cc` — penalty-based beam slope search, quantization positions, all penalty weight constants
- `lily/stem.cc` — `calc_default_direction`, furthest-from-center algorithm, stem length arrays
- `lily/note-collision.cc` — notehead collision classification, displacement amounts
- `lily/tie.cc` — `get_default_dir`, direction rules, tie properties
- `lily/slur.cc` + `lily/slur-scoring.cc` — slur control point generation, penalty scoring, staff-line avoidance
- `lily/spacing-options.cc` — Gourlay `get_duration_space` formula, `increment_`, `shortest_duration_space_`
- `lily/spacing-spanner.cc` — spring-rod model, `set_springs()` algorithm
- `lily/skyline.cc` — skyline data structure, `distance()` algorithm, padding implementation
- `lily/rest-collision.cc` — voiced rest displacement
- `lily/tuplet-bracket.cc` — bracket slope calculation, beam slope copying
- `scm/define-grob-properties.scm` — all grob property defaults (beam-thickness, stem lengths, slur ratios, etc.)

Documentation consulted:

- https://lilypond.org/doc/v2.24/Documentation/internals/ — grob property reference
- https://lilypond.org/doc/v2.24/Documentation/contributor/ — engraver/grob architecture

### Verovio

Repository: https://github.com/rism-digital/verovio
License: LGPLv3

Key source files consulted:

- `src/beam.cpp` — beam slope from `BoundingBox::CalcSlope()`, step constraints, French beam style
- `src/stem.cpp` — `CalcStemFunctor`, `STANDARD_STEMLENGTH`, third-unit calculations, `GetStemUpSE()`/`GetStemDownNW()`
- `src/tie.cpp` — Bézier control points (distance/4, distance×3/4, height multiplier 1.6), system-break spanning cases
- `src/slur.cpp` — `CalcSlurFunctor`, collision scan targets, endpoint offsets
- `src/accid.cpp` — `AdjustX()`, vertical/horizontal margin constants, unison handling
- `src/dot.cpp` — `AdjustDotsFunctor`, spacing multipliers
- `src/horizontalaligner.cpp` — power-law spacing formula, `spacingLinear`, `spacingNonLinear`
- `src/rest.cpp` — `GetOptimalLayerLocation()`, `g_defaultRests` offset table
- `src/tuplet.cpp` — `CalcDrawingBracketAndNumPos()`, direction from stem count
- `include/vrv/doc.h` — `DEFAULT_UNIT`, `DEFINITION_FACTOR`, unit system
- `include/vrv/staff.h` — `CalcPitchPosYRel()`, loc-to-coordinate mapping

### MuseScore

Repository: https://github.com/musescore/MuseScore
License: GPL 3 (study algorithms; do not copy code)

Key source directories:

- `src/engraving/` — core engraving module: data model, layout, and rendering (major rewrite for MuseScore 4)
- `src/notation/` — score interaction layer (sits above engraving)

Documentation:

- Code structure wiki: https://github.com/musescore/MuseScore/wiki/CodeStructure
- MuseScore 4.0 engraving improvements: https://musescore.org/en/node/330793
- MuseScore Studio 4.4 engraving improvements: https://musescore.org/en/node/366024

*(Not deeply researched yet — `src/engraving/` is the entry point for future investigation.)*

### GUIDOLib

Repository: https://github.com/grame-cncm/guidolib
License: Mozilla Public License 2.0 (MPL 2.0)

Explicitly separates Abstract Representation (AR) from Graphic Representation (GR) — the clearest expression of the semantic→layout→drawing pattern across all open-source systems. Long academic lineage around spacing and layout algorithms (see Kai Renz's comparative spacing research).

### OpenSheetMusicDisplay (OSMD)

Repository: https://github.com/opensheetmusicdisplay/opensheetmusicdisplay
License: BSD 3-Clause

TypeScript. Acts as a MusicXML → internal model → VexFlow pipeline. Useful reference for system-level concerns (pagination, system breaks) and for what is needed to bridge a real interchange format to rendered notation.

### abcjs

Repository: https://github.com/paulrosen/abcjs
License: MIT

Browser-based ABC notation engraver. Maintainers describe an explicit split between "layout" and "writing to SVG". Useful as a compact end-to-end reference: parse → layout → SVG write. Requires a live DOM for spacing (browser text measurement), which has implications for determinism and server-side rendering.

### abcm2ps / abc2svg

- abcm2ps: https://moinejf.free.fr/
- abc2svg: https://chiselapp.com/user/moinejf/repository/abc2svg/

ABC-to-PostScript/SVG tools with automatic beaming and practical engraving conventions. Useful for alternative beaming and spacing implementations, though the font model differs from SMuFL-centric systems.

### Lomse

Repository: https://github.com/lenmus/lomse
License: MIT

C++ library designed for embedding notation rendering in other applications. SVG output, SMuFL-based fonts, editing/playback hooks. Good reference for "library-first" API boundaries.

### W3C Music Notation Community Group / MNX

- W3C group: https://www.w3.org/community/music-notation/
- MNX spec (in progress): https://w3c.github.io/mnx/

Maintains MusicXML and SMuFL. Developing MNX, a next-generation interchange format. Beaming semantics, full-measure rest representation, and sequence structure are still actively debated as of 2025–2026 — the field has not fully converged on encoding engraving intent independently of appearance.

### MEI (Music Encoding Initiative)

Repository: https://github.com/music-encoding/music-encoding

XML-based interchange format explicitly supporting notation beyond common Western notation. Rendered by Verovio. Useful for understanding how scholarly systems handle non-standard staves and the distinction between "notation as semantics" vs. "notation as appearance."

### SMuFL specification

Spec: https://w3c.github.io/smufl/latest/

Sections consulted:

- Glyph registration and coordinate system
- `glyphsWithAnchors` — all 22 anchor definitions and semantics
- `engravingDefaults` — canonical thickness and spacing values
- Glyph ranges: noteheads (U+E0A0), flags (U+E240), rests (U+E4E3), accidentals (U+E260), articulations (U+E4A0), dynamics (U+E520)

### Bravura font metadata

Repository: https://github.com/steinbergmedia/bravura
License: SIL Open Font License (OFL)

Key files:

- `redist/bravura_metadata.json` — all `glyphsWithAnchors` values (stem anchor coordinates), `engravingDefaults` values, `glyphAdvanceWidths`, glyph bounding boxes

### License summary

| System                  | License      | Notes                                                                      |
| ----------------------- | ------------ | -------------------------------------------------------------------------- |
| VexFlow                 | MIT          | Can study and adapt freely                                                 |
| abcjs                   | MIT          | Can study and adapt freely                                                 |
| Lomse                   | MIT          | Can study and adapt freely                                                 |
| OpenSheetMusicDisplay   | BSD 3-Clause | Can study and adapt freely                                                 |
| Verovio                 | LGPLv3       | Can link as library; clean-room reimplementation required for copying code |
| GUIDOLib                | MPL 2.0      | Weak copyleft; study and clean-room reimplementation safe                  |
| LilyPond                | GPL 3        | Copyleft — study algorithms, do not copy code                              |
| MuseScore (engraving)   | GPL 3        | Same as LilyPond — study algorithms, do not copy code                     |
| Bravura font            | SIL OFL      | Can embed and redistribute with OFL compliance                             |

Safe pattern: learn algorithms from all sources; reimplement clean-room; embed Bravura under OFL.

---

## SMuFL — The Universal Glyph Standard

All major systems (VexFlow, LilyPond, Verovio, MuseScore) use the **Bravura** font with **SMuFL** Unicode codepoints. The key principle: every glyph has defined **anchor points** in `bravura_metadata.json` that specify exactly where to attach stems, where ledger lines clip, where ties originate. Using this metadata vs. guessing positions is the difference between professional-quality output and approximation.

### Coordinate system

SMuFL coordinates are expressed in **staff spaces** — the distance between adjacent staff lines. This is the universal unit across all notation systems.

- Y increases **upward** (Cartesian), which is the opposite of screen/SVG coordinates
- One staff space = **0.25 em** at the font design size
- For Bravura at 1000 upm, one staff space = 250 units

### Glyph anchor points

The `glyphsWithAnchors` section of `bravura_metadata.json` defines attachment points for each glyph. All coordinates are in staff spaces relative to the glyph origin.

| Anchor           | Semantics                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------- |
| `stemUpSE`       | Bottom-right corner of an up-stem rectangle — where the stem meets the notehead when stem is up |
| `stemDownNW`     | Top-left corner of a down-stem rectangle — where the stem meets the notehead when stem is down  |
| `stemUpNW`       | Used on flag glyphs: amount by which stem must be lengthened for flag connection on up-stems    |
| `stemDownSW`     | Used on flag glyphs: stem-lengthening amount for flag connection on down-stems                  |
| `nominalWidth`   | Width for precise positioning (e.g. ledger lines)                                               |
| `opticalCenter`  | Optical center for alignment (especially dynamics)                                              |
| `graceNoteSlash` | Grace note slash positioning (four variants: SW/NE/NW/SE)                                      |

Example from Bravura metadata:

```json
"noteheadBlack": {
  "stemDownNW": [0.0, -0.184],
  "stemUpSE":   [1.328, 0.184]
}
```

When stem is up: attach at x=1.328, y=0.184 staff spaces from the notehead origin. When stem is down: attach at x=0.0, y=-0.184.

### engravingDefaults (Bravura values, all in staff spaces)

| Field                   | Value | Meaning                                                                 |
| ----------------------- | ----- | ----------------------------------------------------------------------- |
| `staffLineThickness`    | 0.13  | Staff line thickness                                                    |
| `stemThickness`         | 0.12  | Stem width                                                              |
| `beamThickness`         | 0.5   | Beam height                                                             |
| `beamSpacing`           | 0.25  | Gap between inner edge of primary beam and outer edge of secondary beam |
| `legerLineThickness`    | 0.16  | Ledger line thickness (thicker than staff lines)                        |
| `legerLineExtension`    | 0.4   | Amount ledger line extends beyond notehead on each side                 |
| `slurEndpointThickness` | 0.1   | Slur thickness at endpoints                                             |
| `slurMidpointThickness` | 0.22  | Slur thickness at midpoint                                              |
| `tieEndpointThickness`  | 0.1   | Tie thickness at endpoints                                              |
| `tieMidpointThickness`  | 0.22  | Tie thickness at midpoint                                               |
| `thinBarlineThickness`  | 0.16  | Standard barline                                                        |
| `thickBarlineThickness` | 0.5   | Thick barline (final, repeat)                                           |
| `barlineSeparation`     | 0.4   | Gap between double barline strokes                                      |

### Key SMuFL glyph codepoints

**Noteheads:**

- `U+E0A2` — noteheadWhole
- `U+E0A3` — noteheadHalf
- `U+E0A4` — noteheadBlack (quarter and shorter)
- `U+E0A6` — noteheadXBlack (cross notehead)

**Flags:**

- `U+E240/E241` — flag8thUp / flag8thDown
- `U+E242/E243` — flag16thUp / flag16thDown
- `U+E244/E245` — flag32ndUp / flag32ndDown
- `U+E246/E247` — flag64thUp / flag64thDown
- `U+E248/E249` — flag128thUp / flag128thDown
- `U+E24A/E24B` — flag256thUp / flag256thDown

**Rests:**

- `U+E4E3` — restWhole
- `U+E4E4` — restHalf
- `U+E4E5` — restQuarter
- `U+E4E6` — rest8th
- `U+E4E7` — rest16th
- `U+E4E8` — rest32nd
- `U+E4E9` — rest64th
- `U+E4EA` — rest128th
- `U+E4EE` — restHBar (multi-measure rest)

**Accidentals:**

- `U+E260` — accidentalFlat
- `U+E261` — accidentalNatural
- `U+E262` — accidentalSharp
- `U+E263` — accidentalDoubleSharp
- `U+E264` — accidentalDoubleFlat

**Articulations (above/below pairs):**

- `U+E4A0/E4A1` — accentAbove / accentBelow
- `U+E4A2/E4A3` — staccatoAbove / staccatoBelow
- `U+E4A4/E4A5` — tenutoAbove / tenutoBelow
- `U+E4A6/E4A7` — staccatissimoAbove / staccatissimoBelow
- `U+E4AC/E4AD` — marcatoAbove / marcatoBelow
- `U+E4B0/E4B1` — accentStaccatoAbove / accentStaccatoBelow
- `U+E4B2/E4B3` — tenutoStaccatoAbove / tenutoStaccatoBelow
- `U+E4C0/E4C1` — fermataAbove / fermataBelow
- `U+E4C4/E4C5` — fermataShortAbove / fermataShortBelow
- `U+E4C6/E4C7` — fermataLongAbove / fermataLongBelow

**Dynamics:**

- `U+E520` — dynamicPiano (p)
- `U+E521` — dynamicMezzo (m prefix)
- `U+E522` — dynamicForte (f)
- `U+E52C` — dynamicMP
- `U+E52D` — dynamicMF
- `U+E527–E52B` — pp through pppp
- `U+E530–E533` — ff through ffff
- `U+E53E` — crescendoHairpin
- `U+E53F` — diminuendoHairpin

### Glyph advance widths (Bravura, in staff spaces)

| Glyph             | Width |
| ----------------- | ----- |
| noteheadBlack     | 1.18  |
| noteheadHalf      | 1.18  |
| noteheadWhole     | 1.688 |
| accidentalSharp   | 0.996 |
| accidentalFlat    | 0.904 |
| accidentalNatural | 0.672 |
| restWhole         | 1.132 |
| rest8th           | 1.0   |
| rest16th          | 1.28  |

### Rendering SMuFL glyphs in SVG (two approaches)

**Option A — SVG `<text>` with embedded WOFF/WOFF2 font**

Embed Bravura as a WOFF2 web font via `@font-face`. Render each glyph as a `<text>` element with the appropriate Unicode codepoint. Hinting and anti-aliasing are handled by the browser. Glyph positions and sizes must still be computed from `bravura_metadata.json` — never from DOM measurement.

**Option B — Convert glyphs to path outlines and cache them**

Use a font parser (e.g. `opentype.js`) to extract glyph outlines as SVG path data at build time. Render as `<path>` elements. Fully DOM-independent — works server-side, in Workers, and in test environments without a browser. Requires a one-time build step.

Either approach works. The critical requirement in both cases: **measure and position using SMuFL metadata, never by eyeballing or DOM measurement**. All mature systems derive advance widths, bounding boxes, and anchor coordinates from the font metadata file, not from runtime font measurement.

---

## Noteheads

### Types by duration

| Duration             | Glyph               | Filled | Has stem    |
| -------------------- | ------------------- | ------ | ----------- |
| Double whole (breve) | noteheadDoubleWhole | Open   | No standard |
| Whole                | noteheadWhole       | Open   | No          |
| Half                 | noteheadHalf        | Open   | Yes         |
| Quarter and shorter  | noteheadBlack       | Filled | Yes         |

### Sizing

Font scaling formula (VexFlow):

```
scale = (pointSize × 72.0) / (fontResolution × 100.0) × metrics.scale
```

VexFlow calibrates `NOTATION_FONT_SCALE = 39pt` so that notehead height exactly equals the staff-space height at 10px per staff space.

### Notehead collision for seconds

When two notes in a chord are a second apart (adjacent positions), one must be displaced horizontally.

VexFlow approach:

```
if |lineA - lineB| <= 0.5:
  displaced = !displaced  // toggle displacement flag
```

Displaced notes shift horizontally by approximately one notehead width.

LilyPond displacement amounts by collision type:

- Full collide (same position): `0.5 × notehead width`
- Close half (adjacent, normal direction): `0.52 × notehead width`
- Distant half (adjacent, reversed direction): `0.65 × notehead width`
- Touch (extreme notes just contact): `0.5 × notehead width`

### Notehead merging at unison

Notes at the same pitch in different voices can share a notehead only when:

- Same head style
- Same dot count (unless `merge-differently-dotted` enabled)
- Same head type (unless `merge-differently-headed` enabled)
- **Quarter and half notes are never merged even at unison** — visual distinction is required
- **Whole notes never merge**

### Ledger lines

- Extend `0.4` staff spaces past the notehead on each side (`legerLineExtension`)
- Thickness `0.16` ss — thicker than staff lines (`0.13` ss) for visual clarity
- Draw one ledger line per pitch position outside the staff boundary
- For double noteheads (displaced seconds): ledger line width = `2 × (noteheadWidth + extension) - stemWidth/2`

---

## Stems

### Direction rules

Two equivalent algorithms used across systems:

**Average method (VexFlow):**

```
avg = (lowestNotePosition + highestNotePosition) / 2
direction = avg < staffMiddle ? UP : DOWN
```

**Furthest-from-center method (LilyPond):**

```
upDist   = highestNote - staffCenter
downDist = staffCenter - lowestNote
if downDist > upDist: direction = UP
if upDist > downDist: direction = DOWN
// tie-breaker: DOWN
```

**Multi-voice convention (universal, non-negotiable):** Voice 1 = stems UP. Voice 2 = stems DOWN. For three voices, the middle voice yields to beamed notes in adjacent voices; un-beamed notes adjust direction to resolve conflicts.

### Length

Default: **3.5 staff spaces** (7 half-spaces). Consistent across LilyPond, VexFlow, Verovio.

Length array by flag count (staff spaces):

```
[0 flags, 1, 2, 3, 4, 5, 6, 7, 8]
[3.5,    3.5, 3.5, 4.25, 5.0, 6.0, 7.0, 8.0, 9.0]
```

Extension for extreme notes — when a note is more than 3.5 staff spaces from the staff center, extend the stem by the overshoot:

```
if |notePos - staffCenter| > 3.5:
  extension = |notePos - staffCenter| - 3.5
  stemLength += extension
```

Shortening for forced direction (when auto direction is overridden):

```
[unbeamed, 1-beam, 2+-beam] → shorten by [1.0, 0.5, 0.25] staff spaces
```

Beamed stem base lengths (half-spaces, from Verovio):

| Duration | Half-spaces |
| -------- | ----------- |
| 8th      | 13–14       |
| 16th     | 13–14       |
| 32nd     | 16–18       |
| 64th     | 20–22       |
| 128th    | 24–26       |
| 256th    | 28–30       |

### Attachment to noteheads

Use SMuFL anchor data directly:

- Up-stem: the bottom-right corner of the stem rectangle touches the `stemUpSE` anchor of the notehead
- Down-stem: the top-left corner touches `stemDownNW`

For noteheadBlack: `stemUpSE = [1.328, 0.184]`, `stemDownNW = [0.0, -0.184]` (staff spaces)

**Stem width:** `0.12` ss (SMuFL spec). VexFlow uses `1.5px` at 10px/ss.

### Flag extension

Extra stem length needed to accommodate multiple flag glyphs (VexFlow values at 10px/ss):

| Duration | Extra px |
| -------- | -------- |
| 8th–16th | 0        |
| 32nd     | 9        |
| 64th     | 13       |
| 128th    | 22       |
| 256th    | 24       |

### Grace note stems

Scale to 0.75× of normal stem length.

---

## Flags

### Placement

The flag glyph's origin (x=0, y=0) is positioned at the **stem tip**. For up-stems the flag curves downward from the stem tip; for down-stems it extends upward.

A small horizontal shift centers the flag on the stem: VexFlow applies `shiftX = -0.75` units.

### Extents (Bravura)

- `flag8thUp` extends approximately **3.24 staff spaces downward** from the stem tip (the visual curve sweeping toward the notehead)
- `flag8thDown` extends approximately **3.23 staff spaces upward** from the stem tip

### Flags suppressed by beams

When a note belongs to a beam group, its flag glyph is **not rendered**. The beam provides the visual grouping signal. Flags are only drawn on isolated short-duration notes.

---

## Beams

### When to beam

- Only notes shorter than a quarter note (8th and shorter)
- Groups of ≥2 eligible notes
- Grouping follows the beat structure of the time signature
- First and last notes of a beam group must be eligible (no quarter+ notes can be beam endpoints)

### Slope — VexFlow algorithm

The definitive approach from `src/beam.ts`:

```
rawSlope = (lastStemTipY - firstStemTipY) / (lastX - firstX)
idealSlope = rawSlope / 2    // target is HALF the raw slope

min_slope = -0.25
max_slope = 0.25
iterations = 20
slope_cost = 100             // heavily penalizes deviation from ideal slope

bestSlope = 0; minCost = Infinity; yShift = 0

for slope in range(min_slope, max_slope, step=(max_slope-min_slope)/iterations):
  totalStemExtension = 0
  yShiftTemp = 0

  for each middle note i:
    adjustedStemTipY = beamYAt(note.x, firstNote, slope) + yShiftTemp
    actualStemTipY   = note.stemTip.y

    if actualStemTipY is inside beam (note stem too short):
      diff = |actualStemTipY - adjustedStemTipY|
      yShiftTemp += diff * -stemDirection  // shift whole beam up/down
      totalStemExtension += diff * i
    else:
      totalStemExtension += (actualStemTipY - adjustedStemTipY) * stemDirection

  cost = slope_cost * |idealSlope - slope| + |totalStemExtension|
  if cost < minCost: bestSlope = slope; yShift = yShiftTemp
```

Key insight: the ideal slope is **half** the raw slope from first to last note. `slope_cost = 100` strongly penalizes deviation from this, while `totalStemExtension` penalizes excessive stem adjustment.

### Slope — LilyPond penalty model

LilyPond searches quantized beam positions and scores them with penalty weights:

| Penalty                        | Value | Purpose                               |
| ------------------------------ | ----- | ------------------------------------- |
| SECONDARY_BEAM_DEMERIT         | 10.0  | Bad quantization of secondary beams   |
| STEM_LENGTH_DEMERIT_FACTOR     | 5     | Stem deviation from ideal length      |
| HORIZONTAL_INTER_QUANT_PENALTY | 500   | Beam crossing a staff line            |
| STEM_LENGTH_LIMIT_PENALTY      | 5000  | Stem too short (hard constraint)      |
| DAMPING_DIRECTION_PENALTY      | 800   | Slope reverses musical direction      |
| HINT_DIRECTION_PENALTY         | 20    | Subtle slope reversal                 |
| MUSICAL_DIRECTION_FACTOR       | 400   | Conformance with melodic pattern      |
| IDEAL_SLOPE_FACTOR             | 10    | Deviation from ideal slope            |
| ROUND_TO_ZERO_SLOPE            | 0.02  | Treat slopes below this as horizontal |

Preferred beam positions relative to staff lines (best to worst):

1. **Inter** (0.5 ss from line) — beam in a space
2. **Sit** — beam resting on top of a line
3. **Hang** — beam hanging from bottom of a line
4. **Straddle** (0.0) — beam crossing through a line (generally avoided)

### Thickness and secondary beams

- Primary beam thickness: **0.5 staff spaces** (universal across all systems)
- Gap between outer edges of adjacent beams: beamThickness + `0.25` ss gap = `0.75` ss outer-to-outer
- Number of beams by duration: 8th=1, 16th=2, 32nd=3, 64th=4, 128th=5, 256th=6

### Stem length adjustment for beamed groups

Every stem in a beam group is extended or shortened so its tip exactly meets the beam line at its x position:

```
stemTipY = beamYAt(note.x)  // beam line position at this note's x
stemLength = |stemTipY - noteheadAttachY|
```

Stems are never shortened below a minimum length. If the beam would require a stem shorter than the minimum, the entire beam shifts to accommodate.

### Sub-beams (secondary beams for 16th+)

Each note shorter than an 8th has secondary beams in addition to the primary. A secondary beam can be:

- `BEAM_BOTH` — continues through the note (connected on both sides)
- `BEAM_LEFT` — partial beam extending leftward from the note
- `BEAM_RIGHT` — partial beam extending rightward

Break points are governed by rhythmic grouping (typically at beat boundaries). Partial beam length ≈ 1 staff space (10px at 10px/ss in VexFlow).

### Beams over rests

Default behavior: beams break at rests. Options:

- Beam through interior rests (note must not be first or last in group)
- Rested beats within a beamed group get **stemlets** — short stub stems at height = total beam stack height + clearance gap

### Flat beams

Alternative policy: `slope = 0`, beam offset = average of all stem tip positions, adjusted for extreme notes and beam thickness. Useful for visual consistency in some layouts.

### Auto-knee threshold

When the gap between a beam group's highest and lowest notes exceeds **5.5 staff spaces**, the beam is a "kneed beam" — the beam bends to accommodate the large interval. LilyPond expands its search region and applies `× 10` to the IDEAL_SLOPE_FACTOR for cross-staff beams.

### French beam style

In French (or "French style") beaming, secondary beams do not attach to the primary beam on both sides of their note — instead, secondary beams float slightly off the stem tip. The primary beam remains a full horizontal bar, but sub-beams are shorter and positioned differently. Verovio exposes this as a `frenchStyle` option (`beamFrenchStyle`). It is a style toggle, not a different algorithm.

### Beaming as a configurable sub-engine

Beaming is best treated as its own sub-pipeline rather than an inline procedure. It consumes a sequence of positioned notes (x positions and y stem-tip positions already known) and outputs beam polygons plus per-note adjusted stem endpoints.

All policy decisions should be **explicit configuration**, not hidden logic:

- Group boundaries (where beams break — typically at beat boundaries)
- Whether to beam across interior rests
- Knee threshold (default 5.5 ss)
- Slope limits (default ±0.25)
- French style attachment (on/off)
- Flat beam mode (on/off)

This mirrors LilyPond's tunable beam parameters and Verovio's options surface. Hardcoding these assumptions will block you when you encounter notation that needs a different policy.

---

## Multi-voice and Polyphony

### Voice stem conventions

**Universal across all systems:**

- Voice 1 = stems UP
- Voice 2 = stems DOWN

Three voices: middle voice yields to beamed notes in adjacent voices; un-beamed middle-voice notes adjust direction to resolve conflicts.

### Notehead collision for seconds (across voices)

When notes in the same chord are a second apart (including across voices), one displaces horizontally. The displacement side depends on which voice is above/below — typically the lower voice's notehead shifts right. The stem of the displaced note still originates from the correct side of its notehead.

### Shared noteheads at unison

Notes at the same pitch in different voices may share a notehead under strict conditions. Both stems attach to the shared notehead. Conditions:

- Same head style
- Same dot count
- Same head type
- Never quarter + half at unison
- Never whole notes

### Rest collision handling

When rests from opposing voices occupy the same vertical region, they are displaced. Voice 1 rest moves upward; Voice 2 rest moves downward.

Default offset positions:

- Voice 1 rest: position 6 (or 8 for overlap with quarter notes)
- Voice 2 rest: position 2

The specific displacement amount depends on the rests' durations and the density of surrounding material.

---

## Rests

### Glyphs by duration

| Duration      | SMuFL name      | Codepoint |
| ------------- | --------------- | --------- |
| Double whole  | restDoubleWhole | —         |
| Whole         | restWhole       | U+E4E3    |
| Half          | restHalf        | U+E4E4    |
| Quarter       | restQuarter     | U+E4E5    |
| 8th           | rest8th         | U+E4E6    |
| 16th          | rest16th        | U+E4E7    |
| 32nd          | rest32nd        | U+E4E8    |
| 64th          | rest64th        | U+E4E9    |
| 128th         | rest128th       | U+E4EA    |
| Multi-measure | restHBar        | U+E4EE    |

### Vertical positioning (stave context — adapt for custom layout)

| Duration            | Default placement                   |
| ------------------- | ----------------------------------- |
| Whole               | Hangs below the fourth staff line   |
| Half                | Sits on top of the third staff line |
| Quarter and shorter | Centered at staff middle            |

**Whole rest:** Top-heavy, like an inverted hat. The glyph **hangs** from the line above it.
**Half rest:** Right-side-up hat. The glyph **sits** on the line below it.

This whole/half visual distinction is important for recognition even outside traditional stave contexts.

### Multi-measure rests

Use the `restHBar` glyph (U+E4EE), or draw a thick horizontal bar with thin vertical end caps and a number above indicating the measure count. Triggered when two or more consecutive measures are empty.

---

## Augmentation Dots

### The fundamental rule

**Dots always go in spaces, never on lines.** When a note sits on a line position, the dot shifts up by 0.5 positions into the space above. If that space is occupied (by another note or another dot), the dot shifts down instead.

```
dotPosition(noteLine):
  if noteLine is a line position (integer in stave terms):
    if spaceAbove not occupied:
      return noteLine + 0.5  // shift up into space
    else:
      return noteLine - 0.5  // shift down into space
  else:
    return noteLine            // already in a space
```

### Horizontal offset

Dot is placed to the right of the notehead with a fixed gap. Each additional dot cascades right with approximately 1px gap between dots (at 10px/ss scale).

VexFlow values: dot radius = 2px, spacing between consecutive dots = 1px, initial x-shift from note = determined by note right edge plus padding.

### Chord dot stacking

For chords, sort notes top-to-bottom and track which spaces already have dots. When two notes are a second apart, their dots would land in the same space — the lower note's dot shifts to avoid collision. Each note's dot is positioned in the same horizontal column but different spaces.

---

## Accidentals

### Glyph table

| Symbol        | SMuFL name             | Codepoint |
| ------------- | ---------------------- | --------- |
| Sharp         | accidentalSharp        | U+E262    |
| Flat          | accidentalFlat         | U+E260    |
| Natural       | accidentalNatural      | U+E261    |
| Double sharp  | accidentalDoubleSharp  | U+E263    |
| Double flat   | accidentalDoubleFlat   | U+E264    |
| Natural-flat  | accidentalNaturalFlat  | U+E267    |
| Natural-sharp | accidentalNaturalSharp | U+E268    |

### The stacking problem

Multiple accidentals on a chord must be distributed into columns without vertical collision. This is one of the more complex layout problems in notation.

**VexFlow column table** — maps group sizes to column patterns (column 1 = closest to notehead, higher = further left):

```
1 note:  [1]
2 notes: [1, 2]
3 notes: [1, 3, 2]           // zigzag
4 notes: [1, 3, 4, 2]
5 notes: [1, 3, 5, 4, 2]
6 notes: [1, 3, 5, 6, 4, 2]
```

For groups of 7+, the pattern repeats with `column = ((position % patternLength) + 1)`.

**Clearance thresholds** (minimum staff positions between accidentals in the same column):

- Standard accidentals (sharp, natural): 3.0 positions
- Flats and double-sharps: 2.5 positions (asymmetric shape requires less clearance)

**Column width** = widest accidental in that column. Cumulative offsets build from the notehead outward (right to left).

**LilyPond's approach:** Sorts columns by size (larger columns closer to notehead), then uses `stagger_apes()` — alternates picking from front and back of the sorted list to create a staggered, interleaved distribution. Minimum clearance between columns = distance between opposing skylines minus padding.

**Unison accidentals:** Same pitch, same accidental type in different voices → superimposed, not separated.

**Padding:** `0.2` staff spaces between accidental right edge and notehead left edge.

---

## Ties and Slurs

### Tie vs. slur distinction

**Tie:** connects two notes of the **same pitch**, indicating they sustain as one sound. Each note in a chord gets its own tie. Ties are thinner, shorter, and sit close to noteheads.

**Slur:** phrasing mark over notes of **different pitches**, indicating legato articulation. Larger and more prominent than ties.

### Direction rules (universal)

Tie/slur goes **opposite** to stem direction:

- Stem up → curve below the note
- Stem down → curve above the note

For chords: the top note's tie curves upward; the bottom note's tie curves downward; middle notes follow their individual stem context.

Single note with no stem context: default direction is up.

### Tie Bézier control points (Verovio values)

```
distance = x2 - x1
c1.x = x1 + distance / 4        // control point 1 at 25% of span
c2.x = x1 + 3 * distance / 4    // control point 2 at 75% of span
height = 1.6 × drawingUnit       // ≈ 0.6 staff spaces
c1.y = y1 + direction × height
c2.y = y2 + direction × height
```

### Slur Bézier control points (LilyPond values)

```
span   = x2 - x1
height = min(2.0 × staffSpace, 0.33 × span)  // caps at 2 staff spaces
indent = span / 3
c1     = [x1 + indent, y1 + direction × height]
c2     = [x2 - indent, y2 + direction × height]
```

### LilyPond tie/slur properties

| Property         | Tie value | Slur value | Meaning                                     |
| ---------------- | --------- | ---------- | ------------------------------------------- |
| `height-limit`   | 1.0 ss    | 2.0 ss     | Maximum curve height                        |
| `ratio`          | —         | 0.25       | How quickly height reaches limit with span  |
| `line-thickness` | 0.8       | 0.8        | Virtual pen diameter (staff-line multiples) |
| `thickness`      | 1.2       | 1.2        | Arc separation at thickest point            |
| `min-length`     | 1.5 ss    | 1.5 ss     | Minimum span                                |
| `note-head-gap`  | 0.2 ss    | —          | Clearance from notehead                     |
| `stem-gap`       | 0.35 ss   | —          | Clearance from stem                         |

### System break ties

When a tie crosses a system break it is split into two halves:

- **First half:** extends from the note to the right margin
- **Second half:** starts from the left margin at the same pitch position

Verovio models this as `SPANNING_START`, `SPANNING_END`, and `SPANNING_START_END` cases.

### Slur collision avoidance

Slurs scan for collisions with: accidentals, articulations, noteheads, stems, tuplet brackets. When a collision is detected, the slur's control points are adjusted upward/downward to clear the obstacle.

**LilyPond** generates candidate configurations and scores them against penalty weights: accidental collision, general object collision, notehead clearance, nested slur clearance, staff-line avoidance. The least-penalty candidate wins.

**MuseScore** uses a concrete iterative adjustment routine:

1. Compute initial Bézier control points from span and direction
2. Sample the curve into a sequence of small rectangles
3. Test each rectangle for intersection against collision targets (noteheads, stems, accidentals, articulations)
4. If collision detected: adjust control points or shift endpoints, depending on where along the curve the collision occurs
5. Repeat up to a fixed iteration cap (prevents infinite loops on unresolvable collisions)
6. Use stable tie-breakers so small input changes produce small geometry changes

**Key insight:** slur layout is not a closed-form calculation. It is a constrained search: start with a reasonable default, detect failures, adjust, repeat. The iteration cap and tie-breakers are what keep it stable in production.

---

## Tuplets

### Bracket rendering

The bracket consists of:

- Two horizontal segments meeting at a center gap where the number sits
- Vertical end hooks (height ≈ 0.7 ss, directed toward the notes)
- The number (or ratio like 3:2) centered in the gap

VexFlow values:

- Horizontal segment width = `(totalWidth / 2) - (numberWidth / 2) - 5px` padding each side
- Vertical hook height: 10px (in the direction of `location`: above or below notes)
- Nesting offset: 15px per nesting level
- Number size: `(NOTATION_FONT_SCALE × 3) / 5`

LilyPond bracket properties:

| Property        | Default    | Meaning                               |
| --------------- | ---------- | ------------------------------------- |
| `edge-height`   | 0.7 ss     | Left and right vertical hook heights  |
| `padding`       | 1.1 ss     | Space between bracket and adjacent objects |
| `thickness`     | 1.6 (staff-line multiples) | Bracket line thickness  |
| `staff-padding` | 0.25 ss    | Minimum distance from staff           |

### Bracket slope

- VexFlow: always horizontal (no slope)
- LilyPond: when the tuplet is attached to a beam, the bracket copies the beam's slope

### When to omit the bracket

Brackets are omitted when notes are **beamed** — the beam already implies the grouping. Only un-beamed tuplets need an explicit bracket.

### Ratioed tuplets

For "3 in the space of 2" style: render as `3:2` with a colon composed of two small circles. VexFlow positions the dots at approximately `±0.1×` the number point size above/below the horizontal center.

---

## Horizontal Spacing

### Gourlay spring-rod model (LilyPond — the canonical approach)

**Springs** are flexible — they set proportional distances between beat positions. **Rods** are rigid — they enforce minimum distances to prevent collisions.

Duration-to-space formula:

```
ratio = duration / shortestDurationInScore

if ratio < 1.0:
  space = (shortestSpace + ratio - 1) × increment
else:
  space = (shortestSpace + log₂(ratio)) × increment

defaults:
  increment      = 1.2  (notehead widths per duration doubling)
  shortestSpace  = 2.0  (notehead widths for the shortest note)
```

Resulting proportions (in notehead widths):

| Duration | Space |
| -------- | ----- |
| 16th     | ≈ 0.5 |
| 8th      | 2.0   |
| Quarter  | 3.0   |
| Half     | 4.0   |
| Whole    | 5.0   |

Each doubling of duration adds 1.2 notehead widths. This logarithmic spacing matches human perception of rhythmic proportions.

### VexFlow softmax model

```
exp(tick) = SOFTMAX_FACTOR ^ (contextTicks / totalTicks)
// SOFTMAX_FACTOR = 10
```

A note filling 100% of a measure's total ticks gets 10× more space than baseline. A note at 50% gets ~3.16×. Iteratively adjusted (5 iterations, learning rate 0.5) until width fits within the available space.

### Verovio power-law model

```
space = (intervalTime × 1024) ^ spacingNonLinear × spacingLinear × 10.0
// spacingNonLinear = 0.6 (power law exponent)
// spacingLinear    = 0.25 (linear multiplier)
```

Both parameters are user-tunable.

### TickContext and ModifierContext grouping

A **TickContext** groups all notes at the same beat position across all voices. Spacing is computed once per tick context, not per note. A **ModifierContext** groups all modifiers at the same tick and formats them in a fixed sequence. This two-level grouping keeps spacing logic manageable.

**Tick context width formula:**

```
totalWidth = notePx
           + max(modLeftPx + leftDisplacedHeadPx)
           + max(modRightPx + rightDisplacedHeadPx)
           + 2px padding
```

### Modifier layout order

The sequence in which modifiers are measured and laid out matters — each step assumes prior steps are complete (VexFlow `ModifierContext`):

1. Note itself
2. Parentheses
3. Dots
4. Accidentals
5. Grace note groups
6. Articulations
7. Ornaments
8. Annotations / chord symbols
9. Bend, vibrato

### Skyline algorithm (LilyPond — collision avoidance at scale)

Instead of O(n²) bounding-box checks, every element's silhouette is represented as a piecewise-linear **skyline** profile (top and bottom profiles separately). Two opposing skylines can be compared in O(n) to find the minimum safe clearance.

```
skyline = sequence of segments:
  each segment: [x_left, x_right, slope, y_intercept]
  height(x) = slope × x + y_intercept

distance(skylineA, skylineB):
  = max(skylineA.height(x) + skylineB.height(x)) for all x
  // iterate both skylines simultaneously at segment boundaries
```

Padding is applied by inflating each skyline outward by the required clearance distance. This is what allows LilyPond to handle dense scores without performance collapse. For any system where many elements need clearance checks (accidentals, articulations, annotations), this pattern is far more scalable than bounding-box intersection.

### The collision contract

The most important engineering decision about collision handling is not which technique you use first — it is that **all engravables obey a uniform collision contract**. Every element that can collide should export a collision shape through a single API:

```ts
interface Engravable {
  getCollisionShape(): BoundingBox | SkylineProfile
}
```

Start with bounding boxes. Design the interface so that upgrading an element to export a skyline profile requires no changes to the collision-checking code — only to the element itself. This makes the path from "working" to "high quality" incremental rather than a rewrite.

Without this contract, collision handling fragments into a web of ad hoc pairwise checks that is impossible to scale or reason about.

---

## Articulations

### Placement rules

**Default position:** above the note (or below when notated that way). When a stem is present, articulations go on the stem side by default for accent/tenuto; staccato always goes between the note and the stem tip.

**Offset from note:**

- Stem-tip side: initial offset = 0.5 staff spaces from stem tip
- Non-stem side: initial offset = 1.0 staff spaces from notehead

**Snapping to staff positions:** articulations snap to the nearest line or space. If the snapped position would be on a staff line and the articulation needs to be between lines, it shifts an additional 0.5 spaces away from the note.

### Stacking multiple articulations

When multiple articulations appear on the same note, they stack outward from the note:

```
each articulation: y += glyphHeight / 10 + 0.5ss margin
```

### Avoid-slur behavior

Most articulations default to `avoid-slur: inside` — they stay between the note and the slur curve rather than outside it.

### Outside-staff priority

Articulations outside the staff have an `outside-staff-priority` value that controls stacking order relative to other outside-staff elements (dynamics, text, etc.). Higher priority = closer to the staff.

---

## Dynamics

### Positioning

Dynamics are placed **below** the staff by default (above for vocal music). They align horizontally with the beat position of their attached note, using the glyph's `opticalCenter` anchor rather than its left edge.

### Hairpin rendering (crescendo/decrescendo)

A hairpin is a wedge shape:

- Opening end (crescendo) or closing end (decrescendo) has a specified opening height
- Lines converge to a point at the closed end

LilyPond hairpin properties:

| Property         | Default | Meaning                |
| ---------------- | ------- | ---------------------- |
| `height`         | 0.667 ss | Maximum opening height |
| `thickness`      | 1.0 (staff-line multiples) | Line thickness |
| `minimum-length` | 2.0 ss  | Minimum span           |

Verovio: maximum hairpin angle capped at **16 degrees** to prevent overly steep wedges. Angle is computed as `theta = 2 × atan((endY / 2) / length)` and clipped at the maximum.

---

## Key Constants Reference

All values in **staff spaces** unless otherwise noted. Staff space = distance between adjacent staff lines.

### Structural dimensions

```
Stem default length:         3.5 ss
Stem thickness:              0.12 ss
Beam thickness:              0.5 ss
Beam secondary gap:          0.25 ss  (inner-to-outer of adjacent beams)
Ledger line thickness:       0.16 ss
Ledger line extension:       0.4 ss per side
Staff line thickness:        0.13 ss
```

### Curves

```
Slur max height:             2.0 ss
Slur ratio:                  0.25–0.33
Slur min length:             1.5 ss
Tie Bézier height:           ~0.6 ss  (1.6 × drawingUnit where unit ≈ 0.375 ss)
Tie min length:              1.5 ss
Tie line-thickness:          0.8 × staff-line-thickness
Tie arc thickness:           1.2 × staff-line-thickness
```

### Spacing

```
Spacing increment:           1.2 notehead widths per duration doubling
Shortest duration space:     2.0 notehead widths
Auto-knee-gap threshold:     5.5 ss
```

### Clearance

```
Accidental padding:          0.2 ss from notehead
Accidental vertical clear:   3.0 positions (standard), 2.5 (flats/double-sharps)
Dot position gap:            0.5 ss (shift off staff line)
Slur note-head gap:          0.2 ss
Slur stem gap:               0.35 ss
```

### Other

```
Hairpin opening height:      0.667 ss
Hairpin max angle:           16°
Tuplet edge-height:          0.7 ss
Tuplet bracket thickness:    1.6 × staff-line-thickness
Tuplet number padding:       0.3 ss
Grace note stem scale:       0.75×
```

---

## Testing, Performance, and Determinism

### Regression testing with golden images

LilyPond's quality comes significantly from relentless comparison against hand-engraved reference material and regression test suites. Practical strategy for this system:

1. Build a corpus of "engraving torture tests": dense accidentals, seconds in chords, multi-voice rests, beams across mixed pitches, nested tuplets, slurs across articulations
2. Render each to SVG and store as golden outputs
3. On every code change, run visual diffs against the goldens (perceptual diff tools like `pixelmatch` work well)
4. Any regression in visual output fails the build

This is the closest analogue to how LilyPond evolves — not spec compliance testing but perceptual quality tracking.

### Determinism: metadata measurement vs. DOM measurement

A key engineering choice for browser-based notation renderers:

**DOM-dependent measurement** (abcjs approach): uses browser text measurement (`getBoundingClientRect`, `measureText`) for spacing. Cannot run off-thread or server-side without a live DOM. Layout is not deterministic across browser versions.

**Metadata-based measurement** (VexFlow, Verovio approach): uses SMuFL font metadata (`glyphAdvanceWidths`, bounding boxes, anchor points) for all layout calculations. DOM is only needed for the final SVG paint step. Layout is fully deterministic and can run in Node.js, Workers, or server-side.

**Recommendation:** adopt metadata-based measurement. Embed `bravura_metadata.json` at build time and use it for all glyph advance widths and anchor points. This enables deterministic tests, server-side pre-rendering, and layout in Workers.

### Performance at scale

For dense scores (many notes per segment, articulations, dense accidentals):

- **Skyline profiles over O(n²) bounding-box checks** — LilyPond's skyline scales linearly with element count for collision checks. Bounding-box pairwise checks grow quadratically.
- **TickContext grouping** (VexFlow) — compute spacing once per beat position, not once per note. In a multi-voice score with 4 voices sharing 16th-note runs, this reduces spacing work by ≈4×.
- **Functor passes over recursive traversal** (Verovio) — each layout pass traverses the tree once in a focused, cache-friendly manner. Recursive "do everything while visiting" traversals are harder to optimise and profile.

---

## Adaptation Notes for This System

This system uses a custom pitch-space layout rather than traditional staves. The following standard assumptions require adaptation.

**Staff-space unit:** The system's `ROW_HEIGHT` (currently `3px`) is the equivalent unit. All constants above scale from it. A "staff space" = `ROW_HEIGHT` in this system.

**Stem direction reference:** Without a conventional staff middle line, define the reference as the visual center of the visible pitch window, or derive it from the harmonic region's grounding pitch class (the `ground` field).

**Dot positioning:** The pitch row grid is already discretized. Dots-in-spaces maps directly: a dot for a note at row `n` goes at row `n + 0.5`. Check whether row `n + 0.5` is occupied before committing.

**Rest positioning:** The whole/half rest visual distinction (hang vs. sit) still applies and aids recognition. The specific staff-line anchoring rules are replaced by positioning relative to the local pitch window center.

**Horizontal spacing:** The current layout uses a fixed segment width. When notes of varying duration appear within a segment, the Gourlay formula or the Verovio power-law model gives perceptually correct proportions. Both scale from the shortest note present.

**Glyph rendering:** The biggest single quality improvement available is switching from hand-drawn SVG primitives to the Bravura font with SMuFL codepoints. Embed the font, use anchor metadata for stem attachment. Every other serious system does this because the glyph proportions are professionally designed and the anchor data eliminates geometry guesswork entirely.

**Ledger lines:** In this system, "ledger lines" are not needed in the stave sense, since pitch position is continuous rather than anchored to fixed staff lines. The concept may re-emerge if extended pitch ranges are indicated with supplementary position markers.

**Layer ordering for SVG:** The standard paint order applies directly. Harmonic region shapes (the current span fills) are the lowest layer; note events render above them; ties, slurs, and annotations go on top.

**Attachment semantics:** This system will need a strong attachment language that can express: "this glyph is attached to a notehead", "this tie endpoint is attached to this event's pitch row", "this beam belongs to this rhythmic group", and "this symbol floats relative to a harmonic region or segment subdivision." Building this early — before notation symbols are numerous — avoids the expensive retrofit that MuseScore had to do in version 4.4.

**Staff space mapping:** A robust approach is to define a single unit conversion layer — internal engraving unit = staff space (float), projection provides y in pitch-rows plus a `{ pitchRow → staffSpaceY }` mapping, and the renderer converts staff-space geometry to SVG px via one global scale factor. This keeps all engraving constants (stem thickness, beam thickness, slur thickness, padding values) in a consistent unit system as SMuFL intends.

**Import/export boundary:** Think early about what part of this system is "notation as appearance" vs. "notation as musical semantics." Even if the internal model stays custom, having a clear boundary enables future import (ABC, MusicXML fragments) and export (SMuFL-stamped SVG, MIDI) without architectural surgery. Verovio's value is partly that this boundary was designed in from the start.

**The central unknown:** Once conventional notation symbols enter a non-conventional stave, the hard part is no longer the glyphs themselves. It is the contract between musical semantics, rhythmic grouping, vertical reference, and attachment behaviour. This is where mature systems have done the most work, and where this system will either stay clean or become brittle. Every architectural decision about the engraving layer is really a decision about this contract.
