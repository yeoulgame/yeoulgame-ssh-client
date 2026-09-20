@echo off
setlocal enabledelayedexpansion
chcp 949 >nul
title 여울 SSH 클라이언트 - 전체 빌드 (YSC-2026-001)
cd /d "%~dp0"

set "LOG=%~dp0빌드로그.txt"
echo ================================================== > "%LOG%"
echo  Yeoulgame SSH Client v1.0 빌드 로그 >> "%LOG%"
echo  시작: %DATE% %TIME% >> "%LOG%"
echo ================================================== >> "%LOG%"

echo.
echo  ==================================================
echo   여울 SSH 클라이언트 v1.0 - 전체 빌드
echo   프로젝트 코드: YSC-2026-001
echo  ==================================================
echo.
echo   이 창을 닫지 말고 끝날 때까지 기다려 주세요.
echo   전체 로그는 빌드로그.txt 에 저장됩니다.
echo.

rem ---------- Git for Windows 의 openssl 을 PATH 에 추가 ----------
if exist "%ProgramFiles%\Git\usr\bin\openssl.exe" set "PATH=%PATH%;%ProgramFiles%\Git\usr\bin"
if exist "%ProgramFiles(x86)%\Git\usr\bin\openssl.exe" set "PATH=%PATH%;%ProgramFiles(x86)%\Git\usr\bin"

rem ---------- electron-builder 가 macOS 서명 도구를 받지 않도록 ----------
set CSC_IDENTITY_AUTO_DISCOVERY=false
rem ---------- 서명 도구 캐시를 프로젝트 안으로 (심볼릭 링크 권한 문제 회피) ----------
set "ELECTRON_BUILDER_CACHE=%~dp0ebcache"

rem ================= 1. Node.js 확인 =================
echo [1/7] Node.js 확인
echo. >> "%LOG%"
echo ===== [1/7] Node.js 확인 ===== >> "%LOG%"
where node >nul 2>&1
if errorlevel 1 (
    echo       Node.js 가 없습니다. 설치를 시작합니다 ^(winget^).
    echo Node.js 미설치 - winget 설치 시도 >> "%LOG%"
    winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements >> "%LOG%" 2>&1
    echo.
    echo   Node.js 설치 완료. 이 창을 닫고 빌드.bat 을 다시 실행해 주세요.
    echo.
    pause
    exit /b 0
)
for /f "delims=" %%v in ('node -v') do set NODEVER=%%v
for /f "delims=" %%v in ('npm -v') do set NPMVER=%%v
echo       Node !NODEVER!  /  npm !NPMVER!
echo Node !NODEVER! / npm !NPMVER! >> "%LOG%"

rem ================= 2. 의존성 설치 =================
echo [2/7] 의존성 설치
echo. >> "%LOG%"
echo ===== [2/7] npm install ===== >> "%LOG%"
call npm install --no-audit --no-fund >> "%LOG%" 2>&1
if errorlevel 1 goto :fail
echo       설치 완료

rem ================= 3. 자동 검증 =================
echo [3/7] 자동 검증 ^(i18n / 문법 / 한글 인코딩 / 자격증명^)
echo. >> "%LOG%"
echo ===== [3/7] npm run verify ===== >> "%LOG%"
call npm run verify >> "%LOG%" 2>&1
if errorlevel 1 goto :fail
echo       검증 통과

rem ================= 4. Windows 배포 파일 =================
echo [4/7] Windows 설치 파일 생성 ^(몇 분 걸립니다^)
echo. >> "%LOG%"
echo ===== [4/7] npm run dist:win ===== >> "%LOG%"
set "WINMETA=full"
call npm run dist:win >> "%LOG%" 2>&1
if not errorlevel 1 goto :distok

echo       1차 시도 실패 - 서명 도구 압축 해제 권한 문제로 보입니다.
echo       실행 파일 메타데이터 편집을 끄고 다시 시도합니다.
echo. >> "%LOG%"
echo ===== [4/7-재시도] signAndEditExecutable=false ===== >> "%LOG%"
set "WINMETA=skip"
call npx electron-builder --win --config.win.signAndEditExecutable=false >> "%LOG%" 2>&1
if errorlevel 1 goto :fail

:distok
echo       생성 완료

rem ================= 5. 자체 서명 =================
echo [5/7] 자체 서명
echo. >> "%LOG%"
echo ===== [5/7] npm run sign ===== >> "%LOG%"
call npm run sign >> "%LOG%" 2>&1
if errorlevel 1 goto :fail
echo       서명 완료
set "SIGNED=yes"

rem ================= 6. 해시 =================
echo [6/7] SHA-256 해시 생성
echo. >> "%LOG%"
echo ===== [6/7] npm run hash ===== >> "%LOG%"
call npm run hash >> "%LOG%" 2>&1
if errorlevel 1 goto :fail
echo       생성 완료

rem ================= 7. 결과 =================
echo [7/7] 결과 정리
echo. >> "%LOG%"
echo ===== [7/7] release 폴더 ===== >> "%LOG%"
dir /b release >> "%LOG%" 2>&1
echo WINMETA=!WINMETA!  SIGNED=!SIGNED! >> "%LOG%"

echo.
echo  ==================================================
echo   빌드 완료
echo  ==================================================
echo.
dir /b release\*.exe release\*.zip release\*.txt release\*.md 2>nul
echo.
if "!WINMETA!"=="skip" (
    echo   [참고] 실행 파일의 속성^>세부 정보 메타데이터가 빠졌습니다.
    echo          Windows 설정 ^> 시스템 ^> 개발자용 에서
    echo          "개발자 모드"를 켜고 빌드.bat 을 다시 실행하면
    echo          메타데이터까지 완전하게 만들어집니다.
    echo.
)
echo   다음 단계: 실행테스트.bat 으로 한글 입출력을 확인하세요.
echo.
echo 완료: %DATE% %TIME% >> "%LOG%"
pause
exit /b 0

:fail
echo.
echo  --------------------------------------------------
echo   실패했습니다. 빌드로그.txt 를 확인해 주세요.
echo  --------------------------------------------------
echo *** 실패 (errorlevel %errorlevel%) : %DATE% %TIME% >> "%LOG%"
echo.
pause
exit /b 1
