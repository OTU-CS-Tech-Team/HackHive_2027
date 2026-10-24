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

function sdBox(px: number, py: number, cx: number, cy: number, hx: number, hy: number) {
  const dx = Math.abs(px - cx) - hx;
  const dy = Math.abs(py - cy) - hy;
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0);
}

function sdSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number, radius: number) {
  const pax = px - ax;
  const pay = py - ay;
  const bax = bx - ax;
  const bay = by - ay;
  const h = Math.min(1, Math.max(0, (pax * bax + pay * bay) / Math.max(bax * bax + bay * bay, 1e-4)));
  return Math.hypot(pax - bax * h, pay - bay * h) - radius;
}

function sdTriangle(
  px: number,
  py: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  const e0x = x1 - x0;
  const e0y = y1 - y0;
  const e1x = x2 - x1;
  const e1y = y2 - y1;
  const e2x = x0 - x2;
  const e2y = y0 - y2;
  const v0x = px - x0;
  const v0y = py - y0;
  const v1x = px - x1;
  const v1y = py - y1;
  const v2x = px - x2;
  const v2y = py - y2;
  const clampEdge = (vx: number, vy: number, ex: number, ey: number) => {
    const t = Math.min(1, Math.max(0, (vx * ex + vy * ey) / Math.max(ex * ex + ey * ey, 1e-4)));
    return [vx - ex * t, vy - ey * t] as const;
  };
  const [p0x, p0y] = clampEdge(v0x, v0y, e0x, e0y);
  const [p1x, p1y] = clampEdge(v1x, v1y, e1x, e1y);
  const [p2x, p2y] = clampEdge(v2x, v2y, e2x, e2y);
  const s = Math.sign(e0x * e2y - e0y * e2x);
  const dx = Math.min(p0x * p0x + p0y * p0y, p1x * p1x + p1y * p1y, p2x * p2x + p2y * p2y);
  const dy = Math.min(
    s * (v0x * e0y - v0y * e0x),
    s * (v1x * e1y - v1y * e1x),
    s * (v2x * e2y - v2y * e2x),
  );
  return -Math.sqrt(Math.max(dx, 0)) * Math.sign(dy);
}

// Same hive, rope and strap silhouette the earlier swing used, so those
// pixels are never put on a moving layer.
function hiveDistAt(px: number, py: number, mobile: boolean, scx: number, scy: number) {
  const sx = (x: number) => x * scx;
  const sy = (y: number) => y * scy;
  if (!mobile) {
    const ax = sx(924);
    const ay = sy(48);
    let d = sdBox(px, py, sx(908), sy(246), sx(74), sy(50));
    d = Math.min(d, sdTriangle(px, py, sx(900), sy(148), sx(818), sy(204), sx(998), sy(212)));
    d = Math.min(d, Math.hypot(px - sx(862), py - sy(176)) - sx(18));
    // The strands hang inside the old capsules, which sat on the bark
    // beside them. These endpoints follow the ropes in the plate.
    d = Math.min(d, sdSegment(px, py, ax, ay, sx(896), sy(168), sx(7)));
    d = Math.min(d, sdSegment(px, py, ax, ay, sx(933), sy(166), sx(7)));
    d = Math.min(d, sdSegment(px, py, ax, ay, sx(980), sy(198), sx(7)));
    d = Math.min(d, Math.hypot(px - ax, py - ay) - sx(13));
    d = Math.min(d, sdBox(px, py, sx(996), sy(248), sx(26), sy(56)));
    d = Math.min(d, sdSegment(px, py, sx(998), sy(186), sx(1008), sy(304), sx(11)));
    return d;
  }
  const ax = sx(552);
  const ay = sy(648);
  let d = sdBox(px, py, sx(548), sy(758), sx(52), sy(46));
  d = Math.min(d, sdBox(px, py, sx(500), sy(754), sx(28), sy(18)));
  d = Math.min(d, sdTriangle(px, py, sx(548), sy(678), sx(494), sy(730), sx(628), sy(732)));
  d = Math.min(d, Math.hypot(px - sx(520), py - sy(705)) - sx(16));
  // The strands meet a little above the swing pivot. Cover that tie
  // without moving the pivot the hive rotates around.
  const tx = sx(566);
  const ty = sy(628);
  d = Math.min(d, sdSegment(px, py, tx, ty, sx(500), sy(728), sx(7)));
  d = Math.min(d, sdSegment(px, py, tx, ty, sx(576), sy(714), sx(7)));
  d = Math.min(d, sdSegment(px, py, tx, ty, sx(598), sy(718), sx(7)));
  d = Math.min(d, Math.hypot(px - tx, py - ty) - sx(8));
  d = Math.min(d, Math.hypot(px - ax, py - ay) - sx(12));
  d = Math.min(d, sdBox(px, py, sx(618), sy(764), sx(22), sy(48)));
  d = Math.min(d, sdSegment(px, py, sx(622), sy(708), sx(628), sy(808), sx(12)));
  return d;
}

function hiveMask(width: number, height: number, mobile: boolean, scx: number, scy: number, pad: number) {
  const mask = new Uint8Array(width * height);
  const x0 = Math.max(0, Math.floor((mobile ? 420 : 740) * scx));
  const x1 = Math.min(width, Math.ceil((mobile ? 710 : 1080) * scx));
  const y0 = Math.max(0, Math.floor((mobile ? 590 : 0) * scy));
  const y1 = Math.min(height, Math.ceil((mobile ? 870 : 360) * scy));
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (hiveDistAt(x + 0.5, y + 0.5, mobile, scx, scy) < pad) mask[y * width + x] = 1;
    }
  }
  return mask;
}

// Lift the hive and the ropes off the plate. The hole matches the sprite,
// so at rest the composite is the original, and the swing uncovers bark.
function paintHive(
  rgb: Float32Array,
  width: number,
  height: number,
  mobile: boolean,
  scx: number,
  scy: number,
) {
  const alpha = new Float32Array(width * height);
  const x0 = Math.max(0, Math.floor((mobile ? 360 : 720) * scx));
  const x1 = Math.min(width, Math.ceil((mobile ? 700 : 1100) * scx));
  const y0 = Math.max(0, Math.floor((mobile ? 580 : 0) * scy));
  const y1 = Math.min(height, Math.ceil((mobile ? 880 : 380) * scy));
  const hole = new Uint8Array(width * height);
  // A couple of pixels past the silhouette catch the rope's own edge
  // without taking a sleeve of bark along for the swing.
  const opaque = 3 * scx;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const d = hiveDistAt(x + 0.5, y + 0.5, mobile, scx, scy);
      if (d > opaque) continue;
      const i = y * width + x;
      alpha[i] = 1;
      hole[i] = 1;
    }
  }

  // The highlight of a strand sometimes sits a pixel outside the capsule.
  // Grow only through that rope colour, and only above the roof, so the
  // hive does not pick up a bark sleeve.
  const ropeTop = Math.floor((mobile ? 610 : 40) * scy);
  const ropeBot = Math.ceil((mobile ? 750 : 220) * scy);
  const ropeTone = (i: number) => {
    const r = rgb[i * 3];
    const g = rgb[i * 3 + 1];
    const b = rgb[i * 3 + 2];
    const lum = 0.3 * r + 0.59 * g + 0.11 * b;
    return lum > 62 && r > 88 && r - b > 32 && b < 110;
  };
  for (let pass = 0; pass < 4; pass++) {
    const grow: number[] = [];
    for (let y = Math.max(y0, ropeTop); y < Math.min(y1, ropeBot); y++) {
      for (let x = x0 + 1; x < x1 - 1; x++) {
        const i = y * width + x;
        if (hole[i] || !ropeTone(i)) continue;
        if (
          hole[i - 1] ||
          hole[i + 1] ||
          hole[i - width] ||
          hole[i + width]
        ) {
          grow.push(i);
        }
      }
    }
    for (const i of grow) {
      hole[i] = 1;
      alpha[i] = 1;
    }
  }

  const filled = inpaintCover(rgb, hole, width, height, Math.max(5, Math.round(7 * scx)), 8);
  return { alpha, filled };
}

// The photo's leaf edges are mixed with sky. Swap that rim for the colour
// just inside the cluster so the moving edge is not a pale fringe.
function decontaminateLeaf(rgb: Float32Array, coverage: Float32Array, width: number, height: number) {
  const count = width * height;
  const solid = new Uint8Array(count);
  for (let i = 0; i < count; i++) solid[i] = coverage[i] > 0.5 ? 1 : 0;
  const interior = erode(solid, width, height, 2);
  const out = new Uint8Array(count * 4);
  const radius = 6;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!solid[i]) continue;
      let r = rgb[i * 3];
      let g = rgb[i * 3 + 1];
      let b = rgb[i * 3 + 2];
      if (!interior[i]) {
        let sr = 0;
        let sg = 0;
        let sb = 0;
        let n = 0;
        const y0 = Math.max(0, y - radius);
        const y1 = Math.min(height - 1, y + radius);
        const x0 = Math.max(0, x - radius);
        const x1 = Math.min(width - 1, x + radius);
        for (let yy = y0; yy <= y1; yy++) {
          const row = yy * width;
          for (let xx = x0; xx <= x1; xx++) {
            const j = row + xx;
            if (!interior[j]) continue;
            sr += rgb[j * 3];
            sg += rgb[j * 3 + 1];
            sb += rgb[j * 3 + 2];
            n++;
          }
        }
        if (n > 0) {
          const ir = sr / n;
          const ig = sg / n;
          const ib = sb / n;
          const lum = 0.3 * r + 0.59 * g + 0.11 * b;
          const ilum = 0.3 * ir + 0.59 * ig + 0.11 * ib;
          // Only the pale sky fringe. A healthy leaf edge keeps its colour,
          // so the resting frame stays the photograph.
          if (lum > ilum + 26 || (b > 130 && lum > ilum + 12)) {
            r = ir;
            g = ig;
            b = ib;
          }
        }
      }
      const o = i * 4;
      out[o] = Math.max(0, Math.min(255, Math.round(r)));
      out[o + 1] = Math.max(0, Math.min(255, Math.round(g)));
      out[o + 2] = Math.max(0, Math.min(255, Math.round(b)));
      out[o + 3] = 255;
    }
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

  const hive = hiveMask(width, height, mobile, scx, scy, 10 * scx);
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
      // Opaque clusters only. A translucent fringe is what doubled the
      // top-left leaves. The texture filter feathers the hard edge.
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

  const skyField = inpaintCover(rgb, canopyHole, width, height);
  const grassBlur = blurRgb(rgb, width, height, Math.max(8, Math.round(18 * scx)));
  const hiveLayer = paintHive(rgb, width, height, mobile, scx, scy);
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

  const leafTex = decontaminateLeaf(rgb, canopyAlpha, width, height);
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
