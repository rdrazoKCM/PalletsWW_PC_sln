@echo off
:: ==============================================================================
:: Desinstalador Completo de Pallets WW (Kimberly-Clark Planta Tlaxcala)
:: ==============================================================================
echo ========================================================
echo  DESINSTALANDO PALLETS WW CLIENTE Y PRINTBRIDGE
echo ========================================================

:: 1. Detener el microservicio local de impresion
echo [1/5] Deteniendo servicio en segundo plano...
taskkill /F /IM PalletsPrintBridge.exe 2>nul

:: 2. Eliminar inicio automatico de Windows
echo [2/5] Eliminando registros de arranque automatico...
del /F /Q "C:\ProgramData\Microsoft\Windows\Start Menu\Programs\Startup\PalletsPrintBridge.lnk" 2>nul
del /F /Q "C:\ProgramData\Microsoft\Windows\Start Menu\Programs\Startup\Pallets WW.lnk" 2>nul
del /F /Q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\PalletsPrintBridge.lnk" 2>nul
del /F /Q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Pallets WW.lnk" 2>nul
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "PalletsWW_PrintBridge" /f 2>nul
reg delete "HKLM\Software\Microsoft\Windows\CurrentVersion\Run" /v "PalletsWW_PrintBridge" /f 2>nul

:: 3. Eliminar accesos directos publicos
echo [3/5] Eliminando accesos directos publicos...
del /F /Q "C:\Users\Public\Desktop\Pallets WW.lnk" 2>nul
del /F /Q "C:\Users\Public\Desktop\Pallets Wet Wipes.lnk" 2>nul
del /F /Q "C:\ProgramData\Microsoft\Windows\Start Menu\Programs\Pallets WW.lnk" 2>nul
del /F /Q "C:\ProgramData\Microsoft\Windows\Start Menu\Programs\Pallets Wet Wipes.lnk" 2>nul

:: 4. Desanclar de la barra de tareas y limpiar todos los perfiles de usuario
echo [4/5] Desanclando de la barra de tareas y limpiando perfiles locales...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$shell = New-Object -ComObject Shell.Application; foreach ($u in Get-ChildItem 'C:\Users' -Directory) { $tb = Join-Path $u.FullName 'AppData\Roaming\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar'; if (Test-Path $tb) { $f = $shell.Namespace($tb); Get-ChildItem $tb -Filter '*Pallet*.lnk' | ForEach-Object { $it = $f.ParseName($_.Name); if ($it) { $it.Verbs() | Where-Object { $_.Name.Replace('&','') -match 'Desanclar|Unpin' } | ForEach-Object { $_.DoIt() } } } }; $layout = Join-Path $u.FullName 'AppData\Local\Microsoft\Windows\Shell\LayoutModification.xml'; if (Test-Path $layout) { Remove-Item $layout -Force -ErrorAction SilentlyContinue } }" 2>nul

for /d %%u in (C:\Users\*) do (
    del /F /Q "%%u\Desktop\Pallets WW.lnk" 2>nul
    del /F /Q "%%u\Desktop\Pallets Wet Wipes.lnk" 2>nul
    del /F /Q "%%u\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Pallets WW.lnk" 2>nul
    del /F /Q "%%u\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Pallets Wet Wipes.lnk" 2>nul
    del /F /Q "%%u\AppData\Roaming\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar\Pallets WW.lnk" 2>nul
    del /F /Q "%%u\AppData\Roaming\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar\Pallets Wet Wipes.lnk" 2>nul
    del /F /Q "%%u\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\PalletsPrintBridge.lnk" 2>nul
    del /F /Q "%%u\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\Pallets WW.lnk" 2>nul
)

:: 5. Eliminar regla de firewall y carpeta del microservicio
echo [5/5] Eliminando archivos y regla de firewall...
netsh advfirewall firewall delete rule name="PalletsWW_PrintBridge_9100" 2>nul
rmdir /S /Q "C:\ProgramData\PalletsWW_ZebraBridge" 2>nul

echo ========================================================
echo  DESINSTALACION COMPLETADA CORRECTAMENTE
echo ========================================================
pause