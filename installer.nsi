; Korea University Course Registration Helper Installer
; NSIS Script

;--------------------------------
; Basic Settings
!define APPNAME "KU-Sugang"
!define COMPANYNAME "Korea University Helper"
!define DESCRIPTION "Korea University Course Registration Helper"
!define VERSIONMAJOR 1
!define VERSIONMINOR 0
!define VERSIONBUILD 0
!define HELPURL "https://github.com/your-username/sugang"
!define UPDATEURL "https://github.com/your-username/sugang/releases"
!define ABOUTURL "https://github.com/your-username/sugang"
!define INSTALLSIZE 150000

;--------------------------------
; Compression
SetCompressor /SOLID lzma
SetCompressorDictSize 32

;--------------------------------
; General
Name "${APPNAME}"
OutFile "KU-Sugang-Installer-v${VERSIONMAJOR}.${VERSIONMINOR}.${VERSIONBUILD}.exe"
Unicode True

InstallDir "$PROGRAMFILES64\KU-Sugang"
InstallDirRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "InstallLocation"
RequestExecutionLevel admin

;--------------------------------
; Interface Settings
!include "MUI2.nsh"

!define MUI_ABORTWARNING
!define MUI_ICON "${NSISDIR}\Contrib\Graphics\Icons\modern-install.ico"
!define MUI_UNICON "${NSISDIR}\Contrib\Graphics\Icons\modern-uninstall.ico"

!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_RIGHT
!define MUI_HEADERIMAGE_BITMAP "${NSISDIR}\Contrib\Graphics\Header\nsis3-branding.bmp"
!define MUI_HEADERIMAGE_UNBITMAP "${NSISDIR}\Contrib\Graphics\Header\nsis3-branding.bmp"

!define MUI_WELCOMEFINISHPAGE_BITMAP "${NSISDIR}\Contrib\Graphics\Wizard\nsis3-branding.bmp"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "${NSISDIR}\Contrib\Graphics\Wizard\nsis3-branding.bmp"

;--------------------------------
; Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "LICENSE.txt"
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$INSTDIR\KU-Sugang.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Run KU-Sugang now"
!define MUI_FINISHPAGE_LINK "Visit project on GitHub"
!define MUI_FINISHPAGE_LINK_LOCATION "${ABOUTURL}"
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

;--------------------------------
; Languages
!insertmacro MUI_LANGUAGE "English"

;--------------------------------
; Version Info
VIProductVersion "${VERSIONMAJOR}.${VERSIONMINOR}.${VERSIONBUILD}.0"
VIAddVersionKey /LANG=${LANG_ENGLISH} "ProductName" "${APPNAME}"
VIAddVersionKey /LANG=${LANG_ENGLISH} "Comments" "${DESCRIPTION}"
VIAddVersionKey /LANG=${LANG_ENGLISH} "CompanyName" "${COMPANYNAME}"
VIAddVersionKey /LANG=${LANG_ENGLISH} "LegalCopyright" "© 2024 ${COMPANYNAME}"
VIAddVersionKey /LANG=${LANG_ENGLISH} "FileDescription" "${DESCRIPTION}"
VIAddVersionKey /LANG=${LANG_ENGLISH} "FileVersion" "${VERSIONMAJOR}.${VERSIONMINOR}.${VERSIONBUILD}.0"
VIAddVersionKey /LANG=${LANG_ENGLISH} "ProductVersion" "${VERSIONMAJOR}.${VERSIONMINOR}.${VERSIONBUILD}.0"
VIAddVersionKey /LANG=${LANG_ENGLISH} "InternalName" "${APPNAME}"
VIAddVersionKey /LANG=${LANG_ENGLISH} "OriginalFilename" "KU-Sugang.exe"

;--------------------------------
; Macros
!macro VerifyUserIsAdmin
UserInfo::GetAccountType
pop $0
${If} $0 != "admin"
    MessageBox MB_ICONSTOP "Administrator rights required!"
    SetErrorLevel 740
    Quit
${EndIf}
!macroend

Function .onInit
    SetShellVarContext all
    !insertmacro VerifyUserIsAdmin
FunctionEnd

Function un.onInit
    SetShellVarContext all
    !insertmacro VerifyUserIsAdmin
    
    MessageBox MB_ICONQUESTION|MB_YESNO|MB_DEFBUTTON2 "Remove ${APPNAME}?" IDYES +2
    Abort
FunctionEnd

;--------------------------------
; Install Sections
Section "!${APPNAME} (required)" SecMain
    SectionIn RO
    
    SetOutPath $INSTDIR
    
    ; Copy all files from the packaged app
    File /r "dist\KU-Sugang-win32-x64\*.*"
    
    WriteUninstaller "$INSTDIR\Uninstall.exe"
    
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayName" "${APPNAME}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "UninstallString" "$\"$INSTDIR\Uninstall.exe$\""
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "QuietUninstallString" "$\"$INSTDIR\Uninstall.exe$\" /S"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "InstallLocation" "$\"$INSTDIR$\""
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayIcon" "$\"$INSTDIR\KU-Sugang.exe$\""
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "Publisher" "${COMPANYNAME}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "HelpLink" "${HELPURL}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "URLUpdateInfo" "${UPDATEURL}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "URLInfoAbout" "${ABOUTURL}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayVersion" "${VERSIONMAJOR}.${VERSIONMINOR}.${VERSIONBUILD}"
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "VersionMajor" ${VERSIONMAJOR}
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "VersionMinor" ${VERSIONMINOR}
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "NoModify" 1
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "NoRepair" 1
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "EstimatedSize" ${INSTALLSIZE}
SectionEnd

Section "Desktop Shortcut" SecDesktop
    CreateShortcut "$DESKTOP\KU-Sugang.lnk" "$INSTDIR\KU-Sugang.exe"
SectionEnd

Section "Start Menu Shortcut" SecStartMenu
    CreateDirectory "$SMPROGRAMS\KU-Sugang"
    CreateShortcut "$SMPROGRAMS\KU-Sugang\KU-Sugang.lnk" "$INSTDIR\KU-Sugang.exe"
    CreateShortcut "$SMPROGRAMS\KU-Sugang\Uninstall.lnk" "$INSTDIR\Uninstall.exe"
SectionEnd

;--------------------------------
; Descriptions
!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
    !insertmacro MUI_DESCRIPTION_TEXT ${SecMain} "Install ${APPNAME} program files (required)"
    !insertmacro MUI_DESCRIPTION_TEXT ${SecDesktop} "Create desktop shortcut"
    !insertmacro MUI_DESCRIPTION_TEXT ${SecStartMenu} "Create start menu shortcuts"
!insertmacro MUI_FUNCTION_DESCRIPTION_END

;--------------------------------
; Uninstaller
Section "Uninstall"
    Delete "$INSTDIR\KU-Sugang.exe"
    Delete "$INSTDIR\*.dll"
    Delete "$INSTDIR\*.pak"
    Delete "$INSTDIR\*.bin"
    Delete "$INSTDIR\*.dat"
    Delete "$INSTDIR\*.json"
    Delete "$INSTDIR\version"
    Delete "$INSTDIR\LICENSE*"
    Delete "$INSTDIR\LICENSES.chromium.html"
    Delete "$INSTDIR\chrome_100_percent.pak"
    Delete "$INSTDIR\chrome_200_percent.pak"
    Delete "$INSTDIR\resources.pak"
    Delete "$INSTDIR\snapshot_blob.bin"
    Delete "$INSTDIR\v8_context_snapshot.bin"
    
    RMDir /r "$INSTDIR\locales"
    RMDir /r "$INSTDIR\resources"
    
    Delete "$INSTDIR\Uninstall.exe"
    
    Delete "$DESKTOP\KU-Sugang.lnk"
    Delete "$SMPROGRAMS\KU-Sugang\KU-Sugang.lnk"
    Delete "$SMPROGRAMS\KU-Sugang\Uninstall.lnk"
    RMDir "$SMPROGRAMS\KU-Sugang"
    
    RMDir "$INSTDIR"
    
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}"
SectionEnd