/*
 * Yeoulgame SSH Client v1.0
 * Copyright © 2026 Yeoulgame (yeoulgame.com)
 * Licensed under MIT License
 * https://opensource.org/licenses/MIT
 *
 * i18n-main.js - 5개 국가 언어 리소스 로더 및 OS 로케일 자동 감지
 *   완전 지원: ko, en   /   UI 전용(나머지는 en 폴백): ja, zh-CN, de
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SUPPORTED = ['ko', 'en', 'ja', 'zh-CN', 'de'];
const FULL_SUPPORT = ['ko', 'en'];
const FALLBACK = 'en';

const RES_DIR = path.join(__dirname, '..', '..', 'resources', 'i18n');

const cache = new Map();

function loadDict(lang) {
  if (cache.has(lang)) return cache.get(lang);
  let dict = {};
  try {
    dict = JSON.parse(fs.readFileSync(path.join(RES_DIR, `${lang}.json`), 'utf8'));
  } catch {
    dict = {};
  }
  cache.set(lang, dict);
  return dict;
}

/**
 * OS 로케일 -> 지원 언어 코드
 * Windows: app.getLocale() 예) ko-KR, zh-Hans-CN
 * Linux:   LC_ALL / LC_MESSAGES / LANG 예) ko_KR.UTF-8
 */
function detectLanguage(electronLocale) {
  const raw =
    process.env.LC_ALL ||
    process.env.LC_MESSAGES ||
    process.env.LANG ||
    electronLocale ||
    'en_US';
  const norm = String(raw).replace('_', '-').split('.')[0];
  const lower = norm.toLowerCase();

  if (lower.startsWith('ko')) return 'ko';
  if (lower.startsWith('ja')) return 'ja';
  if (lower.startsWith('de')) return 'de';
  if (lower.startsWith('zh')) {
    if (lower.includes('tw') || lower.includes('hk') || lower.includes('hant')) return 'zh-CN'; // 번체는 V1.1
    return 'zh-CN';
  }
  return 'en';
}

function resolveLanguage(setting, electronLocale) {
  if (setting && setting !== 'auto' && SUPPORTED.includes(setting)) return setting;
  return detectLanguage(electronLocale);
}

/** 점 표기 키 조회 */
function pick(dict, key) {
  return key.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), dict);
}

class I18n {
  constructor(lang) {
    this.setLanguage(lang || FALLBACK);
  }

  setLanguage(lang) {
    this.lang = SUPPORTED.includes(lang) ? lang : FALLBACK;
    this.dict = loadDict(this.lang);
    this.fallbackDict = this.lang === FALLBACK ? this.dict : loadDict(FALLBACK);
  }

  t(key, vars) {
    let val = pick(this.dict, key);
    if (typeof val !== 'string') val = pick(this.fallbackDict, key);
    if (typeof val !== 'string') return key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        val = val.split('{' + k + '}').join(String(v));
      }
    }
    return val;
  }

  /** 렌더러로 넘길 병합 사전 (en 폴백 적용 완료) */
  bundle() {
    const merge = (base, over) => {
      const out = Array.isArray(base) ? base.slice() : { ...base };
      for (const [k, v] of Object.entries(over || {})) {
        if (v && typeof v === 'object' && !Array.isArray(v) && base && typeof base[k] === 'object') {
          out[k] = merge(base[k], v);
        } else {
          out[k] = v;
        }
      }
      return out;
    };
    return {
      lang: this.lang,
      fullSupport: FULL_SUPPORT.includes(this.lang),
      dict: merge(this.fallbackDict, this.dict)
    };
  }
}

module.exports = { I18n, SUPPORTED, FULL_SUPPORT, FALLBACK, detectLanguage, resolveLanguage };
