# 고려대학교 수강신청 간단 MSI 인스톨러 생성 스크립트

Write-Host "고려대학교 수강신청 MSI 인스톨러 생성 중..." -ForegroundColor Green

# 패키징된 앱 확인
$appPath = "dist\고려대학교 수강신청-win32-x64"
if (-not (Test-Path $appPath)) {
    Write-Host "패키징된 앱을 찾을 수 없습니다: $appPath" -ForegroundColor Red
    Write-Host "먼저 앱을 패키징하세요:" -ForegroundColor Yellow
    Write-Host "npx electron-packager . `"고려대학교 수강신청`" --platform=win32 --arch=x64 --out=dist --overwrite" -ForegroundColor Cyan
    exit 1
}

# Inno Setup 스크립트 생성
$innoScript = @"
[Setup]
AppName=고려대학교 수강신청
AppVersion=1.0.0
AppPublisher=Korea University
AppPublisherURL=https://korea.ac.kr
AppSupportURL=https://github.com/your-username/sugang
AppUpdatesURL=https://github.com/your-username/sugang
DefaultDirName={autopf}\고려대학교 수강신청
DefaultGroupName=고려대학교 수강신청
AllowNoIcons=yes
LicenseFile=dist\고려대학교 수강신청-win32-x64\LICENSE
OutputDir=dist
OutputBaseFilename=고려대학교 수강신청 Setup
SetupIconFile=assets\icon.ico
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin

[Languages]
Name: "korean"; MessagesFile: "compiler:Languages\Korean.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "dist\고려대학교 수강신청-win32-x64\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs


[Icons]
Name: "{group}\고려대학교 수강신청"; Filename: "{app}\고려대학교 수강신청.exe"
Name: "{group}\{cm:UninstallProgram,고려대학교 수강신청}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\고려대학교 수강신청"; Filename: "{app}\고려대학교 수강신청.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\고려대학교 수강신청.exe"; Description: "{cm:LaunchProgram,고려대학교 수강신청}"; Flags: nowait postinstall skipifsilent
"@

# Inno Setup 스크립트 저장
Set-Content "installer.iss" $innoScript -Encoding UTF8
Write-Host "Inno Setup 스크립트 생성 완료" -ForegroundColor Green

# Inno Setup 컴파일러 확인
$innoPaths = @(
    "C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
    "C:\Program Files\Inno Setup 6\ISCC.exe",
    "C:\Program Files (x86)\Inno Setup 5\ISCC.exe",
    "C:\Program Files\Inno Setup 5\ISCC.exe"
)

$innoCompiler = $null
foreach ($path in $innoPaths) {
    if (Test-Path $path) {
        $innoCompiler = $path
        break
    }
}

if ($innoCompiler) {
    Write-Host "Inno Setup 컴파일러 발견: $innoCompiler" -ForegroundColor Green
    
    # Inno Setup으로 설치 프로그램 생성
    Write-Host "설치 프로그램 생성 중..." -ForegroundColor Yellow
    & $innoCompiler "installer.iss"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "설치 프로그램 생성 완료!" -ForegroundColor Green
        Write-Host "생성된 파일: dist\고려대학교 수강신청 Setup.exe" -ForegroundColor Cyan
    } else {
        Write-Host "설치 프로그램 생성 실패!" -ForegroundColor Red
    }
} else {
    Write-Host "Inno Setup이 설치되어 있지 않습니다." -ForegroundColor Yellow
    Write-Host "다음 링크에서 다운로드하세요:" -ForegroundColor Cyan
    Write-Host "https://jrsoftware.org/isdl.php" -ForegroundColor Cyan
    Write-Host "설치 후 이 스크립트를 다시 실행하세요." -ForegroundColor Yellow
    
    # 대안: 7-Zip을 사용한 자체 추출 실행 파일 생성
    Write-Host "대안: 자체 추출 실행 파일 생성 중..." -ForegroundColor Yellow
    
    # 7-Zip 확인
    $sevenZipPaths = @(
        "C:\Program Files\7-Zip\7z.exe",
        "C:\Program Files (x86)\7-Zip\7z.exe"
    )
    
    $sevenZip = $null
    foreach ($path in $sevenZipPaths) {
        if (Test-Path $path) {
            $sevenZip = $path
            break
        }
    }
    
    if ($sevenZip) {
        Write-Host "7-Zip 발견: $sevenZip" -ForegroundColor Green
        
        # 압축 파일 생성
        $archiveName = "dist\고려대학교 수강신청.zip"
        & $sevenZip "a" "-tzip" $archiveName "$appPath\*" "-r"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "압축 파일 생성 완료: $archiveName" -ForegroundColor Green
            Write-Host "이 파일을 배포할 수 있습니다." -ForegroundColor Cyan
        } else {
            Write-Host "압축 파일 생성 실패!" -ForegroundColor Red
        }
    } else {
        Write-Host "7-Zip도 설치되어 있지 않습니다." -ForegroundColor Yellow
        Write-Host "다음 중 하나를 설치하세요:" -ForegroundColor Cyan
        Write-Host "1. Inno Setup: https://jrsoftware.org/isdl.php" -ForegroundColor Cyan
        Write-Host "2. 7-Zip: https://7-zip.org/" -ForegroundColor Cyan
    }
}

Write-Host "MSI 인스톨러 생성 프로세스 완료!" -ForegroundColor Green
