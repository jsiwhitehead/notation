export const mod = (n, m) => ((n % m) + m) % m;

export const range = length => Array.from({ length }).map((_, i) => i);

export const combinations = (items, count) => {
  if (items.length === count) return [items];
  if (items.length === 0 || count === 0) return [[]];
  const [x, ...rest] = items;
  return [
    ...combinations(rest, count - 1).map(a => [x, ...a]),
    ...combinations(rest, count),
  ];
};

const sortMultiple = sort => (items1, items2) =>
  Array.from({ length: Math.max(items1.length, items2.length) }).reduce(
    (res, _, i) => {
      if (res !== 0) return res;
      if (items1[i] === undefined) return -1;
      if (items2[i] === undefined) return 1;
      return sort(items1[i], items2[i]);
    },
    0,
  );

const normalize = items =>
  range(items.length)
    .map((_, i) =>
      range(items.length).map((_, j) => items[(i + j) % items.length]),
    )
    .sort(sortMultiple((a, b) => a - b))[0];

export const toIntervals = notes =>
  normalize(
    range(notes.length).map(i =>
      mod(notes[mod(i + 1, notes.length)] - notes[i], 12),
    ),
  );

export const toNotes = intervals =>
  intervals.slice(0, -1).reduce((res, int, i) => [...res, res[i] + int], [0]);

const fifthsMap = {
  0: 0,
  1: 7,
  2: 2,
  3: 9,
  4: 4,
  5: 11,
  6: 6,
  7: 1,
  8: 8,
  9: 3,
  10: 10,
  11: 5,
};

export const toPitches = fifths =>
  fifths.map(f => fifthsMap[f]).sort((a, b) => a - b);
