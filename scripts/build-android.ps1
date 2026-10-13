$ErrorActionPreference = 'Stop'

$frontendRoot = Split-Path -Parent $PSScriptRoot
$androidRoot = Join-Path $frontendRoot 'android'
$artifactRoot = Join-Path $frontendRoot 'artifacts'
$apkSource = Join-Path $androidRoot 'app\build\outputs\apk\debug\app-debug.apk'
$apkDestination = Join-Path $artifactRoot 'SupplyMindAI-demo.apk'

$androidStudioJava = 'C:\Program Files\Android\Android Studio\jbr'
if (Test-Path -LiteralPath $androidStudioJava) {
  $env:JAVA_HOME = $androidStudioJava
}

$env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk'

# The demo laptop keeps Gradle caches on D: because the system drive is small.
# Teammates without D: automatically use their normal user Gradle directory.
if (Test-Path -LiteralPath 'D:\') {
  $env:GRADLE_USER_HOME = 'D:\GradleCacheSupplyMind'
  $env:TEMP = 'D:\SupplyMindTemp'
  $env:TMP = 'D:\SupplyMindTemp'
  New-Item -ItemType Directory -Force -Path $env:GRADLE_USER_HOME, $env:TEMP | Out-Null
}

Push-Location $frontendRoot
try {
  npm run mobile:sync

  Push-Location $androidRoot
  try {
    .\gradlew.bat assembleDebug --no-daemon
  }
  finally {
    Pop-Location
  }

  New-Item -ItemType Directory -Force -Path $artifactRoot | Out-Null
  Copy-Item -LiteralPath $apkSource -Destination $apkDestination -Force
  Write-Host "APK ready: $apkDestination"
}
finally {
  Pop-Location
}
