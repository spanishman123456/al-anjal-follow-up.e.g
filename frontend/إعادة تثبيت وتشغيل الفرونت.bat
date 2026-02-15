@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo حذف التثبيت القديم...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del package-lock.json
echo.
echo تثبيت الحزم من جديد... قد يستغرق دقيقتين.
"C:\Program Files\nodejs\npm.cmd" install --legacy-peer-deps
if errorlevel 1 (
    echo حدث خطأ في التثبيت.
    pause
    exit /b 1
)
echo.
echo تشغيل المشروع...
"C:\Program Files\nodejs\npm.cmd" start
pause
