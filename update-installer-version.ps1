# package.json에서 버전을 읽어와서 installer.iss 파일을 업데이트하는 스크립트

# package.json 파일 읽기
$packageJson = Get-Content "package.json" | ConvertFrom-Json
$version = $packageJson.version

Write-Host "package.json에서 읽은 버전: $version"

# installer.iss 파일 읽기
$installerContent = Get-Content "installer.iss" -Raw

# 버전 정의 라인 찾기 및 교체
$pattern = '#define MyAppVersion "([^"]*)"'
$replacement = "#define MyAppVersion `"$version`""

if ($installerContent -match $pattern) {
    $newContent = $installerContent -replace $pattern, $replacement
    
    # 파일에 다시 쓰기 (UTF-8 BOM으로 저장하여 인코딩 문제 방지)
    Set-Content "installer.iss" $newContent -Encoding UTF8
    
    Write-Host "✅ installer.iss 파일이 버전 $version으로 업데이트되었습니다."
} else {
    Write-Host "❌ installer.iss에서 버전 정의를 찾을 수 없습니다."
}

# 추가로 OutputBaseFilename도 버전을 포함하도록 업데이트
$outputPattern = 'OutputBaseFilename=([^#\r\n]*)'
$outputReplacement = "OutputBaseFilename=KoreaUniversitySugang-Setup-v$version"

if ($newContent -match $outputPattern) {
    $finalContent = $newContent -replace $outputPattern, $outputReplacement
    Set-Content "installer.iss" $finalContent -Encoding UTF8
    Write-Host "✅ OutputBaseFilename이 버전을 포함하도록 업데이트되었습니다."
}
