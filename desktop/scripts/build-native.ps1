$ErrorActionPreference = 'Stop'
$desktopRoot = Split-Path -Parent $PSScriptRoot
$compilerPath = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $compilerPath)) { throw 'The Windows .NET Framework 4.x compiler is required.' }
$outputDirectory = Join-Path $desktopRoot 'native/bin'
New-Item -ItemType Directory -Force $outputDirectory | Out-Null
& $compilerPath /nologo /target:exe /platform:x64 /optimize+ /reference:System.Windows.Forms.dll /reference:System.Drawing.dll "/out:$outputDirectory/IrisInput.exe" (Join-Path $desktopRoot 'native/IrisInput.cs')
if ($LASTEXITCODE -ne 0) { throw 'Native helper compilation failed.' }
