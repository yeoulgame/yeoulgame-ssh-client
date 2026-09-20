/*
 * Yeoulgame SSH Client v1.0
 * Copyright © 2026 Yeoulgame (yeoulgame.com)
 * Licensed under MIT License
 *
 * gen-hashes.js - 배포 파일 SHA-256 해시 생성 (release/SHA256SUMS.txt)
 *   사용법: npm run hash
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const RELEASE_DIR = path.join(__dirname, '..', 'release');
const TARGET_EXT = ['.exe', '.zip', '.AppImage', '.deb', '.rpm', '.snap'];

function sha256(file) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(file));
  return hash.digest('hex');
}

function main() {
  if (!fs.existsSync(RELEASE_DIR)) {
    console.error('release/ 폴더가 없습니다. 먼저 npm run dist 를 실행하세요.');
    process.exit(1);
  }
  const files = fs
    .readdirSync(RELEASE_DIR)
    .filter((f) => TARGET_EXT.includes(path.extname(f)))
    .sort();

  if (!files.length) {
    console.error('해시를 만들 배포 파일이 없습니다.');
    process.exit(1);
  }

  const lines = files.map((f) => {
    const h = sha256(path.join(RELEASE_DIR, f));
    console.log(h + '  ' + f);
    return h + '  ' + f;
  });

  const out = path.join(RELEASE_DIR, 'SHA256SUMS.txt');
  fs.writeFileSync(out, lines.join('\n') + '\n', 'utf8');
  console.log('\n생성 완료: ' + out);
  console.log('검증(Linux):   sha256sum -c SHA256SUMS.txt');
  console.log('검증(Windows): certutil -hashfile <파일> SHA256');
}

main();
