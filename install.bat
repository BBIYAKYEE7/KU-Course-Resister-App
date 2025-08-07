@echo off
chcp 65001 >nul
echo 고려대학교 수강신청 설치 프로그램
echo ================================
echo.

REM 관리자 권한 확인
net session >nul 2>&1
if %errorLevel% == 0 (
    echo 관리자 권한 확인됨
) else (
    echo 관리자 권한이 필요합니다.
    echo 이 배치 파일을 관리자 권한으로 실행하세요.
    pause
    exit /b 1
)

REM 패키징된 앱 확인
if not exist "dist\고려대학교 수강신청-win32-x64" (
    echo 패키징된 앱을 찾을 수 없습니다.
    echo 먼저 앱을 패키징하세요:
    echo npx electron-packager . "고려대학교 수강신청" --platform=win32 --arch=x64 --out=dist --overwrite
    pause
    exit /b 1
)

echo 설치를 시작합니다...
powershell.exe -ExecutionPolicy Bypass -File "create-simple-installer.ps1"

if %errorLevel% == 0 (
    echo.
    echo 설치가 완료되었습니다!
    echo 바탕화면에 바로가기가 생성되었습니다.
    echo 시작 메뉴에서도 앱을 찾을 수 있습니다.
) else (
    echo.
    echo 설치 중 오류가 발생했습니다.
)

pause
