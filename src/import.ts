import type {
  ChordEvent,
  EventInput,
  NoteEvent,
  PieceInput,
  RestEvent,
  SegmentInput,
  TimedChordSymbol,
  TimeSignature,
} from "./model";

type MeasureEvent = {
  duration: number;
  isChordTone: boolean;
  layer: number;
  offset: number;
} & (
  | {
      pitches: number[];
      type: "chord";
    }
  | {
      pitch: number;
      type: "note";
    }
  | {
      type: "rest";
    }
);

type ParseState = {
  currentOffset: number;
  divisions: number;
  lastNoteOffset: number | undefined;
  layerByVoice: Map<string, number>;
  timeSignature: TimeSignature | undefined;
};

const STEP_TO_SEMITONE: Record<string, number> = {
  A: 9,
  B: 11,
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
};

const HARMONY_KIND_TO_SUFFIX: Record<string, string> = {
  augmented: "aug",
  diminished: "dim",
  dominant: "7",
  "dominant-seventh": "7",
  major: "",
  "major-seventh": "maj7",
  minor: "min",
  "minor-seventh": "min7",
};
const DEGREE_ACCIDENTAL_TO_TEXT: Record<number, string> = {
  [-2]: "bb",
  [-1]: "b",
  0: "",
  1: "#",
  2: "##",
};

function appendMeasureEvent(events: MeasureEvent[], event: MeasureEvent): void {
  if (!event.isChordTone) {
    events.push(event);
    return;
  }

  const previousEvent = events.at(-1);

  if (
    previousEvent === undefined ||
    previousEvent.type === "rest" ||
    event.type === "rest" ||
    previousEvent.offset !== event.offset ||
    previousEvent.duration !== event.duration ||
    previousEvent.layer !== event.layer
  ) {
    events.push({
      duration: event.duration,
      layer: event.layer,
      offset: event.offset,
      ...(event.type === "chord"
        ? { pitches: event.pitches, type: "chord" as const }
        : event.type === "note"
          ? { pitches: [event.pitch], type: "chord" as const }
          : { type: "rest" as const }),
      isChordTone: false,
    });
    return;
  }

  if (previousEvent.type === "chord") {
    previousEvent.pitches.push(
      ...(event.type === "chord" ? event.pitches : [event.pitch]),
    );
    return;
  }

  events[events.length - 1] = {
    duration: previousEvent.duration,
    layer: previousEvent.layer,
    offset: previousEvent.offset,
    pitches: [
      previousEvent.pitch,
      ...(event.type === "chord" ? event.pitches : [event.pitch]),
    ],
    type: "chord",
    isChordTone: false,
  };
}

function getRequiredChildText(
  element: Element,
  selector: string,
): string | undefined {
  return element.querySelector(selector)?.textContent?.trim();
}

function getPitch(step: string, alter: number, octave: number): number {
  return (octave + 1) * 12 + STEP_TO_SEMITONE[step]! + alter;
}

function getVoiceKey(noteElement: Element): string {
  return getRequiredChildText(noteElement, "voice") ?? "1";
}

function getLayer(voiceKey: string, state: ParseState): number {
  const existingLayer = state.layerByVoice.get(voiceKey);

  if (existingLayer !== undefined) {
    return existingLayer;
  }

  const nextLayer = state.layerByVoice.size;
  state.layerByVoice.set(voiceKey, nextLayer);

  return nextLayer;
}

function getDurationUnits(
  noteElement: Element,
  divisions: number,
): number | undefined {
  const durationText = getRequiredChildText(noteElement, "duration");

  if (durationText === undefined) {
    return undefined;
  }

  const durationValue = Number(durationText);

  if (!Number.isFinite(durationValue) || divisions <= 0) {
    return undefined;
  }

  return durationValue / divisions;
}

function getDegreeSuffixes(harmonyElement: Element, baseSuffix: string): string[] {
  return Array.from(harmonyElement.querySelectorAll("degree")).flatMap(
    (degreeElement) => {
      const degreeValue = Number(
        getRequiredChildText(degreeElement, "degree-value"),
      );
      const degreeAlter = Number(
        getRequiredChildText(degreeElement, "degree-alter") ?? "0",
      );
      const accidentalText = DEGREE_ACCIDENTAL_TO_TEXT[degreeAlter];

      if (
        !Number.isFinite(degreeValue) ||
        !Number.isFinite(degreeAlter) ||
        accidentalText === undefined
      ) {
        return [];
      }

      if (degreeAlter !== 0) {
        return [`${accidentalText}${degreeValue}`];
      }

      if (degreeValue === 9 && /(^|[^0-9])6([^0-9]|$)/.test(baseSuffix)) {
        return ["/9"];
      }

      return [`add${degreeValue}`];
    },
  );
}

function getBassSuffix(harmonyElement: Element): string {
  const bassStep = getRequiredChildText(harmonyElement, "bass-step");

  if (bassStep === undefined) {
    return "";
  }

  const bassAlter = Number(
    getRequiredChildText(harmonyElement, "bass-alter") ?? "0",
  );
  const bassAccidental = DEGREE_ACCIDENTAL_TO_TEXT[bassAlter];

  if (!Number.isFinite(bassAlter) || bassAccidental === undefined) {
    return "";
  }

  return `/${bassStep}${bassAccidental}`;
}

function getHarmonyChordSymbol(harmonyElement: Element): string | undefined {
  const rootStep = getRequiredChildText(harmonyElement, "root-step");

  if (rootStep === undefined) {
    return undefined;
  }

  const rootAlter = Number(
    getRequiredChildText(harmonyElement, "root-alter") ?? "0",
  );
  const kindElement = harmonyElement.querySelector("kind");
  const kindValue = kindElement?.textContent?.trim().toLowerCase() ?? "major";
  const kindText = kindElement?.getAttribute("text")?.trim();
  const kindUsesSymbols = kindElement?.getAttribute("use-symbols") === "yes";
  const accidental =
    rootAlter === -2
      ? "bb"
      : rootAlter === -1
        ? "b"
        : rootAlter === 1
          ? "#"
          : rootAlter === 2
            ? "##"
            : "";
  const suffix =
    kindText ??
    (kindUsesSymbols && kindValue === "major"
      ? "maj7"
      : HARMONY_KIND_TO_SUFFIX[kindValue]);

  if (suffix === undefined) {
    return undefined;
  }

  return `${rootStep}${accidental}${suffix}${getDegreeSuffixes(harmonyElement, suffix).join("")}${getBassSuffix(harmonyElement)}`;
}

function appendTimedChordSymbol(
  chordSymbols: TimedChordSymbol[],
  nextChordSymbol: TimedChordSymbol,
): void {
  const previousChordSymbol = chordSymbols.at(-1);

  if (
    previousChordSymbol?.offset === nextChordSymbol.offset &&
    previousChordSymbol.symbol === nextChordSymbol.symbol
  ) {
    return;
  }

  chordSymbols.push(nextChordSymbol);
}

function getTimeSignature(
  attributesElement: Element,
): TimeSignature | undefined {
  const beatsText = getRequiredChildText(attributesElement, "time > beats");
  const beatTypeText = getRequiredChildText(
    attributesElement,
    "time > beat-type",
  );

  if (beatsText === undefined || beatTypeText === undefined) {
    return undefined;
  }

  const beats = Number(beatsText);
  const beatType = Number(beatTypeText);

  if (
    !Number.isFinite(beats) ||
    !Number.isFinite(beatType) ||
    beats <= 0 ||
    beatType <= 0
  ) {
    return undefined;
  }

  return {
    beatType,
    beats,
  };
}

function parseNoteElement(
  noteElement: Element,
  state: ParseState,
): MeasureEvent | undefined {
  const voiceKey = getVoiceKey(noteElement);
  const duration = getDurationUnits(noteElement, state.divisions);

  if (duration === undefined) {
    return undefined;
  }

  const isChordTone = noteElement.querySelector("chord") !== null;
  const offset = isChordTone
    ? (state.lastNoteOffset ?? state.currentOffset)
    : state.currentOffset;

  if (noteElement.querySelector("rest") !== null) {
    if (!isChordTone) {
      state.currentOffset += duration;
      state.lastNoteOffset = offset;
    }

    return {
      duration,
      isChordTone,
      layer: getLayer(voiceKey, state),
      offset,
      type: "rest",
    };
  }

  const step = getRequiredChildText(noteElement, "pitch > step");
  const octaveText = getRequiredChildText(noteElement, "pitch > octave");

  if (step === undefined || octaveText === undefined) {
    return undefined;
  }

  const alter = Number(
    getRequiredChildText(noteElement, "pitch > alter") ?? "0",
  );
  const octave = Number(octaveText);

  if (!Number.isFinite(alter) || !Number.isFinite(octave)) {
    return undefined;
  }

  if (!isChordTone) {
    state.currentOffset += duration;
    state.lastNoteOffset = offset;
  }

  return {
    duration,
    isChordTone,
    layer: getLayer(voiceKey, state),
    offset,
    pitch: getPitch(step, alter, octave),
    type: "note",
  };
}

function parseMeasure(
  measureElement: Element,
  partState: ParseState,
): SegmentInput {
  const childElements = Array.from(measureElement.children);
  const chordSymbols: TimedChordSymbol[] = [];
  const events: MeasureEvent[] = [];

  partState.currentOffset = 0;
  partState.lastNoteOffset = undefined;

  childElements.forEach((childElement) => {
    if (childElement.tagName === "attributes") {
      const divisionsText = getRequiredChildText(childElement, "divisions");

      if (divisionsText !== undefined) {
        const nextDivisions = Number(divisionsText);

        if (Number.isFinite(nextDivisions) && nextDivisions > 0) {
          partState.divisions = nextDivisions;
        }
      }

      const parsedTimeSignature = getTimeSignature(childElement);

      if (parsedTimeSignature !== undefined) {
        partState.timeSignature = parsedTimeSignature;
      }

      return;
    }

    if (
      childElement.tagName === "backup" ||
      childElement.tagName === "forward"
    ) {
      const duration = getDurationUnits(childElement, partState.divisions);

      if (duration === undefined) {
        return;
      }

      const direction = childElement.tagName === "backup" ? -1 : 1;
      partState.currentOffset = Math.max(
        partState.currentOffset + duration * direction,
        0,
      );
      partState.lastNoteOffset = undefined;
      return;
    }

    if (childElement.tagName === "harmony") {
      const chordSymbol = getHarmonyChordSymbol(childElement);

      if (chordSymbol !== undefined) {
        appendTimedChordSymbol(chordSymbols, {
          offset: partState.currentOffset,
          symbol: chordSymbol,
        });
      }

      return;
    }

    if (childElement.tagName !== "note") {
      return;
    }

    const parsedEvent = parseNoteElement(childElement, partState);

    if (parsedEvent !== undefined) {
      appendMeasureEvent(events, parsedEvent);
    }
  });

  const normalizedEvents = events
    .sort(
      (left, right) => left.offset - right.offset || left.layer - right.layer,
    )
    .map((event): EventInput => {
      if (event.type === "rest") {
        const restEvent: RestEvent = {
          duration: event.duration,
          layer: event.layer,
          offset: event.offset,
          type: "rest",
        };

        return restEvent;
      }

      if (event.type === "note") {
        const noteEvent: NoteEvent = {
          duration: event.duration,
          layer: event.layer,
          offset: event.offset,
          pitch: event.pitch,
          type: "note",
        };

        return noteEvent;
      }

      const chordEvent: ChordEvent = {
        duration: event.duration,
        layer: event.layer,
        offset: event.offset,
        pitches: event.pitches,
        type: "chord",
      };

      return chordEvent;
    });

  return {
    ...(chordSymbols.length === 0
      ? {}
      : {
          chordSymbols,
        }),
    events: normalizedEvents,
    ...(partState.timeSignature === undefined
      ? {}
      : { timeSignature: partState.timeSignature }),
  };
}

function mergeChordSymbols(
  measures: SegmentInput[],
  measureIndex: number,
): TimedChordSymbol[] {
  const merged: TimedChordSymbol[] = [];

  measures.forEach((measure) => {
    const timedChordSymbols = measure.chordSymbols ?? [];

    timedChordSymbols.forEach((timedChordSymbol) => {
      if (
        !merged.some(
          (candidate) =>
            candidate.offset === timedChordSymbol.offset &&
            candidate.symbol === timedChordSymbol.symbol,
        )
      ) {
        merged.push(timedChordSymbol);
      }
    });
  });

  void measureIndex;

  return merged.sort(
    (left, right) =>
      left.offset - right.offset || left.symbol.localeCompare(right.symbol),
  );
}

function getPartMeasures(partElement: Element): SegmentInput[] {
  const partState: ParseState = {
    currentOffset: 0,
    divisions: 1,
    lastNoteOffset: undefined,
    layerByVoice: new Map(),
    timeSignature: undefined,
  };

  return Array.from(partElement.querySelectorAll(":scope > measure")).map(
    (measureElement) => parseMeasure(measureElement, partState),
  );
}

export function parseMusicXml(xml: string): PieceInput {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  const parserError = document.querySelector("parsererror");

  if (parserError !== null) {
    throw new Error("Unable to parse MusicXML.");
  }

  const partElements = Array.from(
    document.querySelectorAll("score-partwise > part"),
  );

  if (partElements.length === 0) {
    throw new Error("MusicXML score-partwise document is missing parts.");
  }

  const partMeasures = partElements.map(getPartMeasures);
  const measureCount = Math.max(
    ...partMeasures.map((measures) => measures.length),
  );

  return {
    segments: Array.from({ length: measureCount }, (_, measureIndex) => {
      const mergedEvents: EventInput[] = [];
      let timeSignature: TimeSignature | undefined;

      partMeasures.forEach((measures) => {
        const measure = measures[measureIndex];

        if (measure === undefined) {
          return;
        }

        if (timeSignature === undefined) {
          timeSignature = measure.timeSignature;
        }

        mergedEvents.push(...measure.events);
      });
      const chordSymbols = mergeChordSymbols(
        partMeasures
          .map((measures) => measures[measureIndex])
          .filter((measure): measure is SegmentInput => measure !== undefined),
        measureIndex,
      );

      mergedEvents.sort(
        (left, right) =>
          (left.offset ?? 0) - (right.offset ?? 0) ||
          (left.layer ?? 0) - (right.layer ?? 0),
      );

      return {
        ...(chordSymbols.length === 0
          ? {}
          : {
              chordSymbols,
            }),
        events: mergedEvents,
        ...(timeSignature === undefined ? {} : { timeSignature }),
      };
    }),
  };
}
