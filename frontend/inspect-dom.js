const { chromium } = require('./node_modules/playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const [w, h] of [[1280, 720], [1366, 768], [1440, 900], [1920, 1080], [375, 667]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
    const metrics = await page.evaluate(() => {
      const docEl = document.documentElement;
      const body = document.body;
      const header = document.querySelector('header');
      const main = document.querySelector('main');
      const footer = document.querySelector('footer');
      const hero = document.querySelector('main section');
      const divider = document.querySelector('main > div:nth-of-type(1)');
      const cardsContainer = document.querySelector('main > div:last-of-type');
      const cards = Array.from(document.querySelectorAll('[id^="portal-card-"]')).map(c => {
        const rect = c.getBoundingClientRect();
        return {
          id: c.id,
          height: rect.height,
          paddingTop: window.getComputedStyle(c).paddingTop,
          paddingBottom: window.getComputedStyle(c).paddingBottom,
        };
      });
      return {
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        scrollWidth: docEl.scrollWidth,
        scrollHeight: docEl.scrollHeight,
        bodyScrollHeight: body.scrollHeight,
        hasVerticalScroll: docEl.scrollHeight > window.innerHeight,
        headerHeight: header ? header.getBoundingClientRect().height : 0,
        mainHeight: main ? main.getBoundingClientRect().height : 0,
        footerHeight: footer ? footer.getBoundingClientRect().height : 0,
        heroHeight: hero ? hero.getBoundingClientRect().height : 0,
        cardsContainerHeight: cardsContainer ? cardsContainer.getBoundingClientRect().height : 0,
        totalStacked: (header ? header.getBoundingClientRect().height : 0) +
                      (main ? main.getBoundingClientRect().height : 0) +
                      (footer ? footer.getBoundingClientRect().height : 0),
        cards
      };
    });
    console.log(JSON.stringify(metrics, null, 2));
  }
  await browser.close();
})();
