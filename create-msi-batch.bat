@echo off
chcp 65001 >nul
echo 고려대학교 수강신청 MSI 인스톨러 생성
echo ======================================
echo.

REM 패키징된 앱 확인
if not exist "dist\KoreaUniversitySugang-win32-x64" (
    echo 패키징된 앱을 찾을 수 없습니다.
    echo 먼저 앱을 패키징하세요:
    echo npx electron-packager . "KoreaUniversitySugang" --platform=win32 --arch=x64 --out=dist --overwrite
    pause
    exit /b 1
)

echo 패키징된 앱 발견: dist\KoreaUniversitySugang-win32-x64

REM 7-Zip으로 압축 파일 생성
echo 압축 파일 생성 중...
powershell.exe -Command "& { $sevenZip = 'C:\Program Files\7-Zip\7z.exe'; if (Test-Path $sevenZip) { & $sevenZip 'a' '-tzip' 'dist\KoreaUniversitySugang.zip' 'dist\KoreaUniversitySugang-win32-x64\*' '-r' } else { Write-Host '7-Zip이 설치되어 있지 않습니다.' } }"

if exist "dist\KoreaUniversitySugang.zip" (
    echo 압축 파일 생성 완료: dist\KoreaUniversitySugang.zip
) else (
    echo 압축 파일 생성 실패!
)

REM 설치 스크립트 생성
echo 설치 스크립트 생성 중...
powershell.exe -ExecutionPolicy Bypass -File "create-msi-english.ps1"

echo.
echo MSI 인스톨러 생성 프로세스 완료!
echo.
echo 다음 파일들이 생성되었습니다:
echo - dist\KoreaUniversitySugang-win32-x64\ (포터블 버전)
echo - dist\KoreaUniversitySugang.zip (압축 파일)
echo - installer.iss (Inno Setup 스크립트)
echo.
echo Inno Setup을 설치하면 MSI 인스톨러를 생성할 수 있습니다:
echo https://jrsoftware.org/isdl.php
echo.
pause
