/*
 * Yeoulgame SSH Client v1.0
 * Copyright © 2026 Yeoulgame (yeoulgame.com)
 * Licensed under MIT License
 *
 * sign-release.js - OpenSSL 자체 서명 (YSC-2026-001 결정사항 2번)
 *
 *   1) signing/ 에 코드 서명용 자체 서명 인증서가 없으면 OpenSSL 로 생성
 *   2) release/ 의 모든 배포 파일에 detached 서명(.sig) 생성
 *   3) Windows 에서 signtool 이 있으면 .exe 에 Authenticode(자체 서명) 적용
 *   4) 공개 인증서와 검증 가이드(SIGNATURE.md)를 release/ 에 함께 배치
 *
 *   사용법:
 *     node scripts/sign-release.js            서명
 *     node scripts/sign-release.js --cert-only  인증서만 생성
 *
 *   환경변수:
 *     YSC_PFX_PASSWORD   PFX 비밀번호 (기본: yeoulgame)
 *
 *   ⚠ 자체 서명은 공인 CA 인증서가 아닙니다.
 *     Windows SmartScreen 경고는 그대로 표시됩니다 (연구팀 결정에 따라 수용).
 *     이 서명의 실제 효용은 "배포 후 파일이 변조되지 않았음"을 공개키로 증명하는 것입니다.
 *     따라서 사용자는 반드시 공개 인증서 지문(SHA-256)을 공식 배포처와 대조해야 합니다.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync, spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const SIGN_DIR = path.join(ROOT, 'signing');
const RELEASE_DIR = path.join(ROOT, 'release');

const KEY_FILE = path.join(SIGN_DIR, 'yeoulgame-codesign.key');
const CERT_FILE = path.join(SIGN_DIR, 'yeoulgame-codesign.crt');
const PFX_FILE = path.join(SIGN_DIR, 'yeoulgame-codesign.pfx');
const PFX_PASSWORD = process.env.YSC_PFX_PASSWORD || 'yeoulgame';

const SUBJECT = '/C=KR/O=Yeoulgame/OU=Yeoulgame Research Team/CN=Yeoulgame SSH Client';
const VALID_DAYS = 3650;
const SIGN_EXT = ['.exe', '.zip', '.AppImage', '.deb', '.rpm', '.snap'];

/* ------------------------------------------------------------------ */

function run(cmd, args, opts) {
  return execFileSync(cmd, args, { stdio: 'pipe', ...opts });
}

function has(cmd) {
  const probe = spawnSync(cmd, ['version'], { stdio: 'ignore' });
  return !probe.error;
}

function certExists() {
  return fs.existsSync(KEY_FILE) && fs.existsSync(CERT_FILE) && fs.existsSync(PFX_FILE);
}

/**
 * 인증서 "생성" 에만 openssl 이 필요하다.
 * 이미 인증서가 있으면 서명·검증은 Node 내장 crypto 로 처리하므로 openssl 이 없어도 된다.
 */
function requireOpensslForCertCreation() {
  if (has('openssl')) return;
  console.error('✗ 서명 인증서가 없고 openssl 도 찾을 수 없습니다.');
  console.error('  인증서를 새로 만들려면 openssl 이 필요합니다:');
  console.error('  Windows : winget install ShiningLight.OpenSSL.Light  (또는 Git for Windows 의 openssl)');
  console.error('  Ubuntu  : sudo apt install openssl');
  console.error('  Fedora  : sudo dnf install openssl');
  console.error('');
  console.error('  이미 발급된 인증서가 있다면 signing/ 폴더에 아래 3개를 넣어주세요.');
  console.error('    yeoulgame-codesign.key / .crt / .pfx');
  process.exit(1);
}

/** 코드 서명용 자체 서명 인증서 생성 */
function ensureCertificate() {
  fs.mkdirSync(SIGN_DIR, { recursive: true });

  if (certExists()) {
    console.log('· 기존 서명 인증서를 사용합니다: signing/yeoulgame-codesign.crt');
    return;
  }

  requireOpensslForCertCreation();

  console.log('· 자체 서명 코드 서명 인증서를 생성합니다 (RSA 3072, 유효기간 ' + VALID_DAYS + '일)');

  const extFile = path.join(SIGN_DIR, 'codesign.ext');
  fs.writeFileSync(
    extFile,
    [
      'basicConstraints=critical,CA:FALSE',
      'keyUsage=critical,digitalSignature',
      'extendedKeyUsage=critical,codeSigning',
      'subjectKeyIdentifier=hash',
      'nsComment="Yeoulgame SSH Client self-signed code signing certificate"'
    ].join('\n') + '\n',
    'utf8'
  );

  run('openssl', ['genrsa', '-out', KEY_FILE, '3072']);
  const csrFile = path.join(SIGN_DIR, 'codesign.csr');
  run('openssl', ['req', '-new', '-key', KEY_FILE, '-out', csrFile, '-subj', SUBJECT]);
  run('openssl', [
    'x509', '-req', '-in', csrFile, '-signkey', KEY_FILE, '-out', CERT_FILE,
    '-days', String(VALID_DAYS), '-sha256', '-extfile', extFile
  ]);
  run('openssl', [
    'pkcs12', '-export', '-out', PFX_FILE, '-inkey', KEY_FILE, '-in', CERT_FILE,
    '-name', 'Yeoulgame SSH Client', '-passout', 'pass:' + PFX_PASSWORD
  ]);

  fs.rmSync(csrFile, { force: true });
  try {
    fs.chmodSync(KEY_FILE, 0o600);
    fs.chmodSync(PFX_FILE, 0o600);
  } catch { /* Windows 에서는 무시 */ }

  console.log('  생성 완료: signing/yeoulgame-codesign.{key,crt,pfx}');
  console.log('  ⚠ .key 와 .pfx 는 절대 저장소에 커밋하지 마세요 (.gitignore 에 등록되어 있습니다).');
}

/** 인증서 파싱은 Node 내장 crypto 로 (openssl 불필요) */
function cert() {
  if (!cert._c) cert._c = new crypto.X509Certificate(fs.readFileSync(CERT_FILE));
  return cert._c;
}

function certFingerprint() {
  return cert().fingerprint256;
}

function certNotAfter() {
  return cert().validTo;
}

/**
 * detached 서명 (RSA + SHA-256).
 * openssl CLI 대신 Node 내장 crypto 를 쓰므로 Windows 에서 추가 설치가 필요 없다.
 * `openssl dgst -sha256 -sign` 과 동일한 형식이라 사용자는 openssl 로 검증할 수 있다.
 */
function signFile(file) {
  const sigPath = file + '.sig';
  const key = crypto.createPrivateKey(fs.readFileSync(KEY_FILE));

  const signer = crypto.createSign('SHA256');
  signer.update(fs.readFileSync(file));
  const signature = signer.sign(key);
  fs.writeFileSync(sigPath, signature);

  // 즉시 자가 검증 — 실패하면 빌드를 멈춘다
  const verifier = crypto.createVerify('SHA256');
  verifier.update(fs.readFileSync(file));
  if (!verifier.verify(cert().publicKey, signature)) {
    throw new Error('서명 자가 검증 실패: ' + path.basename(file));
  }
  return sigPath;
}

/** Windows Authenticode (자체 서명) */
function findSigntool() {
  if (process.platform !== 'win32') return null;

  // 1) electron-builder 가 받아둔 winCodeSign (프로젝트 캐시 또는 사용자 캐시)
  const ebRoots = [
    process.env.ELECTRON_BUILDER_CACHE,
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'electron-builder', 'Cache')
  ].filter(Boolean);
  for (const root of ebRoots) {
    const dir = path.join(root, 'winCodeSign');
    if (!fs.existsSync(dir)) continue;
    for (const d of fs.readdirSync(dir)) {
      const p = path.join(dir, d, 'windows-10', 'x64', 'signtool.exe');
      if (fs.existsSync(p)) return p;
    }
  }

  // 2) Windows SDK
  const sdkRoots = [
    process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], 'Windows Kits', '10', 'bin'),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Windows Kits', '10', 'bin')
  ].filter(Boolean);
  for (const root of sdkRoots) {
    if (!fs.existsSync(root)) continue;
    const versions = fs.readdirSync(root).filter((d) => /^10\./.test(d)).sort().reverse();
    for (const v of versions) {
      const p = path.join(root, v, 'x64', 'signtool.exe');
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

function authenticodeSign(file) {
  const signtool = findSigntool();
  if (!signtool) {
    console.log('  ! signtool.exe 없음 → Authenticode 서명 건너뜀 (Windows SDK 설치 시 자동 적용)');
    console.log('    detached 서명(.sig)과 SHA-256 해시로 무결성 검증은 그대로 가능합니다.');
    return false;
  }
  try {
    run(signtool, ['sign', '/fd', 'SHA256', '/f', PFX_FILE, '/p', PFX_PASSWORD, file]);
    console.log('  Authenticode 서명: ' + path.basename(file));
    return true;
  } catch (e) {
    console.log('  ! Authenticode 서명 실패: ' + path.basename(file) + ' — ' + String(e.stderr || e.message).trim().split('\n')[0]);
    return false;
  }
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function writeGuide(files, fingerprint) {
  const lines = [];
  lines.push('# 배포 파일 서명 검증 안내 (SIGNATURE.md)');
  lines.push('');
  lines.push('Yeoulgame SSH Client v1.0 · Copyright © 2026 Yeoulgame (yeoulgame.com) · MIT License');
  lines.push('');
  lines.push('## 이 배포판의 서명 방식');
  lines.push('');
  lines.push('이 배포판은 **여울게임터 자체 서명(self-signed)** 되어 있습니다. 공인 CA 인증서가 아니므로');
  lines.push('Windows 에서 "게시자를 확인할 수 없습니다" 또는 SmartScreen 경고가 표시될 수 있습니다.');
  lines.push('이는 **기능에 영향을 주지 않으며**, 아래 절차로 파일이 변조되지 않았음을 직접 확인할 수 있습니다.');
  lines.push('');
  lines.push('**공개 인증서 지문 (SHA-256)**');
  lines.push('');
  lines.push('```');
  lines.push(fingerprint);
  lines.push('```');
  lines.push('');
  lines.push('인증서 유효기간 만료: ' + certNotAfter());
  lines.push('');
  lines.push('이 지문이 여울게임터 공식 배포처에 게시된 값과 **반드시 같아야 합니다.**');
  lines.push('');
  lines.push('- <https://yeoulgame.com/board/files>');
  lines.push('- <https://github.com/yeoulgame/yeoulgame-ssh-client/releases>');
  lines.push('');
  lines.push('## 1단계 — SHA-256 해시 확인 (가장 간단)');
  lines.push('');
  lines.push('```bash');
  lines.push('# Linux / macOS');
  lines.push('sha256sum -c SHA256SUMS.txt');
  lines.push('```');
  lines.push('');
  lines.push('```powershell');
  lines.push('# Windows');
  lines.push('certutil -hashfile yeoulgame-ssh-client-1.0.0-installer.exe SHA256');
  lines.push('# 출력값을 SHA256SUMS.txt 의 값과 비교');
  lines.push('```');
  lines.push('');
  lines.push('## 2단계 — 서명 검증 (권장)');
  lines.push('');
  lines.push('`yeoulgame-public-cert.crt` 와 각 파일의 `.sig` 를 함께 내려받은 뒤:');
  lines.push('');
  lines.push('```bash');
  lines.push('# 공개 인증서 지문이 위 값과 같은지 먼저 확인');
  lines.push('openssl x509 -in yeoulgame-public-cert.crt -noout -fingerprint -sha256');
  lines.push('');
  lines.push('# 공개키 추출');
  lines.push('openssl x509 -in yeoulgame-public-cert.crt -pubkey -noout > yeoulgame.pub');
  lines.push('');
  lines.push('# 서명 검증 (Verified OK 가 나와야 합니다)');
  lines.push('openssl dgst -sha256 -verify yeoulgame.pub \\');
  lines.push('  -signature yeoulgame-ssh-client-1.0.0.AppImage.sig \\');
  lines.push('  yeoulgame-ssh-client-1.0.0.AppImage');
  lines.push('```');
  lines.push('');
  lines.push('Windows 에서도 동일합니다 (Git for Windows 의 openssl 사용 가능).');
  lines.push('');
  lines.push('## Windows 경고 화면이 떴을 때');
  lines.push('');
  lines.push('1. "Windows에서 PC를 보호했습니다" → **추가 정보** → **실행**');
  lines.push('2. 실행 전 위 1단계(해시) 또는 2단계(서명) 검증을 먼저 해주세요.');
  lines.push('3. **공식 배포처가 아닌 곳에서 받은 파일은 절대 실행하지 마세요.**');
  lines.push('');
  lines.push('## 서명된 파일 목록');
  lines.push('');
  lines.push('| 파일 | SHA-256 |');
  lines.push('|------|---------|');
  for (const f of files) {
    lines.push('| `' + path.basename(f) + '` | `' + sha256(f) + '` |');
  }
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('문의: support@yeoulgame.com · <https://github.com/yeoulgame/yeoulgame-ssh-client/issues>');
  lines.push('');

  const out = path.join(RELEASE_DIR, 'SIGNATURE.md');
  fs.writeFileSync(out, lines.join('\n'), 'utf8');
  return out;
}

/* ------------------------------------------------------------------ */

function main() {
  ensureCertificate();

  const fingerprint = certFingerprint();
  console.log('\n공개 인증서 지문 (SHA-256)\n  ' + fingerprint);

  if (process.argv.includes('--cert-only')) {
    console.log('\n인증서만 생성하고 종료합니다.');
    console.log('electron-builder 로 서명하려면:');
    console.log('  set CSC_LINK=signing\\yeoulgame-codesign.pfx');
    console.log('  set CSC_KEY_PASSWORD=' + PFX_PASSWORD);
    return;
  }

  if (!fs.existsSync(RELEASE_DIR)) {
    console.error('\n✗ release/ 폴더가 없습니다. 먼저 npm run dist 를 실행하세요.');
    process.exit(1);
  }

  const files = fs
    .readdirSync(RELEASE_DIR)
    .filter((f) => SIGN_EXT.includes(path.extname(f)))
    .sort()
    .map((f) => path.join(RELEASE_DIR, f));

  if (!files.length) {
    console.error('\n✗ 서명할 배포 파일이 없습니다.');
    process.exit(1);
  }

  console.log('\n서명 중 (' + files.length + '개)');
  for (const f of files) {
    if (process.platform === 'win32' && path.extname(f) === '.exe') authenticodeSign(f);
    signFile(f);
    console.log('  서명 + 검증 OK: ' + path.basename(f));
  }

  // 공개 인증서 배포
  const pubCert = path.join(RELEASE_DIR, 'yeoulgame-public-cert.crt');
  fs.copyFileSync(CERT_FILE, pubCert);

  const guide = writeGuide(files, fingerprint);

  console.log('\n완료');
  console.log('  공개 인증서 : ' + path.relative(ROOT, pubCert));
  console.log('  검증 가이드 : ' + path.relative(ROOT, guide));
  console.log('\n다음 단계: npm run hash  (SHA256SUMS.txt 생성)');
  console.log('배포 시 공개 인증서 지문을 yeoulgame.com/board/files 에 반드시 게시하세요.');
}

main();
