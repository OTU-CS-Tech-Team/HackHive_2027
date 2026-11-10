import { SphereGeometry } from "three";
import type { BufferGeometry } from "three";
import {
  createCardGeometry,
  createDaisyGeometry,
  createGrassGeometry,
  createHillsGeometry,
  createLilyGeometry,
  createLupinGeometry,
  createTrunkGeometry,
} from "@/components/landing/meadow/geometry";
import { buildLayout } from "@/components/landing/meadow/layout";
import type { Quality } from "@/components/landing/meadow/quality";
export const SKY_SEGMENTS: readonly [number, number] = [12, 8];

function triangles(geometry: BufferGeometry) {
  const index = geometry.getIndex();
  return index ? index.count / 3 : 0;
}

export type SceneBudget = {
  quality: Quality;
  instances: {
    grass: number;
    lilies: number;
    daisies: number;
    lupins: number;
    clouds: number;
    glows: number;
    sparks: number;
    leaves: number;
    blossoms: number;
  };
  triangles: number;
  draws: number;
};

/** Full quality, before the adaptive prefix trim. */
export function sceneBudget(quality: Quality): SceneBudget {
  const layout = buildLayout(quality);
  const unit = {
    grass: triangles(createGrassGeometry()),
    lily: triangles(createLilyGeometry()),
    lilySpeck: triangles(createLilyGeometry(undefined, "speck")),
    daisy: triangles(createDaisyGeometry()),
    daisySpeck: triangles(createDaisyGeometry(undefined, "speck")),
    lupin: triangles(createLupinGeometry()),
    lupinFar: triangles(createLupinGeometry(undefined, "full", "far")),
    lupinSpeck: triangles(createLupinGeometry(undefined, "speck")),
    card: triangles(createCardGeometry()),
    hill: triangles(createHillsGeometry()),
    trunk: triangles(createTrunkGeometry()),
    sky: triangles(new SphereGeometry(48, SKY_SEGMENTS[0], SKY_SEGMENTS[1])),
    ground: 2,
  };
  const instances = {
    grass: 0,
    lilies: 0,
    daisies: 0,
    lupins: 0,
    clouds: layout.clouds.count,
    glows: layout.glows.count,
    sparks: layout.sparks.count,
    leaves: layout.leaves.count,
    blossoms: layout.blossoms.count,
  };
  let draws = 3;
  let tris = unit.sky + unit.ground + unit.hill;
  layout.patches.forEach((patch, index) => {
    const far = index === 2;
    instances.grass += patch.grass.count;
    instances.lilies += patch.lilies.count;
    instances.daisies += patch.daisies.count;
    instances.lupins += patch.lupins.count;
    if (patch.grass.count > 0) {
      draws += 1;
      tris += unit.grass * patch.grass.count;
    }
    if (patch.lilies.count > 0) {
      draws += 1;
      tris += (far ? unit.lilySpeck : unit.lily) * patch.lilies.count;
    }
    if (patch.daisies.count > 0) {
      draws += 1;
      tris += (far ? unit.daisySpeck : unit.daisy) * patch.daisies.count;
    }
    if (patch.lupins.count > 0) {
      draws += 1;
      const lupinUnit = far ? unit.lupinSpeck : index === 0 ? unit.lupin : unit.lupinFar;
      tris += lupinUnit * patch.lupins.count;
    }
  });
  if (layout.clouds.count > 0) {
    draws += 1;
    tris += unit.card * layout.clouds.count;
  }
  if (layout.glows.count > 0) {
    draws += 1;
    tris += unit.card * layout.glows.count;
  }
  if (layout.sparks.count > 0) draws += 1;
  if (layout.blossoms.count > 0) {
    draws += 1;
    tris += unit.card * layout.blossoms.count;
  }
  draws += 1;
  tris += unit.trunk;
  if (layout.leaves.count > 0) {
    draws += 1;
    tris += unit.card * layout.leaves.count;
  }
  return { quality, instances, triangles: tris, draws };
}
