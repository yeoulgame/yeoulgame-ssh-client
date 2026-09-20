# Yeoulgame SSH Client v1.0
# Copyright (c) 2026 Yeoulgame (yeoulgame.com)
# Licensed under MIT License
#
# Windows 배포 빌드 스크립트
#   PowerShell 에서:
#     .\scripts\build-win.ps1                 일반 빌드 + 자체 서명 + 해시
#     .\scripts\build-win.ps1 -Obfuscate      난독화 빌드
#     .\scripts\build-win.ps1 -NoSign         서명 없이 빌드만
#
# 서명 방식: OpenSSL 자체 서명 (YSC-2026-001 연구팀 결정 2번)
#   - signing\yeoulgame-codesign.pfx 가 없으면 자동 생성됩니다.
#   - 공인 CA 인증서가 아니므로 SmartScreen 경고는 그대로 표시됩니다(수용됨).
#   - 사용자는 release\SIGNATURE.md 의 절차로 무결성을 검증합니다.

param(
    [switch]$Obfuscate,
    [switch]$NoSign,
    [string]$PfxPassword = "yeoulgame"
)

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

Write-Host "[1/6] Node.js 확인" -ForegroundColor Cyan
node -v
npm -v

Write-Host "[2/6] 의존성 설치" -ForegroundColor Cyan
npm install

Write-Host "[3/6] 소스 검증 (i18n / 문법 / 한글 인코딩 / 자격증명)" -ForegroundColor Cyan
npm run verify

if (-not $NoSign) {
    Write-Host "[4/6] 자체 서명 인증서 준비" -ForegroundColor Cyan
    $env:YSC_PFX_PASSWORD = $PfxPassword
    node scripts/sign-release.js --cert-only

    # electron-builder 가 빌드 중에 exe 를 직접 서명하도록 연결
    $env:CSC_LINK = (Resolve-Path "signing\yeoulgame-codesign.pfx").Path
    $env:CSC_KEY_PASSWORD = $PfxPassword
} else {
    Write-Host "[4/6] 서명 건너뜀 (-NoSign)" -ForegroundColor DarkGray
}

if ($Obfuscate) {
    Write-Host "[5/6] 난독화 + 패키징" -ForegroundColor Cyan
    node scripts/obfuscate.js
    npx electron-builder --win --config.directories.app=dist-obfuscated
} else {
    Write-Host "[5/6] 패키징 (Windows)" -ForegroundColor Cyan
    npm run dist:win
}

Write-Host "[6/6] detached 서명 + SHA-256 해시" -ForegroundColor Cyan
if (-not $NoSign) { node scripts/sign-release.js }
npm run hash

Write-Host ""
Write-Host "빌드 완료. release\ 폴더를 확인하세요." -ForegroundColor Green
Get-ChildItem release | Where-Object { $_.Extension -in ".exe", ".zip", ".sig", ".crt", ".txt", ".md" } | Format-Table Name, Length

Write-Host ""
Write-Host "배포 전 필수: release\SIGNATURE.md 의 공개 인증서 지문을" -ForegroundColor Yellow
Write-Host "yeoulgame.com/board/files/5 와 GitHub Release 에 게시하세요." -ForegroundColor Yellow
