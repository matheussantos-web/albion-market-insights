@echo off
echo ============================================
echo   Configurar Albion Market Insights
echo ============================================
echo.

set /p NAME="Seu nome (ex: PC do Joao): "
set /p APIKEY="Sua API Key: "

echo Criando config.json...

(
echo {
echo   "server": "http://191.252.219.229:3000",
echo   "apiKey": "%APIKEY%",
echo   "name": "%NAME%",
echo   "batchInterval": 5000,
echo   "maxBatchSize": 100
echo }
) > "%~dp0config.json"

echo.
echo Configurado! Execute INICIAR.bat como administrador.
echo.
pause
