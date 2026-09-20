/*
 * Yeoulgame SSH Client v1.0
 * Copyright © 2026 Yeoulgame (yeoulgame.com)
 * Licensed under MIT License
 *
 * check-syntax.js - 전체 소스 문법 검사 + 저작권 헤더 검사 (RFP 3.2.2)
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const DIRS = ['src', 'scripts'];
const REQUIRED_MARK = 'Copyright © 2026 Yeoulgame';

let errors = 0;
let checked = 0;

function walk(dir, fn) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, fn);
    else fn(p);
  }
}

for (const d of DIRS) {
  const full = path.join(ROOT, d);
  if (!fs.existsSync(full)) continue;
  walk(full, (file) => {
    const ext = path.extname(file);
    if (!['.js', '.html', '.css'].includes(ext)) return;
    checked++;
    const rel = path.relative(ROOT, file);
    const text = fs.readFileSync(file, 'utf8');

    if (!text.includes(REQUIRED_MARK)) {
      console.error('✗ 저작권 표시 누락: ' + rel);
      errors++;
    }

    if (ext === '.js') {
      try {
        execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
      } catch (e) {
        console.error('✗ 문법 오류: ' + rel + '\n' + String(e.stderr || e.message));
        errors++;
      }
    }
  });
}

// i18n JSON 파싱 검사
const i18nDir = path.join(ROOT, 'resources', 'i18n');
if (fs.existsSync(i18nDir)) {
  for (const f of fs.readdirSync(i18nDir)) {
    if (!f.endsWith('.json')) continue;
    checked++;
    try {
      JSON.parse(fs.readFileSync(path.join(i18nDir, f), 'utf8'));
    } catch (e) {
      console.error('✗ JSON 오류: resources/i18n/' + f + ' — ' + e.message);
      errors++;
    }
  }
}

console.log((errors ? '✗' : '✓') + ' 검사 파일 ' + checked + '개, 오류 ' + errors + '건');
process.exit(errors ? 1 : 0);
