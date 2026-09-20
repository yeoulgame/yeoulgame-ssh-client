/*
 * Yeoulgame SSH Client v1.0
 * Copyright © 2026 Yeoulgame (yeoulgame.com)
 * Licensed under MIT License
 *
 * test-encoding.js - 한글 인코딩 회귀 테스트 (RFP 2.1.2 "한글 출력 깨짐 없음")
 *   SSH 스트림은 임의의 바이트 경계로 쪼개져 도착하므로,
 *   1바이트씩 쪼개 넣어도 한글이 복원되는지 확인한다.
 *   실행: node scripts/test-encoding.js
 */
'use strict';

const iconv = require('iconv-lite');
const { StreamDecoder } = require('../src/main/encoding');

let pass = 0;
let fail = 0;

function check(name, got, want) {
  if (got === want) {
    pass++;
    console.log('  PASS  ' + name);
  } else {
    fail++;
    console.error('  FAIL  ' + name + '\n        got  = ' + JSON.stringify(got) + '\n        want = ' + JSON.stringify(want));
  }
}

function feed(buf, step, mode) {
  const d = new StreamDecoder(mode || 'auto');
  let out = '';
  for (let i = 0; i < buf.length; i += step) out += d.decode(buf.subarray(i, i + step));
  return { out, enc: d.detected };
}

const STEPS = [1, 2, 3, 5, 7, 64];

console.log('\n[1] UTF-8 한글 - 청크 경계 분할');
const KR_UTF = '한글 테스트 디렉토리\n계속되는 한글 출력 · 가나다라마바사';
for (const s of STEPS) {
  const r = feed(Buffer.from(KR_UTF, 'utf8'), s);
  check(s + '바이트씩 (감지: ' + r.enc + ')', r.out, KR_UTF);
}

console.log('\n[2] EUC-KR(CP949) 한글 - 자동 감지 + 경계 분할');
const KR_EUC = '한글 깨짐 없음 테스트 / 여울 게임터 머드 접속';
for (const s of STEPS) {
  const r = feed(iconv.encode(KR_EUC, 'cp949'), s);
  check(s + '바이트씩 (감지: ' + r.enc + ')', r.out, KR_EUC);
}

console.log('\n[3] 4바이트 문자(이모지) 및 박스 문자');
const EMOJI = '🎮게임🎮 ✓ ─┼─ ░▒▓';
for (const s of [1, 2, 3, 4, 5]) {
  const r = feed(Buffer.from(EMOJI, 'utf8'), s);
  check(s + '바이트씩 (감지: ' + r.enc + ')', r.out, EMOJI);
}

console.log('\n[4] ASCII 프롬프트 뒤에 EUC-KR 한글이 오는 경우');
{
  const d = new StreamDecoder('auto');
  let out = d.decode(Buffer.from('$ ls -la\r\ntotal 12\r\n', 'utf8'));
  const k = iconv.encode('테스트 폴더\r\n', 'cp949');
  for (let i = 0; i < k.length; i++) out += d.decode(k.subarray(i, i + 1));
  check('감지: ' + d.detected, out, '$ ls -la\r\ntotal 12\r\n테스트 폴더\r\n');
}

console.log('\n[5] 인코딩 수동 지정');
{
  const d = new StreamDecoder('euc-kr');
  let out = '';
  const k = iconv.encode('명시 EUC-KR 출력', 'cp949');
  for (let i = 0; i < k.length; i++) out += d.decode(k.subarray(i, i + 1));
  check('euc-kr 고정', out, '명시 EUC-KR 출력');
}
{
  const d = new StreamDecoder('utf8');
  let out = '';
  const k = Buffer.from('명시 UTF-8 출력', 'utf8');
  for (let i = 0; i < k.length; i++) out += d.decode(k.subarray(i, i + 1));
  check('utf8 고정', out, '명시 UTF-8 출력');
}

console.log('\n[6] ANSI 이스케이프 + 한글 혼합');
{
  const s = '\x1b[32m초록 한글\x1b[0m 끝 \x1b[1;31m빨강 오류\x1b[0m';
  const r = feed(Buffer.from(s, 'utf8'), 3);
  check('색상 코드 보존', r.out, s);
}

console.log('\n[7] 입력 인코딩 (키보드 → 서버)');
{
  const d = new StreamDecoder('euc-kr');
  check('euc-kr 인코딩', d.encode('한글').toString('hex'), iconv.encode('한글', 'cp949').toString('hex'));
  const u = new StreamDecoder('utf8');
  check('utf8 인코딩', u.encode('한글').toString('hex'), Buffer.from('한글', 'utf8').toString('hex'));
}

console.log('\n결과: 총 ' + (pass + fail) + '건, 통과 ' + pass + ', 실패 ' + fail);
process.exit(fail ? 1 : 0);
