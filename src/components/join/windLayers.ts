// Cut the canopy, the meadow, and the hive off the oak plate so each can
// move a little. The trunk and the limbs stay in the base. At rest the
// composite matches the still: every inpainted pixel is covered by an
// opaque part of a layer.

export type WindLayers = {
  base: Uint8Array;
  mask: Uint8Array;
  // Straight RGBA. The GPU premultiplies it on upload so the leaf filter
  // cannot pull pale sky in from a transparent neighbour.
  leaf: Uint8Array;
};

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function sdSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number, radius: number) {
  const pax = px - ax;
  const pay = py - ay;
  const bax = bx - ax;
  const bay = by - ay;
  const h = Math.min(1, Math.max(0, (pax * bax + pay * bay) / Math.max(bax * bax + bay * bay, 1e-4)));
  return Math.hypot(pax - bax * h, pay - bay * h) - radius;
}

function hiveWood(r: number, g: number, b: number) {
  const lum = 0.3 * r + 0.59 * g + 0.11 * b;
  return r > 78 && g > 30 && b < 170 && r - b > 30 && lum > 50;
}

// The swinging sprite is the hive body plus the ropes. The body is the
// wood connected to the seed, with plank gaps and the dark doorway filled
// in. Boxes around the hive are not used: they were taking the limb and
// the bark with them.
function hiveSprite(rgb: Float32Array, width: number, height: number, mobile: boolean, scx: number, scy: number) {
  const mask = new Uint8Array(width * height);
  const sx = (x: number) => x * scx;
  const sy = (y: number) => y * scy;
  const clip = mobile
    ? { x0: sx(496), x1: sx(632), y0: sy(700), y1: sy(798) }
    : { x0: sx(846), x1: sx(1020), y0: sy(168), y1: sy(292) };
  const x0 = Math.max(0, Math.floor(clip.x0));
  const x1 = Math.min(width - 1, Math.ceil(clip.x1));
  const y0 = Math.max(0, Math.floor(clip.y0));
  const y1 = Math.min(height - 1, Math.ceil(clip.y1));
  const seedX = Math.round(sx(mobile ? 560 : 910));
  const seedY = Math.round(sy(mobile ? 752 : 230));

  const isWood = (x: number, y: number) => {
    const i = (y * width + x) * 3;
    return hiveWood(rgb[i], rgb[i + 1], rgb[i + 2]);
  };

  let startX = seedX;
  let startY = seedY;
  if (!isWood(startX, startY)) {
    let found = false;
    for (let rad = 1; rad <= 24 && !found; rad++) {
      for (let dy = -rad; dy <= rad && !found; dy++) {
        for (let dx = -rad; dx <= rad; dx++) {
          const xx = seedX + dx;
          const yy = seedY + dy;
          if (xx < x0 || yy < y0 || xx > x1 || yy > y1) continue;
          if (!isWood(xx, yy)) continue;
          startX = xx;
          startY = yy;
          found = true;
          break;
        }
      }
    }
  }

  const seen = new Uint8Array(width * height);
  const qx = new Int32Array(width * height);
  const qy = new Int32Array(width * height);
  let qs = 0;
  let qe = 0;
  const push = (x: number, y: number) => {
    const i = y * width + x;
    if (seen[i] || !isWood(x, y)) return;
    seen[i] = 1;
    qx[qe] = x;
    qy[qe] = y;
    qe++;
  };
  push(startX, startY);
  while (qs < qe) {
    const x = qx[qs];
    const y = qy[qs];
    qs++;
    for (let dy = -3; dy <= 3; dy++) {
      const yy = y + dy;
      if (yy < y0 || yy > y1) continue;
      for (let dx = -3; dx <= 3; dx++) {
        const xx = x + dx;
        if (xx < x0 || xx > x1) continue;
        push(xx, yy);
      }
    }
  }

  const rowL = new Int32Array(height);
  const rowR = new Int32Array(height);
  rowL.fill(width);
  rowR.fill(-1);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!seen[y * width + x]) continue;
      mask[y * width + x] = 1;
      if (x < rowL[y]) rowL[y] = x;
      if (x > rowR[y]) rowR[y] = x;
    }
  }
  const maxSpan = mobile ? 130 * scx : 168 * scx;
  for (let y = y0; y <= y1; y++) {
    const span = rowR[y] - rowL[y];
    if (span < 26 * scx || span > maxSpan) continue;
    for (let x = rowL[y]; x <= rowR[y]; x++) mask[y * width + x] = 1;
  }

  // Dark shingles sit just outside the bright face. Grow into that warm
  // wood only, so the roof eave is on the sprite and the bark is not.
  const warm = (x: number, y: number) => {
    const i = (y * width + x) * 3;
    const r = rgb[i];
    const g = rgb[i + 1];
    const b = rgb[i + 2];
    const lum = 0.3 * r + 0.59 * g + 0.11 * b;
    return r > 68 && g > 32 && b < 150 && r - b > 24 && lum > 48;
  };
  for (let pass = 0; pass < 6; pass++) {
    const add: number[] = [];
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * width + x;
        if (mask[i] || !warm(x, y)) continue;
        if (mask[i - 1] || mask[i + 1] || mask[i - width] || mask[i + width]) add.push(i);
      }
    }
    for (const i of add) mask[i] = 1;
  }

  // The cap is darker than the face, so the wood flood stops at the eave.
  // A tight triangle covers those shingles without the old bark boxes.
  const paintTri = (x0: number, y0: number, x1: number, y1: number, x2: number, y2: number) => {
    const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2)));
    const maxX = Math.min(width - 1, Math.ceil(Math.max(x0, x1, x2)));
    const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2)));
    const maxY = Math.min(height - 1, Math.ceil(Math.max(y0, y1, y2)));
    const edge = (ax: number, ay: number, bx: number, by: number, px: number, py: number) =>
      (px - ax) * (by - ay) - (py - ay) * (bx - ax);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        const e0 = edge(x0, y0, x1, y1, px, py);
        const e1 = edge(x1, y1, x2, y2, px, py);
        const e2 = edge(x2, y2, x0, y0, px, py);
        if ((e0 < 0 || e1 < 0 || e2 < 0) && (e0 > 0 || e1 > 0 || e2 > 0)) continue;
        mask[y * width + x] = 1;
      }
    }
  };
  if (!mobile) paintTri(sx(906), sy(158), sx(838), sy(210), sx(1014), sy(214));
  else paintTri(sx(546), sy(680), sx(492), sy(736), sx(634), sy(740));

  // Ropes stay thin. A wide capsule was rotating the bark between them.
  const ropeR = sx(5);
  const paintSeg = (ax: number, ay: number, bx: number, by: number, radius: number) => {
    const minX = Math.max(0, Math.floor(Math.min(ax, bx) - radius - 2));
    const maxX = Math.min(width - 1, Math.ceil(Math.max(ax, bx) + radius + 2));
    const minY = Math.max(0, Math.floor(Math.min(ay, by) - radius - 2));
    const maxY = Math.min(height - 1, Math.ceil(Math.max(ay, by) + radius + 2));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (sdSegment(x + 0.5, y + 0.5, ax, ay, bx, by, radius) <= 0.6 * scx) mask[y * width + x] = 1;
      }
    }
  };
  const paintDisc = (cx: number, cy: number, radius: number) => {
    const minX = Math.max(0, Math.floor(cx - radius - 2));
    const maxX = Math.min(width - 1, Math.ceil(cx + radius + 2));
    const minY = Math.max(0, Math.floor(cy - radius - 2));
    const maxY = Math.min(height - 1, Math.ceil(cy + radius + 2));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) - radius <= 0.6 * scx) mask[y * width + x] = 1;
      }
    }
  };

  if (!mobile) {
    const ax = sx(924);
    const ay = sy(48);
    paintSeg(ax, ay, sx(896), sy(168), ropeR);
    paintSeg(ax, ay, sx(933), sy(166), ropeR);
    paintSeg(ax, ay, sx(980), sy(198), ropeR);
    paintDisc(ax, ay, sx(7));
  } else {
    const tx = sx(566);
    const ty = sy(628);
    paintSeg(tx, ty, sx(500), sy(728), ropeR);
    paintSeg(tx, ty, sx(576), sy(714), ropeR);
    paintSeg(tx, ty, sx(598), sy(718), ropeR);
    paintDisc(tx, ty, sx(6));
    paintDisc(sx(552), sy(648), sx(5));
  }

  // Pull in the bright rim the flood stopped short of: rope highlights and
  // the lit edge of the roof. Dark bark fails this test, so it stays put.
  const hiveish = (x: number, y: number) => {
    const i = (y * width + x) * 3;
    const r = rgb[i];
    const g = rgb[i + 1];
    const b = rgb[i + 2];
    const lum = 0.3 * r + 0.59 * g + 0.11 * b;
    return r > 85 && g > 35 && b < 150 && r - b > 28 && lum > 60;
  };
  const bx0 = Math.max(1, Math.floor(sx(mobile ? 450 : 800)));
  const bx1 = Math.min(width - 2, Math.ceil(sx(mobile ? 690 : 1060)));
  const by0 = Math.max(1, Math.floor(sy(mobile ? 590 : 20)));
  const by1 = Math.min(height - 2, Math.ceil(sy(mobile ? 840 : 330)));
  for (let pass = 0; pass < 5; pass++) {
    const add: number[] = [];
    for (let y = by0; y <= by1; y++) {
      for (let x = bx0; x <= bx1; x++) {
        const i = y * width + x;
        if (mask[i] || !hiveish(x, y)) continue;
        if (mask[i - 1] || mask[i + 1] || mask[i - width] || mask[i + width]) add.push(i);
      }
    }
    for (const i of add) mask[i] = 1;
  }
  return mask;
}

// Lift the hive and the ropes off the plate. The hole matches the sprite,
// so at rest the composite is the original, and the swing uncovers bark.
function paintHive(rgb: Float32Array, width: number, height: number, sprite: Uint8Array, scx: number) {
  const count = sprite.length;
  const alpha = new Float32Array(count);
  const hole = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    if (!sprite[i]) continue;
    alpha[i] = 1;
    hole[i] = 1;
  }
  const filled = inpaintCover(rgb, hole, width, height, Math.max(6, Math.round(8 * scx)), 16);
  return { alpha, filled };
}

// Copy leaf colour out into the transparent texels. Alpha is left as the
// soft coverage, then the GPU premultiplies on upload.
function bleedLeaf(rgb: Float32Array, coverage: Float32Array, width: number, height: number) {
  const count = width * height;
  const srcR = new Float32Array(count);
  const srcG = new Float32Array(count);
  const srcB = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    srcR[i] = rgb[i * 3];
    srcG[i] = rgb[i * 3 + 1];
    srcB[i] = rgb[i * 3 + 2];
  }
  let curR = srcR;
  let curG = srcG;
  let curB = srcB;
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];
  for (let pass = 0; pass < 4; pass++) {
    const nextR = curR.slice();
    const nextG = curG.slice();
    const nextB = curB.slice();
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (coverage[i] >= 0.85) continue;
        let bestA = coverage[i];
        let best = -1;
        for (const [dx, dy] of dirs) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
          const j = yy * width + xx;
          if (coverage[j] > bestA) {
            bestA = coverage[j];
            best = j;
          }
        }
        if (best < 0) continue;
        nextR[i] = curR[best];
        nextG[i] = curG[best];
        nextB[i] = curB[best];
      }
    }
    curR = nextR;
    curG = nextG;
    curB = nextB;
  }
  const out = new Uint8Array(count * 4);
  for (let i = 0; i < count; i++) {
    const o = i * 4;
    out[o] = Math.max(0, Math.min(255, Math.round(curR[i])));
    out[o + 1] = Math.max(0, Math.min(255, Math.round(curG[i])));
    out[o + 2] = Math.max(0, Math.min(255, Math.round(curB[i])));
    out[o + 3] = Math.max(0, Math.min(255, Math.round(coverage[i] * 255)));
  }
  return out;
}

function erode(src: Uint8Array, width: number, height: number, radius: number) {
  if (radius <= 0) return src;
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let keep = true;
      for (let dy = -radius; dy <= radius && keep; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) {
          keep = false;
          break;
        }
        for (let dx = -radius; dx <= radius; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= width || !src[yy * width + xx]) {
            keep = false;
            break;
          }
        }
      }
      if (keep) out[y * width + x] = 1;
    }
  }
  return out;
}

function dilate(src: Uint8Array, width: number, height: number, radius: number) {
  if (radius <= 0) return src;
  const tmp = new Uint8Array(width * height);
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    let count = 0;
    const first = Math.min(width - 1, radius);
    for (let x = 0; x <= first; x++) count += src[row + x];
    for (let x = 0; x < width; x++) {
      if (x > 0) {
        const add = x + radius < width ? src[row + x + radius] : 0;
        const sub = x - radius - 1 >= 0 ? src[row + x - radius - 1] : 0;
        count += add - sub;
      }
      tmp[row + x] = count > 0 ? 1 : 0;
    }
  }
  for (let x = 0; x < width; x++) {
    let count = 0;
    const first = Math.min(height - 1, radius);
    for (let y = 0; y <= first; y++) count += tmp[y * width + x];
    for (let y = 0; y < height; y++) {
      if (y > 0) {
        const add = y + radius < height ? tmp[(y + radius) * width + x] : 0;
        const sub = y - radius - 1 >= 0 ? tmp[(y - radius - 1) * width + x] : 0;
        count += add - sub;
      }
      out[y * width + x] = count > 0 ? 1 : 0;
    }
  }
  return out;
}

function boxMean(src: Uint8Array, width: number, height: number, radius: number) {
  const integral = new Float64Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y++) {
    let run = 0;
    for (let x = 0; x < width; x++) {
      run += src[y * width + x];
      integral[(y + 1) * (width + 1) + (x + 1)] = integral[y * (width + 1) + (x + 1)] + run;
    }
  }
  const out = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(height, y + radius + 1);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width, x + radius + 1);
      const sum =
        integral[y1 * (width + 1) + x1] -
        integral[y0 * (width + 1) + x1] -
        integral[y1 * (width + 1) + x0] +
        integral[y0 * (width + 1) + x0];
      out[y * width + x] = sum / ((y1 - y0) * (x1 - x0));
    }
  }
  return out;
}

function boxBlur(src: Float32Array, width: number, height: number, radius: number) {
  if (radius <= 0) {
    const copy = new Float32Array(src.length);
    copy.set(src);
    return copy;
  }
  const tmp = new Float32Array(width * height);
  const out = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    let sum = 0;
    for (let x = 0; x < radius && x < width; x++) sum += src[y * width + x];
    for (let x = 0; x < width; x++) {
      const add = x + radius < width ? src[y * width + x + radius] : 0;
      const sub = x - radius - 1 >= 0 ? src[y * width + x - radius - 1] : 0;
      if (x === 0) {
        sum = 0;
        const x1 = Math.min(width, radius + 1);
        for (let xx = 0; xx < x1; xx++) sum += src[y * width + xx];
      } else {
        sum += add - sub;
      }
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width, x + radius + 1);
      tmp[y * width + x] = sum / (x1 - x0);
    }
  }
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      if (y === 0) {
        let sum = 0;
        const y1 = Math.min(height, radius + 1);
        for (let yy = 0; yy < y1; yy++) sum += tmp[yy * width + x];
        out[y * width + x] = sum / y1;
        continue;
      }
      const y0 = Math.max(0, y - radius);
      const y1 = Math.min(height, y + radius + 1);
      let sum = 0;
      for (let yy = y0; yy < y1; yy++) sum += tmp[yy * width + x];
      out[y * width + x] = sum / (y1 - y0);
    }
  }
  return out;
}

function blurRgb(rgb: Float32Array, width: number, height: number, radius: number) {
  const channels = [new Float32Array(width * height), new Float32Array(width * height), new Float32Array(width * height)];
  for (let i = 0; i < width * height; i++) {
    channels[0][i] = rgb[i * 3];
    channels[1][i] = rgb[i * 3 + 1];
    channels[2][i] = rgb[i * 3 + 2];
  }
  const blurred = channels.map((channel) => boxBlur(channel, width, height, radius));
  const out = new Float32Array(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    out[i * 3] = blurred[0][i];
    out[i * 3 + 1] = blurred[1][i];
    out[i * 3 + 2] = blurred[2][i];
  }
  return out;
}

// Spread the surrounding sky into the leaf holes. A plain flood leaves
// rectangular blocks; averaging only the known pixels stays soft.
function inpaintCover(
  rgb: Float32Array,
  hole: Uint8Array,
  width: number,
  height: number,
  radiusOverride?: number,
  passes = 5,
) {
  const count = width * height;
  let red = new Float32Array(count);
  let green = new Float32Array(count);
  let blue = new Float32Array(count);
  let weight = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    if (hole[i]) continue;
    weight[i] = 1;
    red[i] = rgb[i * 3];
    green[i] = rgb[i * 3 + 1];
    blue[i] = rgb[i * 3 + 2];
  }
  const radius = radiusOverride ?? Math.max(4, Math.round(Math.min(width, height) / 180));
  for (let pass = 0; pass < passes; pass++) {
    weight = boxBlur(weight, width, height, radius);
    red = boxBlur(red, width, height, radius);
    green = boxBlur(green, width, height, radius);
    blue = boxBlur(blue, width, height, radius);
    const nextW = new Float32Array(count);
    const nextR = new Float32Array(count);
    const nextG = new Float32Array(count);
    const nextB = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      if (!hole[i]) {
        nextW[i] = 1;
        nextR[i] = rgb[i * 3];
        nextG[i] = rgb[i * 3 + 1];
        nextB[i] = rgb[i * 3 + 2];
        continue;
      }
      if (weight[i] < 0.02) continue;
      nextW[i] = 1;
      nextR[i] = red[i] / weight[i];
      nextG[i] = green[i] / weight[i];
      nextB[i] = blue[i] / weight[i];
    }
    weight = nextW;
    red = nextR;
    green = nextG;
    blue = nextB;
  }
  const out = rgb.slice();
  for (let i = 0; i < count; i++) {
    if (!hole[i] || weight[i] < 0.5) continue;
    out[i * 3] = red[i];
    out[i * 3 + 1] = green[i];
    out[i * 3 + 2] = blue[i];
  }
  return out;
}

export function buildWindLayers(pixels: Uint8Array, width: number, height: number, mobile: boolean): WindLayers {
  const refW = mobile ? 720 : 1280;
  const refH = mobile ? 1280 : 720;
  const scx = width / refW;
  const scy = height / refH;
  const count = width * height;
  const rgb = new Float32Array(count * 3);
  const lum = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const r = pixels[i * 4];
    const g = pixels[i * 4 + 1];
    const b = pixels[i * 4 + 2];
    rgb[i * 3] = r;
    rgb[i * 3 + 1] = g;
    rgb[i * 3 + 2] = b;
    lum[i] = 0.3 * r + 0.59 * g + 0.11 * b;
  }

  // Sprite first, so the leaf layer can be cleared around it. The pad is
  // only an exclusion: those pixels stay in the base and do not swing.
  const sprite = hiveSprite(rgb, width, height, mobile, scx, scy);
  const hive = dilate(sprite, width, height, Math.max(6, Math.round(12 * scx)));
  const thick = new Uint8Array(count);
  for (let i = 0; i < count; i++) thick[i] = lum[i] < 62 ? 1 : 0;
  const thickMean = boxMean(thick, width, height, Math.max(2, Math.round(14 * scx)));
  const trunk = new Uint8Array(count);
  for (let i = 0; i < count; i++) trunk[i] = thick[i] && thickMean[i] > 0.45 ? 1 : 0;

  const leaf = new Uint8Array(count);
  const grassCore = new Uint8Array(count);
  for (let y = 0; y < height; y++) {
    const refY = y / scy;
    const canopyBand = mobile ? refY > 300 && refY < 790 : refY < 380;
    const grassBand = mobile ? refY > 900 : refY > 530;
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (hive[i] || trunk[i]) continue;
      const r = rgb[i * 3];
      const g = rgb[i * 3 + 1];
      const b = rgb[i * 3 + 2];
      // Bright backlit leaves in the top-left are almost white-gold. They still
      // have to travel with the cluster, or the plate keeps a second copy.
      // Pale gold at the top-left is sky glow, not a leaf. Real backlit
      // leaves are warmer and not this bright.
      const leafTone =
        lum[i] > 78 &&
        lum[i] < 236 &&
        g > 64 &&
        r > 90 &&
        b < 186 &&
        r - b > 58 &&
        !(lum[i] > 198 && b > 150);
      if (leafTone && canopyBand) leaf[i] = 1;
      const grassTone = r > 85 && g > 48 && b < 155 && r - b > 38 && lum[i] > 78 && lum[i] < 214;
      const flower = lum[i] > 150 && lum[i] < 245 && b < 200 && r - b > 15;
      if (grassBand && (grassTone || flower)) grassCore[i] = 1;
    }
  }

  // Branches and limbs stay off this layer. Only real leaf clusters move.
  // Closing fills pinholes inside a cluster. Specks on the bark stay put,
  // because inpainting them leaves a bright bubble.
  const leafMean = boxMean(leaf, width, height, Math.max(3, Math.round(5 * scx)));
  const dense = new Uint8Array(count);
  for (let i = 0; i < count; i++) dense[i] = leaf[i] && leafMean[i] > 0.16 ? 1 : 0;
  const opened = dilate(dense, width, height, 2);
  const closed = erode(opened, width, height, 2);
  const canopyCore = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    if (hive[i] || trunk[i] || lum[i] < 72 || !closed[i]) continue;
    canopyCore[i] = 1;
  }
  const grassCoreF = new Float32Array(count);
  for (let i = 0; i < count; i++) grassCoreF[i] = grassCore[i];
  const grassR = Math.max(2, Math.round(5 * scx));
  let grassSpread = boxBlur(grassCoreF, width, height, grassR);
  grassSpread = boxBlur(grassSpread, width, height, grassR);

  const trunkNear = boxBlur(Float32Array.from(trunk), width, height, Math.max(2, Math.round(10 * scx)));

  const canopyAlpha = new Float32Array(count);
  const grassAlpha = new Float32Array(count);
  for (let y = 0; y < height; y++) {
    const refY = y / scy;
    const canopyFade = mobile
      ? smoothstep(260, 330, refY) * (1 - smoothstep(800, 880, refY))
      : 1 - smoothstep(400, 490, refY);
    const grassFade = mobile ? smoothstep(860, 980, refY) : smoothstep(500, 610, refY);
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (trunk[i] || hive[i]) continue;
      // Clusters start solid. A one-pixel mean below turns the edge into a
      // continuous ramp. The fringe that doubled the top-left stays out:
      // pale sky never qualifies as a core.
      if (canopyCore[i] > 0 && canopyFade > 0.5) canopyAlpha[i] = 1;
      const trunkKeep = 1 - Math.min(1, trunkNear[i] * 1.3);
      let grass = smoothstep(0.04, 0.22, grassSpread[i]);
      if (grassCore[i]) grass = 1;
      grassAlpha[i] = Math.min(1, Math.max(0, grass * grassFade * trunkKeep * (1 - canopyAlpha[i])));
    }
  }

  const canopyHole = new Uint8Array(count);
  const grassHole = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    if (trunk[i] || hive[i]) continue;
    // Only the opaque leaves are replaced. The soft fringe stays on the
    // original sky so the resting frame does not pick up a dark halo.
    if (canopyAlpha[i] > 0.82) canopyHole[i] = 1;
    else if (grassAlpha[i] > 0.82) grassHole[i] = 1;
  }

  // Soften the leaf edge after the holes are cut, then strip that ramp
  // back off the limb so a feather cannot creep onto the bark.
  const canopyBinary = new Uint8Array(count);
  for (let i = 0; i < count; i++) canopyBinary[i] = canopyAlpha[i] >= 1 ? 1 : 0;
  const feather = boxMean(canopyBinary, width, height, 1);
  for (let i = 0; i < count; i++) {
    if (trunk[i] || hive[i]) canopyAlpha[i] = 0;
    else canopyAlpha[i] = feather[i];
  }

  const skyField = inpaintCover(rgb, canopyHole, width, height);
  const grassBlur = blurRgb(rgb, width, height, Math.max(8, Math.round(18 * scx)));
  const hiveLayer = paintHive(rgb, width, height, sprite, scx);
  const baseRgb = rgb.slice();
  for (let i = 0; i < count; i++) {
    if (hiveLayer.alpha[i] >= 1) {
      baseRgb[i * 3] = hiveLayer.filled[i * 3];
      baseRgb[i * 3 + 1] = hiveLayer.filled[i * 3 + 1];
      baseRgb[i * 3 + 2] = hiveLayer.filled[i * 3 + 2];
    } else if (canopyHole[i]) {
      baseRgb[i * 3] = skyField[i * 3];
      baseRgb[i * 3 + 1] = skyField[i * 3 + 1];
      baseRgb[i * 3 + 2] = skyField[i * 3 + 2];
    } else if (grassHole[i]) {
      baseRgb[i * 3] = grassBlur[i * 3];
      baseRgb[i * 3 + 1] = grassBlur[i * 3 + 1];
      baseRgb[i * 3 + 2] = grassBlur[i * 3 + 2];
    }
  }

  const leafTex = bleedLeaf(rgb, canopyAlpha, width, height);
  const base = new Uint8Array(count * 4);
  const mask = new Uint8Array(count * 4);
  for (let i = 0; i < count; i++) {
    base[i * 4] = Math.max(0, Math.min(255, Math.round(baseRgb[i * 3])));
    base[i * 4 + 1] = Math.max(0, Math.min(255, Math.round(baseRgb[i * 3 + 1])));
    base[i * 4 + 2] = Math.max(0, Math.min(255, Math.round(baseRgb[i * 3 + 2])));
    base[i * 4 + 3] = 255;
    mask[i * 4] = Math.max(0, Math.min(255, Math.round(canopyAlpha[i] * 255)));
    mask[i * 4 + 1] = Math.max(0, Math.min(255, Math.round(grassAlpha[i] * 255)));
    mask[i * 4 + 2] = Math.max(0, Math.min(255, Math.round(hiveLayer.alpha[i] * 255)));
    mask[i * 4 + 3] = 255;
  }
  return { base, mask, leaf: leafTex };
}
