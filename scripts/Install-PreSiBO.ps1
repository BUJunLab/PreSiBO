$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$npmCommand = Get-Command npm -ErrorAction SilentlyContinue

if (-not $nodeCommand -or -not $npmCommand) {
  throw "Node.js 22+ and npm are required."
}

$nodeMajorVersion = [int]((& $nodeCommand.Source --version).TrimStart("v").Split(".")[0])
if ($nodeMajorVersion -lt 22) {
  throw "Node.js 22 or newer is required."
}

Push-Location $repoRoot
try {
  npm ci
  if ($LASTEXITCODE -ne 0) {
    throw "Dependency installation failed."
  }

  if (-not (Test-Path "apps/backend/.env")) {
    Copy-Item "apps/backend/.env.example" "apps/backend/.env"
    Write-Host "Created apps/backend/.env. Configure authorized database values before starting the app."
  }
} finally {
  Pop-Location
}
