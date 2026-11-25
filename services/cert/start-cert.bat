@echo off
chcp 65001 >nul
title AURA 자격증 서비스
cd /d "%~dp0"

docker info >nul 2>&1
if errorlevel 1 (
  echo Docker Desktop 시작 중...
  if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" (
    start "" "%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
  ) else (
    start "" "%LOCALAPPDATA%\Programs\DockerDesktop\Docker Desktop.exe"
  )
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

docker compose -f docker-compose.yml up -d
if errorlevel 1 (
  echo 자격증 DB 시작 실패.
  pause
  exit /b 1
)
timeout /t 5 /nobreak >nul

rem 설치·DB 생성·마이그레이션 후 서버 실행 (http://127.0.0.1:3100)
node scripts/dev.mjs %*
echo 자격증 서비스 종료됨. 다시 켜려면 start-cert.bat 실행.
pause
