param(
  [switch]$Build
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npmCommand) {
  throw "Node.js 22+ and npm are required."
}

Push-Location $repoRoot
try {
  if ($Build) {
    npm run build
    if ($LASTEXITCODE -ne 0) {
      throw "Build failed."
    }
    return
  }

  if (-not (Test-Path "apps/backend/.env")) {
    throw "apps/backend/.env is missing. Run .\scripts\Install-PreSiBO.ps1 first."
  }

  $backendProcess = Start-Process $npmCommand.Source `
    -ArgumentList "run", "dev:backend" `
    -PassThru `
    -WindowStyle Hidden

  try {
    Start-Sleep -Seconds 1
    if ($backendProcess.HasExited) {
      throw "The backend stopped during startup."
    }

    npm run dev:frontend
    if ($LASTEXITCODE -ne 0) {
      throw "The frontend stopped with an error."
    }
  } finally {
    if ($backendProcess -and -not $backendProcess.HasExited) {
      & taskkill.exe /PID $backendProcess.Id /T /F | Out-Null
    }
  }
} finally {
  Pop-Location
}
