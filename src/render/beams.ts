import type { ProjectionEvent } from "../projection";
import { getShortDurationBeamCount, isDurationEqual } from "./duration";
import { createSvgElement, setAttributes } from "./svg";
import { getEngravingDefaults } from "./smufl";

export type BeamGroup = {
  beamCounts: number[];
  eventIndices: number[];
};

export type BeamStemGeometry = {
  anchorY: number;
  centerX: number;
  leftX: number;
  tipY: number;
};

type BeamLine = {
  endBottomY: number;
  endX: number;
  startBottomY: number;
  startX: number;
};

const ENGRAVING_DEFAULTS = getEngravingDefaults();
const BEAM_SPACING_STAFF_SPACES = ENGRAVING_DEFAULTS.beamSpacing;
const BEAM_THICKNESS_STAFF_SPACES = ENGRAVING_DEFAULTS.beamThickness;
const MAX_BEAM_SLOPE = 0.25;
const PARTIAL_BEAM_LENGTH_STAFF_SPACES = 1.25;

export function buildBeamGroups(events: ProjectionEvent[]): BeamGroup[] {
  const beamGroups: BeamGroup[] = [];
  const orderedEvents = events
    .map((event, index) => ({ event, index }))
    .sort(
      (left, right) =>
        left.event.layer - right.event.layer ||
        left.event.offset - right.event.offset ||
        left.index - right.index,
    );
  let currentGroup: Array<{ event: ProjectionEvent; index: number }> = [];

  orderedEvents.forEach(({ event, index }) => {
    const previousEvent =
      currentGroup.length === 0 ? undefined : currentGroup.at(-1)!.event;

    if (
      isBeamableEvent(event) &&
      (previousEvent === undefined || isTimeContiguous(previousEvent, event))
    ) {
      currentGroup.push({ event, index });
      return;
    }

    if (currentGroup.length >= 2) {
      beamGroups.push({
        beamCounts: currentGroup.map((groupedEvent) =>
          getShortDurationBeamCount(groupedEvent.event.duration),
        ),
        eventIndices: currentGroup.map((groupedEvent) => groupedEvent.index),
      });
    }

    currentGroup = isBeamableEvent(event) ? [{ event, index }] : [];
  });

  if (currentGroup.length >= 2) {
    beamGroups.push({
      beamCounts: currentGroup.map((groupedEvent) =>
        getShortDurationBeamCount(groupedEvent.event.duration),
      ),
      eventIndices: currentGroup.map((groupedEvent) => groupedEvent.index),
    });
  }

  return beamGroups;
}

export function appendBeamGroup(
  group: SVGGElement,
  beamCounts: number[],
  stemGeometries: BeamStemGeometry[],
  appendStem: (group: SVGGElement, stemGeometry: BeamStemGeometry) => void,
  staffSpacesToPx: (value: number) => number,
  stemThicknessStaffSpaces: number,
): void {
  const stemThicknessPx = staffSpacesToPx(stemThicknessStaffSpaces);

  if (stemGeometries.length < 2) {
    stemGeometries.forEach((stemGeometry) => {
      appendStem(group, stemGeometry);
    });
    return;
  }

  const beamLine = getBeamLine(stemGeometries);
  const maxBeamCount = Math.max(...beamCounts);

  stemGeometries.forEach((stemGeometry) => {
    appendStem(group, {
      ...stemGeometry,
      tipY: getBeamLineBottomY(beamLine, stemGeometry.centerX),
    });
  });

  appendBeam(
    group,
    beamLine,
    stemGeometries[0]!.leftX,
    stemGeometries[stemGeometries.length - 1]!.leftX + stemThicknessPx,
    0,
    staffSpacesToPx,
  );

  for (let beamLevel = 1; beamLevel < maxBeamCount; beamLevel += 1) {
    let runStartIndex: number | undefined;

    const flushRun = (runEndIndex: number): void => {
      if (runStartIndex === undefined) {
        return;
      }

      if (runEndIndex > runStartIndex) {
        appendBeam(
          group,
          beamLine,
          stemGeometries[runStartIndex]!.leftX,
          stemGeometries[runEndIndex]!.leftX + stemThicknessPx,
          beamLevel,
          staffSpacesToPx,
        );
      } else {
        const stemGeometry = stemGeometries[runStartIndex]!;
        const previousBeamCount = beamCounts[runStartIndex - 1] ?? 0;
        const nextBeamCount = beamCounts[runStartIndex + 1] ?? 0;
        const previousStemGeometry = stemGeometries[runStartIndex - 1];
        const nextStemGeometry = stemGeometries[runStartIndex + 1];
        const canBeamLeft = previousBeamCount <= beamLevel;
        const canBeamRight = nextBeamCount <= beamLevel;

        if (canBeamLeft && canBeamRight) {
          appendRightPartialBeam(
            group,
            beamLine,
            beamLevel,
            stemGeometry,
            nextStemGeometry,
            staffSpacesToPx,
            stemThicknessStaffSpaces,
          );
        } else if (canBeamLeft) {
          appendLeftPartialBeam(
            group,
            beamLine,
            beamLevel,
            previousStemGeometry,
            stemGeometry,
            staffSpacesToPx,
            stemThicknessStaffSpaces,
          );
        } else if (canBeamRight) {
          appendRightPartialBeam(
            group,
            beamLine,
            beamLevel,
            stemGeometry,
            nextStemGeometry,
            staffSpacesToPx,
            stemThicknessStaffSpaces,
          );
        }
      }

      runStartIndex = undefined;
    };

    for (let eventIndex = 0; eventIndex < beamCounts.length; eventIndex += 1) {
      if (beamCounts[eventIndex]! > beamLevel) {
        if (runStartIndex === undefined) {
          runStartIndex = eventIndex;
        }
        continue;
      }

      flushRun(eventIndex - 1);
    }

    flushRun(beamCounts.length - 1);
  }
}

function isBeamableEvent(event: ProjectionEvent): boolean {
  return (
    event.type === "pitched" && getShortDurationBeamCount(event.duration) > 0
  );
}

function isTimeContiguous(
  previousEvent: ProjectionEvent,
  nextEvent: ProjectionEvent,
): boolean {
  return (
    previousEvent.layer === nextEvent.layer &&
    canShareBeamGroup(previousEvent.duration, nextEvent.duration) &&
    isDurationEqual(
      previousEvent.offset + previousEvent.duration,
      nextEvent.offset,
    )
  );
}

function canShareBeamGroup(
  previousDuration: number,
  nextDuration: number,
): boolean {
  return (
    isDurationEqual(previousDuration, nextDuration) ||
    (isMixedEighthSixteenthDuration(previousDuration) &&
      isMixedEighthSixteenthDuration(nextDuration))
  );
}

function isMixedEighthSixteenthDuration(duration: number): boolean {
  return isDurationEqual(duration, 0.5) || isDurationEqual(duration, 0.25);
}

function appendBeam(
  group: SVGGElement,
  beamLine: BeamLine,
  leftX: number,
  rightX: number,
  beamLevel: number,
  staffSpacesToPx: (value: number) => number,
): void {
  const beam = createSvgElement("polygon");
  const beamSpacingPx = staffSpacesToPx(BEAM_SPACING_STAFF_SPACES);
  const beamThicknessPx = staffSpacesToPx(BEAM_THICKNESS_STAFF_SPACES);
  const beamTopOffsetPx = (beamThicknessPx + beamSpacingPx) * beamLevel;
  const leftBottomY = getBeamLineBottomY(beamLine, leftX) - beamTopOffsetPx;
  const rightBottomY = getBeamLineBottomY(beamLine, rightX) - beamTopOffsetPx;

  setAttributes(beam, {
    fill: "#111111",
    points: [
      `${leftX},${leftBottomY - beamThicknessPx}`,
      `${rightX},${rightBottomY - beamThicknessPx}`,
      `${rightX},${rightBottomY}`,
      `${leftX},${leftBottomY}`,
    ].join(" "),
  });

  group.append(beam);
}

function appendRightPartialBeam(
  group: SVGGElement,
  beamLine: BeamLine,
  beamLevel: number,
  stemGeometry: BeamStemGeometry,
  nextStemGeometry: BeamStemGeometry | undefined,
  staffSpacesToPx: (value: number) => number,
  stemThicknessStaffSpaces: number,
): void {
  const stemThicknessPx = staffSpacesToPx(stemThicknessStaffSpaces);
  const rightBeamRightX =
    nextStemGeometry !== undefined
      ? (stemGeometry.leftX + nextStemGeometry.leftX) / 2 + stemThicknessPx
      : stemGeometry.leftX +
        stemThicknessPx +
        staffSpacesToPx(PARTIAL_BEAM_LENGTH_STAFF_SPACES);

  appendBeam(
    group,
    beamLine,
    stemGeometry.leftX,
    rightBeamRightX,
    beamLevel,
    staffSpacesToPx,
  );
}

function appendLeftPartialBeam(
  group: SVGGElement,
  beamLine: BeamLine,
  beamLevel: number,
  previousStemGeometry: BeamStemGeometry | undefined,
  stemGeometry: BeamStemGeometry,
  staffSpacesToPx: (value: number) => number,
  stemThicknessStaffSpaces: number,
): void {
  const leftBeamLeftX =
    previousStemGeometry !== undefined
      ? (previousStemGeometry.leftX + stemGeometry.leftX) / 2
      : stemGeometry.leftX - staffSpacesToPx(PARTIAL_BEAM_LENGTH_STAFF_SPACES);

  appendBeam(
    group,
    beamLine,
    leftBeamLeftX,
    stemGeometry.leftX + staffSpacesToPx(stemThicknessStaffSpaces),
    beamLevel,
    staffSpacesToPx,
  );
}

function getBeamLineBottomY(beamLine: BeamLine, x: number): number {
  const spanX = beamLine.endX - beamLine.startX;

  if (spanX === 0) {
    return beamLine.startBottomY;
  }

  const t = (x - beamLine.startX) / spanX;

  return (
    beamLine.startBottomY + (beamLine.endBottomY - beamLine.startBottomY) * t
  );
}

function getBeamLine(stemGeometries: BeamStemGeometry[]): BeamLine {
  const firstStem = stemGeometries[0]!;
  const lastStem = stemGeometries[stemGeometries.length - 1]!;
  const spanX = lastStem.centerX - firstStem.centerX;
  const rawSlope = spanX === 0 ? 0 : (lastStem.tipY - firstStem.tipY) / spanX;
  const clampedSlope = Math.max(
    -MAX_BEAM_SLOPE,
    Math.min(MAX_BEAM_SLOPE, rawSlope),
  );
  let beamLine: BeamLine = {
    endBottomY: firstStem.tipY + clampedSlope * spanX,
    endX: lastStem.centerX,
    startBottomY: firstStem.tipY,
    startX: firstStem.centerX,
  };
  const minimumStemExcess = Math.max(
    ...stemGeometries.map(
      (stemGeometry) =>
        getBeamLineBottomY(beamLine, stemGeometry.centerX) - stemGeometry.tipY,
    ),
  );

  if (minimumStemExcess > 0) {
    beamLine = {
      ...beamLine,
      endBottomY: beamLine.endBottomY - minimumStemExcess,
      startBottomY: beamLine.startBottomY - minimumStemExcess,
    };
  }

  return beamLine;
}
