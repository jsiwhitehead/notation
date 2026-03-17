# Music Notation Rendering Research

Research into VexFlow, LilyPond, Verovio, MuseScore, and the SMuFL/Bravura specification. Extracted for application to this system. Stave-specific conventions are noted where they require adaptation.

---

## Sources

### VexFlow

Repository: https://github.com/0xfe/vexflow

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

Key source directories:

- `src/engraving/` — core engraving module: data model, layout, and rendering (major rewrite for MuseScore 4)
- `src/notation/` — score interaction layer (sits above engraving)

Documentation:

- Code structure wiki: https://github.com/musescore/MuseScore/wiki/CodeStructure
- MuseScore 4.0 engraving improvements: https://musescore.org/en/node/330793
- MuseScore Studio 4.4 engraving improvements: https://musescore.org/en/node/366024

_(Not deeply researched yet — `src/engraving/` is the entry point for future investigation.)_

### SMuFL specification

Spec: https://w3c.github.io/smufl/latest/

Sections consulted:

- Glyph registration and coordinate system
- `glyphsWithAnchors` — all 22 anchor definitions and semantics
- `engravingDefaults` — canonical thickness and spacing values
- Glyph ranges: noteheads (U+E0A0), flags (U+E240), rests (U+E4E3), accidentals (U+E260), articulations (U+E4A0), dynamics (U+E520)

### Bravura font metadata

Repository: https://github.com/steinbergmedia/bravura

Key files:

- `redist/bravura_metadata.json` — all `glyphsWithAnchors` values (stem anchor coordinates), `engravingDefaults` values, `glyphAdvanceWidths`, glyph bounding boxes

---

## Contents

1. [SMuFL — the universal glyph standard](#smufl--the-universal-glyph-standard)
2. [Noteheads](#noteheads)
3. [Stems](#stems)
4. [Flags](#flags)
5. [Beams](#beams)
6. [Rests](#rests)
7. [Augmentation dots](#augmentation-dots)
8. [Accidentals](#accidentals)
9. [Ties and slurs](#ties-and-slurs)
10. [Tuplets](#tuplets)
11. [Horizontal spacing](#horizontal-spacing)
12. [Multi-voice / polyphony](#multi-voice--polyphony)
13. [Articulations](#articulations)
14. [Dynamics](#dynamics)
15. [Rendering architecture](#rendering-architecture)
16. [Key constants reference](#key-constants-reference)
17. [Adaptation notes for this system](#adaptation-notes-for-this-system)

---

## SMuFL — the universal glyph standard

All four systems (VexFlow, LilyPond, Verovio, MuseScore) use the **Bravura** font with **SMuFL** Unicode codepoints. The key principle: every glyph has defined **anchor points** in `bravura_metadata.json` that specify exactly where to attach stems, where ledger lines clip, where ties originate. Using this metadata vs. guessing positions is the difference between professional-quality output and approximation.

### Coordinate system

SMuFL coordinates are expressed in **staff spaces** — the distance between adjacent staff lines. This is the universal unit across all notation systems. Y increases upward (Cartesian), which is the opposite of screen/SVG coordinates.

One staff space = 0.25 em at the font design size. For Bravura at 1000 upm, one staff space = 250 units.

### Glyph anchor points

The `glyphsWithAnchors` section of `bravura_metadata.json` defines attachment points for each glyph. All coordinates are in staff spaces relative to the glyph origin.

Key anchors:

| Anchor                      | Semantics                                                                                       |
| --------------------------- | ----------------------------------------------------------------------------------------------- |
| `stemUpSE`                  | Bottom-right corner of an up-stem rectangle — where the stem meets the notehead when stem is up |
| `stemDownNW`                | Top-left corner of a down-stem rectangle — where the stem meets the notehead when stem is down  |
| `stemUpNW`                  | Used on flag glyphs: amount by which stem must be lengthened for flag connection on up-stems    |
| `stemDownSW`                | Used on flag glyphs: stem-lengthening amount for flag connection on down-stems                  |
| `nominalWidth`              | Width for precise positioning (e.g. ledger lines)                                               |
| `opticalCenter`             | Optical center for alignment (especially dynamics)                                              |
| `graceNoteSlashSW/NE/NW/SE` | Grace note slash positioning                                                                    |

Example from Bravura metadata:

```json
"noteheadBlack": {
  "stemDownNW": [0.0, -0.184],
  "stemUpSE":   [1.328, 0.184]
}
```

When stem is up, attach at x=1.328, y=0.184 staff spaces from the notehead origin. When stem is down, attach at x=0.0, y=-0.184.

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
- `U+E4AE/E4AF` — marcatoStaccatoAbove / marcatoStaccatoBelow
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

---

## Noteheads

### Notehead types by duration

| Duration             | Glyph               | Filled | Has stem    |
| -------------------- | ------------------- | ------ | ----------- |
| Double whole (breve) | noteheadDoubleWhole | Open   | No standard |
| Whole                | noteheadWhole       | Open   | No          |
| Half                 | noteheadHalf        | Open   | Yes         |
| Quarter and shorter  | noteheadBlack       | Filled | Yes         |

### Notehead sizing

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

### Notehead merging (unison in multi-voice)

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

**Multi-voice convention (universal, non-negotiable):** Voice 1 = stems UP. Voice 2 = stems DOWN.

For three voices: the middle voice yields to beamed notes in adjacent voices; un-beamed notes adjust direction to resolve conflicts with beamed groups.

### Stem length

Default: **3.5 staff spaces** (7 half-spaces). Consistent across LilyPond, VexFlow, Verovio.

Length array by flag count (staff spaces):

```
[0 flags, 1, 2, 3, 4, 5, 6, 7, 8]
[3.5,    3.5, 3.5, 4.25, 5.0, 6.0, 7.0, 8.0, 9.0]
```

Extension for extreme notes: when a note is more than 3.5 staff spaces (approximately one octave) from the staff center, extend the stem by the overshoot amount:

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

### Stem attachment to noteheads

Use SMuFL anchor data directly:

- Up-stem: the bottom-right corner of the stem rectangle touches the `stemUpSE` anchor of the notehead
- Down-stem: the top-left corner touches `stemDownNW`

For noteheadBlack: `stemUpSE = [1.328, 0.184]`, `stemDownNW = [0.0, -0.184]` (staff spaces)

**Stem width:** `0.12` ss (SMuFL spec). VexFlow uses `1.5px` at 10px/ss.

### Stem extension for flags

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

### Flag glyph placement

The flag glyph's origin (x=0, y=0) is positioned at the **stem tip**. For up-stems, the flag curves downward from the stem tip. For down-stems, it extends upward.

A small horizontal shift centers the flag on the stem: VexFlow applies `shiftX = -0.75` units.

### Flag extents (Bravura)

flag8thUp extends approximately 3.24 staff spaces **downward** from the stem tip (the visual curve sweeping down toward the notehead).

flag8thDown extends approximately 3.23 staff spaces **upward** from the stem tip.

### Flags suppressed by beams

When a note belongs to a beam group, its flag glyph is **not rendered**. The beam provides the visual grouping signal. Flags are only drawn on isolated short-duration notes.

---

## Beams

### When to beam

- Only notes shorter than a quarter note (8th and shorter)
- Groups of ≥2 eligible notes
- Grouping follows the beat structure of the time signature
- First and last notes of a beam group must be eligible (no quarter+ notes can be beam endpoints)

### Beam slope — the VexFlow algorithm

The definitive approach from VexFlow source:

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

### Beam slope — LilyPond penalty model

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

### Beam thickness and secondary beams

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

Break points are governed by the rhythmic grouping (typically at beat boundaries). Partial beam length ≈ 1 staff space (10px at 10px/ss in VexFlow).

### Beams over rests

Default behavior: beams break at rests. Options:

- Beam through interior rests (note must not be first or last in group)
- Rested beats within a beamed group get **stemlets** — short stub stems at height = total beam stack height + clearance gap

### Flat beams

Alternative policy: `slope = 0`, beam offset = average of all stem tip positions, adjusted for extreme notes and beam thickness. Useful for visual consistency in some layouts.

### Auto-knee threshold

When the gap between a beam group's highest and lowest notes exceeds **5.5 staff spaces**, the beam is a "kneed beam" — the beam bends to accommodate the large interval. LilyPond expands its search region and applies `× 10` to the IDEAL_SLOPE_FACTOR for cross-staff beams.

---

## Rests

### Rest glyphs by duration

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

### Rest vertical positioning (stave context — adapt for custom layout)

The canonical staff positions for rests:

| Duration            | Default placement                   |
| ------------------- | ----------------------------------- |
| Whole               | Hangs below the fourth staff line   |
| Half                | Sits on top of the third staff line |
| Quarter and shorter | Centered at staff middle            |

**Whole rest:** Top-heavy, like an inverted hat. The glyph **hangs** from the line above it.
**Half rest:** Right-side-up hat. The glyph **sits** on the line below it.

This whole/half distinction is important for recognition even outside traditional stave contexts.

### Rest in polyphonic context

Voice 1 rests (stems-up voice) float **upward** away from Voice 2. Voice 2 rests float **downward**. Default offset positions:

- Voice 1 rest: position 6 (or 8 for overlap with quarter notes)
- Voice 2 rest: position 2

When rests from different voices would collide, they are displaced vertically. The upper-voice rest moves up; lower-voice moves down.

### Multi-measure rests

Use the `restHBar` glyph (U+E4EE), or draw a thick horizontal bar with thin vertical end caps and a number above indicating the measure count. Triggered when two or more consecutive measures are empty.

---

## Augmentation dots

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

### Accidental glyphs

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

**Padding:** `0.2` staff spaces between accidental right edge and notehead left edge (LilyPond default).

---

## Ties and slurs

### Tie vs slur distinction

**Tie:** Connects two notes of the **same pitch**, indicating they should sustain as one sound. Each note in a chord gets its own tie. Ties are thinner, shorter, and sit close to noteheads.

**Slur:** Phrasing mark over notes of **different pitches**, indicating legato articulation. Larger and more prominent than ties.

### Direction rules (universal)

Tie/slur goes **opposite** to stem direction:

- Stem up → curve below the note
- Stem down → curve above the note

For chords: the top note's tie curves upward; the bottom note's tie curves downward; middle notes follow the same rules based on their individual stem context.

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

Slurs scan for collisions with: accidentals, articulations, noteheads, stems, tuplet brackets. When a collision is detected, the slur's control points are adjusted upward/downward to clear the obstacle. LilyPond applies penalty weights: accidental collision, general object collision, notehead clearance, nested slur clearance, staff-line avoidance.

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
| Property | Default | Meaning |
|----------|---------|---------|
| `edge-height` | 0.7 ss each end | Left and right vertical hook heights |
| `padding` | 1.1 ss | Space between bracket and adjacent objects |
| `thickness` | 1.6 (staff-line multiples) | Bracket line thickness |
| `staff-padding` | 0.25 ss | Minimum distance from staff |

### Bracket slope

- VexFlow: always horizontal (no slope)
- LilyPond: when the tuplet is attached to a beam, the bracket copies the beam's slope

### When to omit bracket

Brackets are omitted when notes are **beamed** — the beam itself already implies the grouping. Only un-beamed tuplets need an explicit bracket.

### Ratioed tuplets

For "3 in the space of 2" style: render as `3:2` with a colon composed of two small circles. VexFlow positions the dots at approximately `±0.1×` the number point size above/below the horizontal center.

---

## Horizontal spacing

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

### ModifierContext layout order (VexFlow)

The sequence in which modifiers are laid out matters — each step assumes prior steps are complete:

1. Note itself
2. Parentheses
3. Dots
4. Accidentals
5. Grace note groups
6. Articulations
7. Ornaments
8. Annotations / chord symbols
9. Bend, vibrato

### TickContext / ModifierContext grouping

A **TickContext** groups all notes at the same beat position across all voices. Spacing is computed once per tick context, not per note. A **ModifierContext** groups all modifiers (accidentals, dots, articulations) for all notes at the same tick. This two-level grouping keeps spacing logic manageable.

### Tick context width

```
totalWidth = notePx
           + max(modLeftPx + leftDisplacedHeadPx)
           + max(modRightPx + rightDisplacedHeadPx)
           + 2px padding
```

### Skyline algorithm (LilyPond — collision avoidance at scale)

Instead of O(n²) bounding-box checks, every element's silhouette is represented as a piecewise-linear **skyline** profile (top profile and bottom profile separately). Two opposing skylines can be compared in O(n) to find the minimum safe clearance.

```
skyline = sequence of segments:
  each segment: [x_left, x_right, slope, y_intercept]
  height(x) = slope × x + y_intercept

distance(skylineA, skylineB):
  = max(skylineA.height(x) + skylineB.height(x)) for all x
  // iterate both skylines simultaneously at segment boundaries
```

Padding is applied by inflating each skyline outward by the required clearance distance.

This is what allows LilyPond to handle dense scores without performance collapse. For any system where many elements need clearance checks (accidentals, articulations, annotations), this pattern is far more scalable than bounding-box intersection.

---

## Multi-voice / polyphony

### Voice stem conventions

**Universal across all systems:**

- Voice 1 = stems UP
- Voice 2 = stems DOWN

Three voices: middle voice yields to beamed notes in adjacent voices; un-beamed middle-voice notes adjust direction to resolve conflicts.

### Shared noteheads at unison

Notes at the same pitch in different voices may share a notehead under strict conditions. Both stems attach to the shared notehead. Conditions for sharing:

- Same head style
- Same dot count
- Same head type
- Never quarter + half at unison
- Never whole notes

### Offsetting noteheads for seconds

When notes in the same chord are a second apart (including across voices), one displaces horizontally. The displacement side depends on which voice is above/below — typically the lower voice's notehead shifts right. The stem of the displaced note still originates from the correct side of its notehead.

### Rest collision handling

When rests from opposing voices occupy the same vertical region, they are displaced. Voice 1 rest moves upward; Voice 2 rest moves downward. The specific displacement amount depends on the rests' durations and the density of surrounding material.

---

## Articulations

### Placement rules

**Default position:** Above the note (or below when notated that way). When a stem is present, articulations go on the stem side by default for accent/tenuto; staccato always goes between the note and the stem tip.

**Offset from note:**

- Stem-tip side: initial offset = 0.5 staff spaces from stem tip
- Non-stem side: initial offset = 1.0 staff spaces from notehead

**Snapping to staff positions:** Articulations snap to the nearest line or space. If the snapped position would be on a staff line and the articulation needs to be between lines, it shifts an additional 0.5 spaces away from the note.

### Stacking multiple articulations

When multiple articulations appear on the same note, they stack outward from the note:

```
each articulation: y += glyphHeight / 10 + 0.5ss margin
```

### Avoid-slur behavior

Most articulations default to `avoid-slur: inside` — they stay between the note and the slur curve rather than outside it.

### Outside-staff priority

Articulations outside the staff have an `outside-staff-priority` value that controls their stacking order relative to other outside-staff elements (dynamics, text, etc.). Higher priority = closer to the staff.

---

## Dynamics

### Positioning

Dynamics are placed **below** the staff by default (above for vocal music). They align horizontally with the beat position of their attached note, using the glyph's `opticalCenter` anchor rather than its left edge.

### Hairpin rendering (crescendo/decrescendo)

A hairpin is a wedge shape:

- Opening end (crescendo) or closing end (decrescendo) has a specified opening height
- Lines converge to a point at the closed end

LilyPond hairpin properties:
| Property | Default | Meaning |
|----------|---------|---------|
| `height` | 0.667 ss | Maximum opening height |
| `thickness` | 1.0 (staff-line multiples) | Line thickness |
| `minimum-length` | 2.0 ss | Minimum span |

Verovio: maximum hairpin angle capped at **16 degrees** to prevent overly steep wedges. Angle is computed as `theta = 2 × atan((endY / 2) / length)` and clipped at the maximum.

---

## Rendering architecture

### Logical → graphical separation (LilyPond)

Strict pipeline stages:

1. **Music expressions** — pitches, durations, logical structure (Scheme data)
2. **Contexts** (Score → Staff → Voice) — hierarchical processing containers
3. **Engravers** — convert music expressions into graphical objects (grobs)
4. **Grobs** — layout objects with lazily-evaluated properties
5. **Stencils** — actual drawing instructions

Properties are computed via callbacks on demand. A stem's direction is only computed when requested, allowing later stages to modify earlier decisions without re-running the full pipeline. This lazy evaluation is key to keeping interdependent layout decisions manageable.

### Functor visitor pattern (Verovio)

All layout passes are independent functors that traverse the object tree in sequence:

- `CalcStemFunctor` — stem directions and lengths
- `CalcBeamFunctor` — beam slopes and positions
- `CalcSlurFunctor` — slur control points
- `CalcAccidsFunctor` — accidental stacking
- `AdjustDotsFunctor` — dot vertical positioning
- `HorizontalAligner` — x-coordinate assignment
- `SpacingFunctor` — proportional spacing

Each functor is a single focused pass, easy to reason about in isolation and to reorder when needed.

### TickContext / ModifierContext (VexFlow)

A `TickContext` groups all notes at the **same beat position** across all voices. Spacing is computed once per tick context. A `ModifierContext` groups all modifiers at the same tick and formats them in a fixed sequence (dots → accidentals → articulations → annotations). Each step assumes prior steps are complete.

`Formatter.format()` phases:

1. `preFormat()` — calculate width for each tickable and its modifiers
2. `postFormat()` — position all contexts horizontally using softmax spacing
3. Apply final positions to stave elements

### SVG layer ordering (standard across all systems)

Paint order, bottom-to-top (later elements visually on top):

1. Background, filled regions
2. Staff lines, ledger lines
3. Noteheads
4. Stems
5. Beams
6. Flags
7. Dots, accidentals, articulations
8. Ties, slurs — always above other note elements
9. Text labels, dynamics, chord symbols, annotations

### SVG precision

VexFlow renders to 3 decimal places (`RENDER_PRECISION_PLACES = 3`). Coordinates use internal pen state (pen.x, pen.y) in screen coordinates (Y increases downward). Scaling via SVG `viewBox`, not CSS transforms. All paths use moveTo / lineTo / bezierCurveTo / arc primitives.

---

## Key constants reference

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
Tie bezier height:           ~0.6 ss  (1.6 × drawingUnit where unit ≈ 0.375 ss)
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

## Adaptation notes for this system

This system uses a custom pitch-space layout rather than traditional staves. The following standard assumptions require adaptation:

**Staff-space unit:** The system's `ROW_HEIGHT` (currently `3px`) is the equivalent unit. All constants above scale from it. A "staff space" = `ROW_HEIGHT` in this system.

**Stem direction reference:** Without a conventional staff middle line, define the reference as the visual center of the visible pitch window, or derive it from the harmonic region's grounding pitch class (the `ground` field).

**Dot positioning:** The pitch row grid is already discretized. Dots-in-spaces maps directly: a dot for a note at row `n` goes at row `n + 0.5`. Check whether row `n + 0.5` is occupied before committing.

**Rest positioning:** The whole/half rest visual distinction (hang vs sit) still applies and aids recognition. The specific staff-line anchoring rules are replaced by positioning relative to the local pitch window center.

**Horizontal spacing:** The current layout uses a fixed segment width. When notes of varying duration appear within a segment, the Gourlay formula or the Verovio power-law model gives perceptually correct proportions. Both scale from the shortest note present.

**Glyph rendering:** The biggest single quality improvement available is switching from hand-drawn SVG primitives to the Bravura font with SMuFL codepoints. Embed the font, use the anchor metadata for stem attachment and ledger line clipping. Every other serious system does this because the glyph proportions are professionally designed and the anchor data eliminates geometry guesswork entirely.

**Ledger lines:** In this system, "ledger lines" are not needed in the stave sense, since pitch position is continuous rather than anchored to fixed staff lines. The concept may re-emerge if extended pitch ranges are indicated with supplementary position markers.

**Layer ordering for SVG:** The standard paint order above applies directly. Harmonic region shapes (the current span fills) should be the lowest layer; note events render above them; ties, slurs, and annotations go on top.
