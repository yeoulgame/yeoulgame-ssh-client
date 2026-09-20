@echo off
chcp 949 >nul
title 여울 SSH 클라이언트 - 실행 테스트
cd /d "%~dp0"

echo.
echo  ==================================================
echo   여울 SSH 클라이언트 - 실행 테스트
echo  ==================================================
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo   Node.js 가 없습니다. 먼저 빌드.bat 을 실행해 주세요.
    pause
    exit /b 1
)
if not exist node_modules (
    echo   의존성이 없습니다. 먼저 빌드.bat 을 실행해 주세요.
    pause
    exit /b 1
)

echo   프로그램을 띄웁니다. 아래 항목을 확인해 주세요.
echo.
echo    1. 메뉴와 버튼이 한글로 나오는지
echo    2. 새 연결^(Ctrl+Shift+N^)로 여울게임터 머드 서버 접속
echo    3. 한글 명령/출력이 깨지지 않는지
echo         mkdir 테스트
echo         ls -la
echo         cat 한글파일.txt
echo    4. 한글 복사^(Ctrl+Shift+C^) / 붙여넣기^(Ctrl+Shift+V^)
echo    5. 탭 추가^(Ctrl+Shift+T^) 및 전환^(Ctrl+Tab^)
echo    6. 도움말 ^> 정보 에서 자체 서명 안내 표시
echo.
echo   프로그램 창을 닫으면 이 창도 끝납니다.
echo.

call npm start

echo.
echo   종료되었습니다.
pause
