# Yeoulgame SSH Client v1.0.0

**한국어 안내:** <https://yeoulgame.com/board/files>

한글 안 깨지는 SSH·Telnet 접속기 — 첫 정식 배포판입니다.
PuTTY 나 기본 터미널에서 한글이 깨져 고생하셨다면 이게 답입니다.

## 다운로드

| 플랫폼 | 파일 | 크기 |
|--------|------|------|
| Windows 10/11 (설치판) | `yeoulgame-ssh-client-1.0.0-installer.exe` | 75 MB |
| Windows 10/11 (무설치) | `yeoulgame-ssh-client-1.0.0-portable.zip` | 103 MB |
| Linux (범용) | `yeoulgame-ssh-client-1.0.0.AppImage` | 103 MB |
| Ubuntu / Debian | `yeoulgame-ssh-client_1.0.0_amd64.deb` | 72 MB |
| Fedora / RHEL | `yeoulgame-ssh-client-1.0.0.x86_64.rpm` | 72 MB |
| Snap | `yeoulgame-ssh-client.snap` | 87 MB |

설치 방법은 [INSTALL.md](https://github.com/yeoulgame/yeoulgame-ssh-client/blob/main/INSTALL.md) 를 참고하세요.

## 주요 기능

- **한글 완벽 지원** — UTF-8 / EUC-KR(CP949) 자동 감지. 입력·출력·복사·붙여넣기 모두 정상
- **다중 탭** — 탭마다 독립 연결, 이름·색상·아이콘 지정
- **세션 저장** — 자격증명은 OS 키체인(Windows DPAPI / Linux libsecret)으로 암호화. 평문 저장 없음
- **안정적 연결** — Keep-alive 60초 + 자동 재연결(지수 백오프, 최대 5회)
- **5개 국가 언어** — 한국어·영어 완전 번역, 일본어·중국어(간체)·독일어 UI
- **서버 관리 맞춤** — 서버 상태·로그·디스크·메모리 빠른 명령어 버튼
- **Telnet 도 지원** — 텍스트 머드 등 Telnet 서버에도 그대로 접속
- **광고 없음 · 완전 무료** — MIT 라이선스

앱 단축키는 전부 `Ctrl+Shift` 조합입니다. `Ctrl+C`(중단), `Ctrl+R`(기록 검색),
`Ctrl+W`(단어 지우기) 같은 셸 단축키를 빼앗지 않기 위해서입니다.

---

## ⚠️ 설치 시 경고가 뜹니다

이 배포판은 공인 CA 인증서가 아닌 **여울게임터 자체 서명**을 사용합니다.
Windows 에서 SmartScreen 경고가 표시되지만 기능에는 영향이 없습니다.

자체 서명은 경고를 없애주지 않습니다. 대신 **파일이 변조되지 않았는지
직접 확인할 수 있는 수단**을 제공합니다. 아래 절차로 반드시 확인하세요.

## 파일 검증

### 1. 인증서 지문 확인

첨부된 `yeoulgame-public-cert.crt` 의 SHA-256 지문이 아래와 같아야 합니다.

```
FA:D5:9C:51:12:E3:5A:84:6C:79:6C:28:C9:D7:7E:7C:7B:07:C4:CF:07:4D:13:38:AA:23:4E:E4:F0:2A:3B:DF
```

구분자 없는 형식 (64자):

```
FAD59C5112E35A846C796C28C9D77E7C7B07C4CF074D1338AA234EE4F02A3BDF
```

이 값은 [자료실 공지](https://yeoulgame.com/board/files) 에 게시된 값과
**글자 하나까지 같아야** 합니다. 다르면 설치하지 마시고 신고해 주세요.

확인 명령:

```bash
openssl x509 -in yeoulgame-public-cert.crt -noout -fingerprint -sha256
```

```powershell
(Get-PfxCertificate .\yeoulgame-public-cert.crt).GetCertHashString('SHA256')
```

> `certutil -hashfile` 은 인증서 지문이 아니라 파일 해시를 출력합니다. 쓰지 마세요.

### 2. 서명 검증

각 배포 파일에는 같은 이름의 `.sig` 파일이 함께 있습니다.

```bash
openssl x509 -in yeoulgame-public-cert.crt -pubkey -noout > yeoulgame.pub
openssl dgst -sha256 -verify yeoulgame.pub \
  -signature yeoulgame-ssh-client-1.0.0.AppImage.sig \
  yeoulgame-ssh-client-1.0.0.AppImage
# → Verified OK
```

### 3. 체크섬 대조

```bash
sha256sum -c SHA256SUMS.txt
```

```
d726c8fac13d365d06f936f19b48b52ba8b89155bee2315d95a9ffbd07c9afc6  yeoulgame-ssh-client-1.0.0-installer.exe
8a941a70f417f918711df0c33a5219467207d7a083748a671b0b14e0640b746e  yeoulgame-ssh-client-1.0.0-portable.zip
63e79707bdf7326172203e8b0025468f3df7dc39420d4e7711b872dc9b081fd0  yeoulgame-ssh-client-1.0.0.AppImage
87cd99298015d41d8dc5121211665f0244bb56bceabf3e62efb3dc33e18eae17  yeoulgame-ssh-client_1.0.0_amd64.deb
6957112a949219ef4b24c375f71cb944bf94fec91ac34117895e755dd5c12e68  yeoulgame-ssh-client-1.0.0.x86_64.rpm
2901585bdf7ada238afddf9935b1080d52d03176d7d358ea70a8699f9c09125d  yeoulgame-ssh-client.snap
```

---

## 알려진 제한 사항

- **CentOS 7 미지원** — glibc 2.17 로 Electron 31 구동 불가. CentOS 8 이상 또는
  AppImage 사용을 권장합니다.
- **아이콘** — 현재 임시 아이콘입니다. 정식 아이콘은 후속 버전에 반영됩니다.
- **공인 CA 서명 없음** — 위 SmartScreen 안내 참고.

## 문의

- 버그 신고: [Issues](https://github.com/yeoulgame/yeoulgame-ssh-client/issues)
- 이메일: support@yeoulgame.com

MIT License © 2026 Yeoulgame
