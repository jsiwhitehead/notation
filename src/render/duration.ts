const DURATION_EPSILON = 0.001;
const EIGHTH_DURATION = 0.5;
const HALF_DURATION = 2;
const QUARTER_DURATION = 1;
const SIXTEENTH_DURATION = 0.25;
const THIRTY_SECOND_DURATION = 0.125;
const SIXTY_FOURTH_DURATION = 0.0625;
const WHOLE_DURATION = 4;

const DOTTED_BASE_DURATIONS = [
  WHOLE_DURATION,
  HALF_DURATION,
  QUARTER_DURATION,
  EIGHTH_DURATION,
  SIXTEENTH_DURATION,
  THIRTY_SECOND_DURATION,
  SIXTY_FOURTH_DURATION,
];

export function isDurationEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= DURATION_EPSILON;
}

export function getShortDurationBeamCount(duration: number): number {
  if (isDurationEqual(duration, EIGHTH_DURATION)) {
    return 1;
  }

  if (isDurationEqual(duration, SIXTEENTH_DURATION)) {
    return 2;
  }

  if (isDurationEqual(duration, THIRTY_SECOND_DURATION)) {
    return 3;
  }

  if (isDurationEqual(duration, SIXTY_FOURTH_DURATION)) {
    return 4;
  }

  return 0;
}

export function getDurationDotCount(duration: number): number {
  for (const baseDuration of DOTTED_BASE_DURATIONS) {
    if (isDurationEqual(duration, baseDuration * 1.875)) {
      return 3;
    }

    if (isDurationEqual(duration, baseDuration * 1.75)) {
      return 2;
    }

    if (isDurationEqual(duration, baseDuration * 1.5)) {
      return 1;
    }
  }

  return 0;
}
