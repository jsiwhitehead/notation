import type { ProjectionEvent } from "../projection";
import type { TimeSignature } from "../model";
import { getShortDurationBeamCount, isDurationEqual } from "./duration";
import { createSvgElement, setAttributes } from "./svg";
import { getEngravingDefaults } from "./smufl";

type BeamGroup = {
  beamCounts: number[];
  eventIndices: number[];
};

export type BeamStemGeometry = {
  anchorY: number;
  centerX: number;
  leftX: number;
  tipY: number;
};

export type StemDirection = "down" | "up";

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

export function buildBeamGroups(
  events: ProjectionEvent[],
  timeSignature?: TimeSignature,
): BeamGroup[] {
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
      (previousEvent === undefined ||
        isTimeContiguous(previousEvent, event, timeSignature))
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
  stemDirection: StemDirection,
  appendStem: (group: SVGGElement, stemGeometry: BeamStemGeometry) => void,
  staffSpacesToPx: (value: number) => number,
  stemThicknessStaffSpaces: number,
): void {
  const stemThicknessPx = staffSpacesToPx(stemThicknessStaffSpaces);
  const beamThicknessPx = staffSpacesToPx(BEAM_THICKNESS_STAFF_SPACES);

  if (stemGeometries.length < 2) {
    stemGeometries.forEach((stemGeometry) => {
      appendStem(group, stemGeometry);
    });
    return;
  }

  const maxBeamCount = Math.max(...beamCounts);
  const beamLine = offsetBeamLine(
    getBeamLine(stemGeometries, stemDirection),
    getMainBeamOutwardShiftPx(
      maxBeamCount,
      stemDirection,
      beamThicknessPx,
      staffSpacesToPx,
    ),
  );

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
    stemDirection,
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
          stemDirection,
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
            stemDirection,
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
            stemDirection,
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
            stemDirection,
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
  timeSignature: TimeSignature | undefined,
): boolean {
  return (
    previousEvent.layer === nextEvent.layer &&
    canShareBeamGroup(previousEvent.duration, nextEvent.duration) &&
    isInSameBeatGroup(previousEvent, nextEvent, timeSignature) &&
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

function isInSameBeatGroup(
  previousEvent: ProjectionEvent,
  nextEvent: ProjectionEvent,
  timeSignature: TimeSignature | undefined,
): boolean {
  const beatGroupDuration = getBeatGroupDuration(
    previousEvent.duration,
    nextEvent.duration,
    timeSignature,
  );

  if (beatGroupDuration === undefined) {
    return true;
  }

  return (
    Math.floor(previousEvent.offset / beatGroupDuration) ===
    Math.floor(nextEvent.offset / beatGroupDuration)
  );
}

function getBeatGroupDuration(
  previousDuration: number,
  nextDuration: number,
  timeSignature: TimeSignature | undefined,
): number | undefined {
  if (timeSignature === undefined) {
    return undefined;
  }

  if (timeSignature.beats === 4 && timeSignature.beatType === 4) {
    if (
      isDurationEqual(previousDuration, 0.5) &&
      isDurationEqual(nextDuration, 0.5)
    ) {
      return 2;
    }

    return 1;
  }

  const baseBeatDuration = 4 / timeSignature.beatType;

  if (
    timeSignature.beatType === 8 &&
    timeSignature.beats > 3 &&
    timeSignature.beats % 3 === 0
  ) {
    return baseBeatDuration * 3;
  }

  return baseBeatDuration;
}

function getBeamOffsetPx(
  beamLevel: number,
  staffSpacesToPx: (value: number) => number,
): number {
  const beamSpacingPx = staffSpacesToPx(BEAM_SPACING_STAFF_SPACES);
  const beamThicknessPx = staffSpacesToPx(BEAM_THICKNESS_STAFF_SPACES);

  return (beamThicknessPx + beamSpacingPx) * beamLevel;
}

function getMainBeamOutwardShiftPx(
  maxBeamCount: number,
  stemDirection: StemDirection,
  beamThicknessPx: number,
  staffSpacesToPx: (value: number) => number,
): number {
  if (maxBeamCount <= 1) {
    return 0;
  }

  const deepestBeamLevel = maxBeamCount - 1;
  const deepestBeamFarEdgeOffsetPx =
    getBeamOffsetPx(deepestBeamLevel, staffSpacesToPx) + beamThicknessPx;
  const outwardYDirection = stemDirection === "up" ? -1 : 1;

  return outwardYDirection * deepestBeamFarEdgeOffsetPx;
}

function offsetBeamLine(beamLine: BeamLine, deltaY: number): BeamLine {
  return {
    ...beamLine,
    endBottomY: beamLine.endBottomY + deltaY,
    startBottomY: beamLine.startBottomY + deltaY,
  };
}

function appendBeam(
  group: SVGGElement,
  beamLine: BeamLine,
  leftX: number,
  rightX: number,
  beamLevel: number,
  stemDirection: StemDirection,
  staffSpacesToPx: (value: number) => number,
): void {
  const beam = createSvgElement("polygon");
  const beamThicknessPx = staffSpacesToPx(BEAM_THICKNESS_STAFF_SPACES);
  const inwardYDirection = stemDirection === "up" ? 1 : -1;
  const leftBaseY =
    getBeamLineBottomY(beamLine, leftX) +
    inwardYDirection * getBeamOffsetPx(beamLevel, staffSpacesToPx);
  const rightBaseY =
    getBeamLineBottomY(beamLine, rightX) +
    inwardYDirection * getBeamOffsetPx(beamLevel, staffSpacesToPx);
  const leftFarY = leftBaseY + inwardYDirection * beamThicknessPx;
  const rightFarY = rightBaseY + inwardYDirection * beamThicknessPx;

  setAttributes(beam, {
    fill: "#111111",
    points: [
      `${leftX},${leftFarY}`,
      `${rightX},${rightFarY}`,
      `${rightX},${rightBaseY}`,
      `${leftX},${leftBaseY}`,
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
  stemDirection: StemDirection,
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
    stemDirection,
    staffSpacesToPx,
  );
}

function appendLeftPartialBeam(
  group: SVGGElement,
  beamLine: BeamLine,
  beamLevel: number,
  previousStemGeometry: BeamStemGeometry | undefined,
  stemGeometry: BeamStemGeometry,
  stemDirection: StemDirection,
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
    stemDirection,
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

function getBeamLine(
  stemGeometries: BeamStemGeometry[],
  stemDirection: StemDirection,
): BeamLine {
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

  if (stemDirection === "up") {
    const minimumStemExcess = Math.max(
      ...stemGeometries.map(
        (stemGeometry) =>
          getBeamLineBottomY(beamLine, stemGeometry.centerX) -
          stemGeometry.tipY,
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

  const maximumStemExcess = Math.min(
    ...stemGeometries.map(
      (stemGeometry) =>
        getBeamLineBottomY(beamLine, stemGeometry.centerX) - stemGeometry.tipY,
    ),
  );

  if (maximumStemExcess < 0) {
    beamLine = {
      ...beamLine,
      endBottomY: beamLine.endBottomY - maximumStemExcess,
      startBottomY: beamLine.startBottomY - maximumStemExcess,
    };
  }

  return beamLine;
}
