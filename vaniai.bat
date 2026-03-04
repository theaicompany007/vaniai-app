@echo off
cd /d "%~dp0"
where python >nul 2>&1
if %errorlevel% neq 0 (
  py run-vaniai.py %*
) else (
  python run-vaniai.py %*
)
