#!/usr/bin/env bash
# Yeoulgame SSH Client v1.0
# Copyright (c) 2026 Yeoulgame (yeoulgame.com)
# Licensed under MIT License
#
# Linux 배포 빌드 스크립트 (AppImage / DEB / RPM / Snap)
#   ./scripts/build-linux.sh              일반 빌드 + 자체 서명 + 해시
#   ./scripts/build-linux.sh --obfuscate  난독화 빌드
#   ./scripts/build-linux.sh --no-sign    서명 없이 빌드만
#
# 서명 방식: OpenSSL 자체 서명 (YSC-2026-001 연구팀 결정 2번)
#   GPG 키가 있으면 GPG_KEY_ID 환경변수를 지정해 추가 서명할 수도 있습니다.

set -euo pipefail
cd "$(dirname "$0")/.."

OBFUSCATE=0
SIGN=1
for arg in "$@"; do
  case "$arg" in
    --obfuscate) OBFUSCATE=1 ;;
    --no-sign)   SIGN=0 ;;
  esac
done

echo "[1/6] Node.js 확인"
node -v
npm -v

echo "[2/6] 빌드 도구 확인 (rpm / snapcraft 는 선택, openssl 은 서명에 필요)"
command -v openssl   >/dev/null 2>&1 || echo "  ! openssl 없음 - 서명을 하려면 sudo apt install openssl"
command -v rpmbuild  >/dev/null 2>&1 || echo "  ! rpmbuild 없음 - RPM 생성이 건너뛰어질 수 있습니다 (sudo apt install rpm)"
command -v snapcraft >/dev/null 2>&1 || echo "  ! snapcraft 없음 - Snap 생성이 건너뛰어질 수 있습니다 (sudo snap install snapcraft --classic)"

echo "[3/6] 의존성 설치 및 검증"
npm install
npm run verify

echo "[4/6] 패키징"
if [ "$OBFUSCATE" = "1" ]; then
  node scripts/obfuscate.js
  npx electron-builder --linux --config.directories.app=dist-obfuscated
else
  npm run dist:linux
fi

if [ "$SIGN" = "1" ]; then
  echo "[5/6] OpenSSL 자체 서명 (detached .sig + 공개 인증서)"
  node scripts/sign-release.js
else
  echo "[5/6] 서명 건너뜀 (--no-sign)"
fi

echo "[6/6] SHA-256 해시 생성"
npm run hash

if [ -n "${GPG_KEY_ID:-}" ]; then
  echo "추가 GPG 서명 (key: $GPG_KEY_ID)"
  for f in release/*.AppImage release/*.deb release/*.rpm release/*.snap release/SHA256SUMS.txt; do
    [ -e "$f" ] || continue
    gpg --default-key "$GPG_KEY_ID" --armor --detach-sign "$f"
    echo "  GPG 서명 완료: $f.asc"
  done
fi

echo
echo "빌드 완료. release/ 폴더:"
ls -lh release/ 2>/dev/null | grep -E '\.(AppImage|deb|rpm|snap|sig|crt|txt|md|asc)$' || true

echo
echo "배포 전 필수: release/SIGNATURE.md 의 공개 인증서 지문을"
echo "yeoulgame.com/downloads 와 GitHub Release 에 게시하세요."
