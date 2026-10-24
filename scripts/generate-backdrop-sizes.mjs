#!/usr/bin/env node
/**
 * Generate responsive backdrop images in AVIF and WebP formats
 * Sizes: 640, 1024, 1600, 2400 (upscaling with sharp if needed)
 */

import sharp from "sharp";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public", "join");

const sources = [
  { name: "backdrop-desktop", file: "backdrop-desktop.jpg" },
  { name: "backdrop-mobile", file: "backdrop-mobile.jpg" },
];

const sizes = [640, 1024, 1600, 2400];
const formats = ["avif", "webp"];

async function generateImages() {
  for (const source of sources) {
    const inputPath = join(publicDir, source.file);
    const image = sharp(inputPath);
    const metadata = await image.metadata();
    
    console.log(`Processing ${source.file}: ${metadata.width}x${metadata.height}`);
    
    for (const width of sizes) {
      for (const format of formats) {
        const outputName = `${source.name}-${width}w.${format}`;
        const outputPath = join(publicDir, outputName);
        
        let pipeline = sharp(inputPath);
        
        // Resize (upscale if needed using lanczos3 for quality)
        pipeline = pipeline.resize(width, null, {
          kernel: sharp.kernel.lanczos3,
          withoutEnlargement: false,
        });
        
        // Convert to format
        if (format === "avif") {
          pipeline = pipeline.avif({ quality: 70, effort: 4 });
        } else if (format === "webp") {
          pipeline = pipeline.webp({ quality: 80, effort: 4 });
        }
        
        await pipeline.toFile(outputPath);
        console.log(`  Created: ${outputName}`);
      }
    }
  }
  
  console.log("\nDone! Generated responsive backdrop images.");
}

generateImages().catch(console.error);
