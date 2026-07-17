@echo off
title Albion Market Insights - Instalador
color 0A
cls
echo ============================================
echo   ALBION MARKET INSIGHTS - INSTALADOR
echo ============================================
echo.
echo  Este instalador vai configurar tudo
echo  pra voce contribuir com dados de mercado
echo  do Albion Online pro servidor da guild.
echo.
echo  ANTES DE COMECAR:
echo  1. Acesse http://191.252.219.229:3000/#/register
echo  2. Crie sua conta (voces ja vai ganhar uma API Key)
echo  3. Va em Contribuidor pra copiar sua chave
echo.
echo ============================================
echo.

:: Verificar administrador
echo [1/4] Verificando permissoes de administrador...
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo  ERRO: Este instalador precisa de Administrador!
    echo.
    echo  Clique com botao DIREITO neste arquivo
    echo  e selecione "Executar como administrador".
    echo.
    pause
    exit /b 1
)
echo  OK - Administrador confirmado!
echo.

:: Verificar/Instalar Npcap
echo [2/4] Verificando Npcap (necessario para capturar pacotes)...
sc query npcap >nul 2>&1
if %errorLevel% equ 0 (
    echo  Npcap ja instalado!
) else (
    echo  Npcap nao encontrado. Instalando...
    echo  (Isso pode levar uns segundos)
    echo.

    if not exist "%~dp0npcap-1.88.exe" (
        echo  ERRO: npcap-1.88.exe nao encontrado na pasta!
        echo  Baixe de: https://npcap.com/#download
        echo.
        pause
        exit /b 1
    )

    :: Instalar Npcap silenciosamente com WinPcap compat
    "%~dp0npcap-1.88.exe" /S /winpcap_mode=yes
    timeout /t 3 /nobreak >nul

    sc query npcap >nul 2>&1
    if %errorLevel% neq 0 (
        echo  Npcap instalado com sucesso!
    ) else (
        echo  Aviso: Verifique se o Npcap foi instalado.
    )
)
echo.

:: Configurar API Key
echo [3/4] Configurando sua conta...
echo.

if exist "%~dp0config.json" (
    findstr /C:"COLE_SUA_API_KEY_AQUI" "%~dp0config.json" >nul 2>&1
    if %errorLevel% equ 0 (
        echo  Config anterior encontrado mas com API key padrao.
        echo  Precisamos configurar sua API key.
        echo.
        goto :configure
    ) else (
        echo  Config ja existe com API key configurada.
        set /p reconfig="  Quer reconfigurar? (s/n): "
        if /i "%reconfig%" neq "s" goto :skip_config
    )
)

:configure
set /p NICKNAME="  Seu nome/gamertag: "
set /p APIKEY="  Sua API Key (copie do painel do site): "

if "%NICKNAME%"=="" (
    echo  ERRO: Nome nao pode ser vazio!
    goto :configure
)
if "%APIKEY%"=="" (
    echo  ERRO: API Key nao pode ser vazia!
    goto :configure
)

(
echo {
echo   "server": "http://191.252.219.229:3000",
echo   "apiKey": "%APIKEY%",
echo   "name": "%NICKNAME%",
echo   "batchInterval": 5000,
echo   "maxBatchSize": 100
echo }
) > "%~dp0config.json"

echo.
echo  Configurado com sucesso!
echo  Nome: %NICKNAME%
echo.

:skip_config

:: Verificar client
echo [4/4] Verificando client...
if exist "%~dp0albion-client.exe" (
    echo  Client encontrado!
) else (
    echo  ERRO: albion-client.exe nao encontrado!
    echo  Rebaixe o pacote completo.
    pause
    exit /b 1
)
echo.

:: Tudo pronto
echo ============================================
echo   INSTALACAO CONCLUIDA!
echo ============================================
echo.
echo  Proximos passos:
echo.
echo  1. Acesse http://191.252.219.229:3000/#/parceiros
echo  2. Copie sua API Key
echo  3. Execute CONFIGURAR.bat e cole a chave
echo  4. Abra o Albion Online
echo  5. Execute INICIAR.bat como administrador
echo  6. Va ate o mercado no jogo
echo  7. Clique nos itens pra ver precos
echo  8. Os dados sao enviados automaticamente!
echo.
echo  IMPORTANTE: Execute INICIAR.bat como
echo  Administrador toda vez que for jogar.
echo.
echo ============================================
echo.
pause
