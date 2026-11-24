@echo off
rem 관리자 로비 "재시작"이 호출. 기존 서버 종료 기다린 뒤 새 창에서 AURA 실행
chcp 65001 >nul
cd /d "%~dp0.."
timeout /t 5 /nobreak >nul
start "AURA" cmd /c start-aura.bat
