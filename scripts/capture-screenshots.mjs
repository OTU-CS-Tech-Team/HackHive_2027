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

async function captureWithColdCache(browser, vp, outputDir, attempt = 1) {
  console.log(`Capturing ${vp.name} (${vp.width}x${vp.height}) - attempt ${attempt}...`);
  
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  
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
  
  let hasError = false;
  
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('418') || text.includes('hydrat') || text.includes('Hydrat')) {
      console.log(`  ❌ Hydration error: ${text.substring(0, 200)}`);
      hasError = true;
    } else if (text.includes('NaN')) {
      console.log(`  ❌ NaN error: ${text.substring(0, 200)}`);
      hasError = true;
    }
  });
  
  page.on('pageerror', err => {
    console.log(`  ❌ PageError: ${err.message.substring(0, 200)}`);
    hasError = true;
  });
  
  page.on('requestfailed', req => {
    const url = req.url();
    if (url.includes('/join/backdrop') || url.includes('.avif') || url.includes('.webp')) {
      console.log(`  ❌ 404: ${url}`);
      hasError = true;
    }
  });
  
  await page.goto('http://localhost:3000/scene-test', {
    waitUntil: 'networkidle0',
    timeout: 30000,
  });
  
  await new Promise(r => setTimeout(r, 3000));
  
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
  
  if (!hasError) {
    console.log(`  ✅ Clean (canvas: ${info.hasCanvas})`);
  }
  
  if (attempt === 1) {
    const screenshotPath = path.join(outputDir, `${vp.name}-${vp.width}px.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`  Saved: ${screenshotPath}`);
  }
  
  await context.close();
  return !hasError;
}

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
    await captureWithColdCache(browser, vp, outputDir, 1);
  }
  
  console.log('\nRunning 5 cold-cache tests at 390px...');
  let passCount = 0;
  for (let i = 2; i <= 6; i++) {
    const passed = await captureWithColdCache(browser, viewports[0], outputDir, i);
    if (passed) passCount++;
  }
  console.log(`Cold-cache tests: ${passCount}/5 passed`);

  await browser.close();
  console.log('Done!');
}

captureScreenshots().catch(console.error);
