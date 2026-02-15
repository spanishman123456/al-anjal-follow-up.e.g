@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Installing packages... This may take a few minutes.
call npm install --legacy-peer-deps
if errorlevel 1 (
    echo Installation error occurred.
    pause
    exit /b 1
)
echo.
echo Starting frontend...
call npm start
pause
