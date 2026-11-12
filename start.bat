@echo off
title Remix Kitap Okuyucu

echo ======================================================
echo       Remix Kitap Okuyucu Baslatiliyor...
echo ======================================================
echo.

cd /d "%~dp0"

echo [BILGI] Sunucu baslatiliyor: http://localhost:5173
echo [BILGI] Tarayici otomatik olarak acilacaktir...
echo.
echo [IPUCU] Uygulamayi kapatmak icin bu pencereyi kapatabilirsiniz.
echo ======================================================
echo.

start "" "http://localhost:5173"

call npm run dev
