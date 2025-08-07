# 고려대학교 수강신청 인스톨러 생성 스크립트

Write-Host "고려대학교 수강신청 인스톨러 생성 중..." -ForegroundColor Green

# NSIS가 설치되어 있는지 확인
$nsisPath = "C:\Program Files (x86)\NSIS\makensis.exe"
if (-not (Test-Path $nsisPath)) {
    Write-Host "NSIS가 설치되어 있지 않습니다. 다음 링크에서 다운로드하세요:" -ForegroundColor Yellow
    Write-Host "https://nsis.sourceforge.io/Download" -ForegroundColor Cyan
    Write-Host "설치 후 이 스크립트를 다시 실행하세요." -ForegroundColor Yellow
    exit 1
}

# 패키징된 앱이 있는지 확인
$appPath = "dist\고려대학교 수강신청-win32-x64"
if (-not (Test-Path $appPath)) {
    Write-Host "패키징된 앱을 찾을 수 없습니다. 먼저 앱을 패키징하세요." -ForegroundColor Red
    exit 1
}

# NSIS 스크립트 실행
Write-Host "NSIS 인스톨러 생성 중..." -ForegroundColor Green
& $nsisPath "installer.nsi"

if ($LASTEXITCODE -eq 0) {
    Write-Host "인스톨러 생성 완료!" -ForegroundColor Green
    Write-Host "생성된 파일: dist\고려대학교 수강신청 Setup.exe" -ForegroundColor Cyan
} else {
    Write-Host "인스톨러 생성 실패!" -ForegroundColor Red
}
