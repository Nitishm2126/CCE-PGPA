const { spawnSync } = require('child_process');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const viewports = [
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1280x720', width: 1280, height: 720 },
  { name: 'mobile_375x667', width: 375, height: 667 },
];

for (const vp of viewports) {
  const outputPath = path.resolve(__dirname, `shot_${vp.name}.png`);
  spawnSync(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    `--window-size=${vp.width},${vp.height}`,
    `--screenshot=${outputPath}`,
    'http://localhost:3000/'
  ]);
  console.log(`Generated ${vp.name}`);
}
