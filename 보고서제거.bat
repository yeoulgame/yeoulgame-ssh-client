@echo off
chcp 949 > nul
setlocal
cd /d "%~dp0"

echo ==========================================================
echo  내부 보고서를 공개 저장소에서 제거
echo ==========================================================
echo.

git check-ignore -q signing
if errorlevel 1 ( echo *** 중지: signing 폴더가 .gitignore 에 없습니다. & pause & exit /b 1 )

echo [1/3] 추적 해제
git rm --cached "YSC-2026-001_배포완료_보고서.md" > nul 2>nul
if errorlevel 1 echo      이미 추적되지 않음. 건너뜁니다.

echo [2/3] 커밋
git add .gitignore
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "Remove internal team report from public repository" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
) else (
  echo      변경 사항 없음. 종료합니다.
  pause
  exit /b 0
)

echo [3/3] 푸시
git push origin main
if errorlevel 1 ( echo *** 푸시 실패. & pause & exit /b 1 )

echo.
echo ==========================================================
echo  완료. 로컬 보고서 파일은 그대로 남아 있습니다.
echo ==========================================================
pause
