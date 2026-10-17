// One step of the state, for one cell. Human-written (AGENTS.md: the update rule is this sketch's core).
//
// Called once per cell per step, cell = index (0 .. n*n*n - 1; cellIndex(x, y, z) = x + n * (y + n * z) in cells.ts).
// Read `prev`, write `next` -- never read `next` or write `prev` (the two swap every step: state.ts).
//
//   prev, next  the state of every cell: vec4f(u, v, paint, spare) (plan: decision log)
//   solid       1 = solid, 0 = empty: empty cells are walls
//   n           cells per side
//   tap         the cell knocked this step, or -1
//
// The stub writes nothing, so the state stays all zeros.
fn stepCell(
  prev: ptr<storage, array<vec4f>, read_write>,
  next: ptr<storage, array<vec4f>, read_write>,
  solid: ptr<storage, array<u32>, read_write>,
  n: u32,
  tap: i32,
  index: u32
) {
}
