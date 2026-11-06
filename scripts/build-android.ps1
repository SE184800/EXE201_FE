$ErrorActionPreference = 'Stop'

$frontendRoot = Split-Path -Parent $PSScriptRoot
$androidRoot = Join-Path $frontendRoot 'android'
$artifactRoot = Join-Path $frontendRoot 'artifacts'
$apkSource = Join-Path $androidRoot 'app\build\outputs\apk\debug\app-debug.apk'
$apkDestination = Join-Path $artifactRoot 'SupplyMindAI-demo.apk'

$javaCandidates = @($env:JAVA_HOME, 'C:\Program Files\Android\Android Studio\jbr', 'D:\android\jbr', 'C:\jdk-22.0.1')
$javaPath = $javaCandidates | Where-Object { $_ -and (Test-Path -LiteralPath (Join-Path $_ 'bin\java.exe')) } | Select-Object -First 1
if (-not $javaPath) { throw 'Khong tim thay JDK. Dat JAVA_HOME truoc khi build.' }
$env:JAVA_HOME = $javaPath

$sdkCandidates = @($env:ANDROID_HOME, $env:ANDROID_SDK_ROOT, (Join-Path $env:LOCALAPPDATA 'Android\Sdk'), 'C:\Android\Sdk')
$sdkPath = $sdkCandidates | Where-Object { $_ -and (Test-Path -LiteralPath (Join-Path $_ 'platform-tools')) } | Select-Object -First 1
if (-not $sdkPath) { throw 'Khong tim thay Android SDK. Dat ANDROID_HOME truoc khi build.' }
$env:ANDROID_HOME = $sdkPath

# The demo laptop keeps Gradle caches on D: because the system drive is small.
# Teammates without D: automatically use their normal user Gradle directory.
if (Test-Path -LiteralPath 'D:\GradleCacheSupplyMind') {
  $env:GRADLE_USER_HOME = 'D:\GradleCacheSupplyMind'
  $env:TEMP = 'D:\SupplyMindTemp'
  $env:TMP = 'D:\SupplyMindTemp'
  New-Item -ItemType Directory -Force -Path $env:GRADLE_USER_HOME, $env:TEMP | Out-Null
}

Push-Location $frontendRoot
try {
  npm run mobile:sync
  if ($LASTEXITCODE -ne 0) { throw 'Build web / cap sync that bai; khong xuat APK cu.' }

  Push-Location $androidRoot
  try {
    .\gradlew.bat assembleDebug --no-daemon
    if ($LASTEXITCODE -ne 0) { throw 'Build Android that bai; khong xuat APK cu.' }
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
