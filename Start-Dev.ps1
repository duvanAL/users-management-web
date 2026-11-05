$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
  docker info *> $null
  if ($LASTEXITCODE -ne 0) { throw 'Abre Docker Desktop y espera a que esté listo.' }
  docker compose -p management-web-dev -f compose.dev.yml up -d --build --wait --wait-timeout 240
  if ($LASTEXITCODE -ne 0) { throw 'El entorno no terminó de arrancar. Consulta docker compose -f compose.dev.yml logs --tail 60.' }
  Write-Host 'App lista en http://localhost:3000' -ForegroundColor Green
  Write-Host 'Administrador de demostración: admin@dev.local / DevAdmin123!'
} finally { Pop-Location }
