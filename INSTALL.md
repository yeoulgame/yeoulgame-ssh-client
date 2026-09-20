# 설치 가이드 (INSTALL.md)

Yeoulgame SSH Client v1.0 · Copyright © 2026 Yeoulgame (yeoulgame.com) · MIT License

---

## 1. Windows

### 시스템 요구사항

| 항목 | 최소 | 권장 |
|------|------|------|
| OS | Windows 10 v1909 | Windows 11 |
| RAM | 512MB | 1GB 이상 |
| 디스크 | 50MB | 100MB |
| 해상도 | 1024×768 | 1366×768 이상 |

> Windows 7 / 8 / 8.1 은 보안상의 이유로 지원하지 않습니다.
> Electron 기반이므로 별도의 .NET Framework 나 Visual C++ 런타임 설치는 필요 없습니다.

### ⚠ 먼저 읽어주세요 — 이 프로그램은 자체 서명되어 있습니다

여울 SSH 클라이언트는 **여울게임터가 직접 서명(self-signed)** 한 무료 오픈소스 프로그램입니다.
공인 인증기관(CA)에서 발급한 코드 서명 인증서를 쓰지 않기 때문에, 설치할 때 Windows가
**"Windows에서 PC를 보호했습니다"** 또는 **게시자를 확인할 수 없다**는 경고를 띄웁니다.

- **기능에는 아무 영향이 없습니다.** 경고 화면에서 **추가 정보 → 실행**을 누르면 설치됩니다.
- 대신 파일이 변조되지 않았는지는 **직접 확인할 수 있습니다.** 아래 3장의 절차를 따라주세요.
- **반드시 공식 배포처에서만** 내려받으세요.
  - <https://yeoulgame.com/downloads>
  - <https://github.com/yeoulgame/yeoulgame-ssh-client/releases>

> 정식 코드 서명 인증서는 사용자가 늘어난 뒤 V1.2 이상에서 도입할 예정입니다.

### 설치 프로그램 (권장)

1. `yeoulgame-ssh-client-1.0.0-installer.exe` 다운로드
2. **해시 검증** (권장 — 1장의 자체 서명 안내 참고)
   ```powershell
   certutil -hashfile yeoulgame-ssh-client-1.0.0-installer.exe SHA256
   ```
   출력값이 `SHA256SUMS.txt` 의 값과 같은지 확인
3. 실행 → 경고가 뜨면 **추가 정보 → 실행**
4. 설치 언어 선택(한국어/English/日本語/简体中文/Deutsch) → 설치 경로 지정 → 설치
5. 시작 메뉴 또는 바탕화면의 **Yeoulgame SSH Client** 실행

### 설치 없이 쓰기 (포터블)

1. `yeoulgame-ssh-client-1.0.0-portable.zip` 다운로드 후 원하는 폴더에 압축 해제
2. `Yeoulgame SSH Client.exe` 실행

USB 등에 넣어 다녀도 되지만, 설정과 세션은 `%APPDATA%\Yeoulgame SSH Client` 에 저장됩니다.

### 제거

설정 > 앱 > 설치된 앱 > Yeoulgame SSH Client > 제거
설정 파일까지 지우려면 `%APPDATA%\Yeoulgame SSH Client` 폴더를 삭제하세요.

---

## 2. Linux

### 시스템 요구사항

| 항목 | 요구사항 |
|------|---------|
| Kernel | Linux 4.4 이상 |
| libc | glibc 2.29 이상 |
| GUI | X11 또는 Wayland |
| RAM | 최소 256MB |
| 디스크 | 최소 30MB (AppImage) |

### 방식 1 — AppImage (모든 배포판, 설치 불필요)

```bash
chmod +x yeoulgame-ssh-client-1.0.0.AppImage
./yeoulgame-ssh-client-1.0.0.AppImage
```

FUSE 가 없다는 오류가 나면:

```bash
sudo apt install libfuse2          # Ubuntu 22.04+
# 또는 추출해서 실행
./yeoulgame-ssh-client-1.0.0.AppImage --appimage-extract-and-run
```

### 방식 2 — DEB (Ubuntu 20.04/22.04/24.04, Debian 11/12)

```bash
sudo apt install ./yeoulgame-ssh-client_1.0.0_amd64.deb
# 또는
sudo dpkg -i yeoulgame-ssh-client_1.0.0_amd64.deb && sudo apt -f install
```

### 방식 3 — RPM (CentOS 9 Stream, Fedora 37+)

> CentOS 7 · 8 은 지원하지 않습니다. 두 버전 모두 EOL 이고, CentOS 7 의 glibc 2.17 로는
> 프로그램이 실행되지 않습니다. CentOS 9 Stream 이상으로 올려주세요.

```bash
sudo rpm -i yeoulgame-ssh-client-1.0.0.x86_64.rpm
# 또는 의존성 자동 해결
sudo dnf install ./yeoulgame-ssh-client-1.0.0.x86_64.rpm
```

### 방식 4 — Snap (Ubuntu, Fedora 등)

```bash
sudo snap install --dangerous ./yeoulgame-ssh-client_1.0.0_amd64.snap
# 스토어 배포 후에는
sudo snap install yeoulgame-ssh-client
```

### 한글 설정 (중요)

터미널에서 한글이 깨져 보이면 로케일과 폰트를 확인하세요.

```bash
locale                 # 현재 로케일
locale -a | grep ko    # 한글 로케일 존재 여부

# 없으면 생성 (Ubuntu/Debian)
sudo locale-gen ko_KR.UTF-8
sudo update-locale

export LANG=ko_KR.UTF-8
export LC_ALL=ko_KR.UTF-8
```

한글 폰트 설치:

```bash
sudo apt install fonts-noto-cjk                 # Ubuntu / Debian
sudo dnf install google-noto-sans-cjk-fonts     # Fedora / CentOS 9
sudo pacman -S noto-fonts-cjk                   # Arch
```

프로그램에서 **설정 > 모양 > 폰트** 를 `Noto Sans Mono CJK KR` 로 지정하면 가장 안정적입니다.

### 제거

```bash
sudo apt remove yeoulgame-ssh-client     # DEB
sudo rpm -e yeoulgame-ssh-client         # RPM
sudo snap remove yeoulgame-ssh-client    # Snap
rm ~/.config/"Yeoulgame SSH Client" -rf  # 설정까지 삭제
```

---

## 3. 파일 검증 (해시 · 서명)

자체 서명 배포판이므로, 내려받은 파일이 **여울게임터가 만든 그대로인지** 직접 확인하는 것이 중요합니다.
공식 배포처에는 `SHA256SUMS.txt`, 각 파일의 `.sig`, 공개 인증서 `yeoulgame-public-cert.crt`,
그리고 검증 안내 `SIGNATURE.md` 가 함께 올라갑니다.

### 1단계 — 해시 확인 (가장 간단, 30초)

```powershell
# Windows
certutil -hashfile yeoulgame-ssh-client-1.0.0-installer.exe SHA256
```

```bash
# Linux
sha256sum -c SHA256SUMS.txt
```

출력된 값이 `SHA256SUMS.txt` 의 값과 **한 글자도 다르지 않아야** 합니다.

### 2단계 — 서명 확인 (권장)

```bash
# ① 공개 인증서 지문이 공식 배포처에 게시된 값과 같은지 확인
openssl x509 -in yeoulgame-public-cert.crt -noout -fingerprint -sha256

# ② 공개키 추출
openssl x509 -in yeoulgame-public-cert.crt -pubkey -noout > yeoulgame.pub

# ③ 서명 검증 — "Verified OK" 가 나와야 합니다
openssl dgst -sha256 -verify yeoulgame.pub \
  -signature yeoulgame-ssh-client-1.0.0.AppImage.sig \
  yeoulgame-ssh-client-1.0.0.AppImage
```

Windows 에서도 같은 명령을 쓸 수 있습니다 (Git for Windows 에 포함된 `openssl` 사용).

> **`Verification failure` 가 나오면 절대 실행하지 마세요.** 파일이 손상되었거나 변조된 것입니다.
> 공식 배포처에서 다시 받고, 계속 실패하면 support@yeoulgame.com 으로 알려주세요.

---

## 4. 설정 파일 위치

| OS | 경로 |
|----|------|
| Windows | `%APPDATA%\Yeoulgame SSH Client\` |
| Linux | `~/.config/Yeoulgame SSH Client/` |

| 파일 | 내용 |
|------|------|
| `settings.json` | 언어·테마·폰트·연결 옵션 |
| `sessions.json` | 저장된 세션 (비밀번호는 암호문) |
| `known_hosts.json` | 서버 호스트 키 지문 |
| `vault.json` | 마스터 비밀번호 설정 (검증자만 저장, 비밀번호 자체는 저장하지 않음) |

---

## 5. 첫 실행 안내

1. 왼쪽 위 **새 연결**(Ctrl+N)
2. 호스트 / 포트 / 사용자명 입력 → 인증 방식 선택
3. **세션 목록에 저장** 을 켜두면 다음부터 클릭 한 번으로 접속
4. 한글이 깨지면 메뉴 **세션 > 인코딩** 에서 UTF-8 또는 EUC-KR 지정

도움말은 프로그램에서 **F1** 또는 **도움말 > 도움말 보기**.

---

## 6. 문제 해결

| 증상 | 해결 |
|------|------|
| "Windows에서 PC를 보호했습니다" 경고 | 자체 서명이라 정상입니다. **추가 정보 → 실행**. 먼저 3장의 해시 검증 권장 |
| 게시자를 확인할 수 없다는 경고 | 위와 동일. 공식 배포처에서 받은 파일인지 반드시 확인 |
| CentOS 7 에서 실행 안 됨 | 지원 대상이 아닙니다 (glibc 2.17). CentOS 9 Stream 이상 필요 |
| 실행 직후 창이 하얗게 보임 | 그래픽 드라이버 문제. `--disable-gpu` 옵션으로 실행 |
| 연결이 자꾸 끊김 | 설정 > 연결에서 Keep-alive 와 자동 재연결 확인 |
| 한글 입력이 안 됨 | Windows 한글 IME 확인, Linux 는 ibus/fcitx 설치 확인 |
| 비밀번호가 저장되지 않음 | Linux 에 libsecret(gnome-keyring)이 없으면 **도구 > 마스터 비밀번호** 설정 |
| 호스트 키 변경 경고 | 서버를 직접 확인한 뒤에만 재접속 — 중간자 공격일 수 있음 |

문의: support@yeoulgame.com · <https://github.com/yeoulgame/yeoulgame-ssh-client/issues>
