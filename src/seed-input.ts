import type { PieceInput } from "./model";

export const SEED_INPUT: PieceInput = {
  segments: [
    {
      events: [
        { duration: 1, type: "rest" },
        { duration: 2, pitches: [62, 65, 69], type: "chord" },
      ],
      chordSymbol: "Dmin7",
    },
    {
      events: [
        { duration: 2, type: "rest" },
        { duration: 1, pitch: 67, type: "note" },
      ],
      chordSymbol: "G7",
    },
    {
      events: [
        { duration: 0.5, pitch: 64, type: "note" },
        { duration: 0.5, pitches: [60, 64, 67], type: "chord" },
        { duration: 0.5, type: "rest" },
        { duration: 0.5, pitch: 67, type: "note" },
        { duration: 0.5, pitches: [64, 67, 71], type: "chord" },
        { duration: 0.5, pitch: 72, type: "note" },
      ],
      chordSymbol: "Cmaj7",
    },
    {
      events: [
        { duration: 0.25, pitch: 69, type: "note" },
        { duration: 0.25, type: "rest" },
        { duration: 0.25, pitches: [64, 69], type: "chord" },
        { duration: 0.125, pitch: 72, type: "note" },
        { duration: 0.125, type: "rest" },
        { duration: 0.125, pitches: [67, 72], type: "chord" },
        { duration: 0.0625, pitch: 76, type: "note" },
        { duration: 0.0625, type: "rest" },
        { duration: 0.0625, pitches: [69, 72], type: "chord" },
        { duration: 1, pitch: 67, type: "note" },
        { duration: 0.5, pitch: 69, type: "note" },
        { duration: 0.125, pitch: 72, type: "note" },
        { duration: 0.0625, type: "rest" },
      ],
      chordSymbol: "Amin7",
    },
  ],
};
