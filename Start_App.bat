@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================
echo   Al Anjal - Starting Backend and Frontend
echo ============================================
echo.

echo [1/2] Starting BACKEND in this window (port 8000)...
cd /d "%~dp0backend"
start /b "" "%~dp0backend\run_server.bat"
cd /d "%~dp0"

echo      Waiting for backend...
ping -n 6 127.0.0.1 >nul

echo.
echo [2/2] Starting FRONTEND in a new window (port 3000)...
start "Frontend" /d "%~dp0frontend" cmd /k "npm start"

echo.
echo ============================================
echo   KEEP THIS WINDOW OPEN - backend runs here.
echo   Close it only when you are done using the app.
echo.
echo   Log in at http://localhost:3000 with:
echo      2297033843  /  BabaMama1
echo ============================================
echo.
echo (Backend is running. Close this window to stop it.)
:keepopen
ping -n 3 127.0.0.1 >nul
goto keepopen
