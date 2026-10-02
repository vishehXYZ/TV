export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

/** BlazePose 33-landmark index reference (subset actually used downstream). */
export const POSE_LANDMARKS = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
} as const;

/** Skeleton connections for overlay drawing, in landmark-index pairs. */
export const POSE_CONNECTIONS: ReadonlyArray<[number, number]> = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
  [27, 31],
  [28, 32],
  [15, 17],
  [15, 19],
  [15, 21],
  [16, 18],
  [16, 20],
  [16, 22],
];

export class PoseState {
  /** Smoothed landmarks in normalized [0,1] image space, latest frame. */
  landmarks: Landmark[] = [];
  /** Per-landmark velocity in normalized units/sec. */
  velocities: Float32Array = new Float32Array(0);
  /** Aggregate whole-body movement energy, roughly 0..1+ (unbounded above). */
  energy = 0;
  /** True once at least one real detection has landed. */
  hasDetection = false;
  /** Latest raw segmentation mask (single-channel float, 0..1), or null. */
  segmentationMask: { data: Float32Array; width: number; height: number } | null = null;
}
