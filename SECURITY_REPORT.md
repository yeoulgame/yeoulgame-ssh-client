# Yeoulgame SSH Client v1.0 보안 검사 보고서

**프로젝트 코드:** YSC-2026-001
**작성일:** 2026-09-20 (초안 — 서명/난독화 검증 전)
**작성자:** 개발팀
**상태:** ⏳ 일부 항목 대기

> 표기: ✅ 완료 · ⏳ 대기 · ➖ 해당 없음

---

## 1. 설계상 적용된 보안 조치 (코드 기준 · 검토 완료)

### 1.1 Electron 하드닝

| 항목 | 설정 | 상태 |
|------|------|------|
| `contextIsolation` | `true` | ✅ |
| `nodeIntegration` | `false` | ✅ |
| `sandbox` | `false` (preload 에서 ssh2 접근 불가하도록 IPC 만 노출) | ✅ |
| CSP | `default-src 'none'; script-src 'self'; connect-src 'none'` | ✅ |
| IPC | `preload.js` 채널 **허용 목록** 방식, 목록 밖 채널은 거부 | ✅ |
| 외부 링크 | `shell.openExternal` 허용 도메인 4개로 제한, `will-navigate` 차단 | ✅ |
| 창 열기 | `setWindowOpenHandler` 에서 전부 `deny` | ✅ |
| 단일 인스턴스 | `requestSingleInstanceLock` | ✅ |

### 1.2 자격증명 보관

| 항목 | 구현 | 상태 |
|------|------|------|
| 1차 저장소 | Electron `safeStorage` (Windows DPAPI / Linux libsecret) | ✅ |
| 2차 저장소 | 마스터 비밀번호 → `scrypt(N=16384,r=8,p=1)` → AES-256-GCM | ✅ |
| 평문 저장 | **금지** — 암호화 수단이 없으면 저장을 거부(`NO_ENCRYPTION_BACKEND`) | ✅ |
| 파일 권한 | `settings.json` / `sessions.json` / `vault.json` 0600 | ✅ |
| 마스터 비밀번호 자체 | 저장하지 않음 (검증자만 AES-GCM 으로 보관) | ✅ |
| 세션 내보내기 | 비밀번호·패스프레이즈 **강제 제외** | ✅ |
| 메모리 | 마스터 키는 프로세스 메모리에만 유지, `vault:lock` 으로 즉시 파기 | ✅ |

### 1.3 SSH 전송 보안

| 항목 | 구현 | 상태 |
|------|------|------|
| 프로토콜 | SSH-2 (ssh2 라이브러리, OpenSSH 호환) | ✅ |
| 호스트 키 | TOFU 저장 후 **변경 시 연결 거부** (MITM 방지) | ✅ |
| 지문 표기 | `SHA256:base64` (OpenSSH 동일 형식) | ✅ |
| 호스트 키 초기화 | 사용자가 명시적으로 요청할 때만 (`ssh:forgetHostKey`) | ✅ |
| Keep-alive | 60초, countMax 5 | ✅ |
| 키 파일 | 사용자가 선택한 경로만 읽기, 복사·전송하지 않음 | ✅ |

### 1.4 코드 품질

| 항목 | 결과 | 상태 |
|------|------|------|
| 하드코딩된 자격증명 | 없음 | ✅ |
| SQL Injection | 해당 없음 (DB 미사용) | ➖ |
| 버퍼 오버플로우 | 해당 없음 (네이티브 코드 미작성, ssh2 는 순수 JS) | ➖ |
| XSS (렌더러) | 모든 동적 문자열 `esc()` 로 이스케이프, 서버 출력은 xterm 이 처리 | ✅ |
| 경로 조작 | 파일 경로는 OS 다이얼로그를 통해서만 획득 | ✅ |
| 원격 코드 로딩 | 없음 — 모든 스크립트는 로컬 `'self'` | ✅ |
| 업데이트 확인 | HTTPS 고정, 응답 64KB 제한, 7초 타임아웃, **자동 설치 없음** | ✅ |

---

## 2. 난독화 (RFP 3.1.1)

| 항목 | 방법 | 상태 |
|------|------|------|
| 변수명 난독화 | javascript-obfuscator `identifierNamesGenerator: hexadecimal` | ⏳ 빌드 시 적용 |
| 함수명 난독화 | 동일 (renameGlobals 는 false — Electron API 보호) | ⏳ |
| 논리 흐름 보호 | `controlFlowFlattening` 0.6 | ⏳ |
| 문자열 보호 | `stringArray` + base64 + splitStrings | ⏳ |
| 패킹 | asar 아카이브 + NSIS 압축 / AppImage squashfs | ⏳ |
| 저작권 표시 유지 | 난독화 후 헤더 재삽입 (`scripts/obfuscate.js`) | ✅ |
| **난독화 후 기능 회귀 테스트** | 한글 입출력 / 탭 / 세션 / 재연결 | ⏳ **필수** |

실행:

```bash
npm run obfuscate && npm run dist:secure
```

> asar 는 암호화가 아니라 아카이브입니다. Electron 앱은 원리상 완전한 리버스 엔지니어링 방지가
> 불가능하므로, 난독화는 **진입 장벽**으로만 취급하고 비밀 값은 애초에 코드에 넣지 않았습니다.

---

## 3. 서명 및 무결성

**서명 방식: OpenSSL 자체 서명** (연구팀 결정 YSC-2026-001, 2026-09-20 — 공인 CA 인증서 미사용)

| 항목 | 방법 | 상태 |
|------|------|------|
| 코드 서명 인증서 | RSA 3072, SHA-256, `codeSigning` EKU, 10년 — `scripts/sign-release.js` 가 자동 생성 | ✅ 구현 완료 |
| detached 서명 (.sig) | 모든 배포 파일에 `openssl dgst -sha256 -sign`, 생성 직후 자가 검증 | ✅ 구현 완료 |
| 공개 인증서 배포 | `release/yeoulgame-public-cert.crt` + 지문을 공식 배포처에 게시 | ⏳ 배포 시 |
| 사용자 검증 가이드 | `release/SIGNATURE.md` 자동 생성 (지문·해시표·검증 명령) | ✅ 구현 완료 |
| Windows Authenticode | signtool 존재 시 자동 적용 (자체 서명이므로 SmartScreen 경고는 유지) | ⏳ 빌드 시 |
| Linux GPG 서명 | 선택 — `GPG_KEY_ID` 지정 시 추가 서명 | ➖ 선택 |
| SHA-256 해시 | `npm run hash` → `release/SHA256SUMS.txt` | ⏳ 빌드 후 |
| 해시·지문 공개 | GitHub Releases + yeoulgame.com/board/files/5 | ⏳ 배포 시 |
| 비공식 배포처 경고 | About 창 자체 서명 안내 + 업데이트 확인 시 버전 비교 | ✅ 구현 완료 |

검증 명령 (사용자):

```bash
openssl x509 -in yeoulgame-public-cert.crt -noout -fingerprint -sha256
openssl x509 -in yeoulgame-public-cert.crt -pubkey -noout > yeoulgame.pub
openssl dgst -sha256 -verify yeoulgame.pub -signature <파일>.sig <파일>   # Verified OK
sha256sum -c SHA256SUMS.txt
```

```powershell
certutil -hashfile yeoulgame-ssh-client-1.0.0-installer.exe SHA256
```

### 자체 서명의 보증 범위 (정확히 기록)

| 자체 서명이 **하는 것** | 자체 서명이 **하지 못하는 것** |
|---------------------|--------------------------|
| 배포 후 파일 변조 탐지 (개발팀 개발 환경에서 변조 거부 확인 완료) | Windows SmartScreen / 게시자 경고 제거 |
| 개인키를 가진 주체만 서명 가능함을 증명 | 제3자 CA 에 의한 신원 보증 |
| 공개 인증서 지문 대조로 배포처 위조 탐지 | 사용자가 지문을 대조하지 **않으면** 아무 보호도 되지 않음 |

따라서 **공개 인증서 지문을 공식 배포처 두 곳에 반드시 게시**해야 하며, 이것이 빠지면
자체 서명은 무의미해집니다. 배포 체크리스트에 포함되어 있습니다.

**개인키 관리:** `signing/yeoulgame-codesign.key` 는 `.gitignore` 에 등록되어 있습니다.
유출되면 제3자가 여울게임터 이름으로 서명할 수 있고, 분실하면 기존 사용자가 새 배포판을
검증할 수 없으므로 오프라인 백업이 필요합니다.

---

## 4. 의존성 검사

| 패키지 | 용도 | 확인 |
|--------|------|------|
| electron 31.x | 런타임 | ⏳ 최신 보안 패치 버전 고정 |
| ssh2 1.15.x | SSH-2 클라이언트 | ⏳ |
| iconv-lite 0.6.x | CP949 디코딩 | ⏳ |
| @xterm/* 5.x | 터미널 에뮬레이션 | ⏳ |

점검 명령:

```bash
npm audit --omit=dev
npm outdated
```

결과 붙여넣기: ⏳

> Electron 은 Chromium 보안 패치가 자주 나오므로 **배포 직전 최신 31.x 로 올린 뒤 재검증**합니다.

---

## 5. 발견된 취약점

| ID | 심각도 | 내용 | 조치 | 상태 |
|----|--------|------|------|------|
| — | — | (없음 / 작성) | | |

### 알려진 제약 (연구팀 고지 사항)

1. **자체 서명** — 공인 CA 인증서가 아니므로 Windows SmartScreen 경고가 표시됩니다.
   연구팀이 수용한 사항이며, V1.2 이상에서 정식 인증서 도입을 검토합니다. 사용자는 해시와
   서명으로 무결성을 확인할 수 있습니다 (INSTALL.md 3장).
2. **호스트 키 TOFU** — 최초 접속 시 지문을 자동 신뢰합니다. 고신뢰 환경에서는 사전에 지문을 확인하세요.
3. **난독화의 한계** — Electron 특성상 완전한 코드 보호는 불가능합니다. MIT 오픈소스이므로 소스는 공개됩니다.
4. **libsecret 부재 환경** — 일부 최소 설치 Linux 에서는 OS 키체인이 없어 마스터 비밀번호가 필수입니다.
5. **에이전트 인증** — Windows 는 Pageant, Linux 는 `SSH_AUTH_SOCK` 에 의존합니다.

---

## 6. 최종 결론

- [ ] Electron 하드닝 확인
- [ ] 자격증명 암호화 동작 확인 (키체인 / 마스터 비밀번호 양쪽)
- [ ] 난독화 적용 및 기능 회귀 테스트 통과
- [ ] 자체 서명 적용 (`npm run sign`) 및 전 파일 `Verified OK`
- [ ] SHA-256 해시 생성 (`npm run hash`)
- [ ] **공개 인증서 지문을 yeoulgame.com/board/files/5 와 GitHub Release 에 게시**
- [ ] 개인키(`signing/*.key`, `*.pfx`) 오프라인 백업 및 저장소 미포함 확인
- [ ] `npm audit` 고위험 0건

**판정:** ⏳ 대기
**서명:** ____________________  **날짜:** __________

제출: research@yeoulgame.com · 제목 `[YSC-2026-001] 보안 검사 결과 - <날짜>`
