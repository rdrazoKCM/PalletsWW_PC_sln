# Script para liberar puertos 5105 y 5106 matando instancias huérfanas
Write-Host "Liberando puertos 5105 y 5106 de PalletsWW_PC..." -ForegroundColor Cyan

Get-Process -Name "PalletsWW_PC.Api", "PalletsWW_PC.Web" -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "Terminando proceso  (PID )..." -ForegroundColor Yellow
    Stop-Process -Id .Id -Force
}

Write-Host "Puertos liberados exitosamente." -ForegroundColor Green