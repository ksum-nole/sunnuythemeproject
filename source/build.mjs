import { build } from 'esbuild';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const map = await readFile(join(root, 'dist/assets/foundry.json'), 'utf8');
const ice = await readFile(join(root, 'dist/assets/ice.json'), 'utf8');
const character = await readFile(join(root, 'dist/assets/itrapped.json'), 'utf8');
const run = await readFile(join(root, 'dist/assets/run.json'), 'utf8');
const legacyIce = await readFile(join(root, 'dist/assets/legacy-ice.json'), 'utf8');
const legacyMotion = await readFile(join(root, 'dist/assets/legacy-motion.json'), 'utf8');
await writeFile(join(root, 'source/generated-assets.js'), `// Generated from the original Blender assets.\nexport const MAP=${map};\nexport const ICE=${ice};\nexport const CHARACTER=${character};\nexport const RUN=${run};\nexport const LEGACY_ICE=${legacyIce};\nexport const LEGACY_MOTION=${legacyMotion};\n`);
const bundle = await build({ entryPoints: [join(root, 'source/game.js')], bundle: true, minify: true, format: 'iife', target: 'es2022', write: false, legalComments: 'eof' });
const license = await readFile(join(root, 'THREE-LICENSE.txt'), 'utf8');
const html = (await readFile(join(root, 'source/index.html'), 'utf8')).replace('</head>', `<!-- THREE.JS LICENSE\n${license}\n-->\n</head>`).replace('/* APP_STYLE */', await readFile(join(root, 'source/style.css'), 'utf8')).replace('/* APP_CODE */', () => bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script'));
await mkdir(join(root, 'dist'), { recursive: true });
await writeFile(join(root, 'dist/index.html'), html);
if (!process.env.VERCEL) {
  for (const name of ['Ice_Slam_Game.html', 'Ice_Slam_Game_Itrapped.html', 'PLAY ICE SLAM.html', 'PLAY MASSIVE ICE SLAM.html']) {
    await copyFile(join(root, 'dist/index.html'), join(dirname(root), name));
  }
}
console.log(JSON.stringify({ built: join(root, 'dist/index.html'), bytes: Buffer.byteLength(html), standalone: true }));
