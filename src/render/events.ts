import type { ProjectionEvent } from "../projection";
import {
  getYForPitch,
  NOTEHEAD_HEIGHT_PX,
  PITCH_STEP_HEIGHT_PX,
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

type RenderNoteheadGlyph = RenderGlyph & {
  stemUpSE: ReturnType<typeof getAnchor>;
};

type ShapedPitchedNotehead = {
  centerX: number;
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

type UpStemGeometry = {
  anchorY: number;
  centerX: number;
  leftX: number;
  tipY: number;
};

type DurationAppearance = {
  flagGlyph: RenderGlyph | undefined;
  hasStem: boolean;
  noteheadGlyph: RenderNoteheadGlyph;
  restGlyph: RenderGlyph;
  threshold: number;
};

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

function getRenderNoteheadGlyph(name: GlyphName): RenderNoteheadGlyph {
  const glyph = getRenderGlyph(name);

  return {
    ...glyph,
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
const FLAG_32ND_UP = getRenderGlyph("flag32ndUp");
const FLAG_64TH_UP = getRenderGlyph("flag64thUp");
const FLAG_8TH_UP = getRenderGlyph("flag8thUp");
const PX_PER_STAFF_SPACE =
  NOTEHEAD_HEIGHT_PX / NOTEHEAD_BLACK.heightStaffSpaces;
const MUSIC_GLYPH_FONT_SIZE_PX = PX_PER_STAFF_SPACE * 4;
const ENGRAVING_DEFAULTS = getEngravingDefaults();
const STEM_THICKNESS_PX = ENGRAVING_DEFAULTS.stemThickness * PX_PER_STAFF_SPACE;

// Duration appearance policy for the current renderer.
const DURATION_APPEARANCES: DurationAppearance[] = [
  {
    flagGlyph: undefined,
    hasStem: false,
    noteheadGlyph: NOTEHEAD_WHOLE,
    restGlyph: REST_WHOLE,
    threshold: WHOLE_DURATION,
  },
  {
    flagGlyph: undefined,
    hasStem: true,
    noteheadGlyph: NOTEHEAD_HALF,
    restGlyph: REST_HALF,
    threshold: HALF_DURATION,
  },
  {
    flagGlyph: undefined,
    hasStem: true,
    noteheadGlyph: NOTEHEAD_BLACK,
    restGlyph: REST_QUARTER,
    threshold: QUARTER_DURATION,
  },
  {
    flagGlyph: FLAG_8TH_UP,
    hasStem: true,
    noteheadGlyph: NOTEHEAD_BLACK,
    restGlyph: REST_8TH,
    threshold: 0.5,
  },
  {
    flagGlyph: FLAG_16TH_UP,
    hasStem: true,
    noteheadGlyph: NOTEHEAD_BLACK,
    restGlyph: REST_16TH,
    threshold: 0.25,
  },
  {
    flagGlyph: FLAG_32ND_UP,
    hasStem: true,
    noteheadGlyph: NOTEHEAD_BLACK,
    restGlyph: REST_32ND,
    threshold: 0.125,
  },
  {
    flagGlyph: FLAG_64TH_UP,
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

function getNoteheadDisplacementPx(noteheadGlyph: RenderNoteheadGlyph): number {
  return (
    noteheadGlyph.widthStaffSpaces * PX_PER_STAFF_SPACE - STEM_THICKNESS_PX / 2
  );
}

function appendRest(
  group: SVGGElement,
  centerX: number,
  maxPitch: number,
  pitch: number,
  glyph: RenderGlyph,
): void {
  const y = getYForPitch(maxPitch, pitch);
  const rest = createSvgElement("text");
  const originX = centerX - staffSpacesToPx(glyph.center.x);
  const originY = y + staffSpacesToPx(glyph.center.y);

  setAttributes(rest, {
    fill: "#666666",
    "font-family": getMusicFontFamily(),
    "font-size": MUSIC_GLYPH_FONT_SIZE_PX,
    x: originX,
    y: originY,
  });
  rest.textContent = glyph.character;

  group.append(rest);
}

function appendNote(
  group: SVGGElement,
  centerX: number,
  maxPitch: number,
  pitch: number,
  glyph: RenderNoteheadGlyph,
): { originX: number; originY: number } {
  const notehead = createSvgElement("text");
  const y = getYForPitch(maxPitch, pitch);
  const originX = centerX - staffSpacesToPx(glyph.center.x);
  const originY = y + staffSpacesToPx(glyph.center.y);

  setAttributes(notehead, {
    fill: "#111111",
    "font-family": getMusicFontFamily(),
    "font-size": MUSIC_GLYPH_FONT_SIZE_PX,
    x: originX,
    y: originY,
  });
  notehead.textContent = glyph.character;

  group.append(notehead);

  return { originX, originY };
}

function appendStem(group: SVGGElement, stemGeometry: UpStemGeometry): void {
  const stem = createSvgElement("line");

  setAttributes(stem, {
    stroke: "#111111",
    "stroke-linecap": "butt",
    "stroke-width": STEM_THICKNESS_PX,
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
  stemLeftX: number,
  stemTipY: number,
): void {
  const flag = createSvgElement("text");

  setAttributes(flag, {
    fill: "#111111",
    "font-family": getMusicFontFamily(),
    "font-size": MUSIC_GLYPH_FONT_SIZE_PX,
    x: stemLeftX,
    y: stemTipY,
  });
  flag.textContent = flagGlyph.character;

  group.append(flag);
}

function getUpStemGeometry(
  noteheadGlyph: RenderNoteheadGlyph,
  noteheadOrigin: { originX: number; originY: number },
  maxPitch: number,
  stemTipPitch: number,
): UpStemGeometry | undefined {
  const stemUpSE = noteheadGlyph.stemUpSE;

  if (stemUpSE === undefined) {
    return undefined;
  }

  const anchorX = noteheadOrigin.originX + staffSpacesToPx(stemUpSE.x);
  const anchorY = noteheadOrigin.originY - staffSpacesToPx(stemUpSE.y);
  const tipY =
    getYForPitch(maxPitch, stemTipPitch) -
    staffSpacesToPx(stemUpSE.y) -
    staffSpacesToPx(STEM_LENGTH_STAFF_SPACES);
  const leftX = anchorX - STEM_THICKNESS_PX;

  return {
    anchorY,
    centerX: anchorX - STEM_THICKNESS_PX / 2,
    leftX,
    tipY,
  };
}

function shapePitchedEvent(
  centerX: number,
  duration: number,
  pitches: number[],
): ShapedPitchedEvent | undefined {
  const sortedPitches = [...pitches].sort((left, right) => left - right);
  const noteheads: ShapedPitchedNotehead[] = [];
  const durationAppearance = getDurationAppearance(duration);
  const noteheadGlyph = durationAppearance.noteheadGlyph;
  const hasStem = durationAppearance.hasStem;
  const flagGlyph = durationAppearance.flagGlyph;
  const noteheadDisplacementPx = getNoteheadDisplacementPx(noteheadGlyph);

  sortedPitches.forEach((pitch) => {
    const previousNotehead = noteheads.at(-1);
    const overlapsPrevious =
      previousNotehead !== undefined &&
      (pitch - previousNotehead.pitch) * PITCH_STEP_HEIGHT_PX <
        noteheadGlyph.heightStaffSpaces * PX_PER_STAFF_SPACE;

    noteheads.push({
      centerX: overlapsPrevious ? centerX + noteheadDisplacementPx : centerX,
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
    stemBaseNotehead: hasStem ? noteheads[0] : undefined,
    stemTipPitch: hasStem ? sortedPitches.at(-1) : undefined,
  };
}

function appendPitchedEvent(
  group: SVGGElement,
  centerX: number,
  duration: number,
  maxPitch: number,
  pitches: number[],
): void {
  const shapedEvent = shapePitchedEvent(centerX, duration, pitches);

  if (shapedEvent === undefined) {
    return;
  }

  let stemOrigin:
    | {
        originX: number;
        originY: number;
      }
    | undefined;

  shapedEvent.noteheads.forEach((notehead) => {
    const noteheadOrigin = appendNote(
      group,
      notehead.centerX,
      maxPitch,
      notehead.pitch,
      shapedEvent.noteheadGlyph,
    );

    if (notehead === shapedEvent.stemBaseNotehead) {
      stemOrigin = noteheadOrigin;
    }
  });

  if (
    stemOrigin !== undefined &&
    shapedEvent.stemTipPitch !== undefined &&
    shapedEvent.hasStem
  ) {
    const stemGeometry = getUpStemGeometry(
      shapedEvent.noteheadGlyph,
      stemOrigin,
      maxPitch,
      shapedEvent.stemTipPitch,
    );

    if (stemGeometry !== undefined) {
      appendStem(group, stemGeometry);

      if (shapedEvent.flagGlyph !== undefined) {
        appendFlag(
          group,
          shapedEvent.flagGlyph,
          stemGeometry.leftX,
          stemGeometry.tipY,
        );
      }
    }
  }
}

export function appendProjectedEvent(
  group: SVGGElement,
  centerX: number,
  maxPitch: number,
  projectedEvent: ProjectionEvent,
): void {
  switch (projectedEvent.type) {
    case "pitched":
      appendPitchedEvent(
        group,
        centerX,
        projectedEvent.duration,
        maxPitch,
        projectedEvent.pitches,
      );
      return;
    case "rest":
      appendRest(
        group,
        centerX,
        maxPitch,
        projectedEvent.pitch,
        getDurationAppearance(projectedEvent.duration).restGlyph,
      );
  }
}
