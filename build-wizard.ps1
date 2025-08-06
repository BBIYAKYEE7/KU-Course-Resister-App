# 고려대 수강신청 시스템 설치 마법사 빌드 스크립트

Write-Host ""
Write-Host "🧙‍♂️ 고려대 수강신청 설치 마법사 빌드 시작..." -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Electron 앱 패키징
Write-Host "📦 1단계: Electron 앱 패키징..." -ForegroundColor Yellow
npx @electron/packager . "고려대 수강신청" --platform=win32 --arch=x64 --out=dist --overwrite --icon=assets/icon.png

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Electron 패키징 실패!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Electron 패키징 완료!" -ForegroundColor Green
Write-Host ""

# 2. NSIS 설치 마법사 빌드
Write-Host "🔧 2단계: NSIS 설치 마법사 생성..." -ForegroundColor Yellow

# NSIS 경로 찾기
$nsisPath = @(
    "${env:ProgramFiles}\NSIS\makensis.exe",
    "${env:ProgramFiles(x86)}\NSIS\makensis.exe",
    "C:\Program Files\NSIS\makensis.exe",
    "C:\Program Files (x86)\NSIS\makensis.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($nsisPath) {
    Write-Host "✅ NSIS 발견: $nsisPath" -ForegroundColor Green
    
    # 라이센스 파일 생성 (임시)
    $licenseContent = @"
고려대학교 수강신청 도우미 애플리케이션
==========================================

MIT License

Copyright (c) 2024 Korea University Course Registration Helper

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

주의사항:
- 이 소프트웨어는 교육 목적으로 제작되었습니다.
- 고려대학교와 공식적인 관련이 없습니다.
- 사용자는 본 소프트웨어 사용으로 인한 모든 책임을 져야 합니다.
"@
    
    $licenseContent | Out-File -FilePath "LICENSE.txt" -Encoding UTF8
    
    Write-Host "🔨 NSIS 컴파일 실행 중..." -ForegroundColor Yellow
    & $nsisPath "installer.nsi"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "🎉 설치 마법사 생성 완료!" -ForegroundColor Green
        Write-Host ""
        
        # 생성된 파일 확인
        $installerFile = Get-ChildItem -Name "고려대-수강신청-설치마법사-*.exe" | Select-Object -First 1
        if ($installerFile) {
            $fileSize = [math]::Round((Get-Item $installerFile).Length / 1MB, 1)
            Write-Host "📁 생성된 설치 마법사:" -ForegroundColor Cyan
            Write-Host "   파일명: $installerFile" -ForegroundColor White
            Write-Host "   크기: ${fileSize} MB" -ForegroundColor White
            Write-Host ""
            
            Write-Host "✨ 설치 마법사 특징:" -ForegroundColor Cyan
            Write-Host "   ✅ 전문적인 GUI 설치 인터페이스" -ForegroundColor Green
            Write-Host "   ✅ 라이센스 동의 페이지" -ForegroundColor Green
            Write-Host "   ✅ 설치 구성 요소 선택" -ForegroundColor Green
            Write-Host "   ✅ 설치 경로 선택" -ForegroundColor Green
            Write-Host "   ✅ 바탕화면/시작메뉴 바로가기 옵션" -ForegroundColor Green
            Write-Host "   ✅ 자동 제거 프로그램 등록" -ForegroundColor Green
            Write-Host "   ✅ 설치 완료 후 실행 옵션" -ForegroundColor Green
            Write-Host ""
            
            Write-Host "🚀 배포 방법:" -ForegroundColor Cyan
            Write-Host "   1. '$installerFile' 파일을 웹사이트에 업로드" -ForegroundColor White
            Write-Host "   2. 사용자가 다운로드하여 실행" -ForegroundColor White
            Write-Host "   3. 설치 마법사가 자동으로 안내" -ForegroundColor White
            Write-Host ""
        }
        
        # 임시 파일 정리
        if (Test-Path "LICENSE.txt") {
            Remove-Item "LICENSE.txt"
        }
        
    } else {
        Write-Host "❌ NSIS 컴파일 실패!" -ForegroundColor Red
        Write-Host "오류 코드: $LASTEXITCODE" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "❌ NSIS를 찾을 수 없습니다!" -ForegroundColor Red
    Write-Host "NSIS가 제대로 설치되지 않았을 수 있습니다." -ForegroundColor Yellow
    Write-Host "다시 설치해보세요: winget install NSIS.NSIS" -ForegroundColor Yellow
    exit 1
}

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "🎯 빌드 완료!" -ForegroundColor Green
Write-Host "설치 마법사가 준비되었습니다!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""