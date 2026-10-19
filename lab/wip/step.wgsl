// One step of the state, for one cell. Human-written (AGENTS.md: the update rule is this sketch's core).
//
// Called once per cell per step, cell = index (0 .. n*n*n - 1; cellIndex(x, y, z) = x + n * (y + n * z) in cells.ts).
// Read `prev`, write `next` -- never read `next` or write `prev` (the two swap every step: state.ts).
//
//   prev, next  the state of every cell: vec4f(u, v, paint, spare) (plan: decision log)
//   solid       1 = solid, 0 = empty: empty cells are walls
//   n           cells per side
//   tap         the cell knocked this step, or -1
//   k ...       the knobs, params.json via the debug pane (params.ts)
fn stepCell(
  prev: ptr<storage, array<vec4f>, read_write>, // 前のステップの状態
  next: ptr<storage, array<vec4f>, read_write>, // 次のステップ（これから書き込む現在）の状態
  solid: ptr<storage, array<u32>, read_write>, // 空かどうか
  n: i32,
  tap: i32,
  index: i32,
  k: f32,
  damping: f32,
  anchor: f32,
  knockRadius: f32,
  knockStrength: f32
) {

  let here = prev[index];
  let disp = here.x;
  let vel = here.y;
  let paint = here.z;

  // index = x + y * n + z * n * n
  let iz = index / (n * n);
  let iy = (index / n) % n;
  let ix = index % n;

  let dispLeft = neighborDisp(prev, solid, n, ix - 1, iy, iz, disp);
  let dispRight = neighborDisp(prev, solid, n, ix + 1, iy, iz, disp);
  let dispDown = neighborDisp(prev, solid, n, ix, iy - 1, iz, disp);
  let dispUp = neighborDisp(prev, solid, n, ix, iy + 1, iz, disp);
  let dispBack = neighborDisp(prev, solid, n, ix, iy, iz - 1, disp);
  let dispFront = neighborDisp(prev, solid, n, ix, iy, iz + 1, disp);

  // 隣ごとの差分の合計
  let pull = (dispLeft + dispRight + dispDown + dispUp + dispBack + dispFront - 6.0 * disp);
  var newVel = vel + k * pull - disp * anchor; // 新しい速度を決定(バネ & 元の位置に戻ろうとする)
  newVel = newVel * damping; // 減衰
  var newDisp = disp + newVel; // 新しい変位を決定

  // 叩いた範囲に、中心ほど強く力を入れる（速度に入れるので、次のステップから動き始める）
  if(tap >= 0) {
    let radius = knockRadius; // 叩く範囲の半径（セル数）
    let strength = knockStrength; // 中心に入れる強さ

    // tap -> tx, ty, tz
    let tz = tap / (n * n);
    let ty = (tap / n) % n;
    let tx = tap % n;

    // 叩いたセルから自分までの距離
    let d = vec3f(f32(ix - tx), f32(iy - ty), f32(iz - tz));
    let dist = length(d);

    if(dist < radius) {
      let falloff = 1.0 - dist / radius; // 中心で 1、半径で 0
      newVel = newVel + strength * falloff;
    }
  }

  next[index] = vec4f(newDisp, newVel, paint, 0.0); // 新しい状態を書き込む
}

fn neighborDisp(
  prev: ptr<storage, array<vec4f>, read_write>,
  solid: ptr<storage, array<u32>, read_write>,
  n: i32,
  ix: i32, iy: i32, iz: i32,
  selfDisp: f32
) -> f32 {
  if(ix < 0 || ix >= n || iy < 0 || iy >= n || iz < 0 || iz >= n) {
    return selfDisp;
  }

  let index = ix + iy * n + iz * n * n;

  if(solid[index] == 0) {
    return selfDisp;
  }

  return prev[index].x;
}