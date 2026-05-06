import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { spawn } from 'node:child_process';

const root = process.cwd();
const svgPath = path.join(root, 'build', 'icon.svg');
const iconsetPath = path.join(root, 'build', 'icon.iconset');
const icnsPath = path.join(root, 'build', 'icon.icns');
const pngPath = path.join(root, 'build', 'icon.png');

const iconSizes = [
  [16, 'icon_16x16.png'],
  [32, 'icon_16x16@2x.png'],
  [32, 'icon_32x32.png'],
  [64, 'icon_32x32@2x.png'],
  [128, 'icon_128x128.png'],
  [256, 'icon_128x128@2x.png'],
  [256, 'icon_256x256.png'],
  [512, 'icon_256x256@2x.png'],
  [512, 'icon_512x512.png'],
  [1024, 'icon_512x512@2x.png']
];

await rm(iconsetPath, { recursive: true, force: true });
await mkdir(iconsetPath, { recursive: true });

await sharp(svgPath).resize(1024, 1024).png().toFile(pngPath);

for (const [size, filename] of iconSizes) {
  await sharp(svgPath)
    .resize(size, size)
    .png()
    .toFile(path.join(iconsetPath, filename));
}

await run('iconutil', ['-c', 'icns', iconsetPath, '-o', icnsPath]);

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with ${code}`));
    });
  });
}
