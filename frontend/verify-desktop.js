const { chromium } = require('./node_modules/playwright');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = path.resolve(__dirname, 'test-results', 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const desktopSizes = [
    { w: 1920, h: 1080 },
    { w: 1440, h: 900 },
    { w: 1366, h: 768 },
    { w: 1280, h: 720 }
  ];

  for (const { w, h } of desktopSizes) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

    const checks = await page.evaluate(() => {
      const doc = document.documentElement;
      const body = document.body;

      // Section visibility checks
      const header = document.querySelector('header');
      const secLogo = document.querySelector('header img[alt*="Sri Sairam Engineering College"]');
      const sairamLogo = document.querySelector('header img[alt*="Sri Sairam Institutions"]');
      const deptName = document.getElementById('department-identity-name');
      const h1 = document.querySelector('h1');
      const subtitle = Array.from(document.querySelectorAll('p')).find(p => p.textContent?.includes('PGPA MANAGEMENT SYSTEM'));
      const tagline = Array.from(document.querySelectorAll('p')).find(p => p.textContent?.includes('Academic Performance. Structured. Simplified.'));
      const cardStudent = document.getElementById('portal-card-student');
      const cardMentor = document.getElementById('portal-card-mentor');
      const cardHod = document.getElementById('portal-card-hod');
      const footer = document.querySelector('footer');
      const founderLogo = document.querySelector('footer img[alt*="Founder Chairman"]');
      const founderText = Array.from(document.querySelectorAll('footer span')).find(s => s.textContent?.includes('MJF. Ln. Leo Muthu'));
      const fineworksText = Array.from(document.querySelectorAll('footer span')).find(s => s.textContent?.includes('FINE'));

      function isFullyInViewport(el) {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return (
          rect.top >= 0 &&
          rect.left >= 0 &&
          rect.bottom <= window.innerHeight &&
          rect.right <= window.innerWidth
        );
      }

      return {
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        scrollHeight: doc.scrollHeight,
        innerHeight: window.innerHeight,
        scrollWidth: doc.scrollWidth,
        innerWidth: window.innerWidth,
        fitsHeight: doc.scrollHeight <= window.innerHeight,
        fitsWidth: doc.scrollWidth <= window.innerWidth,
        deptText: deptName?.textContent?.trim(),
        headerVisible: isFullyInViewport(header),
        secLogoVisible: isFullyInViewport(secLogo),
        sairamLogoVisible: isFullyInViewport(sairamLogo),
        deptNameVisible: isFullyInViewport(deptName),
        titleVisible: isFullyInViewport(h1),
        subtitleVisible: isFullyInViewport(subtitle),
        taglineVisible: isFullyInViewport(tagline),
        cardStudentVisible: isFullyInViewport(cardStudent),
        cardMentorVisible: isFullyInViewport(cardMentor),
        cardHodVisible: isFullyInViewport(cardHod),
        footerVisible: isFullyInViewport(footer),
        founderLogoVisible: isFullyInViewport(founderLogo),
        founderTextVisible: isFullyInViewport(founderText),
        fineworksTextVisible: isFullyInViewport(fineworksText),
        footerRect: footer ? { top: footer.getBoundingClientRect().top, bottom: footer.getBoundingClientRect().bottom } : null,
      };
    });

    console.log(`Resolution ${w}x${h}:`, JSON.stringify(checks, null, 2));

    const shotPath = path.join(SCREENSHOT_DIR, `desktop_${w}x${h}.png`);
    await page.screenshot({ path: shotPath });
    console.log(`Saved screenshot to ${shotPath}`);
  }

  await browser.close();
})();
