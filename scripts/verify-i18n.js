/*
 * Yeoulgame SSH Client v1.0
 * Copyright © 2026 Yeoulgame (yeoulgame.com)
 * Licensed under MIT License
 *
 * verify-i18n.js - 5개 국가 언어 리소스 검증
 *   - ko / en : 전체 키가 모두 존재해야 한다 (완전 지원)
 *   - ja / zh-CN / de : menu, common 은 반드시 존재해야 한다 (UI 지원)
 *   - 모든 파일의 {placeholder} 가 en 기준과 일치해야 한다
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DIR = path.join(__dirname, '..', 'resources', 'i18n');
const FULL = ['ko', 'en'];
const UI_ONLY = ['ja', 'zh-CN', 'de'];
const UI_REQUIRED_SECTIONS = ['menu', 'common'];

function flatten(obj, prefix, out) {
  out = out || {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (k === '_meta') continue;
    const key = prefix ? prefix + '.' + k : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}

function placeholders(str) {
  return (String(str).match(/\{[a-zA-Z0-9_]+\}/g) || []).sort().join(',');
}

let errors = 0;
let warnings = 0;

const dicts = {};
for (const lang of [...FULL, ...UI_ONLY]) {
  const file = path.join(DIR, lang + '.json');
  if (!fs.existsSync(file)) {
    console.error('✗ 누락된 언어 파일: ' + lang + '.json');
    errors++;
    continue;
  }
  try {
    dicts[lang] = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.error('✗ JSON 파싱 실패 (' + lang + '): ' + e.message);
    errors++;
  }
}

const enFlat = flatten(dicts.en);
const enKeys = Object.keys(enFlat);

for (const lang of FULL) {
  if (!dicts[lang]) continue;
  const flat = flatten(dicts[lang]);
  const missing = enKeys.filter((k) => !(k in flat));
  const extra = Object.keys(flat).filter((k) => !(k in enFlat));
  if (missing.length) {
    console.error('✗ [' + lang + '] 누락 키 ' + missing.length + '개: ' + missing.slice(0, 12).join(', ') + (missing.length > 12 ? ' …' : ''));
    errors++;
  }
  if (extra.length) {
    console.warn('! [' + lang + '] en 에 없는 키 ' + extra.length + '개: ' + extra.slice(0, 12).join(', '));
    warnings++;
  }
  for (const k of enKeys) {
    if (flat[k] && placeholders(flat[k]) !== placeholders(enFlat[k])) {
      console.error('✗ [' + lang + '] 치환자 불일치: ' + k + ' (en: ' + placeholders(enFlat[k]) + ' / ' + lang + ': ' + placeholders(flat[k]) + ')');
      errors++;
    }
  }
  if (!missing.length) console.log('✓ [' + lang + '] 완전 지원 - ' + enKeys.length + '개 키 확인');
}

for (const lang of UI_ONLY) {
  if (!dicts[lang]) continue;
  const flat = flatten(dicts[lang]);
  for (const section of UI_REQUIRED_SECTIONS) {
    const need = enKeys.filter((k) => k.startsWith(section + '.'));
    const missing = need.filter((k) => !(k in flat));
    if (missing.length) {
      console.error('✗ [' + lang + '] ' + section + ' 누락 ' + missing.length + '개: ' + missing.slice(0, 10).join(', '));
      errors++;
    }
  }
  const unknown = Object.keys(flat).filter((k) => !(k in enFlat));
  if (unknown.length) {
    console.warn('! [' + lang + '] en 에 없는 키: ' + unknown.slice(0, 10).join(', '));
    warnings++;
  }
  console.log('✓ [' + lang + '] UI 번역 ' + Object.keys(flat).length + '개 키 (나머지는 영어 폴백)');
}

console.log('\n검증 결과: 오류 ' + errors + '건, 경고 ' + warnings + '건');
process.exit(errors ? 1 : 0);
