/*
 * Yeoulgame SSH Client v1.0
 * Copyright © 2026 Yeoulgame (yeoulgame.com)
 * Licensed under MIT License
 * https://opensource.org/licenses/MIT
 *
 * store.js - 설정 / 세션 / known-hosts 영구 저장
 *   Windows: %APPDATA%\Yeoulgame SSH Client
 *   Linux:   ~/.config/Yeoulgame SSH Client
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DEFAULT_SETTINGS = {
  language: 'auto',            // auto | ko | en | ja | zh-CN | de
  theme: 'dark',               // dark | light
  fontFamily: '',              // 빈 값이면 OS별 기본 한글 고정폭 폰트
  fontSize: 14,
  scrollback: 1000,
  cursorBlink: true,
  keepAlive: true,
  keepAliveInterval: 60,       // 초
  autoReconnect: true,
  reconnectMaxRetries: 5,
  connectTimeout: 0,           // 0 = 무제한(기본: 없음)
  encoding: 'auto',            // auto | utf8 | euc-kr
  sendLocaleEnv: true,
  copyOnSelect: false,
  rightClickPaste: true,
  showQuickBar: true,
  checkUpdates: true,
  quickCommands: [
    { id: 'qc-server', labelKey: 'quick.serverStatus', command: 'ps aux | grep game' },
    { id: 'qc-log', labelKey: 'quick.viewLog', command: 'tail -f /var/log/game.log' },
    { id: 'qc-disk', labelKey: 'quick.diskUsage', command: 'df -h' },
    { id: 'qc-mem', labelKey: 'quick.memoryUsage', command: 'free -h' },
    { id: 'qc-proc', labelKey: 'quick.processList', command: 'ps aux' },
    { id: 'qc-net', labelKey: 'quick.networkStatus', command: 'netstat -an' }
  ]
};

const SECRET_FIELDS = ['password', 'passphrase'];

class Store {
  constructor(userDataDir, cryptoStore) {
    this.dir = userDataDir;
    this.crypto = cryptoStore;
    this.settingsFile = path.join(userDataDir, 'settings.json');
    this.sessionsFile = path.join(userDataDir, 'sessions.json');
    this.hostsFile = path.join(userDataDir, 'known_hosts.json');
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  _readJson(file, fallback) {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      return fallback;
    }
  }

  _writeJson(file, data) {
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tmp, file);
  }

  // ---------- 설정 ----------
  getSettings() {
    const saved = this._readJson(this.settingsFile, {});
    const merged = { ...DEFAULT_SETTINGS, ...saved };
    if (!Array.isArray(merged.quickCommands) || merged.quickCommands.length === 0) {
      merged.quickCommands = DEFAULT_SETTINGS.quickCommands.map((q) => ({ ...q }));
    }
    return merged;
  }

  setSettings(patch) {
    const next = { ...this.getSettings(), ...(patch || {}) };
    this._writeJson(this.settingsFile, next);
    return next;
  }

  // ---------- 세션 ----------
  /** 렌더러로 내보낼 때는 비밀정보를 제거하고 보유 여부만 알린다 */
  listSessions() {
    const raw = this._readJson(this.sessionsFile, []);
    return raw.map((s) => {
      const out = { ...s };
      for (const f of SECRET_FIELDS) {
        out['has' + f[0].toUpperCase() + f.slice(1)] = !!out[f];
        delete out[f];
      }
      return out;
    });
  }

  _rawSessions() {
    return this._readJson(this.sessionsFile, []);
  }

  getSessionForConnect(id) {
    const s = this._rawSessions().find((x) => x.id === id);
    if (!s) return null;
    const out = { ...s };
    for (const f of SECRET_FIELDS) {
      out[f] = s[f] ? this.crypto.decrypt(s[f]) : '';
    }
    return out;
  }

  saveSession(session) {
    const all = this._rawSessions();
    const idx = all.findIndex((x) => x.id === session.id);
    const prev = idx >= 0 ? all[idx] : {};
    const next = { ...prev, ...session };

    for (const f of SECRET_FIELDS) {
      if (session[f] === undefined) {
        next[f] = prev[f] || '';           // 변경 없음 -> 기존 암호문 유지
      } else if (session[f] === '') {
        next[f] = '';                       // 명시적 삭제
      } else {
        next[f] = this.crypto.encrypt(session[f]);
      }
    }

    if (!next.id) next.id = 'ses-' + crypto.randomBytes(6).toString('hex');
    next.updatedAt = new Date().toISOString();
    if (!next.createdAt) next.createdAt = next.updatedAt;

    if (idx >= 0) all[idx] = next;
    else all.push(next);
    this._writeJson(this.sessionsFile, all);
    return next.id;
  }

  deleteSession(id) {
    const all = this._rawSessions().filter((x) => x.id !== id);
    this._writeJson(this.sessionsFile, all);
    return true;
  }

  duplicateSession(id, newName) {
    const all = this._rawSessions();
    const src = all.find((x) => x.id === id);
    if (!src) return null;
    const copy = { ...src, id: 'ses-' + crypto.randomBytes(6).toString('hex'), name: newName };
    copy.createdAt = copy.updatedAt = new Date().toISOString();
    all.push(copy);
    this._writeJson(this.sessionsFile, all);
    return copy.id;
  }

  reorderSessions(ids) {
    const all = this._rawSessions();
    const map = new Map(all.map((s) => [s.id, s]));
    const next = ids.map((i) => map.get(i)).filter(Boolean);
    for (const s of all) if (!ids.includes(s.id)) next.push(s);
    this._writeJson(this.sessionsFile, next);
    return true;
  }

  /** 내보내기: 비밀번호/패스프레이즈는 절대 포함하지 않는다 */
  exportSessions() {
    return {
      app: 'yeoulgame-ssh-client',
      version: 1,
      exportedAt: new Date().toISOString(),
      note: 'Credentials are intentionally excluded from exports.',
      sessions: this._rawSessions().map((s) => {
        const o = { ...s };
        for (const f of SECRET_FIELDS) delete o[f];
        return o;
      })
    };
  }

  importSessions(payload) {
    if (!payload || !Array.isArray(payload.sessions)) return 0;
    const all = this._rawSessions();
    let count = 0;
    for (const s of payload.sessions) {
      if (!s || !s.host) continue;
      const item = { ...s };
      for (const f of SECRET_FIELDS) delete item[f];
      item.id = 'ses-' + crypto.randomBytes(6).toString('hex');
      item.createdAt = item.updatedAt = new Date().toISOString();
      all.push(item);
      count++;
    }
    this._writeJson(this.sessionsFile, all);
    return count;
  }

  // ---------- known hosts ----------
  getHostKey(host, port) {
    const hosts = this._readJson(this.hostsFile, {});
    return hosts[`${host}:${port}`] || null;
  }

  setHostKey(host, port, fingerprint) {
    const hosts = this._readJson(this.hostsFile, {});
    hosts[`${host}:${port}`] = { fingerprint, addedAt: new Date().toISOString() };
    this._writeJson(this.hostsFile, hosts);
  }

  removeHostKey(host, port) {
    const hosts = this._readJson(this.hostsFile, {});
    delete hosts[`${host}:${port}`];
    this._writeJson(this.hostsFile, hosts);
  }
}

module.exports = { Store, DEFAULT_SETTINGS };
