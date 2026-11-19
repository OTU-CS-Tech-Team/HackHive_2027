// Builds the About section's images in public/about/ from the original photos at the repo root
// (hackhive_photo*.JPG/.jpg, which are too big to commit and are git-ignored).
//
//   node scripts/about-assets.mjs
//
// For each photo it writes a cropped display image (.avif + .webp, 1600 and 800 wide) and a tiny
// grayscale, high-contrast copy (~160 wide, .png) that the ASCII renderer samples one pixel per
// character cell. The hero meadow poster gets a tiny copy too, for the section's ASCII backdrop.
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "public/about");
mkdirSync(out, { recursive: true });

// Crops are fractions of the (EXIF-rotated) original, so they survive a re-export at another size.
// Stat photos are 3:2 frames; the Polaroid photo area is 16:9 (an Instax Wide frame, and a video's shape).
const PHOTOS = [
  {
    // Hackers listening in a lecture hall.
    src: "hackhive_photo3.JPG",
    name: "attendees",
    crop: { left: 0.2, top: 0.16, width: 0.72 },
    aspect: 3 / 2,
    widths: [1600, 800],
  },
  {
    // Two organizers presenting at the front.
    src: "hackhive_photo1.JPG",
    name: "applicants",
    crop: { left: 0.14, top: 0.1, width: 0.76 },
    aspect: 3 / 2,
    widths: [1600, 800],
  },
  {
    // Two hackers demoing, thumbs up: the "projects" stat. Only 400x267 (already 3:2), upscaled once.
    src: "hackhive_photo2.jpg",
    name: "projects",
    crop: { left: 0, top: 0, width: 1 },
    aspect: 3 / 2,
    widths: [800],
  },
  // Polaroids (16:9). Originals sit at the repo root and are git-ignored like the photos above.
  {
    // NeuroDetect: two hackers at their laptops. Only 400x267, upscaled once.
    src: "neurodetect.png",
    name: "neurodetect",
    crop: { left: 0, top: 0.04, width: 1 },
    aspect: 16 / 9,
    widths: [800],
  },
  {
    // LockBlock: the same demo-table photo as the projects stat.
    src: "hackhive_photo2.jpg",
    name: "lockblock",
    crop: { left: 0, top: 0.03, width: 1 },
    aspect: 16 / 9,
    widths: [800],
  },
  {
    // CutOS: the team of four, cropped to their faces and jackets.
    src: "cutos.png",
    name: "cutos",
    crop: { left: 0, top: 0.2, width: 1 },
    aspect: 16 / 9,
    widths: [1600, 800],
  },
];

const TINY_WIDTH = 160;

async function cropped(file, crop, aspect) {
  const rotated = await sharp(file).rotate().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = rotated.info;
  const width = Math.round(W * crop.width);
  const height = Math.min(Math.round(width / aspect), H - Math.round(H * crop.top));
  const left = Math.round(W * crop.left);
  const top = Math.round(H * crop.top);
  return sharp(rotated.data).extract({ left, top, width: Math.min(width, W - left), height });
}

// Gray, stretched to the full range, with a gentle S-curve so faces and edges carry the glyphs.
function tiny(image, width) {
  return image
    .clone()
    .resize({ width, kernel: "lanczos3" })
    .grayscale()
    .normalise({ lower: 2, upper: 98 })
    .linear(1.25, -0.125 * 255)
    .png({ compressionLevel: 9, palette: false });
}

async function main() {
  for (const photo of PHOTOS) {
    const file = path.join(root, photo.src);
    if (!existsSync(file)) {
      console.warn(`skip ${photo.src}: not found at the repo root`);
      continue;
    }
    const image = await cropped(file, photo.crop, photo.aspect);
    // Flatten to one buffer so every output below starts from the same pixels.
    const base = sharp(await image.png().toBuffer());
    for (const width of photo.widths) {
      const resized = base.clone().resize({ width, kernel: "lanczos3", withoutEnlargement: false });
      await resized.clone().webp({ quality: 74, effort: 6 }).toFile(path.join(out, `${photo.name}-${width}.webp`));
      await resized.clone().avif({ quality: 50, effort: 6 }).toFile(path.join(out, `${photo.name}-${width}.avif`));
    }
    await tiny(base, TINY_WIDTH).toFile(path.join(out, `${photo.name}-ascii.png`));
    console.log(`about/${photo.name}: ${photo.widths.join(", ")} + ascii`);
  }

  // The meadow, for the ASCII backdrop behind the section (wider: it spans the whole screen).
  const poster = path.join(root, "public/path/poster.webp");
  if (existsSync(poster)) {
    await tiny(sharp(poster), 240).toFile(path.join(out, "meadow-ascii.png"));
    console.log("about/meadow-ascii");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
