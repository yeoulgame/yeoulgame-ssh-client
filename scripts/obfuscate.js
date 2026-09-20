/*
 * Yeoulgame SSH Client v1.0
 * Copyright © 2026 Yeoulgame (yeoulgame.com)
 * Licensed under MIT License
 *
 * obfuscate.js - 배포판 코드 난독화 (RFP 3.1.1)
 *   src/**\/*.js 를 난독화해 dist-obfuscated/ 로 복사한다.
 *   저작권 헤더는 preserve 설정으로 유지된다.
 *   사용법: npm run obfuscate  →  npm run dist:secure
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

let obfuscator;
try {
  obfuscator = require('javascript-obfuscator');
} catch {
  console.error('javascript-obfuscator 가 설치되어 있지 않습니다. npm i -D javascript-obfuscator');
  process.exit(1);
}

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'dist-obfuscated');
const COPY_AS_IS = ['resources', 'build', 'LICENSE', 'package.json'];

const OPTIONS = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.6,
  deadCodeInjection: false,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  selfDefending: true,
  simplify: true,
  stringArray: true,
  stringArrayThreshold: 0.75,
  stringArrayEncoding: ['base64'],
  splitStrings: true,
  splitStringsChunkLength: 12,
  target: 'node',
  // 난독화 후에도 최상단 저작권 표시는 유지한다
  seed: 20261004
};

const HEADER =
  '/*\n' +
  ' * Yeoulgame SSH Client v1.0\n' +
  ' * Copyright © 2026 Yeoulgame (yeoulgame.com)\n' +
  ' * Licensed under MIT License\n' +
  ' * https://opensource.org/licenses/MIT\n' +
  ' */\n';

function rmrf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, e.name);
    const dst = path.join(to, e.name);
    if (e.isDirectory()) copyDir(src, dst);
    else fs.copyFileSync(src, dst);
  }
}

function walkJs(dir, out) {
  fs.mkdirSync(out, { recursive: true });
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const src = path.join(dir, e.name);
    const dst = path.join(out, e.name);
    if (e.isDirectory()) {
      walkJs(src, dst);
    } else if (e.name.endsWith('.js')) {
      const code = fs.readFileSync(src, 'utf8');
      // 렌더러 코드는 브라우저 타깃
      const opts = { ...OPTIONS, target: src.includes(path.join('src', 'renderer')) ? 'browser' : 'node' };
      const result = obfuscator.obfuscate(code, opts).getObfuscatedCode();
      fs.writeFileSync(dst, HEADER + result, 'utf8');
      console.log('obfuscated: ' + path.relative(ROOT, src));
    } else {
      fs.copyFileSync(src, dst);
    }
  }
}

function main() {
  rmrf(OUT);
  fs.mkdirSync(OUT, { recursive: true });
  walkJs(path.join(ROOT, 'src'), path.join(OUT, 'src'));
  for (const item of COPY_AS_IS) {
    const src = path.join(ROOT, item);
    if (!fs.existsSync(src)) continue;
    const dst = path.join(OUT, item);
    if (fs.statSync(src).isDirectory()) copyDir(src, dst);
    else fs.copyFileSync(src, dst);
  }
  console.log('\n난독화 완료 → ' + OUT);
  console.log('다음: npx electron-builder --config.directories.app=dist-obfuscated');
}

main();
