import { normalizeChordSymbol } from "./chord";
import { getEventPitchClasses } from "../pitch";
import { getSegmentTotalDuration } from "../segment";

import type {
  EventOffset,
  PitchClass,
  SegmentInput,
  TimedChordSymbol,
} from "../model";

export type SegmentEvidence = {
  pitchClassWeightByPitchClass: Map<PitchClass, number>;
  chordGroundPitchClass?: PitchClass;
  chordRootPitchClass?: PitchClass;
  localPitchClasses: PitchClass[];
};

type TimedChordSymbolWindow = {
  duration: number;
  offset: EventOffset;
  symbol: string;
};

function addPitchClassWeight(
  weightByPitchClass: Map<PitchClass, number>,
  pitchClass: PitchClass,
  weight: number,
): void {
  weightByPitchClass.set(
    pitchClass,
    (weightByPitchClass.get(pitchClass) ?? 0) + weight,
  );
}

export function getTimedChordSymbols(segment: SegmentInput): TimedChordSymbol[] {
  return segment.chordSymbols ?? [];
}

export function getOrderedTimedChordSymbols(
  segment: SegmentInput,
): TimedChordSymbol[] {
  return [...getTimedChordSymbols(segment)].sort(
    (left, right) => left.offset - right.offset,
  );
}

function getUnambiguousSegmentGroundingSymbol(
  timedChordSymbols: TimedChordSymbol[],
): string | undefined {
  return timedChordSymbols.length === 1 ? timedChordSymbols[0]!.symbol : undefined;
}

export function getActiveOrderedChordSymbol(
  timedChordSymbols: TimedChordSymbol[],
  offset: EventOffset = 0,
): string | undefined {
  return timedChordSymbols
    .filter((timedChordSymbol) => timedChordSymbol.offset <= offset)
    .at(-1)?.symbol;
}

export function getTimedChordSymbolWindows(
  segment: SegmentInput,
  totalDuration: number,
): TimedChordSymbolWindow[] {
  const timedChordSymbols = getOrderedTimedChordSymbols(segment).filter(
    (timedChordSymbol) => timedChordSymbol.offset < totalDuration,
  );

  return timedChordSymbols.flatMap((timedChordSymbol, index) => {
    const nextOffset = timedChordSymbols[index + 1]?.offset ?? totalDuration;
    const duration = nextOffset - timedChordSymbol.offset;

    if (duration <= 0) {
      return [];
    }

    return [
      {
        duration,
        offset: timedChordSymbol.offset,
        symbol: timedChordSymbol.symbol,
      },
    ];
  });
}

export function getPitchClassWeights(
  segment: SegmentInput,
): Map<PitchClass, number> {
  const pitchClassWeightByPitchClass = new Map<PitchClass, number>();
  const totalDuration = getSegmentTotalDuration(segment);

  segment.events.forEach((event) => {
    getEventPitchClasses(event).forEach((pitchClass) => {
      addPitchClassWeight(
        pitchClassWeightByPitchClass,
        pitchClass,
        event.duration,
      );
    });
  });

  getTimedChordSymbolWindows(segment, totalDuration).forEach(
    ({ duration, symbol }) => {
      const normalizedTimedChordSymbol = normalizeChordSymbol(symbol);

      if (normalizedTimedChordSymbol === undefined) {
        return;
      }

      normalizedTimedChordSymbol.pitchClasses.forEach((pitchClass) => {
        addPitchClassWeight(
          pitchClassWeightByPitchClass,
          pitchClass,
          duration,
        );
      });
    },
  );

  return pitchClassWeightByPitchClass;
}

export function collectSegmentEvidence(segment: SegmentInput): SegmentEvidence {
  const timedChordSymbols = getOrderedTimedChordSymbols(segment);
  const activeChordSymbol = getUnambiguousSegmentGroundingSymbol(timedChordSymbols);
  const normalizedChordSymbol =
    activeChordSymbol === undefined
      ? undefined
      : normalizeChordSymbol(activeChordSymbol);
  const pitchClassWeightByPitchClass = getPitchClassWeights(segment);

  const localPitchClasses = [...pitchClassWeightByPitchClass.keys()].sort(
    (left, right) => left - right,
  );

  return {
    pitchClassWeightByPitchClass,
    localPitchClasses,
    ...(normalizedChordSymbol === undefined
      ? {}
      : {
          chordGroundPitchClass: normalizedChordSymbol.groundPitchClass,
          chordRootPitchClass: normalizedChordSymbol.rootPitchClass,
        }),
  };
}
