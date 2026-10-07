export interface InkJoint { x: number; y: number; vx: number; vy: number; }
/** Continuous spatial deformation, driven by actual joint positions and directional velocity. */
export function deformInkPoint(x: number, y: number, joints: InkJoint[], width: number, height: number, strength: number): [number, number] {
  let dx = 0, dy = 0;
  const radius = Math.min(width, height) * 0.38;
  for (const joint of joints) {
    const rx = x - joint.x, ry = y - joint.y;
    const influence = Math.exp(-(rx * rx + ry * ry) / (2 * radius * radius));
    // Moving hands drag local ink; stationary hands still bend it around their actual location.
    dx += influence * (joint.vx * 0.12 - ry * 0.18);
    dy += influence * (joint.vy * 0.12 + rx * 0.18);
  }
  return [x + dx * strength, y + dy * strength];
}
