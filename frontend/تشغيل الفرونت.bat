@echo off
chcp 65001 >nul
echo جاري تثبيت الحزم... قد يستغرق دقيقتين.
cd /d "%~dp0"
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
