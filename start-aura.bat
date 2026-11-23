@echo off
chcp 65001 >nul
title AURA
cd /d "%~dp0"

if not exist backend\.env copy backend\.env.example backend\.env >nul
if not exist node_modules\concurrently call npm run install:all

docker info >nul 2>&1
if errorlevel 1 (
  echo Docker Desktop 시작 중...
  start "" "%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
  for /l %%i in (1,1,40) do (
    docker info >nul 2>&1 || timeout /t 3 /nobreak >nul
  )
)
docker info >nul 2>&1
if errorlevel 1 (
  echo Docker 실행 실패. Docker Desktop을 직접 켜 주세요.
  pause
  exit /b 1
)

call npm run db:up
if errorlevel 1 (
  echo DB 시작 실패.
  pause
  exit /b 1
)
timeout /t 5 /nobreak >nul

rem 마이그레이션·generate는 npm run dev(scripts/dev.mjs)가 자동 실행

curl -s -o nul http://127.0.0.1:11434
if errorlevel 1 (
  echo Ollama 시작 중...
  start "" /min ollama serve
)

start "" /min cmd /c "timeout /t 10 /nobreak >nul & start http://127.0.0.1:5173"
call npm run dev
echo AURA 종료됨. 다시 켜려면 start-aura.bat 실행.
pause
