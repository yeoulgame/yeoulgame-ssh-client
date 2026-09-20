/*
 * Yeoulgame SSH Client v1.0
 * Copyright © 2026 Yeoulgame (yeoulgame.com)
 * Licensed under MIT License
 * https://opensource.org/licenses/MIT
 *
 * encoding.js - 한글 인코딩 자동 감지 및 스트림 디코딩 (UTF-8 / EUC-KR·CP949)
 *
 * 핵심 요구사항 (RFP 2.1.2): 한글 출력 깨짐 절대 없음.
 *  - 청크 경계에서 잘린 멀티바이트 문자를 보존한다.
 *  - auto 모드에서는 첫 비ASCII 바이트열을 검사해 UTF-8 / EUC-KR 을 1회 확정한다.
 */
'use strict';

const iconv = require('iconv-lite');
const { StringDecoder } = require('node:string_decoder');

/** 버퍼 끝에 걸친 불완전 UTF-8 시퀀스를 잘라낸다 */
function trimPartialUtf8(buf) {
  let i = buf.length - 1;
  let cont = 0;
  while (i >= 0 && cont < 3 && (buf[i] & 0xc0) === 0x80) {
    i--;
    cont++;
  }
  if (i < 0) return buf;
  const lead = buf[i];
  let need = 1;
  if (lead >= 0xf0) need = 4;
  else if (lead >= 0xe0) need = 3;
  else if (lead >= 0xc0) need = 2;
  if (need > 1 && cont + 1 < need) return buf.subarray(0, i);
  return buf;
}

function isValidUtf8(buf) {
  if (typeof Buffer.isUtf8 === 'function') return Buffer.isUtf8(buf);
  return Buffer.compare(Buffer.from(buf.toString('utf8'), 'utf8'), buf) === 0;
}

/** EUC-KR(CP949) 에서 청크 끝에 걸친 2바이트 문자의 안전 절단 위치 */
function safeCp949Cut(buf) {
  let i = 0;
  while (i < buf.length) {
    const b = buf[i];
    if (b >= 0x81 && b <= 0xfe) {
      if (i + 1 >= buf.length) return i; // 선행 바이트만 도착
      i += 2;
    } else {
      i += 1;
    }
  }
  return buf.length;
}

class StreamDecoder {
  /** @param {'auto'|'utf8'|'euc-kr'} mode */
  constructor(mode) {
    this.mode = mode || 'auto';
    this.encoding = this.mode === 'auto' ? 'utf8' : this.mode;
    this.locked = this.mode !== 'auto';
    this.hold = Buffer.alloc(0); // auto 모드에서 판별 전까지 보류하는 바이트
    this._reset();
  }

  _reset() {
    this.sd = this.encoding === 'utf8' ? new StringDecoder('utf8') : null;
    this.pending = Buffer.alloc(0);
  }

  get detected() {
    return this.encoding;
  }

  /** 인코딩이 확정된 뒤의 일반 디코딩 */
  _decodeLocked(chunk) {
    if (this.encoding === 'utf8') return this.sd.write(chunk);
    const buf = this.pending.length ? Buffer.concat([this.pending, chunk]) : chunk;
    const cut = safeCp949Cut(buf);
    this.pending = Buffer.from(buf.subarray(cut));
    return cut ? iconv.decode(buf.subarray(0, cut), 'cp949') : '';
  }

  decode(chunk) {
    if (!Buffer.isBuffer(chunk)) chunk = Buffer.from(chunk);
    if (this.locked) return this._decodeLocked(chunk);

    // --- auto 판별 단계 ---
    this.hold = this.hold.length ? Buffer.concat([this.hold, chunk]) : chunk;

    let high = -1;
    for (let i = 0; i < this.hold.length; i++) {
      if (this.hold[i] >= 0x80) {
        high = i;
        break;
      }
    }

    // 아직 ASCII 뿐이면 두 인코딩에서 동일하므로 그대로 내보낸다
    if (high === -1) {
      const out = this.hold.toString('utf8');
      this.hold = Buffer.alloc(0);
      return out;
    }

    const ascii = this.hold.subarray(0, high).toString('utf8');
    const rest = Buffer.from(this.hold.subarray(high));
    const probe = trimPartialUtf8(rest);

    // 아직 판별하기에 바이트가 모자라면(멀티바이트 문자가 청크 경계에 걸림) 보류
    if (probe.length === 0) {
      this.hold = rest;
      return ascii;
    }

    this.encoding = isValidUtf8(probe) ? 'utf8' : 'euc-kr';
    this.locked = true;
    this.hold = Buffer.alloc(0);
    this._reset();
    return ascii + this._decodeLocked(rest);
  }

  /** 문자열 -> 서버로 보낼 바이트 */
  encode(str) {
    if (this.encoding === 'utf8') return Buffer.from(str, 'utf8');
    return iconv.encode(str, 'cp949');
  }
}

module.exports = { StreamDecoder, trimPartialUtf8, isValidUtf8, safeCp949Cut };
