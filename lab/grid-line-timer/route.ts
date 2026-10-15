// The path one line takes from outside the frame to its segment: a walk along grid lines, turning only at
// grid points, so the line is always riding the grid it is drawn over.
//
// Built BACKWARDS from the segment. Arriving exactly is the hard constraint and leaving the frame is the
// loose one, so start from the end that must be exact and walk outward until the loose one is satisfied.
import type { Segment, Vec2 } from './clock.ts';

export type Route = {
  'points': Vec2[]; // corners, from the off-screen start to the arrival point
  'lengths': number[]; // arc length at each point; lengths[0] = 0
  'total': number;
};

export type RouteParams = {
  'inset': number; // cells kept clear at each end of the segment, so neighbouring segments do not touch
  'legMin': number;
  'legMax': number;
  'outward': number; // 0..1, chance a turn heads away from the clock rather than back toward it
  'maxLegs': number;
};

// Mulberry32. Seeded per line so a given second always draws the same paths (?capture takes are repeatable).
export const createRandom = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// center: the middle of the clock. bound: half extents (cells, from center) the walk must get past.
export const buildRoute = (
  segment: Segment,
  center: Vec2,
  bound: Vec2,
  params: RouteParams,
  random: () => number,
): Route => {
  // Which end the line comes in from. Either is fine; picking at random keeps a digit from always
  // assembling in the same direction.
  const flip = random() < 0.5;
  const tail = flip ? segment['to'] : segment['from'];
  const head = flip ? segment['from'] : segment['to'];
  // Arrival direction, a unit axis vector.
  const dir: Vec2 = [head[0] - tail[0], head[1] - tail[1]];
  const inset = params['inset'];
  const end: Vec2 = [head[0] - dir[0] * inset, head[1] - dir[1] * inset];

  const legLength = () => params['legMin'] + Math.floor(random() * (params['legMax'] - params['legMin'] + 1));
  const outside = (p: Vec2) => Math.abs(p[0] - center[0]) > bound[0] || Math.abs(p[1] - center[1]) > bound[1];

  // Walking backwards: the first leg runs back along the segment, through its far end, and on.
  const back: Vec2[] = [end];
  let p: Vec2 = [tail[0] - dir[0] * legLength(), tail[1] - dir[1] * legLength()];
  back.push(p);
  let axis = dir[0] !== 0 ? 0 : 1; // the axis of the leg just walked

  for (let leg = 0; leg < params['maxLegs'] && !outside(p); leg++) {
    axis = 1 - axis;
    const offset = p[axis] - center[axis];
    const away = offset === 0 ? (random() < 0.5 ? 1 : -1) : Math.sign(offset);
    const sign = random() < params['outward'] ? away : -away;
    const next: Vec2 = [p[0], p[1]];
    next[axis] += sign * legLength();
    back.push(next);
    p = next;
  }

  // Still inside after maxLegs: one last leg straight out, perpendicular to the last one (never a U-turn).
  if (!outside(p)) {
    axis = 1 - axis;
    const offset = p[axis] - center[axis];
    const sign = offset === 0 ? 1 : Math.sign(offset);
    const next: Vec2 = [p[0], p[1]];
    next[axis] = center[axis] + sign * (Math.floor(bound[axis]) + 1);
    back.push(next);
  }

  const points = back.reverse();
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    lengths.push(lengths[i - 1]! + Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]));
  }
  return { 'points': points, 'lengths': lengths, 'total': lengths[lengths.length - 1]! };
};
