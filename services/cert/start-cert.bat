@echo off
chcp 65001 >nul
title AURA 자격증 서비스
cd /d "%~dp0"

rem 이미 실행 중이면 화면만 열고 끝 (두 번 켜면 Prisma 파일 잠김 오류)
curl -s -o nul http://127.0.0.1:3100/health
if not errorlevel 1 (
  echo 자격증 서비스 이미 실행 중: http://127.0.0.1:3100
  if not defined CERT_NO_BROWSER start http://127.0.0.1:3100
  exit /b 0
)

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

rem 설치·DB 생성·마이그레이션·빌드 후 서버 실행 (화면 http://127.0.0.1:3100). 개발 모드는 start-cert.bat --dev
if not defined CERT_NO_BROWSER start "" /min cmd /c "timeout /t 40 /nobreak >nul & start http://127.0.0.1:3100"
if "%~1"=="--dev" (
  node scripts/dev.mjs
) else (
  node scripts/dev.mjs --prod
)
echo 자격증 서비스 종료됨. 다시 켜려면 start-cert.bat 실행.
pause
