@echo off
chcp 65001 >nul
echo ========================================
echo   เช็กคนโกง — Collector Bot Installer
echo ========================================
echo.

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python ไม่พบ — กรุณาติดตั้ง Python 3.10+ ก่อน
    echo   https://www.python.org/downloads/
    pause
    exit /b 1
)

echo [1/3] กำลังติดตั้ง dependencies...
pip install -r requirements-dist.txt
if errorlevel 1 (
    echo [ERROR] ติดตั้ง dependencies ไม่สำเร็จ
    pause
    exit /b 1
)

echo.
echo [2/3] กำลังติดตั้ง browser (Chromium)...
echo   (ครั้งแรกจะดาวน์โหลด ~200MB)
python -m playwright install chromium
if errorlevel 1 (
    echo [ERROR] ติดตั้ง browser ไม่สำเร็จ
    pause
    exit /b 1
)

echo.
echo [3/3] สร้าง shortcut...
echo   คุณสามารถรันได้ด้วย: python gui_app.py
echo.

echo ========================================
echo   ติดตั้งเสร็จแล้ว!
echo.
echo   วิธีใช้:
echo     python gui_app.py
echo.
echo   หรือดับเบิลคลิก: start_bot.bat
echo ========================================
pause
