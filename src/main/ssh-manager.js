/*
 * Yeoulgame SSH Client v1.0
 * Copyright © 2026 Yeoulgame (yeoulgame.com)
 * Licensed under MIT License
 * https://opensource.org/licenses/MIT
 *
 * ssh-manager.js - SSH2 연결 관리 (keep-alive, 자동 재연결, 한글 인코딩)
 */
'use strict';

const fs = require('node:fs');
const crypto = require('node:crypto');
const { Client } = require('ssh2');
const { StreamDecoder } = require('./encoding');

const LOCALE_ENV = {
  ko: 'ko_KR.UTF-8',
  en: 'en_US.UTF-8',
  ja: 'ja_JP.UTF-8',
  'zh-CN': 'zh_CN.UTF-8',
  de: 'de_DE.UTF-8'
};

class SshSession {
  /**
   * @param {string} id 탭 ID
   * @param {object} cfg 연결 설정
   * @param {(type:string, payload:object)=>void} emit 렌더러 전송 콜백
   * @param {object} deps { store }
   */
  constructor(id, cfg, emit, deps) {
    this.id = id;
    this.cfg = cfg;
    this.emit = emit;
    this.store = deps.store;
    this.conn = null;
    this.stream = null;
    this.decoder = new StreamDecoder(cfg.encoding || 'auto');
    this.closedByUser = false;
    this.retries = 0;
    this.retryTimer = null;
    this.connectedAt = null;
    this.status = 'idle';
  }

  _send(type, payload) {
    this.emit(type, { id: this.id, ...(payload || {}) });
  }

  _setStatus(status, extra) {
    this.status = status;
    this._send('status', { status, ...(extra || {}) });
  }

  connect() {
    clearTimeout(this.retryTimer);
    this.closedByUser = false;
    this._setStatus('connecting');

    const cfg = this.cfg;
    const conn = new Client();
    this.conn = conn;

    conn.on('ready', () => {
      this.retries = 0;
      this.connectedAt = Date.now();
      this._openShell();
    });

    conn.on('banner', (msg) => {
      this._send('data', { data: String(msg).replace(/\r?\n/g, '\r\n') });
    });

    conn.on('keyboard-interactive', (name, instructions, lang, prompts, finish) => {
      // 대화형 인증: 저장된 비밀번호가 있으면 그대로 응답
      if (cfg.password) finish(prompts.map(() => cfg.password));
      else finish([]);
    });

    conn.on('error', (err) => {
      this._setStatus('error', { message: err && err.message ? err.message : String(err), code: err && err.code });
      this._scheduleReconnect();
    });

    conn.on('close', () => {
      if (this.status !== 'error') this._setStatus('disconnected');
      this.stream = null;
      this._scheduleReconnect();
    });

    const opts = {
      host: cfg.host,
      port: Number(cfg.port) || 22,
      username: cfg.username,
      readyTimeout: cfg.connectTimeout && Number(cfg.connectTimeout) > 0 ? Number(cfg.connectTimeout) * 1000 : 0,
      keepaliveInterval: cfg.keepAlive === false ? 0 : (Number(cfg.keepAliveInterval) || 60) * 1000,
      keepaliveCountMax: 5,
      hostVerifier: (key) => this._verifyHost(key)
    };

    if (cfg.authType === 'key' && cfg.keyPath) {
      try {
        opts.privateKey = fs.readFileSync(cfg.keyPath);
        if (cfg.passphrase) opts.passphrase = cfg.passphrase;
      } catch (e) {
        this._setStatus('error', { message: 'KEY_READ_FAILED', detail: e.message });
        return;
      }
    } else if (cfg.authType === 'agent') {
      opts.agent = process.env.SSH_AUTH_SOCK || (process.platform === 'win32' ? 'pageant' : undefined);
    } else {
      opts.password = cfg.password || '';
      opts.tryKeyboard = true;
    }

    try {
      conn.connect(opts);
    } catch (e) {
      this._setStatus('error', { message: e.message });
    }
  }

  _verifyHost(key) {
    const buf = Buffer.isBuffer(key) ? key : Buffer.from(key);
    const fp = 'SHA256:' + crypto.createHash('sha256').update(buf).digest('base64').replace(/=+$/, '');
    const known = this.store.getHostKey(this.cfg.host, Number(this.cfg.port) || 22);
    if (!known) {
      this.store.setHostKey(this.cfg.host, Number(this.cfg.port) || 22, fp);
      this._send('hostkey', { state: 'new', fingerprint: fp });
      return true;
    }
    if (known.fingerprint !== fp) {
      this._send('hostkey', { state: 'changed', fingerprint: fp, previous: known.fingerprint });
      return false; // 호스트 키 변경 시 연결 거부 (중간자 공격 방지)
    }
    return true;
  }

  _openShell() {
    const cfg = this.cfg;
    const shellOpts = {
      term: 'xterm-256color',
      cols: cfg.cols || 80,
      rows: cfg.rows || 24
    };
    if (cfg.sendLocaleEnv !== false) {
      const loc = LOCALE_ENV[cfg.uiLanguage] || 'ko_KR.UTF-8';
      shellOpts.env = { LANG: loc, LC_ALL: loc, LC_CTYPE: loc };
    }

    this.conn.shell(shellOpts, (err, stream) => {
      if (err) {
        this._setStatus('error', { message: err.message });
        return;
      }
      this.stream = stream;
      this._setStatus('connected', { host: cfg.host, port: cfg.port, username: cfg.username, connectedAt: this.connectedAt });

      stream.on('data', (chunk) => {
        const text = this.decoder.decode(chunk);
        if (text) this._send('data', { data: text, encoding: this.decoder.detected });
      });
      stream.stderr && stream.stderr.on('data', (chunk) => {
        const text = this.decoder.decode(chunk);
        if (text) this._send('data', { data: text, encoding: this.decoder.detected });
      });
      stream.on('close', () => {
        this.stream = null;
        if (this.conn) this.conn.end();
      });
    });
  }

  _scheduleReconnect() {
    if (this.closedByUser) return;
    if (this.cfg.autoReconnect === false) return;
    const max = Number(this.cfg.reconnectMaxRetries) || 5;
    if (this.retries >= max) {
      this._setStatus('give-up', { retries: this.retries });
      return;
    }
    this.retries += 1;
    const delay = Math.min(30000, 2000 * this.retries);
    this._setStatus('reconnecting', { attempt: this.retries, max, delay });
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => this.connect(), delay);
  }

  write(data) {
    if (!this.stream) return false;
    this.stream.write(this.decoder.encode(data));
    return true;
  }

  resize(cols, rows) {
    this.cfg.cols = cols;
    this.cfg.rows = rows;
    if (this.stream) {
      try {
        this.stream.setWindow(rows, cols, 0, 0);
      } catch { /* 연결 종료 직후 무시 */ }
    }
  }

  setEncoding(mode) {
    this.cfg.encoding = mode;
    this.decoder = new StreamDecoder(mode);
    this._send('status', { status: this.status, encoding: this.decoder.detected });
  }

  disconnect() {
    this.closedByUser = true;
    clearTimeout(this.retryTimer);
    try {
      if (this.stream) this.stream.end();
      if (this.conn) this.conn.end();
    } catch { /* noop */ }
    this._setStatus('disconnected');
  }

  destroy() {
    this.closedByUser = true;
    clearTimeout(this.retryTimer);
    try {
      if (this.conn) this.conn.destroy();
    } catch { /* noop */ }
    this.conn = null;
    this.stream = null;
  }
}

class SshManager {
  constructor(deps) {
    this.sessions = new Map();
    this.deps = deps;
    this.emit = () => {};
  }

  setEmitter(fn) {
    this.emit = fn;
  }

  connect(id, cfg) {
    this.close(id);
    const s = new SshSession(id, cfg, (type, payload) => this.emit(type, payload), this.deps);
    this.sessions.set(id, s);
    s.connect();
    return true;
  }

  get(id) {
    return this.sessions.get(id) || null;
  }

  write(id, data) {
    const s = this.get(id);
    return s ? s.write(data) : false;
  }

  resize(id, cols, rows) {
    const s = this.get(id);
    if (s) s.resize(cols, rows);
  }

  setEncoding(id, mode) {
    const s = this.get(id);
    if (s) s.setEncoding(mode);
  }

  disconnect(id) {
    const s = this.get(id);
    if (s) s.disconnect();
  }

  reconnect(id) {
    const s = this.get(id);
    if (s) {
      s.retries = 0;
      s.connect();
    }
  }

  close(id) {
    const s = this.get(id);
    if (s) {
      s.destroy();
      this.sessions.delete(id);
    }
  }

  closeAll() {
    for (const id of Array.from(this.sessions.keys())) this.close(id);
  }
}

module.exports = { SshManager, SshSession };
