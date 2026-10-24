import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
];

async function captureScreenshots() {
  const outputDir = path.join(__dirname, 'test-artifacts');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--use-gl=swiftshader',
      '--enable-unsafe-swiftshader',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu-sandbox',
    ],
  });

  for (const vp of viewports) {
    console.log(`Capturing ${vp.name} (${vp.width}x${vp.height})...`);
    
    const page = await browser.newPage();
    await page.setViewport({ width: vp.width, height: vp.height });
    
    await page.evaluateOnNewDocument(() => {
      const originalGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, options) {
        if ((type === 'webgl' || type === 'experimental-webgl' || type === 'webgl2') && options) {
          delete options.failIfMajorPerformanceCaveat;
        }
        return originalGetContext.call(this, type, options);
      };
      window.__SKIP_WEBGL_PREFLIGHT__ = true;
    });
    
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('NaN') || text.includes('error') || text.includes('Error') || text.includes('418') || text.includes('hydrat') || text.includes('Hydrat')) {
        console.log(`  Console [${msg.type()}]: ${text.substring(0, 200)}`);
      }
    });
    
    page.on('pageerror', err => {
      console.log(`  PageError: ${err.message.substring(0, 200)}`);
    });
    
    page.on('requestfailed', req => {
      console.log(`  Failed request: ${req.url()}`);
    });
    
    await page.goto('http://localhost:3000/scene-test', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    
    await new Promise(r => setTimeout(r, 4000));
    
    await page.evaluate(() => {
      document.querySelectorAll('[data-nextjs-dialog-overlay], [data-nextjs-dialog], nextjs-portal').forEach(el => el.remove());
      document.querySelectorAll('[data-nextjs-toast], [class*="nextjs"]').forEach(el => el.remove());
    });
    
    await new Promise(r => setTimeout(r, 500));
    
    const info = await page.evaluate(() => ({
      hasCanvas: !!document.querySelector('canvas'),
      canvasW: document.querySelector('canvas')?.clientWidth,
      canvasH: document.querySelector('canvas')?.clientHeight,
    }));
    console.log(`  Info: ${JSON.stringify(info)}`);
    
    const screenshotPath = path.join(outputDir, `${vp.name}-${vp.width}px.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`  Saved: ${screenshotPath}`);
    
    await page.close();
  }

  await browser.close();
  console.log('Done!');
}

captureScreenshots().catch(console.error);
