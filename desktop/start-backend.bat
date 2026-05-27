@echo off
REM Trade Dashboard Backend Launcher
cd /d "%~dp0..\backend"
echo Starting Trade Dashboard backend on port 8021...
python -m uvicorn app.main:app --host 127.0.0.1 --port 8021
pause
