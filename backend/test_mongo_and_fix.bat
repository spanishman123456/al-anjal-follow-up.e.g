@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo ===== Testing MongoDB (for login) =====
echo.
py test_mongo_login.py
echo.
pause
