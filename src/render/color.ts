import type { PitchClass } from "../model";
import { getRegionMidpointInHalfFifths, mod } from "../pitch";

const HARMONIC_WHEEL_SIZE = 24;
const HARMONIC_WHEEL_24 = [
  "rgb(254, 125, 125)",
  "rgb(255, 141, 102)",
  "rgb(255, 156, 75)",
  "rgb(255, 172, 65)",
  "rgb(255, 187, 53)",
  "rgb(251, 196, 36)",
  "rgb(247, 204, 0)",
  "rgb(236, 215, 0)",
  "rgb(225, 225, 0)",
  "rgb(194, 226, 7)",
  "rgb(161, 227, 15)",
  "rgb(124, 222, 53)",
  "rgb(75, 217, 75)",
  "rgb(74, 195, 129)",
  "rgb(53, 173, 173)",
  "rgb(85, 153, 188)",
  "rgb(103, 133, 203)",
  "rgb(118, 120, 203)",
  "rgb(130, 105, 203)",
  "rgb(149, 101, 204)",
  "rgb(166, 96, 205)",
  "rgb(198, 94, 186)",
  "rgb(226, 91, 168)",
  "rgb(241, 108, 147)",
] as const;
const HARMONIC_WHEEL_24_DARK = [
  "#fd0c0c",
  "#f24a06",
  "#e76700",
  "#e07c00",
  "#d78f00",
  "#c28f00",
  "#ac8e00",
  "#a59600",
  "#9d9d00",
  "#879e05",
  "#709e0a",
  "#53a319",
  "#23a823",
  "#2f9055",
  "#257979",
  "#33688c",
  "#36569f",
  "#4648a0",
  "#5237a0",
  "#6635a0",
  "#7832a0",
  "#9d2c8c",
  "#bc2179",
  "#df194a",
] as const;

export function regionToWheel24(
  pitchClasses: PitchClass[],
): number | undefined {
  return getRegionMidpointInHalfFifths(pitchClasses);
}

function wheel24ToColor(wheelIndex: number): string {
  const normalizedIndex = mod(wheelIndex, HARMONIC_WHEEL_SIZE);
  return HARMONIC_WHEEL_24[normalizedIndex]!;
}

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function parseRgbColor(color: string): [number, number, number] | undefined {
  const match = color.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);

  if (match === null) {
    return undefined;
  }

  const [, red, green, blue] = match;

  return [
    Number.parseInt(red!, 10),
    Number.parseInt(green!, 10),
    Number.parseInt(blue!, 10),
  ];
}

export function wheel24ToDarkColor(wheelIndex: number): string {
  const normalizedIndex = mod(wheelIndex, HARMONIC_WHEEL_SIZE);
  return HARMONIC_WHEEL_24_DARK[normalizedIndex]!;
}

export function flattenColorOverWhite(color: string, alpha: number): string {
  const parsedColor = parseRgbColor(color);

  if (parsedColor === undefined) {
    return color;
  }

  const [red, green, blue] = parsedColor;
  const flattenChannel = (channel: number): number =>
    clampChannel(255 - alpha * (255 - channel));

  return `rgb(${flattenChannel(red)}, ${flattenChannel(green)}, ${flattenChannel(blue)})`;
}

export function regionToColor(pitchClasses: PitchClass[]): string | undefined {
  const wheelIndex = regionToWheel24(pitchClasses);

  if (wheelIndex === undefined) {
    return undefined;
  }

  return wheel24ToColor(wheelIndex);
}
