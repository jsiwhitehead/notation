import './reset.css';

import getScales from './scales';
import { mod, range } from './util';

const data = require('./scales.json');

const canvas = document.createElement('canvas');
canvas.width = 2400;
canvas.height = 8000;
canvas.style.width = '1200px';
canvas.style.height = '4000px';
const ctx = canvas.getContext('2d');
document.body.appendChild(canvas);

const scales = getScales(7, 3);

const radius = 60;

const angle = Math.PI / 6;
const circle = range(12).map(i => [
  Math.sin(i * angle) * radius,
  -Math.cos(i * angle) * radius,
]);

const drawArc = (a, b, anti) => {
  const d = [(b[0] - a[0]) / 2, (b[1] - a[1]) / 2];
  const l = Math.sqrt(d[0] * d[0] + d[1] * d[1]);
  const t = 16 / l;
  const r = l / Math.sin(t);
  const s = Math.atan2(d[1], d[0]) + ((anti ? -1 : 1) * Math.PI) / 2;
  ctx.arc(
    a[0] + d[0] + ((anti ? -1 : 1) * d[1]) / Math.tan(t),
    a[1] + d[1] - ((anti ? -1 : 1) * d[0]) / Math.tan(t),
    r,
    s - t,
    s + t,
  );
};

const drawCircle = (scale, x, y) => {
  // ctx.beginPath();
  // ctx.arc(x, y, radius, 0, 2 * Math.PI);
  // ctx.stroke();

  // ctx.beginPath();
  // ctx.moveTo(x, y - radius);
  // ctx.lineTo(x, y + radius);
  // ctx.stroke();

  // ctx.beginPath();
  // ctx.moveTo(x - radius, y);
  // ctx.lineTo(x + radius, y);
  // ctx.stroke();

  ctx.strokeStyle = '#999';
  scale.forEach(i => {
    let drawn = false;
    [7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5].forEach(j => {
      if (!drawn) {
        const next = mod(i + j, 12);
        if (scale.includes(next)) {
          ctx.beginPath();
          if (j === 6 || j === 7) {
            ctx.moveTo(x + circle[i][0], y + circle[i][1]);
            ctx.lineTo(x + circle[next][0], y + circle[next][1]);
          } else {
            if (j === 9) ctx.setLineDash([10, 5]);
            drawArc(
              [x + circle[i][0], y + circle[i][1]],
              [x + circle[next][0], y + circle[next][1]],
              j > 6,
            );
          }
          ctx.stroke();
          ctx.setLineDash([]);
          drawn = true;
        }
      }
    });
  });
  ctx.strokeStyle = '#000';

  ctx.fillStyle = '#fff';
  range(12).forEach(note => {
    ctx.beginPath();
    ctx.arc(x + circle[note][0], y + circle[note][1], 6, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
  });
  ctx.fillStyle = '#000';

  scale.forEach(note => {
    ctx.beginPath();
    ctx.arc(x + circle[note][0], y + circle[note][1], 6, 0, 2 * Math.PI);
    ctx.fill();
  });
};

const width = 50;
const gap = 20;

const drawStave = (scale, x, y) => {
  const top = y - gap * 3;
  range(4).map(i => {
    ctx.beginPath();
    ctx.moveTo(x - width, top + i * 2 * gap);
    ctx.lineTo(x + width, top + i * 2 * gap);
    ctx.stroke();
  });
  scale.forEach(note => {
    ctx.beginPath();
    ctx.arc(
      x - (Math.floor(note / 6) - 0.5) * gap,
      top + (6 - (note % 6)) * gap,
      6,
      0,
      2 * Math.PI,
    );
    ctx.fill();
    if (note % 6 === 0) {
      ctx.beginPath();
      ctx.arc(x + (Math.floor(note / 6) - 0.5) * gap, top, 6, 0, 2 * Math.PI);
      ctx.fill();
    }
  });
};

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
const noteMap = {
  0: 'A',
  1: 'Bb',
  2: 'B',
  3: 'C',
  4: 'C#',
  5: 'D',
  6: 'Eb',
  7: 'E',
  8: 'F',
  9: 'F#',
  10: 'G',
  11: 'G#',
};

scales.forEach((scale, i) => {
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#000';
  ctx.fillStyle = '#000';
  ctx.font = '20px serif';
  ctx.textBaseline = 'middle';

  const x = 200 + (i % 2) * 1100;
  const y = 300 + Math.floor(i / 2) * 230;

  drawCircle(scale, x, y);
  drawStave(scale, x + 250, y);

  const modes = range(scale.length).reduce((res, i) => {
    const key = scale
      .map(n => fifthsMap[mod(n - scale[i], 12)])
      .sort((a, b) => a - b)
      .map(n => noteMap[n])
      .join('-');
    return { ...res, [key]: scale[i] };
  }, {});
  const namedScales = Object.keys(modes).reduce(
    (res, m) => [...res, ...(data[m] || []).map(s => `${modes[m]}: ${s}`)],
    [],
  );

  const gap = 25;
  const top = y - (namedScales.length - 1) * gap * 0.5;
  namedScales.forEach((s, i) => {
    ctx.fillText(s, x + 400, top + i * gap);
  });
});
