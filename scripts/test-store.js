/*
 * Yeoulgame SSH Client v1.0
 * Copyright © 2026 Yeoulgame (yeoulgame.com)
 * Licensed under MIT License
 *
 * test-store.js - 자격증명 암호화 및 세션 저장소 회귀 테스트 (RFP 2.1.6 / 3.1)
 *   OS 키체인 없이(safeStorage = null) 마스터 비밀번호 경로를 검증한다.
 *   실행: node scripts/test-store.js
 */
'use strict';

const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const { CryptoStore } = require('../src/main/crypto-store');
const { Store } = require('../src/main/store');

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) {
    pass++;
    console.log('  PASS  ' + name);
  } else {
    fail++;
    console.error('  FAIL  ' + name);
  }
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ysc-test-'));

console.log('\n[1] 암호화 백엔드가 없을 때');
let cs = new CryptoStore(dir, null);
let refused = false;
try {
  cs.encrypt('secret');
} catch (e) {
  refused = e.message === 'NO_ENCRYPTION_BACKEND';
}
check('평문 저장을 거부한다', refused);

console.log('\n[2] 마스터 비밀번호 (scrypt + AES-256-GCM)');
cs.setMasterPassword('yeoul-1234');
const enc = cs.encrypt('p@ssw0rd 한글비번');
check('AES-GCM 암호문 형식', enc.startsWith('ysc-aes1:'));
check('복호화 일치', cs.decrypt(enc) === 'p@ssw0rd 한글비번');
check('암호문에 평문 미포함', !enc.includes('p@ssw0rd'));

console.log('\n[3] 잠금 / 해제');
cs.lock();
check('잠금 상태', cs.unlocked === false);
check('틀린 비밀번호 거부', cs.unlock('wrong').ok === false);
check('올바른 비밀번호로 해제', cs.unlock('yeoul-1234').ok === true);
check('해제 후 복호화', cs.decrypt(enc) === 'p@ssw0rd 한글비번');

console.log('\n[4] 재시작 시뮬레이션');
const cs2 = new CryptoStore(dir, null);
check('vault 설정 영속', cs2.masterEnabled === true);
check('재시작 후 복호화', cs2.unlock('yeoul-1234').ok && cs2.decrypt(enc) === 'p@ssw0rd 한글비번');

console.log('\n[5] 세션 저장소');
const st = new Store(dir, cs2);
const id = st.saveSession({
  name: '여울 머드',
  host: 'mud.yeoulgame.com',
  port: 22,
  username: 'game',
  password: '비밀1234',
  encoding: 'euc-kr'
});
const list = st.listSessions();
check('목록에 비밀번호 미노출', list.length === 1 && list[0].hasPassword === true && list[0].password === undefined);
check('연결용 조회 시 복호화', st.getSessionForConnect(id).password === '비밀1234');
check('디스크에 평문 없음', !fs.readFileSync(path.join(dir, 'sessions.json'), 'utf8').includes('비밀1234'));
const ex = st.exportSessions();
check('내보내기에서 비밀번호 제외', ex.sessions[0].password === undefined && !JSON.stringify(ex).includes('비밀1234'));
st.saveSession({ id, name: '여울 머드2' });
check('비밀번호 미지정 시 기존 값 유지', st.getSessionForConnect(id).password === '비밀1234');
st.saveSession({ id, password: '' });
check('빈 문자열로 비밀번호 삭제', st.getSessionForConnect(id).password === '');

console.log('\n[6] known hosts');
st.setHostKey('a.com', 22, 'SHA256:abc');
check('호스트 키 저장', st.getHostKey('a.com', 22).fingerprint === 'SHA256:abc');
st.removeHostKey('a.com', 22);
check('호스트 키 삭제', st.getHostKey('a.com', 22) === null);

console.log('\n[7] 기본 설정값');
const s = st.getSettings();
check('keep-alive 60초', s.keepAliveInterval === 60);
check('스크롤백 1000줄', s.scrollback === 1000);
check('빠른 명령어 6개', s.quickCommands.length === 6);
check('기본 인코딩 auto', s.encoding === 'auto');

fs.rmSync(dir, { recursive: true, force: true });

console.log('\n결과: 총 ' + (pass + fail) + '건, 통과 ' + pass + ', 실패 ' + fail);
process.exit(fail ? 1 : 0);
