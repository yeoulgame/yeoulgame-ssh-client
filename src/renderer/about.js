/*
 * Yeoulgame SSH Client v1.0
 * Copyright © 2026 Yeoulgame (yeoulgame.com)
 * Licensed under MIT License
 * https://opensource.org/licenses/MIT
 *
 * about.js - 정보 창 (출처 표시 · 라이선스 · 링크)
 */
'use strict';

const api = window.yeoul;

function pick(dict, key) {
  return key.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), dict);
}

let dict = {};
const t = (k) => {
  const v = pick(dict, k);
  return typeof v === 'string' ? v : k;
};

async function render() {
  const info = await api.invoke('app:info');
  const bundle = await api.invoke('i18n:get');
  dict = bundle.dict;

  document.documentElement.lang = bundle.lang;
  document.getElementById('a-name').textContent = info.name;
  document.getElementById('a-version').textContent = t('about.version') + ' ' + info.version;
  document.getElementById('a-desc').textContent = t('about.description');
  document.getElementById('a-devby').textContent = t('about.developedBy');
  document.getElementById('a-home').textContent = t('about.visitHomepage');
  document.getElementById('a-github').textContent = t('about.visitGithub');
  document.getElementById('a-license').textContent = t('about.viewLicense');
  document.getElementById('a-close').textContent = t('about.close');
  document.getElementById('a-sign-title').textContent = t('about.selfSignedTitle');
  document.getElementById('a-sign-body').textContent = t('about.selfSigned');
  document.getElementById('a-verify').textContent = t('about.verifyGuide');

  document.getElementById('a-sys').textContent =
    t('about.system') + '\n' +
    'Platform : ' + info.platform + ' (' + info.arch + ')\n' +
    'Electron : ' + info.electron + '\n' +
    'Node     : ' + info.node + '\n' +
    'Locale   : ' + info.locale + '\n' +
    'Keychain : ' + (info.safeStorage ? 'available' : 'unavailable');
}

document.addEventListener('DOMContentLoaded', () => {
  render();
  document.getElementById('a-home').addEventListener('click', () => api.invoke('shell:open', 'https://yeoulgame.com'));
  document.getElementById('a-github').addEventListener('click', () =>
    api.invoke('shell:open', 'https://github.com/yeoulgame/yeoulgame-ssh-client'));
  document.getElementById('a-license').addEventListener('click', () =>
    api.invoke('shell:open', 'https://opensource.org/licenses/MIT'));
  document.getElementById('a-verify').addEventListener('click', () =>
    api.invoke('shell:open', 'https://yeoulgame.com/board/files/5'));
  document.getElementById('a-close').addEventListener('click', () => api.invoke('window:closeAbout'));

  api.on('i18n:changed', () => render());
});
