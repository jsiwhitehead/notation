import {
  combinations,
  mod,
  range,
  toIntervals,
  toNotes,
  toPitches,
} from './util';

const angle = Math.PI / 6;
const circle = range(12).map(i => [Math.sin(i * angle), Math.cos(i * angle)]);

const getCentre = notes => {
  const dir = notes.reduce(
    (res, n) => [res[0] + circle[n][0], res[1] + circle[n][1]],
    [0, 0],
  );
  const size = Math.sqrt(dir[0] * dir[0] + dir[1] * dir[1]);
  if (size < 0.000000001) return null;
  const ang = Math.atan2(dir[0], dir[1]);
  const centre = Math.round(ang / angle);
  return { size, angle: mod(centre + 9, 12) };
};

const rotate = notes => {
  const c1 = getCentre(notes);
  const centre = c1 === null ? getCentre(notes.map(n => mod(n, 6))) : c1;
  const result = notes
    .map(n => mod(n - centre.angle, 12))
    .sort((a, b) => a - b);
  return { size: c1 === null ? 0 : centre.size, notes: result };
};

export default (length, maxInterval) => {
  const scales = {};
  combinations(range(12), length).forEach(notes => {
    if (toIntervals(toPitches(notes)).every(i => i <= maxInterval)) {
      scales[JSON.stringify(toNotes(toIntervals(notes)))] = true;
    }
  });

  return Object.keys(scales)
    .map(k => rotate(JSON.parse(k)))
    .sort((a, b) => b.size - a.size)
    .map(a => a.notes);
};
