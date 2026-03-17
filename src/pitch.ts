import type { EventInput, PitchClass } from "./model";

export function toPitchClass(value: number): PitchClass {
  return ((value % 12) + 12) % 12;
}

export function toFifthsPosition(pitchClass: PitchClass): number {
  return (pitchClass * 7) % 12;
}

export function uniqueSortedPitchClasses(values: PitchClass[]): PitchClass[] {
  return [...new Set(values)].sort((left, right) => left - right);
}

export function uniqueFifthsOrderedPitchClasses(
  values: PitchClass[],
): PitchClass[] {
  return [...new Set(values)].sort(
    (left, right) =>
      toFifthsPosition(left) - toFifthsPosition(right) || left - right,
  );
}

export function getEventPitches(event: EventInput): number[] {
  switch (event.type) {
    case "note":
      return [event.pitch];
    case "chord":
      return event.pitches;
    case "rest":
      return [];
  }
}

export function getEventPitchClasses(event: EventInput): PitchClass[] {
  return getEventPitches(event).map(toPitchClass);
}
