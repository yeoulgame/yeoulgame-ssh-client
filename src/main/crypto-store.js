/*
 * Yeoulgame SSH Client v1.0
 * Copyright © 2026 Yeoulgame (yeoulgame.com)
 * Licensed under MIT License
 * https://opensource.org/licenses/MIT
 *
 * crypto-store.js - 자격증명 암호화 보관 (safeStorage / AES-256-GCM + 마스터 비밀번호)
 */
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const MAGIC_SAFE = 'ysc-safe:';
const MAGIC_AES = 'ysc-aes1:';

class CryptoStore {
  /**
   * @param {string} userDataDir Electron userData 경로
   * @param {import('electron').SafeStorage|null} safeStorage
   */
  constructor(userDataDir, safeStorage) {
    this.dir = userDataDir;
    this.safeStorage = safeStorage || null;
    this.vaultFile = path.join(userDataDir, 'vault.json');
    this.masterKey = null; // Buffer, 마스터 비밀번호 사용 시에만
    this.vault = this._readVault();
  }

  _readVault() {
    try {
      return JSON.parse(fs.readFileSync(this.vaultFile, 'utf8'));
    } catch {
      return { masterEnabled: false, salt: null, verifier: null };
    }
  }

  _writeVault() {
    fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(this.vaultFile, JSON.stringify(this.vault, null, 2), { mode: 0o600 });
  }

  get masterEnabled() {
    return !!this.vault.masterEnabled;
  }

  get unlocked() {
    return !this.masterEnabled || !!this.masterKey;
  }

  /** OS 키체인 사용 가능 여부 */
  get safeAvailable() {
    try {
      return !!(this.safeStorage && this.safeStorage.isEncryptionAvailable());
    } catch {
      return false;
    }
  }

  _deriveKey(password, salt) {
    return crypto.scryptSync(password, Buffer.from(salt, 'base64'), 32, { N: 16384, r: 8, p: 1 });
  }

  /** 마스터 비밀번호 설정 / 해제 (password === null 이면 해제) */
  setMasterPassword(password) {
    if (!password) {
      this.vault = { masterEnabled: false, salt: null, verifier: null };
      this.masterKey = null;
      this._writeVault();
      return { ok: true, masterEnabled: false };
    }
    const salt = crypto.randomBytes(16).toString('base64');
    const key = this._deriveKey(password, salt);
    const verifier = this._aesEncrypt('yeoulgame-ssh-client', key);
    this.vault = { masterEnabled: true, salt, verifier };
    this.masterKey = key;
    this._writeVault();
    return { ok: true, masterEnabled: true };
  }

  unlock(password) {
    if (!this.masterEnabled) return { ok: true };
    try {
      const key = this._deriveKey(password, this.vault.salt);
      const plain = this._aesDecrypt(this.vault.verifier, key);
      if (plain !== 'yeoulgame-ssh-client') return { ok: false };
      this.masterKey = key;
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }

  lock() {
    this.masterKey = null;
  }

  _aesEncrypt(plain, key) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return MAGIC_AES + Buffer.concat([iv, tag, enc]).toString('base64');
  }

  _aesDecrypt(payload, key) {
    const raw = Buffer.from(String(payload).slice(MAGIC_AES.length), 'base64');
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const data = raw.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }

  /**
   * 평문 -> 암호문 문자열. 빈 값은 그대로 빈 문자열.
   * 우선순위: 마스터 비밀번호(AES) > OS 키체인(safeStorage) > 저장 거부
   */
  encrypt(plain) {
    if (plain === undefined || plain === null || plain === '') return '';
    if (this.masterEnabled) {
      if (!this.masterKey) throw new Error('VAULT_LOCKED');
      return this._aesEncrypt(plain, this.masterKey);
    }
    if (this.safeAvailable) {
      return MAGIC_SAFE + this.safeStorage.encryptString(String(plain)).toString('base64');
    }
    // 암호화 수단이 없으면 저장하지 않는다 (평문 저장 금지)
    throw new Error('NO_ENCRYPTION_BACKEND');
  }

  decrypt(payload) {
    if (!payload) return '';
    const s = String(payload);
    try {
      if (s.startsWith(MAGIC_AES)) {
        if (!this.masterKey) throw new Error('VAULT_LOCKED');
        return this._aesDecrypt(s, this.masterKey);
      }
      if (s.startsWith(MAGIC_SAFE)) {
        if (!this.safeAvailable) throw new Error('NO_ENCRYPTION_BACKEND');
        return this.safeStorage.decryptString(Buffer.from(s.slice(MAGIC_SAFE.length), 'base64'));
      }
    } catch (e) {
      if (e && e.message === 'VAULT_LOCKED') throw e;
      return '';
    }
    return '';
  }

  /** 저장 가능한 상태인지 */
  canStoreSecrets() {
    return this.masterEnabled ? !!this.masterKey : this.safeAvailable;
  }
}

module.exports = { CryptoStore };
