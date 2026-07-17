@echo off
echo ========================================
echo  Albion Market Insights - Cliente
echo ========================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERRO: Node.js nao encontrado!
    echo Baixe em: https://nodejs.org
    pause
    exit /b 1
)

echo Instalando dependencias...
call npm install
if %errorlevel% neq 0 (
    echo ERRO ao instalar dependencias
    pause
    exit /b 1
)

echo.
echo Configuracao:
echo.
echo 1. Abra o arquivo config.json
echo 2. Preencha o campo "apiKey" com sua chave de contribuidor
echo 3. Execute: npm start
echo.
echo Obtenha sua API key perguntando ao administrador do servidor.
echo.

if not exist config.json (
    echo config.json nao encontrado! Copie de config.json.example
    pause
    exit /b 1
)

echo Deseja iniciar agora? (S/N)
set /p choice=
if /i "%choice%"=="S" (
    call npm start
) else (
    echo Para iniciar depois, execute: npm start
    pause
)
