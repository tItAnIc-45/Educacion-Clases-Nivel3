@echo off
setlocal
title TUPLUSEDUCA - Servidor local
chcp 65001 >nul

cd /d "%~dp0"

echo ============================================
echo   TUPLUSEDUCA - Iniciando proyecto
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] No se encontro Node.js en el sistema.
  echo Instala Node.js 22.13 o superior desde https://nodejs.org
  echo.
  pause
  exit /b 1
)

for /f "tokens=*" %%v in ('node -p "process.versions.node"') do set "NODE_VERSION=%%v"
echo Node.js detectado: v%NODE_VERSION%
echo.

if not exist "node_modules\" (
  echo Instalando dependencias ^(npm install^)...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo [ERROR] Fallo la instalacion de dependencias.
    echo Revisa tu conexion a internet e intentalo de nuevo.
    echo.
    pause
    exit /b 1
  )
  echo.
)

if not defined PORT set "PORT=5500"
set "URL=http://127.0.0.1:%PORT%"

netstat -ano | findstr /c:"127.0.0.1:%PORT%" | findstr /c:"LISTENING" >nul
if not errorlevel 1 (
  echo El servidor ya esta corriendo en %URL%
  start "" "%URL%"
  echo.
  pause
  exit /b 0
)

echo Abriendo navegador en %URL%
start "" "%URL%"
echo.
echo Iniciando servidor... Presiona Ctrl+C para detenerlo.
echo.

call npm run dev

echo.
echo El servidor se detuvo.
pause
