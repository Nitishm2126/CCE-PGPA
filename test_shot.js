const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outputPath = path.resolve(__dirname, 'shot_1920.png');

console.log('Testing Chrome screenshot to:', outputPath);
const res = spawnSync(chromePath, [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--window-size=1920,1080',
  `--screenshot=${outputPath}`,
  'http://localhost:3000/'
], { encoding: 'utf8' });

console.log('Exit code:', res.status);
console.log('Stderr:', res.stderr);
console.log('Stdout:', res.stdout);
console.log('File exists?', fs.existsSync(outputPath));
