@echo off
cd /d "%~dp0"
echo Deleting old installation...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del package-lock.json
echo.
echo Installing packages (2-5 minutes)...
call npm install --legacy-peer-deps
if errorlevel 1 (
    echo Install failed.
    pause
    exit /b 1
)
echo.
echo Starting...
call npm start
pause
