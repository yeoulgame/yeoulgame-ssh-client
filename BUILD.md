# 빌드 가이드 (BUILD.md)

Yeoulgame SSH Client v1.0 · Copyright © 2026 Yeoulgame (yeoulgame.com) · MIT License

---

## 0. 시작하기 전에 — Node.js 설치

이 프로젝트는 Electron 기반이라 **Node.js 18 이상(권장 20 LTS)** 이 필요합니다.

### 설치되어 있는지 확인

Windows 명령 프롬프트(cmd) 또는 PowerShell 에서:

```
node -v
npm -v
```

`v20.x.x` 처럼 버전이 나오면 준비 완료입니다.
`'node'은(는) 내부 또는 외부 명령...` 이라고 나오면 설치가 필요합니다.

### Windows 설치 방법 (둘 중 하나)

**방법 A — 공식 설치 프로그램 (가장 쉬움)**

1. <https://nodejs.org> 접속
2. **LTS** 버튼(20.x 또는 22.x) 클릭해 `.msi` 내려받기
3. 설치 마법사에서 기본값으로 진행 (Add to PATH 체크 유지)
4. **명령 프롬프트를 새로 열고** `node -v` 확인

**방법 B — winget (Windows 10 1809+ / 11)**

```powershell
winget install OpenJS.NodeJS.LTS
```

설치 후 터미널을 새로 열어야 PATH 가 반영됩니다.

### Linux 설치 방법

```bash
# Ubuntu / Debian (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Fedora
sudo dnf install nodejs

# 배포판 독립 (nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install 20
```

---

## 1. 소스 준비

```bash
git clone https://github.com/yeoulgame/yeoulgame-ssh-client.git
cd yeoulgame-ssh-client
npm install
```

`npm install` 은 Electron 바이너리(약 150MB)를 내려받으므로 처음 한 번은 몇 분 걸립니다.
사내망이라 프록시가 필요하면:

```bash
npm config set proxy http://proxy:port
npm config set https-proxy http://proxy:port
```

## 2. 개발 모드 실행

```bash
npm start          # 그냥 실행
npm run dev        # 개발자 도구(F12) 메뉴 포함
```

## 3. 소스 검증

```bash
npm run verify
```

- `scripts/check-syntax.js` — 모든 .js/.html/.css 문법 + **저작권 헤더** 검사
- `scripts/verify-i18n.js` — 5개 국가 언어 리소스 키/치환자 검증

커밋 전과 제출 전에 반드시 통과시킵니다.

## 4. 패키징

| 명령 | 결과물 |
|------|--------|
| `npm run pack` | 압축하지 않은 실행 폴더 (`release/*-unpacked`) — 빠른 확인용 |
| `npm run dist:win` | `yeoulgame-ssh-client-1.0.0-installer.exe`, `yeoulgame-ssh-client-1.0.0-portable.zip` |
| `npm run dist:linux` | `yeoulgame-ssh-client-1.0.0.AppImage`, `yeoulgame-ssh-client_1.0.0_amd64.deb`, `yeoulgame-ssh-client-1.0.0.x86_64.rpm`, `yeoulgame-ssh-client.snap` |
| `npm run dist` | 현재 OS 의 모든 타깃 |

또는 스크립트를 쓰면 설치·검증·패키징·해시까지 한 번에 진행됩니다.

```powershell
.\scripts\build-win.ps1
```

```bash
chmod +x scripts/build-linux.sh
./scripts/build-linux.sh
```

### 크로스 빌드 주의

- **Windows 결과물은 Windows 에서** 만드는 것이 가장 안전합니다 (NSIS 다국어 설치 마법사 포함).
- Linux RPM 을 만들려면 `rpm` 패키지, Snap 을 만들려면 `snapcraft` 가 필요합니다.
  없으면 해당 타깃만 건너뛰어집니다.
- 두 OS 를 모두 갖추기 어려우면 `.github/workflows/build.yml` 의 CI 가
  windows-latest / ubuntu-latest 러너에서 동시에 빌드합니다.

## 5. 난독화 빌드 (RFP 3.1.1)

```bash
npm run obfuscate    # src/**/*.js → dist-obfuscated/
npm run dist:secure  # 난독화된 소스로 패키징
```

- 변수명·함수명 난독화, 제어 흐름 평탄화, 문자열 배열 인코딩 적용
- 각 파일 최상단의 저작권 표시는 그대로 유지됩니다
- **난독화 후 반드시 기능 회귀 테스트를 하세요** (한글 입출력, 다중 탭, 세션 저장/로드)

## 6. 서명 — OpenSSL 자체 서명

연구팀 결정(YSC-2026-001, 2026-09-20)에 따라 **공인 CA 인증서 대신 자체 서명**을 씁니다.
비용이 들지 않고, 배포 후 파일 변조를 사용자가 직접 확인할 수 있습니다.

### 한 번에 하기

```bash
npm run dist:win     # 또는 npm run dist:linux
npm run sign         # 인증서 자동 생성 + 서명 + 자가 검증
npm run hash         # SHA256SUMS.txt
```

`npm run dist:secure` 는 난독화 → 패키징 → 서명 → 해시를 한 번에 수행합니다.
빌드 스크립트(`build-win.ps1`, `build-linux.sh`)도 기본으로 서명 단계를 포함합니다.

### 무엇이 만들어지나

| 파일 | 설명 |
|------|------|
| `signing/yeoulgame-codesign.key` | **개인키 — 절대 유출·커밋 금지** (`.gitignore` 등록됨) |
| `signing/yeoulgame-codesign.crt` | 공개 인증서 (RSA 3072, codeSigning EKU, 10년) |
| `signing/yeoulgame-codesign.pfx` | Windows signtool / electron-builder 용 |
| `release/*.sig` | 각 배포 파일의 detached 서명 |
| `release/yeoulgame-public-cert.crt` | 사용자에게 배포할 공개 인증서 |
| `release/SIGNATURE.md` | 공개 인증서 지문 + 사용자용 검증 절차 |

PFX 비밀번호는 기본 `yeoulgame` 이며 `YSC_PFX_PASSWORD` 환경변수로 바꿀 수 있습니다.

### 인증서 관리 (중요)

- **개인키를 잃어버리면 기존 사용자가 새 배포판의 서명을 검증할 수 없습니다.** 안전한 곳에 백업하세요.
- 인증서를 새로 만들면 **지문이 바뀌므로** 공식 배포처의 게시 값도 반드시 함께 갱신해야 합니다.
- 배포할 때마다 `release/SIGNATURE.md` 의 지문을 다음 두 곳에 게시합니다.
  - <https://yeoulgame.com/board/files>
  - GitHub Release 본문

### Windows Authenticode

Windows SDK 의 `signtool.exe` 가 설치되어 있으면 `npm run sign` 이 .exe 에 자동으로 적용합니다.
없으면 건너뛰며, detached 서명과 해시로 무결성 검증은 그대로 가능합니다.

```powershell
signtool verify /pa /v release\yeoulgame-ssh-client-1.0.0-installer.exe
```

> 자체 서명이므로 `/pa` 검증은 "신뢰할 수 있는 루트가 아님"으로 실패합니다. 정상입니다.
> **SmartScreen 경고도 그대로 표시됩니다** — 연구팀이 수용한 사항입니다.

### Linux GPG (선택)

GPG 키가 따로 있으면 추가 서명할 수 있습니다.

```bash
export GPG_KEY_ID=여울게임터키ID
./scripts/build-linux.sh
gpg --verify release/yeoulgame-ssh-client-1.0.0.AppImage.asc
```

### 사용자가 검증하는 방법

```bash
openssl x509 -in yeoulgame-public-cert.crt -noout -fingerprint -sha256   # 지문 대조
openssl x509 -in yeoulgame-public-cert.crt -pubkey -noout > yeoulgame.pub
openssl dgst -sha256 -verify yeoulgame.pub -signature <파일>.sig <파일>   # Verified OK
```

## 7. 해시 생성 및 검증

```bash
npm run hash        # release/SHA256SUMS.txt
```

```bash
sha256sum -c SHA256SUMS.txt              # Linux
certutil -hashfile <파일> SHA256          # Windows
```

## 8. 버전 올리기

1. `package.json` 의 `version` 수정
2. `npm run verify`
3. `git tag v1.0.1 && git push --tags` → CI 가 Release 초안 생성
4. 승인(APPROVAL.md) 후 Release 공개 + 여울게임터 자료실 게시

## 9. 자주 나는 문제

| 증상 | 원인 / 해결 |
|------|------------|
| `xterm.js not found. Run npm install first.` | `npm install` 을 하지 않았거나 node_modules 가 지워짐 |
| Electron 다운로드가 멈춤 | 프록시/방화벽. `ELECTRON_MIRROR` 환경변수 사용 |
| Linux 빌드 시 `rpmbuild not found` | `sudo apt install rpm` |
| Snap 빌드 실패 | `sudo snap install snapcraft --classic` (선택 타깃이므로 건너뛰어도 무방) |
| Windows 빌드에서 심볼릭 링크 오류 | 개발자 모드 켜기 또는 관리자 권한 터미널 |
| 한글 파일명이 깨진 ZIP | 7-Zip 대신 Windows 기본 탐색기로 압축 해제 |
