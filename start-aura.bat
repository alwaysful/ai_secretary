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

rem PC 조작(선택): Python 있으면 라이브러리 자동 설치
where python >nul 2>&1
if not errorlevel 1 (
  python -c "import pyautogui, pynput, pyperclip" >nul 2>&1 || python -m pip install -q -r pc-agent\requirements.txt
  rem 도구 탭 STT(로컬 Whisper)
  python -c "import faster_whisper" >nul 2>&1 || python -m pip install -q -r pc-agent\requirements-stt.txt
  rem TTS(edge-tts, 무료 음성)
  python -c "import edge_tts" >nul 2>&1 || python -m pip install -q -r pc-agent\requirements-tts.txt
)

rem 마이그레이션·generate는 npm run dev(scripts/dev.mjs)가 자동 실행

curl -s -o nul http://127.0.0.1:11434
if errorlevel 1 (
  echo Ollama 시작 중...
  start "" /min ollama serve
)

start "" /min cmd /c "timeout /t 10 /nobreak >nul & start http://127.0.0.1:5173"
call npm run dev
rem 관리자 재시작이면 이 창은 닫음 (새 창이 이어서 실행)
if exist .aura-restart (
  del .aura-restart 2>nul
  exit
)
echo AURA 종료됨. 다시 켜려면 start-aura.bat 실행.
pause
