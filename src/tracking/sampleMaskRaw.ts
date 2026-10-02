export interface RawMask {
  data: Float32Array;
  width: number;
  height: number;
}

/** CPU-side equivalent of the shader's sampleMask() (see generators/shared/maskSample.glsl) — for code paths (lines, ribbon clipping) that aren't per-fragment shaders. */
export function sampleMaskRaw(x: number, y: number, aspect: number, mask: RawMask): number {
  let imageX = 0.5 - x / (2 * aspect);
  let imageY = 0.5 - y / 2;
  if (imageX < 0 || imageX > 1 || imageY < 0 || imageY > 1) return 0;

  // Cover-crop to the mask's own aspect ratio — see the matching comment in maskSample.glsl for why.
  const maskAspect = mask.width / mask.height;
  let cropRepeatX = 1;
  let cropRepeatY = 1;
  let cropOffsetX = 0;
  let cropOffsetY = 0;
  if (maskAspect > aspect) {
    cropRepeatX = aspect / maskAspect;
    cropOffsetX = (1 - cropRepeatX) / 2;
  } else {
    cropRepeatY = maskAspect / aspect;
    cropOffsetY = (1 - cropRepeatY) / 2;
  }
  imageX = imageX * cropRepeatX + cropOffsetX;
  imageY = imageY * cropRepeatY + cropOffsetY;

  const col = Math.min(mask.width - 1, Math.floor(imageX * mask.width));
  const row = Math.min(mask.height - 1, Math.floor(imageY * mask.height));
  return mask.data[row * mask.width + col]!;
}
