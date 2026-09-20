/*
 * Yeoulgame SSH Client v1.0
 * Copyright © 2026 Yeoulgame (yeoulgame.com)
 * Licensed under MIT License
 * https://opensource.org/licenses/MIT
 *
 * updater.js - 버전 확인 (강제 업데이트 아님, 사용자 동의 후 브라우저로 안내)
 *   엔드포인트: https://api.yeoulgame.com/ssh/version
 *   응답 예: { "version": "1.0.1", "url": "https://yeoulgame.com/board/files", "notes": "..." }
 */
'use strict';

const https = require('node:https');

const VERSION_URL = 'https://api.yeoulgame.com/ssh/version';
const TIMEOUT_MS = 7000;

function cmpVersion(a, b) {
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

function fetchLatest() {
  return new Promise((resolve, reject) => {
    const req = https.get(VERSION_URL, { headers: { 'User-Agent': 'YeoulgameSSHClient' } }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error('HTTP ' + res.statusCode));
        return;
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => {
        body += c;
        if (body.length > 64 * 1024) req.destroy(new Error('RESPONSE_TOO_LARGE'));
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.setTimeout(TIMEOUT_MS, () => req.destroy(new Error('TIMEOUT')));
    req.on('error', reject);
  });
}

/**
 * @param {string} currentVersion
 * @returns {Promise<{status:'up-to-date'|'update-available'|'unavailable', latest?:string, url?:string, notes?:string, error?:string}>}
 */
async function check(currentVersion) {
  try {
    const data = await fetchLatest();
    if (!data || !data.version) return { status: 'unavailable', error: 'BAD_PAYLOAD' };
    if (cmpVersion(data.version, currentVersion) > 0) {
      return {
        status: 'update-available',
        latest: data.version,
        url: data.url || 'https://yeoulgame.com/board/files',
        notes: data.notes || ''
      };
    }
    return { status: 'up-to-date', latest: data.version };
  } catch (e) {
    return { status: 'unavailable', error: e.message };
  }
}

module.exports = { check, cmpVersion, VERSION_URL };
