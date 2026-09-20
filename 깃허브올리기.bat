@echo off
setlocal enabledelayedexpansion
chcp 949 >nul
title 여울 SSH 클라이언트 - GitHub 업로드
cd /d "%~dp0"

rem ===================================================================
rem  업로드할 저장소 주소
rem  2026-09-20 조직 이관 완료 → yeoulgame 조직 저장소로 설정됨
rem ===================================================================
set "REPO_URL=https://github.com/yeoulgame/yeoulgame-ssh-client.git"

set "GIT_AUTHOR_NAME_DEFAULT=hym2581-afk"
set "GIT_AUTHOR_MAIL_DEFAULT=hym2581@gmail.com"

echo.
echo  ==================================================
echo   여울 SSH 클라이언트 v1.0 - GitHub 업로드
echo   대상: !REPO_URL!
echo  ==================================================
echo.
echo   올라가지 않는 것 (.gitignore 로 제외됨)
echo     signing\   서명 개인키  ^<-- 중요
echo     ebcache\   빌드 도구 캐시
echo     release\   배포 파일
echo     node_modules\
echo.

rem ---------- 1. git 확인 ----------
echo [1/6] git 확인
where git >nul 2>&1
if errorlevel 1 (
    echo       git 이 없습니다. 설치를 시작합니다 ^(winget^).
    winget install --id Git.Git -e --accept-source-agreements --accept-package-agreements
    echo.
    echo   설치가 끝났습니다. 이 창을 닫고 깃허브올리기.bat 을 다시 실행해 주세요.
    echo.
    pause
    exit /b 0
)
for /f "delims=" %%v in ('git --version') do echo       %%v

rem ---------- 2. 저장소 준비 ----------
echo [2/6] 로컬 저장소 준비
if not exist ".git" (
    git init -b main >nul 2>&1
    if errorlevel 1 ( git init >nul 2>&1 & git branch -M main >nul 2>&1 )
    echo       새로 만들었습니다.
) else (
    echo       이미 있습니다.
)

git config user.name >nul 2>&1 || git config user.name "!GIT_AUTHOR_NAME_DEFAULT!"
git config user.email >nul 2>&1 || git config user.email "!GIT_AUTHOR_MAIL_DEFAULT!"
for /f "delims=" %%v in ('git config user.name') do set "WHO=%%v"
for /f "delims=" %%v in ('git config user.email') do set "MAIL=%%v"
echo       작성자: !WHO! ^<!MAIL!^>
echo       ^(바꾸려면: git config user.name "이름"^)

rem ---------- 3. 제외 확인 ----------
echo [3/6] 제외 목록 확인
git check-ignore -q signing
if errorlevel 1 (
    echo.
    echo   *** 중지: signing 폴더가 .gitignore 에 없습니다.
    echo   *** 서명 개인키가 올라갈 수 있어 업로드를 멈춥니다.
    echo.
    pause
    exit /b 1
)
echo       signing\ 제외 확인됨

rem ---------- 4. 커밋 ----------
echo [4/6] 변경 사항 커밋
git add -A >nul 2>&1
git diff --cached --quiet
if errorlevel 1 (
    git commit -m "YSC v1.0: Core implementation complete" -m "Yeoulgame SSH Client v1.0 - YSC-2026-001" >nul
    echo       커밋 완료
) else (
    echo       바뀐 것이 없어 건너뜁니다.
)

rem ---------- 5. 원격 연결 ----------
echo [5/6] 원격 저장소 연결
git remote get-url origin >nul 2>&1
if errorlevel 1 ( git remote add origin "!REPO_URL!" ) else ( git remote set-url origin "!REPO_URL!" )
echo       origin = !REPO_URL!

echo       원격 상태 확인 중... ^(로그인 창이 뜨면 GitHub 계정으로 로그인해 주세요^)
git fetch origin main 2>nul
if errorlevel 1 (
    echo       원격에 main 이 없습니다. 새로 올립니다.
    set "REMOTE_COMMITS=0"
) else (
    for /f "delims=" %%c in ('git rev-list --count origin/main') do set "REMOTE_COMMITS=%%c"
    echo       원격 커밋 수: !REMOTE_COMMITS!
)

rem ---------- 6. 업로드 ----------
echo [6/6] 업로드
if "!REMOTE_COMMITS!"=="0" (
    git push -u origin main
) else if "!REMOTE_COMMITS!"=="1" (
    echo       원격에 초기 커밋 1개 ^(README/LICENSE/.gitignore^) 만 있습니다.
    echo       이 폴더의 정식 판으로 덮어씁니다.
    git push -u --force origin main
) else (
    echo.
    echo   *** 중지: 원격에 커밋이 !REMOTE_COMMITS! 개 있습니다.
    echo   *** 남의 작업을 덮어쓸 수 있어 자동 업로드를 멈춥니다.
    echo   *** 개발팀에 알려주세요.
    echo.
    pause
    exit /b 1
)

if errorlevel 1 (
    echo.
    echo   업로드에 실패했습니다.
    echo    - 로그인 창을 닫으셨나요? 다시 실행하면 또 뜹니다.
    echo    - 조직 이관을 하셨다면 이 파일 위쪽 REPO_URL 을 새 주소로 바꿔주세요.
    echo.
    pause
    exit /b 1
)

echo.
echo  ==================================================
echo   업로드 완료
echo  ==================================================
echo.
echo   확인: !REPO_URL:~0,-4!
echo.
echo   저장소 설정에서 아래를 채워주세요 ^(RFP 4.3.2^)
echo     설명   : Yeoulgame SSH Client - Perfect Korean language support
echo     홈페이지: https://yeoulgame.com
echo     토픽   : ssh, telnet, client, korean, game-dev
echo.
pause
