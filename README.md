# Yeoulgame SSH Client

🎮 게임 개발자를 위한 완벽한 한글 SSH 클라이언트
🎮 The perfect Korean-ready SSH client for game developers

**개발처 / Developed by:** [여울게임터 (Yeoulgame)](https://yeoulgame.com)
**프로젝트 코드:** YSC-2026-001 · **버전:** 1.0.0 · **라이선스:** MIT

---

## 한국어

### 특징

- ✅ **한글 완벽 지원** — UTF-8 / EUC-KR(CP949) 자동 감지, 입력·출력·복사·붙여넣기 모두 정상
- ✅ **광고 없음 · 무료** — MIT 라이선스 오픈소스
- ✅ **다중 탭** — 탭마다 독립 연결, 이름·색상·아이콘 지정
- ✅ **세션 저장** — 한 번의 클릭으로 재접속, 자격증명은 OS 키체인으로 암호화 보관
- ✅ **안정적 연결** — Keep-alive(기본 60초) + 자동 재연결(지수 백오프, 최대 5회)
- ✅ **5개 국가 언어** — 한국어·영어 완전 지원, 일본어·중국어(간체)·독일어 UI 지원
- ✅ **게임 개발자 맞춤** — 빠른 명령어 버튼(서버 상태, 로그 보기, 디스크·메모리 사용량 등)
- ✅ **Windows 10/11 · Linux 주요 배포판** — exe / AppImage / DEB / RPM / Snap

### 다운로드

[yeoulgame.com/downloads](https://yeoulgame.com/downloads) 또는
[GitHub Releases](https://github.com/yeoulgame/yeoulgame-ssh-client/releases)

설치 방법은 [INSTALL.md](INSTALL.md), 직접 빌드는 [BUILD.md](BUILD.md) 를 참고하세요.

### 한글이 깨질 때

1. 메뉴 **세션 > 인코딩** 에서 UTF-8 또는 EUC-KR(CP949)을 직접 지정
2. 리눅스라면 `export LANG=ko_KR.UTF-8` 과 한글 폰트 설치
   ```bash
   sudo apt install fonts-noto-cjk        # Ubuntu / Debian
   sudo dnf install google-noto-sans-cjk-fonts   # Fedora / CentOS
   sudo pacman -S noto-fonts-cjk          # Arch
   ```
3. **설정 > 모양 > 폰트** 에서 D2Coding / 나눔고딕코딩 / Noto Sans Mono CJK KR 중 선택

### 단축키

앱 단축키는 **전부 `Ctrl+Shift`** 입니다. `Ctrl+C`(중단) · `Ctrl+R`(명령 기록 검색) ·
`Ctrl+W`(단어 지우기) · `Ctrl+A`(줄 처음) 같은 셸 단축키를 빼앗지 않기 위해서입니다.

| 기능 | 단축키 |
|------|--------|
| 새 탭 / 탭 닫기 | `Ctrl+Shift+T` / `Ctrl+Shift+W` |
| 새 연결 | `Ctrl+Shift+N` |
| 탭 이동 | `Ctrl+Tab` / `Ctrl+Shift+Tab` |
| 복사 / 붙여넣기 | `Ctrl+Shift+C` / `Ctrl+Shift+V` |
| 모두 선택 | `Ctrl+Shift+A` |
| 찾기 | `Ctrl+Shift+F` |
| 터미널 지우기 | `Ctrl+Shift+L` |
| 글자 크기 | `Ctrl+ +` / `Ctrl+ -` / `Ctrl+0` |
| 사이드바 / 빠른 명령어 바 | `Ctrl+Shift+B` / `Ctrl+Shift+J` |
| 세션 저장 | `Ctrl+Shift+S` |
| 다시 연결 | `Ctrl+Shift+R` |
| 설정 | `Ctrl+,` |
| 화면 새로고침 / 도움말 | `F5` / `F1` |

---

## English

### Features

- ✅ **Flawless Korean support** — UTF-8 / EUC-KR (CP949) auto-detection for input, output, copy and paste
- ✅ **No ads, free** — MIT licensed open source
- ✅ **Multiple tabs** — independent connection, name, colour and icon per tab
- ✅ **Saved sessions** — one-click reconnect; credentials encrypted with the OS keychain
- ✅ **Stable connections** — keep-alive (60s) and automatic reconnect with backoff
- ✅ **5 languages** — Korean and English fully translated; Japanese, Simplified Chinese and German UI
- ✅ **Built for game developers** — quick command buttons for server status, logs, disk and memory
- ✅ **Windows 10/11 and major Linux distributions** — exe / AppImage / DEB / RPM / Snap

### Download

From [yeoulgame.com/downloads](https://yeoulgame.com/downloads) or the
[GitHub Releases](https://github.com/yeoulgame/yeoulgame-ssh-client/releases) page.
See [INSTALL.md](INSTALL.md) to install and [BUILD.md](BUILD.md) to build from source.

---

## 기술 스택 / Tech stack

| 영역 | 선택 |
|------|------|
| 런타임 | Electron 31 (Chromium + Node 20) |
| 터미널 | xterm.js 5 + unicode11 addon (CJK 문자폭 2칸 계산) |
| SSH | ssh2 (순수 JavaScript, SSH-2) |
| 인코딩 | iconv-lite (CP949) + Node StringDecoder |
| i18n | 자체 경량 로더 (`resources/i18n/*.json`, en 폴백) |
| 패키징 | electron-builder (NSIS / AppImage / DEB / RPM / Snap) |

### 폴더 구조

```
src/main/        메인 프로세스 (SSH, 세션 저장, 암호화, 메뉴, i18n)
src/renderer/    UI (탭, 터미널, 다이얼로그, About 창)
resources/i18n/  ko, en, ja, zh-CN, de 언어 리소스
scripts/         빌드 · 난독화 · 해시 · 검증 스크립트
build/           아이콘
```

## 보안

- 저장된 비밀번호는 OS 키체인(Windows DPAPI / Linux libsecret)으로 암호화합니다.
- 키체인을 쓸 수 없으면 마스터 비밀번호(scrypt + AES-256-GCM)를 설정해야 저장됩니다. **평문 저장은 하지 않습니다.**
- 세션 내보내기 파일에는 비밀번호가 포함되지 않습니다.
- 호스트 키는 최초 접속 시 저장(TOFU)되고, 이후 변경되면 연결을 거부합니다.
- 렌더러는 `contextIsolation: true`, `nodeIntegration: false`, CSP 적용, IPC 채널 허용 목록 방식입니다.

### 배포판은 자체 서명입니다

공인 CA 인증서 대신 **여울게임터 자체 서명**을 사용합니다. Windows 에서 SmartScreen 경고가
표시되지만 기능에는 영향이 없으며, 파일이 변조되지 않았는지는 직접 확인할 수 있습니다.

```bash
openssl x509 -in yeoulgame-public-cert.crt -pubkey -noout > yeoulgame.pub
openssl dgst -sha256 -verify yeoulgame.pub -signature <파일>.sig <파일>   # Verified OK
sha256sum -c SHA256SUMS.txt
```

공개 인증서 지문은 [yeoulgame.com/downloads](https://yeoulgame.com/downloads) 와
GitHub Release 에 게시된 값과 반드시 같아야 합니다. 자세한 절차는 [INSTALL.md](INSTALL.md) 3장.

자세한 보안 설계는 [SECURITY_REPORT.md](SECURITY_REPORT.md) 를 참고하세요.

## 라이선스 / License

MIT License © 2026 Yeoulgame — 상용 사용 가능. 전문은 [LICENSE](LICENSE) 참고.

## 문의

- 버그 신고: <https://github.com/yeoulgame/yeoulgame-ssh-client/issues>
- 이메일: support@yeoulgame.com
- 연구팀 검수: research@yeoulgame.com
