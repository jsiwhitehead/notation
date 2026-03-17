import type { PitchClass } from "./model";
import { toPitchClass, uniqueSortedPitchClasses } from "./pitch";

type ParsedChordSymbol = {
  groundPitchClass: PitchClass;
  pitchClasses: PitchClass[];
  rootPitchClass: PitchClass;
};

type RootName =
  | "a"
  | "a#"
  | "ab"
  | "b"
  | "bb"
  | "c"
  | "c#"
  | "cb"
  | "d"
  | "d#"
  | "db"
  | "e"
  | "e#"
  | "eb"
  | "f"
  | "f#"
  | "g"
  | "g#"
  | "gb";

type HarmonyQuality =
  | "augmented"
  | "diminished"
  | "major"
  | "minor"
  | "suspended-fourth"
  | "suspended-second";

type SeventhKind = "diminished" | "major" | "minor" | "none";
type FifthKind = "flat" | "natural" | "sharp";
type NinthKind = "flat" | "natural" | "none" | "sharp";
type EleventhKind = "natural" | "none" | "sharp";

const ROOT_PITCH_CLASSES = {
  a: 9,
  "a#": 10,
  ab: 8,
  b: 11,
  bb: 10,
  c: 0,
  "c#": 1,
  cb: 11,
  d: 2,
  "d#": 3,
  db: 1,
  e: 4,
  "e#": 5,
  eb: 3,
  f: 5,
  "f#": 6,
  g: 7,
  "g#": 8,
  gb: 6,
} satisfies Record<RootName, PitchClass>;

const BASE_INTERVALS = {
  augmented: [0, 4, 8],
  diminished: [0, 3, 6],
  major: [0, 4, 7],
  minor: [0, 3, 7],
  "suspended-fourth": [0, 5, 7],
  "suspended-second": [0, 2, 7],
} satisfies Record<HarmonyQuality, PitchClass[]>;

type ParsedHarmonySymbol = {
  bassName?: RootName;
  eleventh: EleventhKind;
  fifth: FifthKind;
  ninth: NinthKind;
  quality: HarmonyQuality;
  rootName: RootName;
  seventh: SeventhKind;
  sixth: boolean;
  thirteenth: boolean;
};

function getRootFromName(rootName: RootName): PitchClass {
  return ROOT_PITCH_CLASSES[rootName];
}

function getRootName(symbol: string): RootName | undefined {
  const rootMatch = symbol.match(/^(c|d|e|f|g|a|b)(b|#)?/);

  if (rootMatch === null) {
    return undefined;
  }

  return rootMatch[0] as RootName;
}

function getHarmonyQuality(symbol: string): HarmonyQuality {
  if (symbol.includes("maj")) {
    return "major";
  }

  if (symbol.includes("sus2")) {
    return "suspended-second";
  }

  if (symbol.includes("sus")) {
    return "suspended-fourth";
  }

  if (symbol.includes("dim")) {
    return "diminished";
  }

  if (symbol.includes("aug") || symbol.includes("+")) {
    return "augmented";
  }

  if (
    symbol.includes("min") ||
    symbol.includes("-") ||
    /(^|[^a-z])m(6|7|9|11|13)?/.test(symbol)
  ) {
    return "minor";
  }

  return "major";
}

function parseHarmonySymbol(symbol: string): ParsedHarmonySymbol | undefined {
  const normalized = symbol.trim().toLowerCase();
  const bassMatch = normalized.match(/\/(c|d|e|f|g|a|b)(b|#)?$/);

  if (
    normalized.includes("/") &&
    bassMatch === null &&
    !normalized.includes("6/9")
  ) {
    return undefined;
  }

  const body =
    bassMatch === null
      ? normalized
      : normalized.slice(0, normalized.length - bassMatch[0].length);
  const rootName = getRootName(body);

  if (rootName === undefined) {
    return undefined;
  }

  const descriptor = body.slice(rootName.length);
  const includesSixNine = descriptor.includes("6/9");
  const seventh = descriptor.includes("maj7")
    ? "major"
    : descriptor.includes("dim7")
      ? "diminished"
      : !includesSixNine && /(^|[^0-9])(7|9|11|13)/.test(descriptor)
        ? "minor"
        : "none";
  const sixth = includesSixNine || /(^|[^0-9])6([^0-9]|$)/.test(descriptor);
  const ninth = descriptor.includes("b9")
    ? "flat"
    : descriptor.includes("#9")
      ? "sharp"
      : includesSixNine || descriptor.includes("9")
        ? "natural"
        : "none";
  const eleventh = descriptor.includes("#11")
    ? "sharp"
    : descriptor.includes("11")
      ? "natural"
      : "none";
  const thirteenth = descriptor.includes("13");
  const fifth = descriptor.includes("b5")
    ? "flat"
    : descriptor.includes("#5")
      ? "sharp"
      : "natural";

  return {
    eleventh,
    fifth,
    ninth,
    quality: getHarmonyQuality(descriptor),
    rootName,
    seventh,
    sixth,
    thirteenth,
    ...(() => {
      if (bassMatch === null) {
        return {};
      }

      const bassName = getRootName(bassMatch[0].slice(1));

      return bassName === undefined ? {} : { bassName };
    })(),
  };
}

function getBaseIntervals(quality: HarmonyQuality): PitchClass[] {
  return BASE_INTERVALS[quality];
}

function applyExtensions(
  baseIntervals: PitchClass[],
  parsedSymbol: ParsedHarmonySymbol,
): PitchClass[] {
  let intervals = [...baseIntervals];

  switch (parsedSymbol.seventh) {
    case "major":
      intervals = [...intervals, 11];
      break;
    case "minor":
      intervals = [...intervals, 10];
      break;
    case "diminished":
      intervals = [...intervals, 9];
      break;
    case "none":
      break;
  }

  if (parsedSymbol.sixth) {
    intervals = [...intervals, 9];
  }

  if (parsedSymbol.ninth === "natural") {
    intervals = [...intervals, 2];
  }

  if (parsedSymbol.eleventh === "natural") {
    intervals = [...intervals, 5];
  }

  if (parsedSymbol.thirteenth) {
    intervals = [...intervals, 9];
  }

  return intervals;
}

function applyAlterations(
  baseIntervals: PitchClass[],
  parsedSymbol: ParsedHarmonySymbol,
): PitchClass[] {
  let intervals = [...baseIntervals];

  switch (parsedSymbol.fifth) {
    case "flat":
      intervals = intervals.map((interval) => (interval === 7 ? 6 : interval));
      break;
    case "sharp":
      intervals = intervals.map((interval) => (interval === 7 ? 8 : interval));
      break;
    case "natural":
      break;
  }

  switch (parsedSymbol.ninth) {
    case "flat":
      intervals = [...intervals, 1];
      break;
    case "sharp":
      intervals = [...intervals, 3];
      break;
    case "natural":
    case "none":
      break;
  }

  switch (parsedSymbol.eleventh) {
    case "sharp":
      intervals = [...intervals, 6];
      break;
    case "natural":
    case "none":
      break;
  }

  return intervals;
}

function getGuidancePitchClasses(
  parsedSymbol: ParsedHarmonySymbol,
): PitchClass[] {
  const baseIntervals = getBaseIntervals(parsedSymbol.quality);
  const withExtensions = applyExtensions(baseIntervals, parsedSymbol);
  const completeIntervals = applyAlterations(withExtensions, parsedSymbol);

  return uniqueSortedPitchClasses(
    completeIntervals.map((interval) =>
      toPitchClass(getRootFromName(parsedSymbol.rootName) + interval),
    ),
  );
}

export function normalizeChordSymbol(
  symbol: string,
): ParsedChordSymbol | undefined {
  const parsedSymbol = parseHarmonySymbol(symbol);

  if (parsedSymbol === undefined) {
    return undefined;
  }

  const rootPitchClass = getRootFromName(parsedSymbol.rootName);
  const groundPitchClass =
    parsedSymbol.bassName === undefined
      ? rootPitchClass
      : getRootFromName(parsedSymbol.bassName);

  return {
    groundPitchClass,
    pitchClasses: getGuidancePitchClasses(parsedSymbol),
    rootPitchClass,
  };
}
