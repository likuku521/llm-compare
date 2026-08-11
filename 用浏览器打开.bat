@echo off
chcp 65001 >nul
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" "%~dp0index.html" 2>nul
if errorlevel 1 start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" "%~dp0index.html"
if errorlevel 1 start "" msedge "%~dp0index.html"
