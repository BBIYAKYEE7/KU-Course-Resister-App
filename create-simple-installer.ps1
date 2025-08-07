# 고려대학교 수강신청 간단 인스톨러

param(
    [switch]$Uninstall
)

$AppName = "고려대학교 수강신청"
$AppVersion = "1.0.0"
$InstallDir = "$env:ProgramFiles\$AppName"
$SourceDir = "dist\고려대학교 수강신청-win32-x64"
$DesktopShortcut = "$env:USERPROFILE\Desktop\$AppName.lnk"
$StartMenuDir = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\$AppName"
$StartMenuShortcut = "$StartMenuDir\$AppName.lnk"

function Install-App {
    Write-Host "고려대학교 수강신청 설치 중..." -ForegroundColor Green
    
    # 설치 디렉토리 생성
    if (-not (Test-Path $InstallDir)) {
        New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    }
    
    # 파일 복사
    Write-Host "파일 복사 중..." -ForegroundColor Yellow
    Copy-Item -Path "$SourceDir\*" -Destination $InstallDir -Recurse -Force
    
    # 시작 메뉴 디렉토리 생성
    if (-not (Test-Path $StartMenuDir)) {
        New-Item -ItemType Directory -Path $StartMenuDir -Force | Out-Null
    }
    
    # 바로가기 생성
    Write-Host "바로가기 생성 중..." -ForegroundColor Yellow
    
    # 시작 메뉴 바로가기
    $WshShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut($StartMenuShortcut)
    $Shortcut.TargetPath = "$InstallDir\고려대학교 수강신청.exe"
    $Shortcut.WorkingDirectory = $InstallDir
    $Shortcut.Description = "고려대학교 수강신청 애플리케이션"
    $Shortcut.Save()
    
    # 바탕화면 바로가기
    $Shortcut = $WshShell.CreateShortcut($DesktopShortcut)
    $Shortcut.TargetPath = "$InstallDir\고려대학교 수강신청.exe"
    $Shortcut.WorkingDirectory = $InstallDir
    $Shortcut.Description = "고려대학교 수강신청 애플리케이션"
    $Shortcut.Save()
    
    # 레지스트리 등록
    Write-Host "레지스트리 등록 중..." -ForegroundColor Yellow
    $RegPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$AppName"
    New-Item -Path $RegPath -Force | Out-Null
    Set-ItemProperty -Path $RegPath -Name "DisplayName" -Value $AppName
    Set-ItemProperty -Path $RegPath -Name "DisplayVersion" -Value $AppVersion
    Set-ItemProperty -Path $RegPath -Name "Publisher" -Value "Korea University"
    Set-ItemProperty -Path $RegPath -Name "UninstallString" -Value "powershell.exe -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Uninstall"
    Set-ItemProperty -Path $RegPath -Name "DisplayIcon" -Value "$InstallDir\고려대학교 수강신청.exe"
    Set-ItemProperty -Path $RegPath -Name "EstimatedSize" -Value 200000
    Set-ItemProperty -Path $RegPath -Name "NoModify" -Value 1
    Set-ItemProperty -Path $RegPath -Name "NoRepair" -Value 1
    
    Write-Host "설치 완료!" -ForegroundColor Green
    Write-Host "설치 위치: $InstallDir" -ForegroundColor Cyan
    Write-Host "바로가기: $DesktopShortcut" -ForegroundColor Cyan
}

function Uninstall-App {
    Write-Host "고려대학교 수강신청 제거 중..." -ForegroundColor Green
    
    # 바로가기 삭제
    if (Test-Path $DesktopShortcut) {
        Remove-Item $DesktopShortcut -Force
    }
    
    if (Test-Path $StartMenuShortcut) {
        Remove-Item $StartMenuShortcut -Force
    }
    
    if (Test-Path $StartMenuDir) {
        Remove-Item $StartMenuDir -Force
    }
    
    # 설치 디렉토리 삭제
    if (Test-Path $InstallDir) {
        Remove-Item $InstallDir -Recurse -Force
    }
    
    # 레지스트리 삭제
    $RegPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$AppName"
    if (Test-Path $RegPath) {
        Remove-Item $RegPath -Recurse -Force
    }
    
    Write-Host "제거 완료!" -ForegroundColor Green
}

# 관리자 권한 확인
if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "관리자 권한이 필요합니다. 스크립트를 관리자 권한으로 실행하세요." -ForegroundColor Red
    exit 1
}

if ($Uninstall) {
    Uninstall-App
} else {
    # 소스 디렉토리 확인
    if (-not (Test-Path $SourceDir)) {
        Write-Host "패키징된 앱을 찾을 수 없습니다: $SourceDir" -ForegroundColor Red
        Write-Host "먼저 'npx electron-packager . `"고려대학교 수강신청`" --platform=win32 --arch=x64 --out=dist --overwrite'를 실행하세요." -ForegroundColor Yellow
        exit 1
    }
    
    Install-App
}
