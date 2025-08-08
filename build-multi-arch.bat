@echo off
echo 고려대학교 수강신청 앱 - 다중 아키텍처 빌드 스크립트
echo ================================================

echo.
echo 1. x64 아키텍처 빌드 중...
call npm run build:win:x64
if %errorlevel% neq 0 (
    echo x64 빌드 실패!
    pause
    exit /b 1
)

echo.
echo 2. ia32 아키텍처 빌드 중...
call npm run build:win:ia32
if %errorlevel% neq 0 (
    echo ia32 빌드 실패!
    pause
    exit /b 1
)

echo.
echo 3. arm64 아키텍처 빌드 중...
call npm run build:win:arm64
if %errorlevel% neq 0 (
    echo arm64 빌드 실패!
    pause
    exit /b 1
)

echo.
echo 모든 아키텍처 빌드 완료!
echo 빌드된 파일들은 dist 폴더에 있습니다.
echo.
echo 생성된 파일들:
dir /b dist\*.exe

pause
