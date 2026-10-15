// Where each lit segment of HH:MM:SS sits on the grid.
//
// One digit is 1 cell wide and 2 cells tall, and a segment is one cell edge, so every segment lies on a grid
// line and the travelling lines can reach it without ever leaving the grid. Coordinates are in cells.
//
//    a
//  f   b      a: (0,2)-(1,2)   b: (1,1)-(1,2)   c: (1,0)-(1,1)
//    g        d: (0,0)-(1,0)   e: (0,0)-(0,1)   f: (0,1)-(0,2)
//  e   c      g: (0,1)-(1,1)
//    d

export type Vec2 = [number, number];
export type Segment = { 'from': Vec2; 'to': Vec2 };
// A lit segment on the clock, and which of the six digits it belongs to.
export type LitSegment = Segment & { 'digit': number };

const SEGMENTS: Segment[] = [
  { 'from': [0, 2], 'to': [1, 2] }, // a
  { 'from': [1, 1], 'to': [1, 2] }, // b
  { 'from': [1, 0], 'to': [1, 1] }, // c
  { 'from': [0, 0], 'to': [1, 0] }, // d
  { 'from': [0, 0], 'to': [0, 1] }, // e
  { 'from': [0, 1], 'to': [0, 2] }, // f
  { 'from': [0, 1], 'to': [1, 1] }, // g
];

// Bit i set = segment i (a..g) lit.
const DIGITS = [
  0b0111111, // 0: abcdef
  0b0000110, // 1: bc
  0b1011011, // 2: abdeg
  0b1001111, // 3: abcdg
  0b1100110, // 4: bcfg
  0b1101101, // 5: acdfg
  0b1111101, // 6: acdefg
  0b0000111, // 7: abc
  0b1111111, // 8
  0b1101111, // 9: abcdfg
];

// The lower-left cell of each of the six digits (H H M M S S), and the bounds of the whole clock.
// Integer origins on purpose: a digit off the integer lattice would put its segments between grid lines.
export type Layout = { 'origins': Vec2[]; 'min': Vec2; 'max': Vec2 };

// HH MM SS side by side: 1 cell between digits, 2 between the pairs where a colon would be.
const ROW: Layout = {
  'origins': [[-7, -1], [-5, -1], [-2, -1], [0, -1], [3, -1], [5, -1]],
  'min': [-7, -1],
  'max': [6, 1],
};
// HH over MM over SS, 1 cell between the rows.
const COLUMN: Layout = {
  'origins': [[-2, 3], [0, 3], [-2, 0], [0, 0], [-2, -3], [0, -3]],
  'min': [-2, -3],
  'max': [1, 5],
};

// layout: 0 = by the screen's shape, 1 = row, 2 = column.
export const pickLayout = (layout: number, aspect: number): Layout => {
  if (layout === 1) return ROW;
  if (layout === 2) return COLUMN;
  return aspect >= 1 ? ROW : COLUMN;
};

// The six digits of HH:MM:SS at a moment. Local time, 24-hour.
export const digitsAt = (date: Date): number[] => {
  const h = date.getHours();
  const m = date.getMinutes();
  const s = date.getSeconds();
  return [Math.floor(h / 10), h % 10, Math.floor(m / 10), m % 10, Math.floor(s / 10), s % 10];
};

// Which of the six digits differ between second t - 1 and second t (epoch seconds).
export const changedDigits = (t: number): boolean[] => {
  const before = digitsAt(new Date((t - 1) * 1000));
  return digitsAt(new Date(t * 1000)).map((digit, i) => digit !== before[i]);
};

// How many segments a digit lights: 2 for a 1, 7 for an 8.
export const segmentCount = (digit: number): number => {
  let bits = DIGITS[digit]!;
  let n = 0;
  for (; bits; bits >>= 1) n += bits & 1;
  return n;
};

// The middle of digit i, in grid coordinates.
export const digitCenter = (layout: Layout, i: number): Vec2 => {
  const [ox, oy] = layout['origins'][i]!;
  return [ox + 0.5, oy + 1];
};

// The segments lit at a moment, in grid coordinates.
export const litSegments = (date: Date, layout: Layout): LitSegment[] => {
  const out: LitSegment[] = [];
  digitsAt(date).forEach((digit, i) => {
    const [ox, oy] = layout['origins'][i]!;
    const bits = DIGITS[digit]!;
    SEGMENTS.forEach((segment, s) => {
      if (!(bits & (1 << s))) return;
      out.push({
        'from': [segment['from'][0] + ox, segment['from'][1] + oy],
        'to': [segment['to'][0] + ox, segment['to'][1] + oy],
        'digit': i,
      });
    });
  });
  return out;
};
