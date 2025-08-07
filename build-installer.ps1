# 고려대학교 수강신청 앱 자동 빌드 스크립트

Write-Host "🚀 고려대학교 수강신청 앱 빌드 시작..." -ForegroundColor Green

# 1. package.json에서 버전 읽기
$packageJson = Get-Content "package.json" | ConvertFrom-Json
$version = $packageJson.version
Write-Host "📦 현재 버전: $version" -ForegroundColor Yellow

# 2. installer.iss 파일 업데이트
Write-Host "📝 installer.iss 파일 업데이트 중..." -ForegroundColor Cyan
& ".\update-installer-version.ps1"

# 3. 기존 빌드 파일 정리
Write-Host "🧹 기존 빌드 파일 정리 중..." -ForegroundColor Cyan
if (Test-Path "dist") {
    Remove-Item "dist" -Recurse -Force
    Write-Host "  - dist 폴더 삭제됨" -ForegroundColor Gray
}
if (Test-Path "Output") {
    Remove-Item "Output" -Recurse -Force
    Write-Host "  - Output 폴더 삭제됨" -ForegroundColor Gray
}

# 4. npm 의존성 설치 확인
Write-Host "📦 npm 의존성 확인 중..." -ForegroundColor Cyan
if (-not (Test-Path "node_modules")) {
    Write-Host "  - node_modules가 없습니다. npm install 실행 중..." -ForegroundColor Yellow
    npm install
} else {
    Write-Host "  - node_modules가 존재합니다." -ForegroundColor Gray
}

# 5. Electron 앱 빌드
Write-Host "🔨 Electron 앱 빌드 중..." -ForegroundColor Cyan
npm run build:win

# 6. 빌드 결과 확인
if (Test-Path "dist") {
    Write-Host "✅ Electron 빌드 완료!" -ForegroundColor Green
    $distFiles = Get-ChildItem "dist" -Recurse | Measure-Object
    Write-Host "  - 생성된 파일 수: $($distFiles.Count)" -ForegroundColor Gray
} else {
    Write-Host "❌ Electron 빌드 실패!" -ForegroundColor Red
    exit 1
}

# 7. Inno Setup 설치 확인
Write-Host "🔧 Inno Setup 확인 중..." -ForegroundColor Cyan
$innoSetupPath = "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe"
if (Test-Path $innoSetupPath) {
    Write-Host "  - Inno Setup 6 발견됨: $innoSetupPath" -ForegroundColor Gray
} else {
    $innoSetupPath = "${env:ProgramFiles}\Inno Setup 6\ISCC.exe"
    if (Test-Path $innoSetupPath) {
        Write-Host "  - Inno Setup 6 발견됨: $innoSetupPath" -ForegroundColor Gray
    } else {
        Write-Host "❌ Inno Setup 6을 찾을 수 없습니다!" -ForegroundColor Red
        Write-Host "  - Inno Setup 6을 설치해주세요: https://jrsoftware.org/isinfo.php" -ForegroundColor Yellow
        exit 1
    }
}

# 8. Inno Setup으로 설치 파일 생성
Write-Host "📦 설치 파일 생성 중..." -ForegroundColor Cyan
& $innoSetupPath "installer.iss"

# 9. 생성된 설치 파일 확인
$setupFile = "Output\KoreaUniversitySugang-Setup-v$version.exe"
if (Test-Path $setupFile) {
    $fileSize = (Get-Item $setupFile).Length / 1MB
    Write-Host "✅ 설치 파일 생성 완료!" -ForegroundColor Green
    Write-Host "  - 파일: $setupFile" -ForegroundColor Gray
    Write-Host "  - 크기: $([math]::Round($fileSize, 2)) MB" -ForegroundColor Gray
} else {
    Write-Host "❌ 설치 파일 생성 실패!" -ForegroundColor Red
    exit 1
}

# 10. 빌드 완료 요약
Write-Host ""
Write-Host "🎉 빌드 완료!" -ForegroundColor Green
Write-Host "📁 생성된 파일들:" -ForegroundColor Yellow
Get-ChildItem "Output" | ForEach-Object {
    Write-Host "  - $($_.Name) ($([math]::Round($_.Length / 1MB, 2)) MB)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "💡 다음 단계:" -ForegroundColor Cyan
Write-Host "  1. 생성된 설치 파일을 테스트해보세요" -ForegroundColor White
Write-Host "  2. GitHub에 릴리즈를 업로드하세요" -ForegroundColor White
Write-Host "  3. 사용자들에게 배포하세요" -ForegroundColor White
