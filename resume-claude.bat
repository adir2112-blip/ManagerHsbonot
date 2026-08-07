@echo off
title Claude - ManagerHsbonot
cd /d "%~dp0"
call claude --continue
if errorlevel 1 (
  echo.
  echo No previous session found in this folder - starting a new one instead.
  echo (From now on, sessions started here will be found by --continue.)
  echo.
  call claude
)
echo.
pause
