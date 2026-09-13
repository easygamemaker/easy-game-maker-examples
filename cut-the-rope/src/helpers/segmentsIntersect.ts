// Port of GeometricUtils.segmentsIntersect from Lua original
// Tests if segment AB intersects segment CD using cross-product method

function cross(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}

function area2(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  return cross(bx - ax, by - ay, cx - ax, cy - ay);
}

function pointInBox(px: number, py: number, ax: number, ay: number, bx: number, by: number): boolean {
  return px >= Math.min(ax, bx) && px <= Math.max(ax, bx) &&
         py >= Math.min(ay, by) && py <= Math.max(ay, by);
}

function pointOverSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): boolean {
  return Math.abs(area2(ax, ay, bx, by, px, py)) <= 1e-10 &&
         pointInBox(px, py, ax, ay, bx, by);
}

export function segmentsIntersect(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number,
): boolean {
  const A1 = area2(cx, cy, dx, dy, ax, ay);
  const A2 = area2(cx, cy, dx, dy, bx, by);
  const A3 = area2(ax, ay, bx, by, cx, cy);
  const A4 = area2(ax, ay, bx, by, dx, dy);

  if (((A1 > 0 && A2 < 0) || (A1 < 0 && A2 > 0)) &&
      ((A3 > 0 && A4 < 0) || (A3 < 0 && A4 > 0))) return true;

  if (A1 === 0 && pointOverSegment(ax, ay, cx, cy, dx, dy)) return true;
  if (A2 === 0 && pointOverSegment(bx, by, cx, cy, dx, dy)) return true;
  if (A3 === 0 && pointOverSegment(cx, cy, ax, ay, bx, by)) return true;
  if (A4 === 0 && pointOverSegment(dx, dy, ax, ay, bx, by)) return true;

  return false;
}
