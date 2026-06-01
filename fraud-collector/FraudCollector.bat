@echo off
title FraudCollector

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo  ========================================
    echo   Python is required!
    echo   Please install Python 3.10+
    echo   1. Go to python.org/downloads
    echo   2. Click Download Python
    echo   3. Check "Add to PATH"
    echo   4. Click Install Now
    echo   5. Run this file again
    echo  ========================================
    echo.
    echo  Opening download page...
    start https://www.python.org/downloads/
    pause
    exit /b 1
)

:: Check dependencies
cd /d "%~dp0"
python -c "import playwright" >nul 2>&1
if errorlevel 1 (
    echo.
    echo  Installing dependencies...
    echo.
    pip install -r requirements-dist.txt
    if errorlevel 1 (
        echo  ERROR: Failed to install dependencies
        pause
        exit /b 1
    )
)

:: Check Chromium
python -c "import playwright; print('ok')" >nul 2>&1
if errorlevel 1 goto :install_browser

python -c "from pathlib import Path; import playwright; p=Path(playwright.__file__).parent; browsers=list((p/'driver'/'package'/'.local-browsers').glob('chromium-*')); exit(0 if browsers else 1)" >nul 2>&1
if errorlevel 1 goto :install_browser
goto :run

:install_browser
echo.
echo  Downloading browser (first time only, ~200MB)...
echo.
python -m playwright install chromium
if errorlevel 1 (
    echo  ERROR: Failed to download browser
    pause
    exit /b 1
)

:run
echo  Starting FraudCollector...
python gui_app.py
