@echo off
setlocal
cd /d "%~dp0"

set "PORT=8765"
set "URL=http://localhost:%PORT%"

where python >nul 2>nul
if %ERRORLEVEL%==0 (
  start "" "%URL%"
  python server.py
  goto :eof
)

where py >nul 2>nul
if %ERRORLEVEL%==0 (
  start "" "%URL%"
  py server.py
  goto :eof
)

echo [ERROR] Python was not found on PATH.
echo Please install Python 3 from https://www.python.org/downloads/
echo or open index.html directly for offline-only mode.
pause
