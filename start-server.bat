@echo off
echo ================================
echo   AI模特工作室 - 本地服务器
echo ================================
echo.
echo 正在启动服务器...
echo.

cd /d "%~dp0"

:: 检查是否有Python
python --version >nul 2>&1
if %errorlevel% equ 0 (
    echo 使用 Python 启动服务器...
    echo.
    echo 服务器地址: http://localhost:8080
    echo.
    echo 请在浏览器打开: http://localhost:8080/test.html
    echo 按 Ctrl+C 停止服务器
    echo.
    python -m http.server 8080
    goto end
)

:: 检查是否有Node.js
npx --version >nul 2>&1
if %errorlevel% equ 0 (
    echo 使用 Node.js 启动服务器...
    echo.
    echo 服务器地址: http://localhost:8080
    echo.
    echo 请在浏览器打开: http://localhost:8080/test.html
    echo 按 Ctrl+C 停止服务器
    echo.
    npx serve -p 8080
    goto end
)

echo.
echo 错误: 未找到 Python 或 Node.js
echo.
echo 请安装其中一个:
echo   - Python: https://www.python.org/downloads/
echo   - Node.js: https://nodejs.org/
echo.
echo 或者使用 VS Code 的 Live Server 插件
echo.
pause

:end
