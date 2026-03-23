import type { ProjectedSpan } from "../projection/spans";
import {
  appendBeamGroup,
  buildBeamGroups,
  type BeamStemGeometry,
  type StemDirection,
} from "./beams";
import { getDurationDotCount, getShortDurationBeamCount } from "./duration";
import type { RenderSegmentLayout } from "./layout";
import {
  getYForPitch,
  NOTEHEAD_KNOCKOUT_STROKE_PX,
  NOTEHEAD_HEIGHT_PX,
  PITCH_STEP_HEIGHT_PX,
  SPAN_EVENT_CLEARANCE_PX,
} from "./metrics";
import { createSvgElement, setAttributes } from "./svg";
import {
  getAnchor,
  getEngravingDefaults,
  getGlyphBox,
  getGlyphCharacter,
  getMusicFontFamily,
  type GlyphName,
} from "./smufl";

const DURATION_EPSILON = 0.001;
const QUARTER_DURATION = 1;
const HALF_DURATION = 2;
const WHOLE_DURATION = 4;
const STEM_LENGTH_STAFF_SPACES = 3.5;
const AUGMENTATION_DOT_OFFSET_PX = 8;
const AUGMENTATION_DOT_SPACING_PX = 2;

type RenderGlyph = {
  box: ReturnType<typeof getGlyphBox>;
  center: {
    x: number;
    y: number;
  };
  character: string;
  heightStaffSpaces: number;
  widthStaffSpaces: number;
};

const NOTEHEAD_BACKGROUNDS = {
  noteheadBlack: {
    pathData:
      "M0 42C0 85 31 133 112 133C216 133 325 48 325-40C325-99 275-132 213-132C116-132 0-50 0 42Z",
  },
  noteheadHalf: {
    pathData:
      "M213-132C116-132 0-51 0 42C0 85 31 133 112 133C216 133 325 48 325-40C325-99 275-132 213-132Z",
  },
  noteheadWhole: {
    pathData:
      "M187-136C49-136 0-66 0-1C0 64 49 134 187 134C325 134 373 64 373-1C373-66 325-136 187-136Z",
  },
} as const;

type NoteheadBackgroundName = keyof typeof NOTEHEAD_BACKGROUNDS;

type RenderNoteheadGlyph = RenderGlyph & {
  name: NoteheadBackgroundName;
  stemDownNW: ReturnType<typeof getAnchor>;
  stemUpSE: ReturnType<typeof getAnchor>;
};

type ShapedPitchedNotehead = {
  centerOffsetStaffSpaces: number;
  pitch: number;
};

type ShapedPitchedEvent = {
  flagGlyph: RenderGlyph | undefined;
  hasStem: boolean;
  noteheadGlyph: RenderNoteheadGlyph;
  noteheads: ShapedPitchedNotehead[];
  stemBaseNotehead: ShapedPitchedNotehead | undefined;
  stemTipPitch: number | undefined;
};

type DurationAppearance = {
  hasStem: boolean;
  noteheadGlyph: RenderNoteheadGlyph;
  restGlyph: RenderGlyph;
  threshold: number;
};

type RenderedPitchedEvent = {
  dotCount: number;
  dotPosition:
    | {
        x: number;
        y: number;
      }
    | undefined;
  flagGlyph: RenderGlyph | undefined;
  isBeamed: boolean;
  stemDirection: StemDirection;
  stemGeometry: BeamStemGeometry | undefined;
};

type NoteheadBounds = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

let nextNoteheadKnockoutClipId = 0;

function getRenderGlyph(name: GlyphName): RenderGlyph {
  const box = getGlyphBox(name);

  return {
    box,
    center: {
      x: (box.sw.x + box.ne.x) / 2,
      y: (box.sw.y + box.ne.y) / 2,
    },
    character: getGlyphCharacter(name),
    heightStaffSpaces: box.ne.y - box.sw.y,
    widthStaffSpaces: box.ne.x - box.sw.x,
  };
}

function getRenderNoteheadGlyph(
  name: NoteheadBackgroundName,
): RenderNoteheadGlyph {
  const glyph = getRenderGlyph(name);

  return {
    ...glyph,
    name,
    stemDownNW: getAnchor(name, "stemDownNW"),
    stemUpSE: getAnchor(name, "stemUpSE"),
  };
}

const NOTEHEAD_BLACK = getRenderNoteheadGlyph("noteheadBlack");
const NOTEHEAD_HALF = getRenderNoteheadGlyph("noteheadHalf");
const NOTEHEAD_WHOLE = getRenderNoteheadGlyph("noteheadWhole");
const REST_16TH = getRenderGlyph("rest16th");
const REST_32ND = getRenderGlyph("rest32nd");
const REST_64TH = getRenderGlyph("rest64th");
const REST_8TH = getRenderGlyph("rest8th");
const REST_HALF = getRenderGlyph("restHalf");
const REST_QUARTER = getRenderGlyph("restQuarter");
const REST_WHOLE = getRenderGlyph("restWhole");
const FLAG_16TH_UP = getRenderGlyph("flag16thUp");
const FLAG_16TH_DOWN = getRenderGlyph("flag16thDown");
const FLAG_32ND_UP = getRenderGlyph("flag32ndUp");
const FLAG_32ND_DOWN = getRenderGlyph("flag32ndDown");
const FLAG_64TH_UP = getRenderGlyph("flag64thUp");
const FLAG_64TH_DOWN = getRenderGlyph("flag64thDown");
const FLAG_8TH_UP = getRenderGlyph("flag8thUp");
const FLAG_8TH_DOWN = getRenderGlyph("flag8thDown");
const AUGMENTATION_DOT = getRenderGlyph("augmentationDot");
const PX_PER_STAFF_SPACE =
  NOTEHEAD_HEIGHT_PX / NOTEHEAD_BLACK.heightStaffSpaces;
const MUSIC_GLYPH_FONT_SIZE_PX = PX_PER_STAFF_SPACE * 4;
const STEM_THICKNESS_STAFF_SPACES = getEngravingDefaults().stemThickness;

const DURATION_APPEARANCES: DurationAppearance[] = [
  {
    hasStem: false,
    noteheadGlyph: NOTEHEAD_WHOLE,
    restGlyph: REST_WHOLE,
    threshold: WHOLE_DURATION,
  },
  {
    hasStem: true,
    noteheadGlyph: NOTEHEAD_HALF,
    restGlyph: REST_HALF,
    threshold: HALF_DURATION,
  },
  {
    hasStem: true,
    noteheadGlyph: NOTEHEAD_BLACK,
    restGlyph: REST_QUARTER,
    threshold: QUARTER_DURATION,
  },
  {
    hasStem: true,
    noteheadGlyph: NOTEHEAD_BLACK,
    restGlyph: REST_8TH,
    threshold: 0.5,
  },
  {
    hasStem: true,
    noteheadGlyph: NOTEHEAD_BLACK,
    restGlyph: REST_16TH,
    threshold: 0.25,
  },
  {
    hasStem: true,
    noteheadGlyph: NOTEHEAD_BLACK,
    restGlyph: REST_32ND,
    threshold: 0.125,
  },
  {
    hasStem: true,
    noteheadGlyph: NOTEHEAD_BLACK,
    restGlyph: REST_64TH,
    threshold: 0,
  },
];

function staffSpacesToPx(value: number): number {
  return value * PX_PER_STAFF_SPACE;
}

function isDurationAtLeast(duration: number, threshold: number): boolean {
  return duration + DURATION_EPSILON >= threshold;
}

function getDurationAppearance(duration: number): DurationAppearance {
  return (
    DURATION_APPEARANCES.find((appearance) =>
      isDurationAtLeast(duration, appearance.threshold),
    ) ?? DURATION_APPEARANCES.at(-1)!
  );
}

function getFlagGlyph(
  duration: number,
  stemDirection: StemDirection,
): RenderGlyph | undefined {
  switch (getShortDurationBeamCount(duration)) {
    case 1:
      return stemDirection === "up" ? FLAG_8TH_UP : FLAG_8TH_DOWN;
    case 2:
      return stemDirection === "up" ? FLAG_16TH_UP : FLAG_16TH_DOWN;
    case 3:
      return stemDirection === "up" ? FLAG_32ND_UP : FLAG_32ND_DOWN;
    case 4:
      return stemDirection === "up" ? FLAG_64TH_UP : FLAG_64TH_DOWN;
    default:
      return undefined;
  }
}

function getStemDirection(layer: number): StemDirection {
  return layer === 0 ? "up" : "down";
}

function getNoteheadDisplacementStaffSpaces(
  noteheadGlyph: RenderNoteheadGlyph,
): number {
  return noteheadGlyph.widthStaffSpaces - STEM_THICKNESS_STAFF_SPACES / 2;
}

function appendRest(
  group: SVGGElement,
  centerX: number,
  duration: number,
  maxPitch: number,
  pitch: number,
  glyph: RenderGlyph,
): void {
  const y = getYForPitch(maxPitch, pitch);
  const rest = createSvgElement("text");
  const originX = centerX - staffSpacesToPx(glyph.center.x);
  const originY = y + staffSpacesToPx(glyph.center.y);
  const dotCount = getDurationDotCount(duration);

  setAttributes(rest, {
    fill: "#111111",
    "font-family": getMusicFontFamily(),
    "font-size": MUSIC_GLYPH_FONT_SIZE_PX,
    x: originX,
    y: originY,
  });
  rest.textContent = glyph.character;

  group.append(rest);

  if (dotCount > 0) {
    appendAugmentationDots(
      group,
      dotCount,
      originX +
        staffSpacesToPx(glyph.widthStaffSpaces) +
        AUGMENTATION_DOT_OFFSET_PX,
      y,
    );
  }
}

function appendNote(
  group: SVGGElement,
  glyph: RenderNoteheadGlyph,
  originX: number,
  originY: number,
): void {
  const notehead = createSvgElement("text");

  setAttributes(notehead, {
    fill: "#111111",
    "font-family": getMusicFontFamily(),
    "font-size": MUSIC_GLYPH_FONT_SIZE_PX,
    x: originX,
    y: originY,
  });
  notehead.textContent = glyph.character;

  group.append(notehead);
}

function appendAugmentationDots(
  group: SVGGElement,
  dotCount: number,
  centerX: number,
  centerY: number,
): void {
  for (let index = 0; index < dotCount; index += 1) {
    const dot = createSvgElement("text");
    const dotCenterX =
      centerX +
      index *
        (staffSpacesToPx(AUGMENTATION_DOT.widthStaffSpaces) +
          AUGMENTATION_DOT_SPACING_PX);
    const originX = dotCenterX - staffSpacesToPx(AUGMENTATION_DOT.center.x);
    const originY = centerY + staffSpacesToPx(AUGMENTATION_DOT.center.y);

    setAttributes(dot, {
      fill: "#111111",
      "font-family": getMusicFontFamily(),
      "font-size": MUSIC_GLYPH_FONT_SIZE_PX,
      x: originX,
      y: originY,
    });
    dot.textContent = AUGMENTATION_DOT.character;

    group.append(dot);
  }
}

function getNoteheadOrigin(
  centerX: number,
  maxPitch: number,
  pitch: number,
  glyph: RenderNoteheadGlyph,
): { originX: number; originY: number } {
  const y = getYForPitch(maxPitch, pitch);

  return {
    originX: centerX - staffSpacesToPx(glyph.center.x),
    originY: y + staffSpacesToPx(glyph.center.y),
  };
}

function getNoteheadBounds(
  glyph: RenderNoteheadGlyph,
  originX: number,
  originY: number,
): NoteheadBounds {
  return {
    bottom: originY - staffSpacesToPx(glyph.box.sw.y),
    left: originX + staffSpacesToPx(glyph.box.sw.x),
    right: originX + staffSpacesToPx(glyph.box.ne.x),
    top: originY - staffSpacesToPx(glyph.box.ne.y),
  };
}

function appendNoteheadKnockout(
  group: SVGGElement,
  bounds: NoteheadBounds,
  clipHeight: number,
  clipY: number,
  glyph: RenderNoteheadGlyph,
  originX: number,
  originY: number,
): void {
  const clipId = `notehead-knockout-${nextNoteheadKnockoutClipId++}`;
  const defs = createSvgElement("defs");
  const clipPath = createSvgElement("clipPath");
  const clipRect = createSvgElement("rect");
  const knockout = createSvgElement("text");

  setAttributes(clipPath, { id: clipId });
  setAttributes(clipRect, {
    height: clipHeight,
    width: bounds.right - bounds.left + NOTEHEAD_KNOCKOUT_STROKE_PX * 2,
    x: bounds.left - NOTEHEAD_KNOCKOUT_STROKE_PX,
    y: clipY,
  });
  clipPath.append(clipRect);
  defs.append(clipPath);

  setAttributes(knockout, {
    "clip-path": `url(#${clipId})`,
    fill: "#111111",
    "font-family": getMusicFontFamily(),
    "font-size": MUSIC_GLYPH_FONT_SIZE_PX,
    x: originX,
    y: originY,
  });
  knockout.textContent = glyph.character;

  group.append(defs, knockout);
}

function appendNoteheadBackground(
  group: SVGGElement,
  glyph: RenderNoteheadGlyph,
  originX: number,
  originY: number,
): void {
  const background = NOTEHEAD_BACKGROUNDS[glyph.name];
  const path = createSvgElement("path");
  const glyphScale = MUSIC_GLYPH_FONT_SIZE_PX / 1000;

  setAttributes(path, {
    d: background.pathData,
    fill: "#ffffff",
    transform: `translate(${originX} ${originY}) scale(${glyphScale} ${glyphScale})`,
  });

  group.append(path);
}

function getSpanBounds(
  maxPitch: number,
  span: ProjectedSpan,
): {
  bottom: number;
  top: number;
} {
  return {
    bottom: getYForPitch(maxPitch, span.start) - SPAN_EVENT_CLEARANCE_PX,
    top: getYForPitch(maxPitch, span.end) + SPAN_EVENT_CLEARANCE_PX,
  };
}

function getOwningSpan(
  renderSegmentLayout: RenderSegmentLayout,
  pitch: number,
): ProjectedSpan | undefined {
  const containingSpans =
    renderSegmentLayout.segment.placement.field.spans.filter(
      (span) => span.start <= pitch && pitch <= span.end,
    );

  return containingSpans.sort(
    (left, right) =>
      left.end - left.start - (right.end - right.start) ||
      left.start - right.start,
  )[0];
}

function appendOverflowKnockout(
  group: SVGGElement,
  bounds: NoteheadBounds,
  glyph: RenderNoteheadGlyph,
  maxPitch: number,
  suppressBottom: boolean,
  suppressTop: boolean,
  originX: number,
  originY: number,
  owningSpan: ProjectedSpan | undefined,
): void {
  if (owningSpan === undefined) {
    return;
  }

  const spanBounds = getSpanBounds(maxPitch, owningSpan);
  const noteheadMidY = (bounds.top + bounds.bottom) / 2;

  if (!suppressTop && bounds.top < spanBounds.top) {
    appendNoteheadKnockout(
      group,
      bounds,
      noteheadMidY - bounds.top + NOTEHEAD_KNOCKOUT_STROKE_PX,
      bounds.top - NOTEHEAD_KNOCKOUT_STROKE_PX,
      glyph,
      originX,
      originY,
    );
  }

  if (!suppressBottom && bounds.bottom > spanBounds.bottom) {
    appendNoteheadKnockout(
      group,
      bounds,
      bounds.bottom - noteheadMidY + NOTEHEAD_KNOCKOUT_STROKE_PX,
      noteheadMidY,
      glyph,
      originX,
      originY,
    );
  }
}

function appendStem(group: SVGGElement, stemGeometry: BeamStemGeometry): void {
  const stem = createSvgElement("line");

  setAttributes(stem, {
    stroke: "#111111",
    "stroke-linecap": "butt",
    "stroke-width": staffSpacesToPx(STEM_THICKNESS_STAFF_SPACES),
    x1: stemGeometry.centerX,
    x2: stemGeometry.centerX,
    y1: stemGeometry.anchorY,
    y2: stemGeometry.tipY,
  });

  group.append(stem);
}

function appendFlag(
  group: SVGGElement,
  flagGlyph: RenderGlyph,
  stemDirection: StemDirection,
  stemX: number,
  stemTipY: number,
): void {
  const flag = createSvgElement("text");
  const anchorName = stemDirection === "up" ? "stemUpNW" : "stemDownSW";
  const anchor = getAnchor(
    stemDirection === "up"
      ? flagGlyph.character === FLAG_8TH_UP.character
        ? "flag8thUp"
        : flagGlyph.character === FLAG_16TH_UP.character
          ? "flag16thUp"
          : flagGlyph.character === FLAG_32ND_UP.character
            ? "flag32ndUp"
            : flagGlyph.character === FLAG_64TH_UP.character
              ? "flag64thUp"
              : "flag8thUp"
      : flagGlyph.character === FLAG_8TH_DOWN.character
        ? "flag8thDown"
        : flagGlyph.character === FLAG_16TH_DOWN.character
          ? "flag16thDown"
          : flagGlyph.character === FLAG_32ND_DOWN.character
            ? "flag32ndDown"
            : flagGlyph.character === FLAG_64TH_DOWN.character
              ? "flag64thDown"
              : "flag8thDown",
    anchorName,
  );
  const x = stemX - staffSpacesToPx(anchor?.x ?? 0);
  const y = stemTipY + staffSpacesToPx(anchor?.y ?? 0);

  setAttributes(flag, {
    fill: "#111111",
    "font-family": getMusicFontFamily(),
    "font-size": MUSIC_GLYPH_FONT_SIZE_PX,
    x,
    y,
  });
  flag.textContent = flagGlyph.character;

  group.append(flag);
}

function getStemGeometry(
  noteheadGlyph: RenderNoteheadGlyph,
  noteheadOrigin: { originX: number; originY: number },
  stemDirection: StemDirection,
  maxPitch: number,
  stemTipPitch: number,
): BeamStemGeometry | undefined {
  const anchor =
    stemDirection === "up" ? noteheadGlyph.stemUpSE : noteheadGlyph.stemDownNW;

  if (anchor === undefined) {
    return undefined;
  }

  const stemThicknessPx = staffSpacesToPx(STEM_THICKNESS_STAFF_SPACES);
  const anchorX = noteheadOrigin.originX + staffSpacesToPx(anchor.x);
  const anchorY = noteheadOrigin.originY - staffSpacesToPx(anchor.y);
  const tipY =
    getYForPitch(maxPitch, stemTipPitch) -
    staffSpacesToPx(anchor.y) +
    (stemDirection === "up"
      ? -staffSpacesToPx(STEM_LENGTH_STAFF_SPACES)
      : staffSpacesToPx(STEM_LENGTH_STAFF_SPACES));
  const leftX = stemDirection === "up" ? anchorX - stemThicknessPx : anchorX;

  return {
    anchorY,
    centerX:
      stemDirection === "up"
        ? anchorX - stemThicknessPx / 2
        : anchorX + stemThicknessPx / 2,
    leftX,
    tipY,
  };
}

function shapePitchedEvent(
  duration: number,
  layer: number,
  pitches: number[],
): ShapedPitchedEvent | undefined {
  const sortedPitches = [...pitches].sort((left, right) => left - right);
  const noteheads: ShapedPitchedNotehead[] = [];
  const durationAppearance = getDurationAppearance(duration);
  const noteheadGlyph = durationAppearance.noteheadGlyph;
  const hasStem = durationAppearance.hasStem;
  const stemDirection = getStemDirection(layer);
  const flagGlyph = getFlagGlyph(duration, stemDirection);
  const noteheadDisplacementStaffSpaces =
    getNoteheadDisplacementStaffSpaces(noteheadGlyph);

  sortedPitches.forEach((pitch) => {
    const previousNotehead = noteheads.at(-1);
    const overlapsPrevious =
      previousNotehead !== undefined &&
      (pitch - previousNotehead.pitch) * PITCH_STEP_HEIGHT_PX <
        noteheadGlyph.heightStaffSpaces * PX_PER_STAFF_SPACE;

    noteheads.push({
      centerOffsetStaffSpaces: overlapsPrevious
        ? noteheadDisplacementStaffSpaces
        : 0,
      pitch,
    });
  });

  if (noteheads.length === 0) {
    return undefined;
  }

  return {
    flagGlyph,
    hasStem,
    noteheadGlyph,
    noteheads,
    stemBaseNotehead: hasStem
      ? stemDirection === "up"
        ? noteheads[0]
        : noteheads.at(-1)
      : undefined,
    stemTipPitch: hasStem
      ? stemDirection === "up"
        ? sortedPitches.at(-1)
        : sortedPitches[0]
      : undefined,
  };
}

function appendPitchedEvent(
  knockoutGroup: SVGGElement,
  fillGroup: SVGGElement,
  inkGroup: SVGGElement,
  centerX: number,
  duration: number,
  layer: number,
  maxPitch: number,
  pitches: number[],
  renderSegmentLayout: RenderSegmentLayout,
): RenderedPitchedEvent | undefined {
  const stemDirection = getStemDirection(layer);
  const shapedEvent = shapePitchedEvent(duration, layer, pitches);
  const dotCount = getDurationDotCount(duration);

  if (shapedEvent === undefined) {
    return undefined;
  }

  let stemOrigin:
    | {
        originX: number;
        originY: number;
      }
    | undefined;
  let dotPosition:
    | {
        x: number;
        y: number;
      }
    | undefined;

  shapedEvent.noteheads.forEach((notehead) => {
    const suppressBottom = shapedEvent.noteheads.some(
      (candidate) =>
        candidate.pitch < notehead.pitch &&
        notehead.pitch - candidate.pitch <= 3,
    );
    const suppressTop = shapedEvent.noteheads.some(
      (candidate) =>
        candidate.pitch > notehead.pitch &&
        candidate.pitch - notehead.pitch <= 3,
    );
    const noteheadOrigin = getNoteheadOrigin(
      centerX + staffSpacesToPx(notehead.centerOffsetStaffSpaces),
      maxPitch,
      notehead.pitch,
      shapedEvent.noteheadGlyph,
    );
    const noteheadBounds = getNoteheadBounds(
      shapedEvent.noteheadGlyph,
      noteheadOrigin.originX,
      noteheadOrigin.originY,
    );

    appendNoteheadBackground(
      fillGroup,
      shapedEvent.noteheadGlyph,
      noteheadOrigin.originX,
      noteheadOrigin.originY,
    );
    appendOverflowKnockout(
      knockoutGroup,
      noteheadBounds,
      shapedEvent.noteheadGlyph,
      maxPitch,
      suppressBottom,
      suppressTop,
      noteheadOrigin.originX,
      noteheadOrigin.originY,
      getOwningSpan(renderSegmentLayout, notehead.pitch),
    );
    appendNote(
      inkGroup,
      shapedEvent.noteheadGlyph,
      noteheadOrigin.originX,
      noteheadOrigin.originY,
    );

    if (notehead === shapedEvent.noteheads.at(-1)) {
      dotPosition = {
        x: noteheadBounds.right + AUGMENTATION_DOT_OFFSET_PX,
        y: getYForPitch(maxPitch, notehead.pitch),
      };
    }

    if (notehead === shapedEvent.stemBaseNotehead) {
      stemOrigin = noteheadOrigin;
    }
  });

  return {
    dotCount,
    dotPosition: dotCount > 0 ? dotPosition : undefined,
    flagGlyph: shapedEvent.flagGlyph,
    isBeamed: false,
    stemDirection,
    stemGeometry:
      stemOrigin !== undefined &&
      shapedEvent.stemTipPitch !== undefined &&
      shapedEvent.hasStem
        ? getStemGeometry(
            shapedEvent.noteheadGlyph,
            stemOrigin,
            stemDirection,
            maxPitch,
            shapedEvent.stemTipPitch,
          )
        : undefined,
  };
}

function appendStandaloneStemAndFlag(
  group: SVGGElement,
  renderedPitchedEvent: RenderedPitchedEvent,
): void {
  if (renderedPitchedEvent.stemGeometry === undefined) {
    return;
  }

  appendStem(group, renderedPitchedEvent.stemGeometry);

  if (renderedPitchedEvent.flagGlyph !== undefined) {
    appendFlag(
      group,
      renderedPitchedEvent.flagGlyph,
      renderedPitchedEvent.stemDirection,
      renderedPitchedEvent.stemGeometry.centerX,
      renderedPitchedEvent.stemGeometry.tipY,
    );
  }

  if (
    renderedPitchedEvent.dotPosition !== undefined &&
    renderedPitchedEvent.dotCount > 0
  ) {
    appendAugmentationDots(
      group,
      renderedPitchedEvent.dotCount,
      renderedPitchedEvent.dotPosition.x,
      renderedPitchedEvent.dotPosition.y,
    );
  }
}

export function appendProjectedSegmentEvents(
  knockoutGroup: SVGGElement,
  fillGroup: SVGGElement,
  inkGroup: SVGGElement,
  maxPitch: number,
  renderSegmentLayout: RenderSegmentLayout,
): void {
  const beamGroups = buildBeamGroups(
    renderSegmentLayout.segment.events,
    renderSegmentLayout.segment.timeSignature,
  );
  const beamedEventIndices = new Set<number>();
  const renderedPitchedEventsByIndex = new Map<number, RenderedPitchedEvent>();

  beamGroups.forEach((beamGroup) => {
    beamGroup.eventIndices.forEach((eventIndex) => {
      beamedEventIndices.add(eventIndex);
    });
  });

  renderSegmentLayout.segment.events.forEach((projectedEvent, eventIndex) => {
    const centerX =
      renderSegmentLayout.x + projectedEvent.x * renderSegmentLayout.widthPx;

    switch (projectedEvent.type) {
      case "pitched": {
        const renderedPitchedEvent = appendPitchedEvent(
          knockoutGroup,
          fillGroup,
          inkGroup,
          centerX,
          projectedEvent.duration,
          projectedEvent.layer,
          maxPitch,
          projectedEvent.pitches,
          renderSegmentLayout,
        );

        if (renderedPitchedEvent !== undefined) {
          renderedPitchedEvent.isBeamed = beamedEventIndices.has(eventIndex);
          renderedPitchedEventsByIndex.set(eventIndex, renderedPitchedEvent);
        }
        return;
      }
      case "rest":
        appendRest(
          inkGroup,
          centerX,
          projectedEvent.duration,
          maxPitch,
          projectedEvent.pitch,
          getDurationAppearance(projectedEvent.duration).restGlyph,
        );
    }
  });

  beamGroups.forEach((beamGroup) => {
    const renderedPitchedEvents = beamGroup.eventIndices
      .map((eventIndex) => renderedPitchedEventsByIndex.get(eventIndex))
      .filter(
        (renderedPitchedEvent): renderedPitchedEvent is RenderedPitchedEvent =>
          renderedPitchedEvent !== undefined,
      );

    appendBeamGroup(
      inkGroup,
      beamGroup.beamCounts,
      renderedPitchedEvents
        .map((renderedPitchedEvent) => renderedPitchedEvent.stemGeometry)
        .filter(
          (stemGeometry): stemGeometry is BeamStemGeometry =>
            stemGeometry !== undefined,
        ),
      renderedPitchedEvents[0]?.stemDirection ?? "up",
      appendStem,
      staffSpacesToPx,
      STEM_THICKNESS_STAFF_SPACES,
    );
  });

  renderedPitchedEventsByIndex.forEach((renderedPitchedEvent) => {
    if (!renderedPitchedEvent.isBeamed) {
      appendStandaloneStemAndFlag(inkGroup, renderedPitchedEvent);
    }
  });
}
