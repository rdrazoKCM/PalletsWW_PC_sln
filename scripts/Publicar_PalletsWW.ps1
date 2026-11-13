# ==============================================================================
# Script de Despliegue de Alta Disponibilidad (Near Zero-Downtime) para IIS
# Proyecto: Pallets Wipes PC (Kimberly-Clark Planta Tlaxcala)
# ==============================================================================

param(
    [string]$PublishRoot = "C:\PublishIIS",
    [switch]$SkipApi,
    [switch]$SkipWeb,
    [switch]$BuildInstaller
)

$ErrorActionPreference = "Stop"
$sw = [System.Diagnostics.Stopwatch]::StartNew()

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host " INICIANDO PUBLICACION: PALLETS WIPES PC -> IIS" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir

$apiPublishDir = Join-Path $PublishRoot "PalletsWW_PC.Api.Publish"
$webPublishDir = Join-Path $PublishRoot "PalletsWW_PC_React.Publish"

Write-Host "Destino API:  $apiPublishDir" -ForegroundColor Cyan
Write-Host "Destino Web:  $webPublishDir" -ForegroundColor Cyan

# ------------------------------------------------------------------------------
# 0. COMPILACION DEL INSTALADOR Y MICROSERVICIO LOCAL (Si se requiere)
# ------------------------------------------------------------------------------
if ($BuildInstaller) {
    Write-Host "`n[0/3] Compilando Microservicio PrintBridge e Instalador Cliente..." -ForegroundColor Yellow
    $bridgeProj = Join-Path $repoRoot "src\PalletsPrintBridge\PalletsPrintBridge.csproj"
    $bridgeStaging = Join-Path $repoRoot "src\PalletsPrintBridge\bin\Publish"
    & dotnet publish $bridgeProj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o $bridgeStaging --nologo
    if ($LASTEXITCODE -ne 0) { throw "Error al compilar PalletsPrintBridge." }

    $payloadDir = Join-Path $repoRoot "src\PalletsWW_ClientSetup\Payload"
    Copy-Item "$bridgeStaging\PalletsPrintBridge.exe" "$payloadDir\PalletsPrintBridge.exe" -Force

    $setupProj = Join-Path $repoRoot "src\PalletsWW_ClientSetup\PalletsWW_ClientSetup.csproj"
    $setupStaging = Join-Path $repoRoot "src\PalletsWW_ClientSetup\bin\Publish"
    & dotnet publish $setupProj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o $setupStaging --nologo
    if ($LASTEXITCODE -ne 0) { throw "Error al compilar Setup_PalletsWW_Cliente." }

    # Sincronizar en public de la Web App para descarga directa de operadores
    $publicExe = Join-Path $repoRoot "src\PalletsWW_PC.Web\public\Setup_PalletsWW_Cliente.exe"
    Copy-Item "$setupStaging\Setup_PalletsWW_Cliente.exe" $publicExe -Force
    Write-Host "-> Instalador Setup_PalletsWW_Cliente.exe compilado y colocado en public/." -ForegroundColor Green
}

# ------------------------------------------------------------------------------
# 1. PUBLICACION DE BACKEND WEB API (Tecnica Oficial app_offline.htm)
# ------------------------------------------------------------------------------
if (-not $SkipApi) {
    Write-Host "
[1/2] Compilando Backend API (.NET 10 LTS)..." -ForegroundColor Yellow
    $apiProj = Join-Path $repoRoot "src\PalletsWW_PC.Api\PalletsWW_PC.Api.csproj"
    $apiStaging = Join-Path $repoRoot "src\PalletsWW_PC.Api\bin\Publish"
    
    & dotnet publish $apiProj -c Release -o $apiStaging --nologo
    if ($LASTEXITCODE -ne 0) { throw "Error al compilar la API de Pallets Wipes." }
    Write-Host "-> Compilacion de API en staging lista." -ForegroundColor Green

    if (Test-Path $apiPublishDir) {
        Write-Host "-> Desplegando en IIS mediante app_offline.htm (liberando locks de DLLs)..." -ForegroundColor Yellow
        $offlineHtm = Join-Path $apiPublishDir "app_offline.htm"
        
        # Poner offline temporalmente para que AspNetCoreModuleV2 libere los DLLs en ~1.5 seg
        Set-Content -Path $offlineHtm -Value "<html><head><meta charset='utf-8'></head><body style='font-family:sans-serif;text-align:center;padding:50px;'><h2>Actualizando API Pallets Wipes...</h2><p>El servicio estara disponible en unos segundos.</p></body></html>" -Encoding UTF8
        Start-Sleep -Milliseconds 1500

        # Copiar binarios nuevos excluyendo appsettings.json de produccion
        & robocopy $apiStaging $apiPublishDir /E /XO /XF appsettings.json web.config app_offline.htm /NDL /NFL /NJH /NJS

        # Retirar app_offline.htm para que IIS levante inmediatamente la nueva API
        if (Test-Path $offlineHtm) {
            Remove-Item -Path $offlineHtm -Force -ErrorAction SilentlyContinue
        }
        Write-Host "-> Backend API desplegada y en linea con exito." -ForegroundColor Green
    } else {
        Write-Host "-> Creando directorio inicial de publicacion API..." -ForegroundColor Yellow
        New-Item -ItemType Directory -Path $apiPublishDir -Force | Out-Null
        & robocopy $apiStaging $apiPublishDir /E /NDL /NFL /NJH /NJS
        Write-Host "-> Backend API publicada por primera vez." -ForegroundColor Green
    }
}

# ------------------------------------------------------------------------------
# 2. PUBLICACION DE FRONTEND WEB (React 19 + TypeScript + Vite)
# ------------------------------------------------------------------------------
if (-not $SkipWeb) {
    Write-Host "
[2/2] Compilando Frontend Web (React 19 + Vite)..." -ForegroundColor Yellow
    $webDir = Join-Path $repoRoot "src\PalletsWW_PC.Web"
    
    Push-Location $webDir
    try {
        $env:CI = "true"
        & pnpm run build
        if ($LASTEXITCODE -ne 0) { throw "Error al compilar la Web App con Vite." }
    } finally {
        Pop-Location
    }
    
    Write-Host "-> Desplegando archivos estaticos de React en IIS..." -ForegroundColor Yellow
    $distDir = Join-Path $webDir "dist"
    
    if (-not (Test-Path $webPublishDir)) {
        New-Item -ItemType Directory -Path $webPublishDir -Force | Out-Null
    }
    
    # Copia directa: preservar instaladores .exe y web.config
    & robocopy $distDir $webPublishDir /E /PURGE /XF web.config *.exe /NDL /NFL /NJH /NJS
    
    # Sincronizar web.config si existe en dist
    if (Test-Path "$distDir\web.config") {
        Copy-Item -Path "$distDir\web.config" -Destination "$webPublishDir\web.config" -Force
    }
    
    # Sincronizar instalador si existe en dist
    if (Test-Path "$distDir\Setup_PalletsWW_Cliente.exe") {
        Copy-Item -Path "$distDir\Setup_PalletsWW_Cliente.exe" -Destination "$webPublishDir\Setup_PalletsWW_Cliente.exe" -Force
    }
    Write-Host "-> Frontend Web React actualizado con exito (Cero caida de clientes)." -ForegroundColor Green
}

$sw.Stop()
$elapsed = [Math]::Round($sw.Elapsed.TotalSeconds, 1)

Write-Host "
========================================================" -ForegroundColor Cyan
Write-Host " PUBLICACION COMPLETADA EXITOSAMENTE EN $elapsed SEGUNDOS! " -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Backend API:  $apiPublishDir"
Write-Host "Frontend Web: $webPublishDir"