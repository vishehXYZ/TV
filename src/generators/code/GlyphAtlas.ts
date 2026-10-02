import * as THREE from 'three';

const CODE_GLYPHS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '{', '}', '<', '>', '/', '='];
/**
 * A spread of Arabic/Farsi letterforms (distinct shapes across their
 * isolated forms) plus a couple of Eastern Arabic-Indic digits, so the
 * "Script" mode reads as clearly Arabic/Farsi rather than a random subset.
 */
const ARABIC_GLYPHS = ['ا', 'ب', 'پ', 'ت', 'ث', 'ج', 'چ', 'د', 'ر', 'س', 'ش', 'ک', 'گ', 'م', 'ن', 'ی'];
/** Hebrew consonants (isolated forms only, skipping final letterforms) for a clearly distinct set. */
const HEBREW_GLYPHS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע'];
/** Cyrillic letters chosen for visually distinct shapes rather than ones that read as plain Latin —
 * skips the heaviest/densest glyphs (Ж, Ш, Щ, Ф) which rendered noticeably bolder/brighter than
 * every other language's letterforms once multiplied across ~1000 additively-blended instances. */
const RUSSIAN_GLYPHS = ['А', 'Б', 'В', 'Г', 'Д', 'И', 'Л', 'Н', 'П', 'Р', 'У', 'Ц', 'Ч', 'Э', 'Ю', 'Я'];
/** Katakana — cleaner, more distinct shapes than kanji at small glyph sizes, and reads immediately as Japanese. */
const JAPANESE_GLYPHS = ['ア', 'イ', 'ウ', 'エ', 'オ', 'カ', 'キ', 'ク', 'ケ', 'コ', 'サ', 'シ', 'ス', 'セ', 'ソ', 'タ'];

export type GlyphSet = 'code' | 'arabic' | 'hebrew' | 'russian' | 'japanese';

const GLYPH_SETS: Record<GlyphSet, string[]> = {
  code: CODE_GLYPHS,
  arabic: ARABIC_GLYPHS,
  hebrew: HEBREW_GLYPHS,
  russian: RUSSIAN_GLYPHS,
  japanese: JAPANESE_GLYPHS,
};

const FONT_STACKS: Record<GlyphSet, string> = {
  code: 'bold {size}px "Consolas", "Courier New", monospace',
  arabic: '{size}px "Noto Naskh Arabic", "Noto Sans Arabic", "Arial", sans-serif',
  hebrew: '{size}px "Noto Sans Hebrew", "Arial Hebrew", "David", "Arial", sans-serif',
  russian: '{size}px "Arial", "Helvetica", sans-serif',
  japanese: '{size}px "Noto Sans JP", "Yu Gothic", "MS Gothic", "Hiragino Kaku Gothic Pro", sans-serif',
};

/** Per-language font-size multiplier (relative to the shared 0.72 base) — lets a script with
 * naturally heavier default stroke weight (like Cyrillic in Arial) be tuned down individually rather
 * than reading as much bolder/brighter than the others once multiplied across ~1000 instances. */
const SIZE_SCALE: Partial<Record<GlyphSet, number>> = {
  russian: 0.85,
};

const GRID_SIZE = 4;

export interface GlyphAtlas {
  texture: THREE.CanvasTexture;
  count: number;
  gridSize: number;
}

/** Bakes a monospace glyph atlas once — sampled per-instance in CodeMode's glyph shader. `set` picks
 * digits/code symbols ('code', the default) or one of several letterform sets. */
export function createGlyphAtlas(set: GlyphSet = 'code'): GlyphAtlas {
  const glyphs = GLYPH_SETS[set];
  const cellSize = 64;
  const baseScale = set === 'code' ? 0.68 : 0.72;
  const fontSize = Math.floor(cellSize * baseScale * (SIZE_SCALE[set] ?? 1));
  const canvas = document.createElement('canvas');
  canvas.width = cellSize * GRID_SIZE;
  canvas.height = cellSize * GRID_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.font = FONT_STACKS[set].replace('{size}', String(fontSize));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < glyphs.length; i++) {
    const col = i % GRID_SIZE;
    const row = Math.floor(i / GRID_SIZE);
    const cx = col * cellSize + cellSize / 2;
    const cy = row * cellSize + cellSize / 2 + 2;
    ctx.fillText(glyphs[i]!, cx, cy);
  }

  bakeSDFChannel(ctx, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;

  return { texture, count: glyphs.length, gridSize: GRID_SIZE };
}

/**
 * Bakes an approximate signed-distance field (0 = well outside a stroke, 0.5 = right at its edge,
 * 1 = deep interior) into the atlas's RED channel, alongside — not replacing — the original plain
 * antialiased glyph mask already sitting in the ALPHA channel from fillText(). The puffy "3D" glyph
 * style (CodeGlyphMaterial/codeGlyph.frag.glsl) reads the red channel to fatten strokes into bold
 * letterforms and to derive a smooth height field for rounded volume shading; a per-fragment gradient
 * of the original noisy antialiased mask wasn't smooth enough to read as an actual 3D surface. Writing
 * this into alpha instead (as an earlier version did) subtly changed the flat/non-3D style's letter
 * edges too, since the RGB fill color is otherwise unused (always plain white) — using red instead
 * keeps the original flat rendering byte-for-byte untouched.
 */
function bakeSDFChannel(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const imgData = ctx.getImageData(0, 0, width, height);
  const src = imgData.data;
  const pixelCount = width * height;
  const inside = new Uint8Array(pixelCount);
  for (let i = 0; i < pixelCount; i++) inside[i] = src[i * 4 + 3] > 128 ? 1 : 0;

  const maxDist = 4;
  const maxDistSq = maxDist * maxDist;
  const out = new Uint8ClampedArray(pixelCount);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const here = inside[idx];
      let bestSq = maxDistSq;
      for (let dy = -maxDist; dy <= maxDist; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        const rowBase = ny * width;
        for (let dx = -maxDist; dx <= maxDist; dx++) {
          const distSq = dx * dx + dy * dy;
          if (distSq >= bestSq) continue;
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          if (inside[rowBase + nx] !== here) bestSq = distSq;
        }
      }
      const norm = Math.min(Math.sqrt(bestSq), maxDist) / maxDist;
      const signed = here ? 0.5 + norm * 0.5 : 0.5 - norm * 0.5;
      out[idx] = Math.round(signed * 255);
    }
  }

  for (let i = 0; i < pixelCount; i++) src[i * 4] = out[i]!;
  ctx.putImageData(imgData, 0, 0);
}
