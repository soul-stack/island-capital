@echo off
chcp 65001 >nul
setlocal
pushd "%~dp0" || exit /b 1
where.exe node.exe >nul 2>nul
if errorlevel 1 goto :need_node
node.exe -e "process.exit(Number(process.versions.node.split('.')[0]) >= 22 ? 0 : 1)"
if errorlevel 1 goto :need_node
echo 正在启动群岛大亨。请保留这个窗口，按 Ctrl+C 可停止服务。
node.exe server.mjs --open %*
set "game_exit=%errorlevel%"
if not "%game_exit%"=="0" pause
popd
exit /b %game_exit%

:need_node
echo 请先安装 Node.js 22 或更高版本，然后重新打开此文件。
echo https://nodejs.org/
pause
popd
exit /b 1
