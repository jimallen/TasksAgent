@echo off
REM Development Installation Script for Obsidian Meeting Tasks Plugin (Windows)
REM This script helps set up the plugin for local development

echo ========================================
echo Obsidian Meeting Tasks Plugin - Dev Setup
echo ========================================
echo.

REM Check if npm is installed
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: npm is not installed. Please install Node.js first.
    echo Download from: https://nodejs.org/
    pause
    exit /b 1
)

REM Install dependencies if needed
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
) else (
    echo Dependencies already installed
)

REM Build the plugin
echo.
echo Building plugin...
call npm run build:dev

REM Ask for vault path
echo.
echo Please enter your Obsidian vault path:
echo Examples:
echo   - C:\Users\YourName\Documents\ObsidianVault
echo   - D:\ObsidianVault
echo.
set /p VAULT_PATH="Vault path: "

REM Check if vault exists
if not exist "%VAULT_PATH%" (
    echo ERROR: Vault directory does not exist: %VAULT_PATH%
    pause
    exit /b 1
)

REM Create plugin directory
set PLUGIN_DIR=%VAULT_PATH%\.obsidian\plugins\meeting-tasks
if not exist "%PLUGIN_DIR%" mkdir "%PLUGIN_DIR%"

REM Ask for installation method
echo.
echo Choose installation method:
echo 1. Symbolic link (recommended for development - requires admin)
echo 2. Copy files (for testing)
echo.
set /p INSTALL_METHOD="Choice (1 or 2): "

if "%INSTALL_METHOD%"=="1" (
    REM Check for admin rights
    net session >nul 2>&1
    if %errorlevel% neq 0 (
        echo.
        echo ERROR: Creating symbolic links requires administrator privileges.
        echo Please run this script as administrator or choose option 2.
        pause
        exit /b 1
    )
    
    REM Remove existing directory/link
    if exist "%PLUGIN_DIR%" (
        rmdir "%PLUGIN_DIR%" 2>nul
        rmdir /s /q "%PLUGIN_DIR%" 2>nul
    )
    
    REM Create symbolic link
    echo Creating symbolic link...
    mklink /D "%PLUGIN_DIR%" "%CD%"
    
    if %errorlevel% equ 0 (
        echo Symbolic link created successfully!
        echo.
        echo Starting watch mode for development...
        echo The plugin will auto-rebuild when you make changes.
        echo Press Ctrl+C to stop.
        echo.
        call npm run dev
    ) else (
        echo ERROR: Failed to create symbolic link
        pause
        exit /b 1
    )
    
) else if "%INSTALL_METHOD%"=="2" (
    REM Copy files
    echo Copying plugin files...
    
    copy main.js "%PLUGIN_DIR%\" >nul
    copy manifest.json "%PLUGIN_DIR%\" >nul
    if exist styles.css copy styles.css "%PLUGIN_DIR%\" >nul
    
    echo Files copied to vault!
    echo.
    echo ========================================
    echo Installation complete!
    echo ========================================
    echo.
    echo Next steps:
    echo 1. Open Obsidian
    echo 2. Go to Settings - Community Plugins
    echo 3. Turn off Safe Mode
    echo 4. Enable 'Meeting Tasks' plugin
    echo 5. Configure the plugin settings
    echo.
    echo To rebuild after changes, run: npm run build:dev
    echo.
    pause
    
) else (
    echo Invalid choice. Please run the script again.
    pause
    exit /b 1
)