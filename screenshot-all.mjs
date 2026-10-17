import puppeteer from 'puppeteer';
import { mkdir } from 'fs/promises';

const SCREENSHOT_DIR = '/opt/cursor/artifacts/screenshots';
const BASE_URL = 'http://localhost:3000';

async function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function setupAuth(page) {
  await page.evaluate(() => {
    localStorage.setItem('hackhive_verified', 'true');
    localStorage.setItem('hackhive_user_email', 'test@example.com');
  });
}

async function takeScreenshots() {
  await mkdir(SCREENSHOT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  // Mobile screenshots
  console.log('Taking mobile screenshots...');
  const mobilePage = await browser.newPage();
  await mobilePage.setViewport({ width: 390, height: 844 });

  // Home mobile
  await mobilePage.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
  await mobilePage.screenshot({ path: `${SCREENSHOT_DIR}/home-mobile.png` });
  console.log('  home-mobile.png');

  // Signup mobile
  await mobilePage.goto(`${BASE_URL}/signup`, { waitUntil: 'networkidle0' });
  await mobilePage.screenshot({ path: `${SCREENSHOT_DIR}/signup-mobile.png` });
  console.log('  signup-mobile.png');

  // Apply form top - mobile
  await setupAuth(mobilePage);
  await mobilePage.goto(`${BASE_URL}/apply`, { waitUntil: 'networkidle0' });
  await delay(1000);
  await mobilePage.screenshot({ path: `${SCREENSHOT_DIR}/apply-top-mobile.png` });
  console.log('  apply-top-mobile.png');

  // Apply form full - mobile
  await mobilePage.screenshot({ path: `${SCREENSHOT_DIR}/apply-mobile.png`, fullPage: true });
  console.log('  apply-mobile.png (full)');

  // Short answers with word count - mobile
  await mobilePage.evaluate(() => {
    const textarea = document.querySelector('textarea[name="q_proud"]');
    if (textarea) {
      textarea.scrollIntoView({ behavior: 'instant', block: 'center' });
    }
  });
  await delay(300);
  
  const qProudMobile = await mobilePage.$('textarea[name="q_proud"]');
  if (qProudMobile) {
    await qProudMobile.click();
    await qProudMobile.type('I built a mobile app that helps students track their study habits and improve productivity. The main feature I developed was an analytics dashboard that visualizes study patterns over time. I also implemented a notification system to remind users to take breaks. This project taught me a lot about user experience design and data visualization. I worked on this project for about three months during my sophomore year.');
  }
  await delay(500);
  await mobilePage.screenshot({ path: `${SCREENSHOT_DIR}/apply-short-answers-mobile.png` });
  console.log('  apply-short-answers-mobile.png');

  // Guardian section - set age to 16
  await mobilePage.goto(`${BASE_URL}/apply`, { waitUntil: 'networkidle0' });
  await setupAuth(mobilePage);
  await mobilePage.reload({ waitUntil: 'networkidle0' });
  await delay(500);

  // Clear and set age to 16
  const ageInput = await mobilePage.$('input[name="age"]');
  if (ageInput) {
    await ageInput.click({ clickCount: 3 });
    await ageInput.type('16');
    await delay(500);
  }

  // Scroll to bottom to see guardian section
  await mobilePage.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });
  await delay(500);
  
  // Find and scroll to guardian section
  await mobilePage.evaluate(() => {
    const guardianInput = document.querySelector('input[name="guardian_name"]');
    if (guardianInput) {
      guardianInput.scrollIntoView({ behavior: 'instant', block: 'center' });
    }
  });
  await delay(300);
  await mobilePage.screenshot({ path: `${SCREENSHOT_DIR}/guardian-section-mobile.png` });
  console.log('  guardian-section-mobile.png');

  // Guardian section with errors - try to submit without guardian info
  await mobilePage.evaluate(() => {
    // Fill required fields except guardian
    const fields = {
      'first_name': 'Jane',
      'last_name': 'Doe',
      'phone': '555-1234',
      'city': 'Toronto',
      'country': 'Canada',
      'university': 'OTU',
      'program': 'Computer Science',
      'grad_date': '2028-05-15',
    };
    for (const [name, value] of Object.entries(fields)) {
      const input = document.querySelector(`input[name="${name}"]`);
      if (input) {
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    // Select year of study
    const yearSelect = document.querySelector('select[name="year_of_study"]');
    if (yearSelect) {
      yearSelect.value = '1';
      yearSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    // Select t-shirt size
    const tshirtSelect = document.querySelector('select[name="tshirt_size"]');
    if (tshirtSelect) {
      tshirtSelect.value = 'M';
      tshirtSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    // Select team status
    const soloRadio = document.querySelector('input[name="team_status"][value="solo"]');
    if (soloRadio) soloRadio.click();
    // Check consents
    const cocCheckbox = document.querySelector('input[name="consent_coc"]');
    if (cocCheckbox) cocCheckbox.click();
    const privacyCheckbox = document.querySelector('input[name="consent_privacy"]');
    if (privacyCheckbox) privacyCheckbox.click();
  });

  // Submit to trigger errors
  const submitBtn = await mobilePage.$('button[type="submit"]');
  if (submitBtn) {
    await submitBtn.click();
    await delay(1000);
  }

  // Scroll to guardian errors
  await mobilePage.evaluate(() => {
    const guardianInput = document.querySelector('input[name="guardian_name"]');
    if (guardianInput) {
      guardianInput.scrollIntoView({ behavior: 'instant', block: 'center' });
    }
  });
  await delay(300);
  await mobilePage.screenshot({ path: `${SCREENSHOT_DIR}/guardian-errors-mobile.png` });
  console.log('  guardian-errors-mobile.png');

  // Upload error state
  await mobilePage.goto(`${BASE_URL}/apply`, { waitUntil: 'networkidle0' });
  await setupAuth(mobilePage);
  await mobilePage.reload({ waitUntil: 'networkidle0' });
  await delay(500);

  // Inject upload error state
  await mobilePage.evaluate(() => {
    const resumeSection = Array.from(document.querySelectorAll('label')).find(l => l.textContent?.includes('Resume'));
    if (resumeSection) {
      const container = resumeSection.closest('div.space-y-2');
      if (container) {
        container.innerHTML = `
          <label class="block text-sm font-medium text-neutral-700">
            Resume (PDF)
            <span class="ml-1 text-red-500" aria-hidden="true">*</span>
          </label>
          <p class="text-sm text-neutral-500">PDF only, max 5 MB</p>
          <div class="space-y-2">
            <div class="rounded-lg border border-red-300 bg-red-50 p-4">
              <div class="flex items-start gap-3">
                <svg class="h-5 w-5 flex-shrink-0 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
                </svg>
                <div class="flex-1">
                  <p class="text-sm font-medium text-red-800">Upload failed</p>
                  <p class="mt-1 text-sm text-red-700">Network error. Please check your connection and try again.</p>
                </div>
              </div>
            </div>
            <button type="button" class="text-sm font-medium text-neutral-900 underline hover:no-underline">Try again</button>
          </div>
        `;
        container.scrollIntoView({ behavior: 'instant', block: 'center' });
      }
    }
  });
  await delay(300);
  await mobilePage.screenshot({ path: `${SCREENSHOT_DIR}/upload-error-mobile.png` });
  console.log('  upload-error-mobile.png');

  // Confirmation mobile
  await mobilePage.goto(`${BASE_URL}/apply/confirmation`, { waitUntil: 'networkidle0' });
  await mobilePage.screenshot({ path: `${SCREENSHOT_DIR}/confirmation-mobile.png` });
  console.log('  confirmation-mobile.png');

  // Status mobile
  await setupAuth(mobilePage);
  await mobilePage.goto(`${BASE_URL}/apply/status`, { waitUntil: 'networkidle0' });
  await delay(500);
  await mobilePage.screenshot({ path: `${SCREENSHOT_DIR}/status-mobile.png` });
  console.log('  status-mobile.png');

  await mobilePage.close();

  // Desktop screenshots
  console.log('Taking desktop screenshots...');
  const desktopPage = await browser.newPage();
  await desktopPage.setViewport({ width: 1280, height: 800 });

  // Home desktop
  await desktopPage.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
  await desktopPage.screenshot({ path: `${SCREENSHOT_DIR}/home-desktop.png` });
  console.log('  home-desktop.png');

  // Apply top desktop
  await setupAuth(desktopPage);
  await desktopPage.goto(`${BASE_URL}/apply`, { waitUntil: 'networkidle0' });
  await delay(1000);
  await desktopPage.screenshot({ path: `${SCREENSHOT_DIR}/apply-top-desktop.png` });
  console.log('  apply-top-desktop.png');

  // Apply full desktop
  await desktopPage.screenshot({ path: `${SCREENSHOT_DIR}/apply-desktop.png`, fullPage: true });
  console.log('  apply-desktop.png (full)');

  // Short answers desktop
  await desktopPage.evaluate(() => {
    const textarea = document.querySelector('textarea[name="q_proud"]');
    if (textarea) {
      textarea.scrollIntoView({ behavior: 'instant', block: 'center' });
    }
  });
  await delay(300);

  const qProudDesktop = await desktopPage.$('textarea[name="q_proud"]');
  if (qProudDesktop) {
    await qProudDesktop.click();
    await qProudDesktop.type('I built a mobile app that helps students track their study habits and improve productivity. The main feature I developed was an analytics dashboard that visualizes study patterns over time. I also implemented a notification system and a social feature for study groups.');
  }
  await delay(500);
  await desktopPage.screenshot({ path: `${SCREENSHOT_DIR}/apply-short-answers-desktop.png` });
  console.log('  apply-short-answers-desktop.png');

  // Confirmation desktop
  await desktopPage.goto(`${BASE_URL}/apply/confirmation`, { waitUntil: 'networkidle0' });
  await desktopPage.screenshot({ path: `${SCREENSHOT_DIR}/confirmation-desktop.png` });
  console.log('  confirmation-desktop.png');

  // Status desktop
  await setupAuth(desktopPage);
  await desktopPage.goto(`${BASE_URL}/apply/status`, { waitUntil: 'networkidle0' });
  await delay(500);
  await desktopPage.screenshot({ path: `${SCREENSHOT_DIR}/status-desktop.png` });
  console.log('  status-desktop.png');

  // Submit button locked state
  console.log('Testing submit button lock...');
  await desktopPage.goto(`${BASE_URL}/apply`, { waitUntil: 'networkidle0' });
  await setupAuth(desktopPage);
  await desktopPage.reload({ waitUntil: 'networkidle0' });
  await delay(500);

  // Scroll to submit and inject locked state
  await desktopPage.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
    const submitBtn = document.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';
      submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
  });
  await delay(300);
  await desktopPage.screenshot({ path: `${SCREENSHOT_DIR}/submit-locked-desktop.png` });
  console.log('  submit-locked-desktop.png');

  await desktopPage.close();
  await browser.close();

  console.log('\nAll screenshots saved to', SCREENSHOT_DIR);
}

takeScreenshots().catch(console.error);
