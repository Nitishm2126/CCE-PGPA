const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const viewports = [
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1280x720', width: 1280, height: 720 },
  { name: '390x844', width: 390, height: 844 },
  { name: '360x800', width: 360, height: 800 },
];

// First, warm up the endpoint
fetch('http://localhost:3000/').then(r => r.text()).then(() => {
  console.log('Warmup complete.');

  for (const vp of viewports) {
    const outputPath = path.resolve(__dirname, `shot_new_${vp.name}.png`);
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }
    const res = spawnSync(chromePath, [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--virtual-time-budget=3000',
      `--window-size=${vp.width},${vp.height}`,
      `--screenshot=${outputPath}`,
      'http://localhost:3000/'
    ]);
    console.log(`Generated ${vp.name}: exists=${fs.existsSync(outputPath)}`);
  }
});
