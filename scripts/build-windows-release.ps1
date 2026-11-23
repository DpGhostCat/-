$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$releaseRoot = Join-Path $root "release"
$stageRoot = Join-Path $releaseRoot "windows-stage"
$stageApp = Join-Path $stageRoot "Xunye"
$setupRoot = Join-Path $env:TEMP "xunye-windows-setup-stage"
$nodeExe = Join-Path $root ".runtime\node\node.exe"
$portableZip = Join-Path $releaseRoot "Xunye-Windows-x64.zip"
$setupExe = Join-Path $releaseRoot "Xunye-Windows-Setup.exe"
$tempSetupExe = Join-Path $setupRoot "Xunye-Windows-Setup.exe"
$checksumFile = Join-Path $releaseRoot "SHA256SUMS.txt"

if (-not (Test-Path -LiteralPath $nodeExe)) {
  throw "Bundled Node runtime not found: $nodeExe"
}

function Reset-BuildDirectory([string]$path) {
  $full = [System.IO.Path]::GetFullPath($path)
  $expectedParent = [System.IO.Path]::GetFullPath($releaseRoot) + [System.IO.Path]::DirectorySeparatorChar
  if (-not $full.StartsWith($expectedParent, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to clear a directory outside release: $full"
  }
  if (Test-Path -LiteralPath $full) {
    Remove-Item -LiteralPath $full -Recurse -Force
  }
  New-Item -ItemType Directory -Force -Path $full | Out-Null
}

New-Item -ItemType Directory -Force -Path $releaseRoot | Out-Null
Reset-BuildDirectory $stageRoot
New-Item -ItemType Directory -Force -Path $stageApp | Out-Null
$tempParent = [System.IO.Path]::GetFullPath((Split-Path $setupRoot -Parent)) + [System.IO.Path]::DirectorySeparatorChar
$tempFull = [System.IO.Path]::GetFullPath($setupRoot)
if (-not $tempFull.StartsWith($tempParent, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing to clear unexpected temporary directory: $tempFull"
}
if (Test-Path -LiteralPath $tempFull) {
  Remove-Item -LiteralPath $tempFull -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $tempFull | Out-Null

Copy-Item -LiteralPath (Join-Path $root "server") -Destination $stageApp -Recurse
Copy-Item -LiteralPath (Join-Path $root "public") -Destination $stageApp -Recurse
Copy-Item -LiteralPath (Join-Path $root "docs") -Destination $stageApp -Recurse
Copy-Item -LiteralPath (Join-Path $root "artifacts") -Destination $stageApp -Recurse
Copy-Item -LiteralPath (Join-Path $root "package.json") -Destination $stageApp
Copy-Item -LiteralPath (Join-Path $root "README.md") -Destination $stageApp
Copy-Item -LiteralPath (Join-Path $root "installer\Xunye.vbs") -Destination $stageApp
Copy-Item -LiteralPath (Join-Path $root "installer\Stop-Xunye.cmd") -Destination $stageApp
Copy-Item -LiteralPath (Join-Path $root "public\icon.ico") -Destination (Join-Path $stageApp "xunye.ico")
Copy-Item -LiteralPath $nodeExe -Destination (Join-Path $stageApp "node.exe")
New-Item -ItemType Directory -Force -Path (Join-Path $stageApp "data") | Out-Null

if (Test-Path -LiteralPath $portableZip) {
  Remove-Item -LiteralPath $portableZip -Force
}
Compress-Archive -Path (Join-Path $stageApp "*") -DestinationPath $portableZip -CompressionLevel Optimal

Copy-Item -LiteralPath (Join-Path $root "installer\install.cmd") -Destination $setupRoot
Copy-Item -LiteralPath $portableZip -Destination (Join-Path $setupRoot "payload.zip")

$sedPath = Join-Path $setupRoot "xunye.sed"
$sourcePath = $setupRoot.TrimEnd("\") + "\"
$targetPath = $tempSetupExe
$sed = @"
[Version]
Class=IEXPRESS
SEDVersion=3

[Options]
PackagePurpose=InstallApp
ShowInstallProgramWindow=0
HideExtractAnimation=1
UseLongFileName=1
InsideCompressed=0
CAB_FixedSize=0
CAB_ResvCodeSigning=0
RebootMode=N
InstallPrompt=
DisplayLicense=
FinishMessage=Xunye has been installed. A desktop shortcut has been created.
TargetName=$targetPath
FriendlyName=Xunye Reading Platform
AppLaunched=install.cmd
PostInstallCmd=<None>
AdminQuietInstCmd=
UserQuietInstCmd=
SourceFiles=SourceFiles

[Strings]
FILE0="install.cmd"
FILE1="payload.zip"

[SourceFiles]
SourceFiles0=$sourcePath

[SourceFiles0]
%FILE0%=
%FILE1%=
"@
Set-Content -LiteralPath $sedPath -Value $sed -Encoding Unicode

& "$env:WINDIR\System32\iexpress.exe" /N /Q $sedPath
$buildDeadline = (Get-Date).AddMinutes(3)
$lastSize = -1
$stableChecks = 0
while ((Get-Date) -lt $buildDeadline) {
  Start-Sleep -Seconds 1
  if (Test-Path -LiteralPath $tempSetupExe) {
    $size = (Get-Item -LiteralPath $tempSetupExe).Length
    if ($size -gt 1MB -and $size -eq $lastSize) {
      $stableChecks += 1
      if ($stableChecks -ge 2) { break }
    } else {
      $stableChecks = 0
    }
    $lastSize = $size
  }
}
if (-not (Test-Path -LiteralPath $tempSetupExe) -or (Get-Item -LiteralPath $tempSetupExe).Length -lt 1MB) {
  throw "IExpress failed to build the installer within the expected time."
}
Copy-Item -LiteralPath $tempSetupExe -Destination $setupExe -Force

$hashLines = @(
  "$((Get-FileHash -Algorithm SHA256 -LiteralPath $portableZip).Hash)  Xunye-Windows-x64.zip",
  "$((Get-FileHash -Algorithm SHA256 -LiteralPath $setupExe).Hash)  Xunye-Windows-Setup.exe"
)
Set-Content -LiteralPath $checksumFile -Value $hashLines -Encoding UTF8

Get-Item -LiteralPath $portableZip, $setupExe, $checksumFile |
  Select-Object Name, Length, LastWriteTime
