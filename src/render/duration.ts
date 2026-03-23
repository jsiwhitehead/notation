const DURATION_EPSILON = 0.001;
const EIGHTH_DURATION = 0.5;
const SIXTEENTH_DURATION = 0.25;
const THIRTY_SECOND_DURATION = 0.125;
const SIXTY_FOURTH_DURATION = 0.0625;

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
