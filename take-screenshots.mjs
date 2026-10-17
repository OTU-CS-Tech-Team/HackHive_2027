import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3000';
const ARTIFACTS_DIR = '/opt/cursor/artifacts/screenshots';

async function takeScreenshots() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 }
  });
  
  const desktopPage = await context.newPage();
  const mobilePage = await mobileContext.newPage();
  
  console.log('Taking screenshots...');
  
  // Homepage - desktop
  await desktopPage.goto(BASE_URL);
  await desktopPage.waitForLoadState('networkidle');
  await desktopPage.screenshot({ path: `${ARTIFACTS_DIR}/01_homepage_desktop.png`, fullPage: false });
  console.log('✓ Homepage desktop');
  
  // Homepage - mobile
  await mobilePage.goto(BASE_URL);
  await mobilePage.waitForLoadState('networkidle');
  await mobilePage.screenshot({ path: `${ARTIFACTS_DIR}/02_homepage_mobile.png`, fullPage: false });
  console.log('✓ Homepage mobile');
  
  // Signup page - desktop
  await desktopPage.goto(`${BASE_URL}/signup`);
  await desktopPage.waitForLoadState('networkidle');
  await desktopPage.screenshot({ path: `${ARTIFACTS_DIR}/03_signup_desktop.png`, fullPage: false });
  console.log('✓ Signup desktop');
  
  // Signup page - mobile
  await mobilePage.goto(`${BASE_URL}/signup`);
  await mobilePage.waitForLoadState('networkidle');
  await mobilePage.screenshot({ path: `${ARTIFACTS_DIR}/04_signup_mobile.png`, fullPage: false });
  console.log('✓ Signup mobile');
  
  // Set auth in localStorage for apply pages
  // First, go to a page to set localStorage
  await desktopPage.goto(`${BASE_URL}/signup`);
  await desktopPage.evaluate(() => {
    localStorage.setItem('hackhive_auth', JSON.stringify({ email: 'test@example.com', verified: true }));
    localStorage.setItem('hackhive_application_draft', JSON.stringify({
      data: {},
      submissionId: 'test-submission-id',
      _savedAt: Date.now()
    }));
  });
  
  await mobilePage.goto(`${BASE_URL}/signup`);
  await mobilePage.evaluate(() => {
    localStorage.setItem('hackhive_auth', JSON.stringify({ email: 'test@example.com', verified: true }));
    localStorage.setItem('hackhive_application_draft', JSON.stringify({
      data: {},
      submissionId: 'test-submission-id',
      _savedAt: Date.now()
    }));
  });
  
  // Apply page - desktop (top of form)
  await desktopPage.goto(`${BASE_URL}/apply`);
  await desktopPage.waitForLoadState('networkidle');
  await desktopPage.waitForTimeout(1000);
  
  // Check if we're on the apply page or got redirected
  const currentUrl = desktopPage.url();
  console.log('Current URL:', currentUrl);
  
  if (currentUrl.includes('/apply') && !currentUrl.includes('/signup')) {
    await desktopPage.screenshot({ path: `${ARTIFACTS_DIR}/05_apply_top_desktop.png`, fullPage: false });
    console.log('✓ Apply top desktop');
    
    // Try to fill in age field
    try {
      const ageInput = await desktopPage.locator('input[name="age"]');
      if (await ageInput.isVisible({ timeout: 2000 })) {
        await ageInput.fill('16');
        await desktopPage.waitForTimeout(500);
        
        // Try to find guardian section
        const guardianSection = desktopPage.locator('text=Guardian Information');
        if (await guardianSection.isVisible({ timeout: 2000 })) {
          await guardianSection.scrollIntoViewIfNeeded();
          await desktopPage.waitForTimeout(300);
          await desktopPage.screenshot({ path: `${ARTIFACTS_DIR}/06_guardian_section_desktop.png`, fullPage: false });
          console.log('✓ Guardian section desktop');
        }
      }
    } catch (e) {
      console.log('Could not fill age field:', e.message);
    }
    
    // Try short answers section
    try {
      const shortAnswersSection = desktopPage.locator('text=Short Answers');
      if (await shortAnswersSection.isVisible({ timeout: 2000 })) {
        await shortAnswersSection.scrollIntoViewIfNeeded();
        await desktopPage.waitForTimeout(300);
        
        // Fill in some text to show word count
        const textareas = desktopPage.locator('textarea');
        const count = await textareas.count();
        if (count > 0) {
          await textareas.first().fill('This is a test response that shows the word count feature working correctly. I am passionate about building innovative solutions that help people in meaningful ways. This project represents my dedication to creating accessible technology for everyone.');
          await desktopPage.waitForTimeout(300);
        }
        
        await desktopPage.screenshot({ path: `${ARTIFACTS_DIR}/07_short_answers_desktop.png`, fullPage: false });
        console.log('✓ Short answers desktop');
      }
    } catch (e) {
      console.log('Could not find short answers section:', e.message);
    }
    
    // Scroll to bottom to show consent and submit
    await desktopPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await desktopPage.waitForTimeout(300);
    await desktopPage.screenshot({ path: `${ARTIFACTS_DIR}/08_consent_submit_desktop.png`, fullPage: false });
    console.log('✓ Consent/submit section desktop');
  } else {
    console.log('Apply page redirected to:', currentUrl);
    await desktopPage.screenshot({ path: `${ARTIFACTS_DIR}/05_apply_redirect.png`, fullPage: false });
    console.log('✓ Screenshot of redirected page');
  }
  
  // Mobile apply page
  await mobilePage.goto(`${BASE_URL}/apply`);
  await mobilePage.waitForLoadState('networkidle');
  await mobilePage.waitForTimeout(1000);
  
  const mobileUrl = mobilePage.url();
  if (mobileUrl.includes('/apply') && !mobileUrl.includes('/signup')) {
    await mobilePage.screenshot({ path: `${ARTIFACTS_DIR}/09_apply_top_mobile.png`, fullPage: false });
    console.log('✓ Apply top mobile');
    
    await mobilePage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await mobilePage.waitForTimeout(300);
    await mobilePage.screenshot({ path: `${ARTIFACTS_DIR}/10_apply_bottom_mobile.png`, fullPage: false });
    console.log('✓ Apply bottom mobile');
  } else {
    console.log('Mobile apply page redirected to:', mobileUrl);
  }
  
  // Confirmation page
  await desktopPage.goto(`${BASE_URL}/apply/confirmation`);
  await desktopPage.waitForLoadState('networkidle');
  await desktopPage.screenshot({ path: `${ARTIFACTS_DIR}/11_confirmation_desktop.png`, fullPage: false });
  console.log('✓ Confirmation desktop');
  
  // Status page
  await desktopPage.goto(`${BASE_URL}/apply/status`);
  await desktopPage.waitForLoadState('networkidle');
  await desktopPage.waitForTimeout(500);
  await desktopPage.screenshot({ path: `${ARTIFACTS_DIR}/12_status_desktop.png`, fullPage: false });
  console.log('✓ Status desktop');
  
  await browser.close();
  console.log('\nAll screenshots saved to:', ARTIFACTS_DIR);
}

takeScreenshots().catch(console.error);
