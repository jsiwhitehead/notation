import type { ProjectedSpan, Span } from "../projection/spans";
import type { NotationLayout, RenderSegmentLayout } from "./layout";
import {
  GROUNDING_MARK_HEIGHT_PX,
  GROUNDING_MARK_WIDTH_PX,
  getYForPitch,
  JOIN_CURVE_CONTROL_X_RATIO,
  SEGMENT_GAP_PX,
  SPAN_EVENT_CLEARANCE_PX,
} from "./metrics";
import { regionToColor, regionToWheel24, wheel24ToDarkColor } from "./color";
import { createSvgElement, setAttributes } from "./svg";

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

function getCenterDarkColor(centerPitchClasses: number[]): string {
  const wheelIndex = regionToWheel24(centerPitchClasses);

  return wheelIndex === undefined ? "#111111" : wheel24ToDarkColor(wheelIndex);
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

function appendProjectedSpan(
  group: SVGGElement,
  maxPitch: number,
  segmentX: number,
  segmentWidth: number,
  projectedSpan: ProjectedSpan,
  paint: RegionPaint,
): void {
  const d = getProjectedSpanPath(
    maxPitch,
    segmentX,
    segmentWidth,
    projectedSpan,
  );

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
  segmentWidth: number,
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
          segmentWidth,
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
          segmentWidth,
          projectedSpan,
          projectedSpan.next,
          "next",
        );
  const leftX =
    segmentX - (projectedSpan.prev === undefined ? joinExtension : 0);
  const rightX =
    segmentX +
    segmentWidth +
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
  segmentWidth: number,
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
    segmentWidth,
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
  segmentWidth: number,
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
    direction === "next" ? segmentX + segmentWidth : segmentX;
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
      { fill: color, opacity: 0.7 },
    ],
  };
}

export function appendProjectedSegmentRegions(
  group: SVGGElement,
  layout: NotationLayout,
  renderSegmentLayout: RenderSegmentLayout,
): void {
  const {
    segment: projectedSegment,
    widthPx: segmentWidth,
    x: segmentX,
  } = renderSegmentLayout;
  const centerColor =
    regionToColor(projectedSegment.harmonic.center.pitchClasses) ?? "#111111";
  const centerDarkColor = getCenterDarkColor(
    projectedSegment.harmonic.center.pitchClasses,
  );
  const fieldPaint = getFieldPaint();
  const centerPaint = getCenterPaint(centerColor);

  projectedSegment.placement.field.spans.forEach((span) => {
    appendProjectedSpan(
      group,
      layout.maxPitch,
      segmentX,
      segmentWidth,
      span,
      fieldPaint,
    );
  });
  projectedSegment.placement.center.spans.forEach((span) => {
    appendProjectedSpan(
      group,
      layout.maxPitch,
      segmentX,
      segmentWidth,
      span,
      centerPaint,
    );
  });
  projectedSegment.placement.projectedGroundingOverlay?.marks.forEach(
    (mark) => {
      appendGroundMark(
        group,
        centerDarkColor,
        layout.maxPitch,
        segmentX,
        mark.pitch,
      );
    },
  );
}
