@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Installing packages...
py -m pip install -r requirements.txt
echo.
echo Starting server...
py -m uvicorn server:app --reload --host 0.0.0.0 --port 8000
pause
