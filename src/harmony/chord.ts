import type { PitchClass } from "../model";
import { toPitchClass, uniqueSortedPitchClasses } from "../pitch";

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

type AccidentalOffset = -1 | 0 | 1;
type SeventhKind = "diminished" | "major" | "minor" | "none";
type Modifier =
  | {
      accidental: AccidentalOffset;
      degree: number;
      type: "add";
    }
  | {
      accidental: -1 | 1;
      degree: 5 | 9 | 11 | 13;
      type: "alter";
    };
type DescriptorToken =
  | {
      quality: HarmonyQuality;
      type: "quality";
    }
  | {
      modifier: Modifier;
      type: "modifier";
    }
  | {
      kind: SeventhKind;
      type: "seventh";
    }
  | {
      type: "sixth";
    };

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
const SUPPORTED_ADD_DEGREES = [2, 4, 5, 6, 7, 9, 11, 13] as const;
const SEVENTH_TOKEN_PATTERNS = [
  { kind: "major" as const, pattern: /maj7/g },
  { kind: "diminished" as const, pattern: /dim7/g },
];

type ParsedHarmonySymbol = {
  bassName?: RootName;
  modifiers: Modifier[];
  quality: HarmonyQuality;
  rootName: RootName;
  seventh: SeventhKind;
  sixth: boolean;
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

function parseRootAndBass(symbol: string): {
  bassName?: RootName;
  descriptor: string;
  rootName: RootName;
} | undefined {
  const bassMatch = symbol.match(/\/(c|d|e|f|g|a|b)(b|#)?$/);

  if (symbol.includes("/") && bassMatch === null && !symbol.includes("6/9")) {
    return undefined;
  }

  const body =
    bassMatch === null ? symbol : symbol.slice(0, symbol.length - bassMatch[0].length);
  const rootName = getRootName(body);

  if (rootName === undefined) {
    return undefined;
  }

  const bassName =
    bassMatch === null ? undefined : getRootName(bassMatch[0].slice(1));

  return {
    ...(bassName === undefined ? {} : { bassName }),
    descriptor: body.slice(rootName.length),
    rootName,
  };
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

function getAccidentalOffset(
  accidental: "" | "#" | "b",
): AccidentalOffset {
  return accidental === "#"
    ? 1
    : accidental === "b"
      ? -1
      : 0;
}

function getIntervalForDegree(
  degree: number,
  accidental: AccidentalOffset,
): PitchClass | undefined {
  const degreeClassByDegree: Partial<Record<number, number>> = {
    2: 2,
    4: 4,
    5: 5,
    6: 6,
    7: 7,
    9: 2,
    11: 4,
    13: 6,
  };
  const baseIntervalByDegreeClass: Record<number, PitchClass> = {
    2: 2,
    4: 5,
    5: 7,
    6: 9,
    7: 11,
  };
  const degreeClass = degreeClassByDegree[degree];

  if (degreeClass === undefined) {
    return undefined;
  }

  const baseInterval = baseIntervalByDegreeClass[degreeClass];

  return baseInterval === undefined
    ? undefined
    : toPitchClass(baseInterval + accidental);
}

function isSupportedAddDegree(degree: number): boolean {
  return (SUPPORTED_ADD_DEGREES as readonly number[]).includes(degree);
}

function tokenizeDescriptor(descriptor: string): DescriptorToken[] {
  const tokens: DescriptorToken[] = [
    { quality: getHarmonyQuality(descriptor), type: "quality" },
  ];
  const consumedRanges: Array<{ end: number; start: number }> = [];
  const markConsumed = (start: number, end: number): void => {
    consumedRanges.push({ end, start });
  };
  const isConsumed = (start: number, end: number): boolean =>
    consumedRanges.some((range) => start < range.end && end > range.start);

  Array.from(descriptor.matchAll(/add(#|b)?(\d+)/g)).forEach((match) => {
    const index = match.index;

    if (index === undefined) {
      return;
    }

    markConsumed(index, index + match[0].length);
    const degree = Number(match[2]);

    if (!isSupportedAddDegree(degree)) {
      return;
    }

    tokens.push({
      modifier: {
        accidental: getAccidentalOffset((match[1] ?? "") as "" | "#" | "b"),
        degree,
        type: "add",
      },
      type: "modifier",
    });
  });

  SEVENTH_TOKEN_PATTERNS.forEach(({ kind, pattern }) => {
    Array.from(descriptor.matchAll(pattern)).forEach((match) => {
      const index = match.index;

      if (index === undefined || isConsumed(index, index + match[0].length)) {
        return;
      }

      markConsumed(index, index + match[0].length);
      tokens.push({ kind, type: "seventh" });
    });
  });

  Array.from(descriptor.matchAll(/(b|#)(5|9|11|13)/g)).forEach((match) => {
    const index = match.index;

    if (index === undefined || isConsumed(index, index + match[0].length)) {
      return;
    }

    markConsumed(index, index + match[0].length);
    tokens.push({
      modifier: {
        accidental: getAccidentalOffset(match[1] as "#" | "b") as -1 | 1,
        degree: Number(match[2]) as 5 | 9 | 11 | 13,
        type: "alter",
      },
      type: "modifier",
    });
  });

  if (descriptor.includes("6/9")) {
    const index = descriptor.indexOf("6/9");
    markConsumed(index, index + 3);
    tokens.push({ type: "sixth" });
    tokens.push({
      modifier: {
        accidental: 0,
        degree: 9,
        type: "add",
      },
      type: "modifier",
    });
  }

  Array.from(descriptor.matchAll(/(^|[^0-9#b])(7|9|11|13)([^0-9]|$)/g)).forEach(
    (match) => {
      const degreeText = match[2]!;
      const index = (match.index ?? 0) + match[1]!.length;
      const end = index + degreeText.length;

      if (isConsumed(index, end)) {
        return;
      }

      markConsumed(index, end);

      if (degreeText === "7") {
        tokens.push({ kind: "minor", type: "seventh" });
        return;
      }

      tokens.push({ kind: "minor", type: "seventh" });
      tokens.push({
        modifier: {
          accidental: 0,
          degree: Number(degreeText),
          type: "add",
        },
        type: "modifier",
      });
    },
  );

  Array.from(descriptor.matchAll(/(^|[^0-9])6([^0-9]|$)/g)).forEach((match) => {
    const index = (match.index ?? 0) + match[1]!.length;
    const end = index + 1;

    if (isConsumed(index, end)) {
      return;
    }

    markConsumed(index, end);
    tokens.push({ type: "sixth" });
  });

  return tokens;
}

function buildParsedHarmony(
  descriptor: string,
  rootName: RootName,
  bassName?: RootName,
): ParsedHarmonySymbol {
  const tokens = tokenizeDescriptor(descriptor);
  const qualityToken = tokens.find(
    (token): token is Extract<DescriptorToken, { type: "quality" }> =>
      token.type === "quality",
  );

  if (qualityToken === undefined) {
    throw new Error("Chord descriptor tokenization must emit a quality token.");
  }

  const modifiers = tokens.flatMap((token) =>
    token.type === "modifier" ? [token.modifier] : [],
  );
  const seventh =
    tokens.find((token) => token.type === "seventh")?.kind ?? "none";
  const sixth = tokens.some((token) => token.type === "sixth");

  return {
    ...(bassName === undefined ? {} : { bassName }),
    modifiers,
    quality: qualityToken.quality,
    rootName,
    seventh,
    sixth,
  };
}

function parseHarmonySymbol(symbol: string): ParsedHarmonySymbol | undefined {
  const parsedRootAndBass = parseRootAndBass(symbol.trim().toLowerCase());

  if (parsedRootAndBass === undefined) {
    return undefined;
  }

  return buildParsedHarmony(
    parsedRootAndBass.descriptor,
    parsedRootAndBass.rootName,
    parsedRootAndBass.bassName,
  );
}

function getBaseIntervals(quality: HarmonyQuality): PitchClass[] {
  return BASE_INTERVALS[quality];
}

function applyStructuralIntervals(
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

  return intervals;
}

function applyModifier(
  intervals: PitchClass[],
  modifier: Modifier,
): PitchClass[] {
  const interval = getIntervalForDegree(modifier.degree, modifier.accidental);

  if (interval === undefined) {
    return intervals;
  }

  if (modifier.type === "alter" && modifier.degree === 5) {
    return intervals.includes(7)
      ? intervals.map((candidate) => (candidate === 7 ? interval : candidate))
      : [...intervals, interval];
  }

  return [...intervals, interval];
}

function getGuidancePitchClasses(
  parsedSymbol: ParsedHarmonySymbol,
): PitchClass[] {
  const baseIntervals = getBaseIntervals(parsedSymbol.quality);
  const structuralIntervals = applyStructuralIntervals(baseIntervals, parsedSymbol);
  const completeIntervals = parsedSymbol.modifiers.reduce(
    (intervals, modifier) => applyModifier(intervals, modifier),
    structuralIntervals,
  );

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
  const pitchClasses = uniqueSortedPitchClasses([
    ...getGuidancePitchClasses(parsedSymbol),
    groundPitchClass,
  ]);

  return {
    groundPitchClass,
    pitchClasses,
    rootPitchClass,
  };
}
