@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo Starting backend in a new window...
start "Backend" cmd /c "py -m uvicorn server:app --host 127.0.0.1 --port 8000"

echo Waiting for backend to be ready...
ping -n 13 127.0.0.1 >nul

echo Running password reset...
powershell -ExecutionPolicy Bypass -File "%~dp0run_password_reset.ps1"

echo.
echo You can close the "Backend" window if you do not need the server anymore.
pause
