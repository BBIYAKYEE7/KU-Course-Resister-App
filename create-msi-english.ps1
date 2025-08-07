# Korea University Sugang MSI Installer Creation Script

Write-Host "Korea University Sugang MSI Installer Creation..." -ForegroundColor Green

# Check packaged app
$appPath = "dist\KoreaUniversitySugang-win32-x64"
if (-not (Test-Path $appPath)) {
    Write-Host "Packaged app not found: $appPath" -ForegroundColor Red
    Write-Host "Please package the app first:" -ForegroundColor Yellow
    Write-Host "npx electron-packager . `"KoreaUniversitySugang`" --platform=win32 --arch=x64 --out=dist --overwrite" -ForegroundColor Cyan
    exit 1
}

Write-Host "Packaged app found: $appPath" -ForegroundColor Green

# Create Inno Setup script
$innoScript = @"
[Setup]
AppName=Korea University Sugang
AppVersion=1.0.0
AppPublisher=Korea University
AppPublisherURL=https://korea.ac.kr
AppSupportURL=https://github.com/your-username/sugang
AppUpdatesURL=https://github.com/your-username/sugang
DefaultDirName={autopf}\KoreaUniversitySugang
DefaultGroupName=Korea University Sugang
AllowNoIcons=yes
LicenseFile=dist\KoreaUniversitySugang-win32-x64\LICENSE
OutputDir=dist
OutputBaseFilename=KoreaUniversitySugang Setup
SetupIconFile=assets\icon.ico
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "dist\KoreaUniversitySugang-win32-x64\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\Korea University Sugang"; Filename: "{app}\KoreaUniversitySugang.exe"
Name: "{group}\{cm:UninstallProgram,Korea University Sugang}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\Korea University Sugang"; Filename: "{app}\KoreaUniversitySugang.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\KoreaUniversitySugang.exe"; Description: "{cm:LaunchProgram,Korea University Sugang}"; Flags: nowait postinstall skipifsilent
"@

# Save Inno Setup script
Set-Content "installer.iss" $innoScript -Encoding UTF8
Write-Host "Inno Setup script created successfully" -ForegroundColor Green

# Check Inno Setup compiler
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
    Write-Host "Inno Setup compiler found: $innoCompiler" -ForegroundColor Green
    
    # Create installer with Inno Setup
    Write-Host "Creating installer..." -ForegroundColor Yellow
    & $innoCompiler "installer.iss"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Installer created successfully!" -ForegroundColor Green
        Write-Host "Created file: dist\KoreaUniversitySugang Setup.exe" -ForegroundColor Cyan
    } else {
        Write-Host "Installer creation failed!" -ForegroundColor Red
    }
} else {
    Write-Host "Inno Setup is not installed." -ForegroundColor Yellow
    Write-Host "Please download from:" -ForegroundColor Cyan
    Write-Host "https://jrsoftware.org/isdl.php" -ForegroundColor Cyan
    Write-Host "Install and run this script again." -ForegroundColor Yellow
    
    # Alternative: Create self-extracting executable with 7-Zip
    Write-Host "Alternative: Creating self-extracting executable..." -ForegroundColor Yellow
    
    # Check 7-Zip
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
        Write-Host "7-Zip found: $sevenZip" -ForegroundColor Green
        
        # Create archive
        $archiveName = "dist\KoreaUniversitySugang.zip"
        & $sevenZip "a" "-tzip" $archiveName "$appPath\*" "-r"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Archive created successfully: $archiveName" -ForegroundColor Green
            Write-Host "This file can be distributed." -ForegroundColor Cyan
        } else {
            Write-Host "Archive creation failed!" -ForegroundColor Red
        }
    } else {
        Write-Host "7-Zip is also not installed." -ForegroundColor Yellow
        Write-Host "Please install one of the following:" -ForegroundColor Cyan
        Write-Host "1. Inno Setup: https://jrsoftware.org/isdl.php" -ForegroundColor Cyan
        Write-Host "2. 7-Zip: https://7-zip.org/" -ForegroundColor Cyan
    }
}

Write-Host "MSI installer creation process completed!" -ForegroundColor Green
