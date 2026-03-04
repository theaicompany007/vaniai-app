@echo off
:: ─────────────────────────────────────────────────────────────────────────────
:: Vani AI Sales Intelligence — Post-Deploy Configuration (Windows)
:: Runs update-vaniai-supabase-auth.py then scripts/configure_vaniai_webhooks.py
::
:: Usage:
::   vaniai_post_deploy.bat                            (uses NEXT_PUBLIC_APP_URL from .env.local)
::   vaniai_post_deploy.bat https://vaniai.ngrok.app
::   vaniai_post_deploy.bat https://vaniai.ngrok.app --skip-resend
:: ─────────────────────────────────────────────────────────────────────────────
cd /d "%~dp0"

set APP_URL=%1
set EXTRA=%2

echo.
echo ====================================================================
echo   Vani AI Sales Intelligence -- Post-Deploy Configuration
echo ====================================================================
echo.

:: Determine python command
where python >nul 2>&1
if %errorlevel% equ 0 (
    set PYTHON=python
) else (
    set PYTHON=py
)

:: Step 1: Supabase Auth
echo [1/2] Updating Supabase Auth configuration...
if "%APP_URL%"=="" (
    %PYTHON% update-vaniai-supabase-auth.py --env-file .env.local
) else (
    %PYTHON% update-vaniai-supabase-auth.py --app-url %APP_URL% --env-file .env.local
)
if %errorlevel% neq 0 (
    echo [WARN] Supabase Auth update failed. Check SUPABASE_ACCESS_TOKEN in .env.local
    echo        Get token: https://supabase.com/dashboard/account/tokens
) else (
    echo [OK] Supabase Auth updated
)

echo.

:: Step 2: Razorpay + Resend Webhooks
echo [2/2] Configuring webhooks ^(Razorpay + Resend^)...
if "%APP_URL%"=="" (
    %PYTHON% scripts\configure_vaniai_webhooks.py --env-file .env.local %EXTRA%
) else (
    %PYTHON% scripts\configure_vaniai_webhooks.py --app-url %APP_URL% --env-file .env.local %EXTRA%
)
if %errorlevel% neq 0 (
    echo [WARN] Some webhooks may need manual setup ^(see output above^)
) else (
    echo [OK] Webhooks configured
)

echo.
echo ====================================================================
echo   Done. Verify your external dashboard configurations:
echo   Supabase : https://supabase.com/dashboard/project/ooqrhtrnnsoxmvcnywua/auth/url-configuration
echo   Razorpay : https://dashboard.razorpay.com/app/webhooks
echo   Resend   : https://resend.com/webhooks
echo ====================================================================
echo.
