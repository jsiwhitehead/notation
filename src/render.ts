import {
  type Projection,
  type ProjectionEvent,
  type ProjectionSegment,
  type ProjectedSpan,
  type Span,
} from "./projection";
import { regionToColor, regionToWheel24, wheel24ToDarkColor } from "./color";
import {
  getEngravingDefaults,
  getMusicFontFamily,
  getSmuflAnchor,
  getSmuflGlyphBox,
  getSmuflGlyphCharacter,
  type SmuflGlyphName,
} from "./smufl";
const SVG_NS = "http://www.w3.org/2000/svg";

// Render units.
const PITCH_STEP_HEIGHT_PX = 3;
const NOTEHEAD_HEIGHT_PX = 8;
const DURATION_EPSILON = 0.001;
const QUARTER_DURATION = 1;
const HALF_DURATION = 2;
const WHOLE_DURATION = 4;

type RenderGlyph = {
  box: ReturnType<typeof getSmuflGlyphBox>;
  center: {
    x: number;
    y: number;
  };
  character: string;
  heightStaffSpaces: number;
  widthStaffSpaces: number;
};

type RenderNoteheadGlyph = RenderGlyph & {
  stemUpSE: ReturnType<typeof getSmuflAnchor>;
};

function getRenderGlyph(name: SmuflGlyphName): RenderGlyph {
  const box = getSmuflGlyphBox(name);

  return {
    box,
    center: {
      x: (box.sw.x + box.ne.x) / 2,
      y: (box.sw.y + box.ne.y) / 2,
    },
    character: getSmuflGlyphCharacter(name),
    heightStaffSpaces: box.ne.y - box.sw.y,
    widthStaffSpaces: box.ne.x - box.sw.x,
  };
}

function getRenderNoteheadGlyph(name: SmuflGlyphName): RenderNoteheadGlyph {
  const glyph = getRenderGlyph(name);

  return {
    ...glyph,
    stemUpSE: getSmuflAnchor(name, "stemUpSE"),
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

// Engraving units.
const STEM_LENGTH_STAFF_SPACES = 3.5;

// Score layout.
const HORIZONTAL_PADDING_PX = 28;
const VERTICAL_PADDING_PX = 100;
const SEGMENT_WIDTH_PX = 120;
const SEGMENT_GAP_PX = 20;
const SEGMENT_SEAM_PX = 1;
const JOIN_CURVE_CONTROL_X_RATIO = 0.65;

// Event and mark dimensions.
const GROUNDING_MARK_HEIGHT_PX = 3;
const GROUNDING_MARK_WIDTH_PX = 10;

// Span readability tuning.
const SPAN_CLEARANCE_PX = 0.5;
const SPAN_EVENT_CLEARANCE_PX =
  Math.max(0, NOTEHEAD_HEIGHT_PX / 2 - PITCH_STEP_HEIGHT_PX) +
  SPAN_CLEARANCE_PX;

type ScoreLayout = {
  height: number;
  maxPitch: number;
  minPitch: number;
  width: number;
};

type SpanRect = {
  bottom: number;
  height: number;
  top: number;
};

type Point = {
  x: number;
  y: number;
};

type PaintLayer = {
  fill: string;
  opacity: number;
};

type RegionPaint = {
  layers: PaintLayer[];
};

type CubicCurve = [Point, Point, Point, Point];

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

function createSvgElement<K extends keyof SVGElementTagNameMap>(
  tagName: K,
): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NS, tagName);
}

function setAttributes(
  element: Element,
  attributes: Record<string, number | string>,
): void {
  Object.entries(attributes).forEach(([name, value]) => {
    element.setAttribute(name, String(value));
  });
}

function getYForPitch(maxPitch: number, pitch: number): number {
  return VERTICAL_PADDING_PX + (maxPitch - pitch) * PITCH_STEP_HEIGHT_PX;
}

function getXForSegment(index: number): number {
  return HORIZONTAL_PADDING_PX + index * (SEGMENT_WIDTH_PX + SEGMENT_GAP_PX);
}

function staffSpacesToPx(value: number): number {
  return value * PX_PER_STAFF_SPACE;
}

function isDurationAtLeast(duration: number, threshold: number): boolean {
  return duration + DURATION_EPSILON >= threshold;
}

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

function getCenterDarkColor(projectedSegment: ProjectionSegment): string {
  const wheelIndex = regionToWheel24(
    projectedSegment.harmonic.center.pitchClasses,
  );

  return wheelIndex === undefined ? "#111111" : wheel24ToDarkColor(wheelIndex);
}

function getSeamX(segmentIndex: number, segmentCount: number): number {
  if (segmentIndex < 0) {
    return getXForSegment(0) - SEGMENT_GAP_PX / 2;
  }

  if (segmentIndex >= segmentCount - 1) {
    return (
      getXForSegment(segmentCount - 1) + SEGMENT_WIDTH_PX + SEGMENT_GAP_PX / 2
    );
  }

  return getXForSegment(segmentIndex) + SEGMENT_WIDTH_PX + SEGMENT_GAP_PX / 2;
}

function getSpanRect(maxPitch: number, span: Span): SpanRect {
  const top = getYForPitch(maxPitch, span.end) + SPAN_EVENT_CLEARANCE_PX;
  const bottom = getYForPitch(maxPitch, span.start) - SPAN_EVENT_CLEARANCE_PX;
  const height = bottom - top;

  return {
    bottom,
    height,
    top,
  };
}

function isDrawableSpanRect(rect: SpanRect): boolean {
  return rect.height > 0;
}

function appendGroundMark(
  group: SVGGElement,
  fill: string,
  maxPitch: number,
  segmentX: number,
  pitch: number,
): void {
  const rect = createSvgElement("rect");
  const y = getYForPitch(maxPitch, pitch);
  const x = segmentX - SEGMENT_GAP_PX / 2;

  setAttributes(rect, {
    fill,
    height: GROUNDING_MARK_HEIGHT_PX,
    width: GROUNDING_MARK_WIDTH_PX,
    x,
    y: y - GROUNDING_MARK_HEIGHT_PX / 2,
  });

  group.append(rect);
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

function appendProjectedSpan(
  group: SVGGElement,
  maxPitch: number,
  segmentX: number,
  projectedSpan: ProjectedSpan,
  paint: RegionPaint,
): void {
  const d = getProjectedSpanPath(maxPitch, segmentX, projectedSpan);

  if (d === undefined) {
    return;
  }

  paint.layers.forEach((attributes) => {
    const path = createSvgElement("path");
    setAttributes(path, {
      ...attributes,
      d,
    });
    group.append(path);
  });
}

function getProjectedSpanPath(
  maxPitch: number,
  segmentX: number,
  projectedSpan: ProjectedSpan,
): string | undefined {
  const joinExtension = SEGMENT_GAP_PX / 2;
  const currentRect = getSpanRect(maxPitch, projectedSpan);

  if (!isDrawableSpanRect(currentRect)) {
    return undefined;
  }

  const prevHalf =
    projectedSpan.prev === undefined
      ? undefined
      : getJoinHalf(
          maxPitch,
          segmentX,
          projectedSpan,
          projectedSpan.prev,
          "prev",
        );
  const nextHalf =
    projectedSpan.next === undefined
      ? undefined
      : getJoinHalf(
          maxPitch,
          segmentX,
          projectedSpan,
          projectedSpan.next,
          "next",
        );
  const leftX =
    segmentX - (projectedSpan.prev === undefined ? joinExtension : 0);
  const rightX =
    segmentX +
    SEGMENT_WIDTH_PX +
    (projectedSpan.next === undefined ? joinExtension : 0);

  return [
    prevHalf === undefined
      ? `M ${leftX} ${currentRect.top}`
      : `M ${prevHalf.midTop.x} ${prevHalf.midTop.y}`,
    ...(prevHalf === undefined
      ? []
      : [getHalfCubicCommand(prevHalf.top, "prev", "top")]),
    `L ${rightX} ${currentRect.top}`,
    ...(nextHalf === undefined
      ? []
      : [getHalfCubicCommand(nextHalf.top, "next", "top")]),
    nextHalf === undefined
      ? `L ${rightX} ${currentRect.bottom}`
      : `L ${nextHalf.midBottom.x} ${nextHalf.midBottom.y}`,
    ...(nextHalf === undefined
      ? []
      : [getHalfCubicCommand(nextHalf.bottom, "next", "bottom")]),
    `L ${leftX} ${currentRect.bottom}`,
    ...(prevHalf === undefined
      ? []
      : [getHalfCubicCommand(prevHalf.bottom, "prev", "bottom")]),
    "Z",
  ].join(" ");
}

function splitCubicAtHalf(curve: CubicCurve): {
  left: CubicCurve;
  right: CubicCurve;
} {
  const startControl = midpoint(curve[0], curve[1]);
  const innerControl = midpoint(curve[1], curve[2]);
  const endControl = midpoint(curve[2], curve[3]);
  const leftControl = midpoint(startControl, innerControl);
  const rightControl = midpoint(innerControl, endControl);
  const middle = midpoint(leftControl, rightControl);

  return {
    left: [curve[0], startControl, leftControl, middle],
    right: [middle, rightControl, endControl, curve[3]],
  };
}

function midpoint(left: Point, right: Point): Point {
  return {
    x: (left.x + right.x) / 2,
    y: (left.y + right.y) / 2,
  };
}

function getHalfCubicCommand(
  halfCurve: CubicCurve,
  direction: "next" | "prev",
  edge: "bottom" | "top",
): string {
  if (direction === "next") {
    if (edge === "top") {
      return `C ${halfCurve[1].x} ${halfCurve[1].y} ${halfCurve[2].x} ${halfCurve[2].y} ${halfCurve[3].x} ${halfCurve[3].y}`;
    }

    return `C ${halfCurve[2].x} ${halfCurve[2].y} ${halfCurve[1].x} ${halfCurve[1].y} ${halfCurve[0].x} ${halfCurve[0].y}`;
  }

  if (edge === "top") {
    return `C ${halfCurve[1].x} ${halfCurve[1].y} ${halfCurve[2].x} ${halfCurve[2].y} ${halfCurve[3].x} ${halfCurve[3].y}`;
  }

  return `C ${halfCurve[2].x} ${halfCurve[2].y} ${halfCurve[1].x} ${halfCurve[1].y} ${halfCurve[0].x} ${halfCurve[0].y}`;
}

function getJoinHalf(
  maxPitch: number,
  segmentX: number,
  currentSpan: Span,
  joinedSpan: Span,
  direction: "next" | "prev",
):
  | {
      bottom: CubicCurve;
      midBottom: Point;
      midTop: Point;
      top: CubicCurve;
    }
  | undefined {
  const fullJoinCurves = getFullJoinCurves(
    maxPitch,
    segmentX,
    currentSpan,
    joinedSpan,
    direction,
  );

  if (fullJoinCurves === undefined) {
    return undefined;
  }

  const { bottomCurve, topCurve } = fullJoinCurves;
  const topHalf = splitCubicAtHalf(topCurve);
  const bottomHalf = splitCubicAtHalf(bottomCurve);

  if (direction === "next") {
    return {
      bottom: bottomHalf.left,
      midBottom: bottomHalf.left[3],
      midTop: topHalf.left[3],
      top: topHalf.left,
    };
  }

  return {
    bottom: bottomHalf.right,
    midBottom: bottomHalf.right[0],
    midTop: topHalf.right[0],
    top: topHalf.right,
  };
}

function getFullJoinCurves(
  maxPitch: number,
  segmentX: number,
  currentSpan: Span,
  joinedSpan: Span,
  direction: "next" | "prev",
):
  | {
      bottomCurve: CubicCurve;
      topCurve: CubicCurve;
    }
  | undefined {
  const currentRect = getSpanRect(maxPitch, currentSpan);
  const joinedRect = getSpanRect(maxPitch, joinedSpan);

  if (!isDrawableSpanRect(currentRect) || !isDrawableSpanRect(joinedRect)) {
    return undefined;
  }

  const currentEdgeX =
    direction === "next" ? segmentX + SEGMENT_WIDTH_PX : segmentX;
  const joinedEdgeX =
    currentEdgeX + (direction === "next" ? SEGMENT_GAP_PX : -SEGMENT_GAP_PX);
  const leftX = Math.min(currentEdgeX, joinedEdgeX);
  const rightX = Math.max(currentEdgeX, joinedEdgeX);
  const leftRect = currentEdgeX <= joinedEdgeX ? currentRect : joinedRect;
  const rightRect = currentEdgeX <= joinedEdgeX ? joinedRect : currentRect;
  const joinControlX = SEGMENT_GAP_PX * JOIN_CURVE_CONTROL_X_RATIO;
  const fullTopCurve: CubicCurve = [
    { x: leftX, y: leftRect.top },
    { x: leftX + joinControlX, y: leftRect.top },
    { x: rightX - joinControlX, y: rightRect.top },
    { x: rightX, y: rightRect.top },
  ];
  const fullBottomCurve: CubicCurve = [
    { x: leftX, y: leftRect.bottom },
    { x: leftX + joinControlX, y: leftRect.bottom },
    { x: rightX - joinControlX, y: rightRect.bottom },
    { x: rightX, y: rightRect.bottom },
  ];
  return {
    bottomCurve: fullBottomCurve,
    topCurve: fullTopCurve,
  };
}

function getFieldPaint(): RegionPaint {
  return {
    layers: [{ fill: "#cccccc", opacity: 0.3 }],
  };
}

function getCenterPaint(color: string): RegionPaint {
  return {
    layers: [
      { fill: "#ffffff", opacity: 1 },
      { fill: color, opacity: 0.5 },
    ],
  };
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

function appendEventMark(
  group: SVGGElement,
  maxPitch: number,
  segmentX: number,
  projectedSegment: ProjectionSegment,
  projectedEvent: ProjectionEvent,
): void {
  const startX =
    segmentX +
    (projectedEvent.offset / projectedSegment.totalDuration) * SEGMENT_WIDTH_PX;
  const endX =
    segmentX +
    ((projectedEvent.offset + projectedEvent.duration) /
      projectedSegment.totalDuration) *
      SEGMENT_WIDTH_PX;
  const centerX = (startX + endX) / 2;

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

function appendSegmentForeground(
  group: SVGGElement,
  layout: ScoreLayout,
  projectedSegment: ProjectionSegment,
): void {
  const segmentX = getXForSegment(projectedSegment.index);
  const label = createSvgElement("text");

  projectedSegment.events.forEach((projectedEvent) => {
    appendEventMark(
      group,
      layout.maxPitch,
      segmentX,
      projectedSegment,
      projectedEvent,
    );
  });

  setAttributes(label, {
    fill: "#111111",
    "font-size": 12,
    x: segmentX,
    y: VERTICAL_PADDING_PX - 10,
  });
  label.textContent = String(projectedSegment.index + 1);

  group.append(label);
}

function appendSegmentRegions(
  group: SVGGElement,
  layout: ScoreLayout,
  projectedSegment: ProjectionSegment,
): void {
  const segmentX = getXForSegment(projectedSegment.index);
  const centerColor =
    regionToColor(projectedSegment.harmonic.center.pitchClasses) ?? "#111111";
  const centerDarkColor = getCenterDarkColor(projectedSegment);
  const fieldPaint = getFieldPaint();
  const centerPaint = getCenterPaint(centerColor);

  projectedSegment.placement.field.spans.forEach((span) => {
    appendProjectedSpan(group, layout.maxPitch, segmentX, span, fieldPaint);
  });
  projectedSegment.placement.center.spans.forEach((span) => {
    appendProjectedSpan(group, layout.maxPitch, segmentX, span, centerPaint);
  });
  projectedSegment.placement.groundingOverlay?.marks.forEach((mark) => {
    appendGroundMark(
      group,
      centerDarkColor,
      layout.maxPitch,
      segmentX,
      mark.pitch,
    );
  });
}

function appendSegmentBoundarySeam(
  group: SVGGElement,
  layout: ScoreLayout,
  segmentIndex: number,
  segmentCount: number,
): void {
  const rect = createSvgElement("rect");
  const seamX = getSeamX(segmentIndex, segmentCount);

  setAttributes(rect, {
    fill: "#ffffff",
    height: layout.height,
    width: SEGMENT_SEAM_PX,
    x: seamX - SEGMENT_SEAM_PX / 2,
    y: 0,
  });

  group.append(rect);
}

function appendAllSegmentSeams(
  group: SVGGElement,
  layout: ScoreLayout,
  segmentCount: number,
): void {
  appendSegmentBoundarySeam(group, layout, -1, segmentCount);

  for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex += 1) {
    appendSegmentBoundarySeam(group, layout, segmentIndex, segmentCount);
  }
}

function getScoreLayout(projection: Projection): ScoreLayout {
  return {
    height:
      VERTICAL_PADDING_PX * 2 +
      (projection.maxPitch - projection.minPitch) * PITCH_STEP_HEIGHT_PX,
    maxPitch: projection.maxPitch,
    minPitch: projection.minPitch,
    width:
      HORIZONTAL_PADDING_PX * 2 +
      projection.segments.length * SEGMENT_WIDTH_PX +
      Math.max(projection.segments.length - 1, 0) * SEGMENT_GAP_PX,
  };
}

function createScoreSvg(projection: Projection): SVGSVGElement {
  const svg = createSvgElement("svg");
  const regionGroup = createSvgElement("g");
  const seamGroup = createSvgElement("g");
  const foregroundGroup = createSvgElement("g");
  const layout = getScoreLayout(projection);

  svg.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`);
  svg.setAttribute("width", String(layout.width));
  svg.setAttribute("height", String(layout.height));
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Simple harmonic score");

  projection.segments.forEach((projectedSegment) => {
    const group = createSvgElement("g");
    appendSegmentRegions(group, layout, projectedSegment);
    regionGroup.append(group);
  });

  appendAllSegmentSeams(seamGroup, layout, projection.segments.length);

  projection.segments.forEach((projectedSegment) => {
    const group = createSvgElement("g");
    appendSegmentForeground(group, layout, projectedSegment);
    foregroundGroup.append(group);
  });

  svg.append(regionGroup, seamGroup, foregroundGroup);

  return svg;
}

export function renderApp(projection: Projection): HTMLElement {
  const app = document.createElement("main");
  const heading = document.createElement("h1");
  const score = document.createElement("div");

  app.className = "app";
  heading.textContent = "Notation";
  score.className = "score";
  score.append(createScoreSvg(projection));

  app.append(heading, score);
  return app;
}
