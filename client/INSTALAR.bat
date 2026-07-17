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
echo ============================================
echo.

:: Verificar administrador
echo [1/2] Verificando permissoes de administrador...
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
echo [2/2] Verificando Npcap (necessario para capturar pacotes)...
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

    "%~dp0npcap-1.88.exe" /S /winpcap_mode=yes
    timeout /t 3 /nobreak >nul

    sc query npcap >nul 2>&1
    if %errorLevel% equ 0 (
        echo  Npcap instalado com sucesso!
    ) else (
        echo  Aviso: Verifique se o Npcap foi instalado.
    )
)
echo.

:: Verificar client
if not exist "%~dp0albion-client.exe" (
    echo  ERRO: albion-client.exe nao encontrado!
    pause
    exit /b 1
)

:: Tudo pronto
echo ============================================
echo   INSTALACAO CONCLUIDA!
echo ============================================
echo.
echo  Agora e so:
echo.
echo  1. Abra o Albion Online
echo  2. Execute INICIAR.bat como administrador
echo  3. Va ate o mercado no jogo
echo  4. Clique nos itens pra ver precos
echo  5. Os dados sao enviados automaticamente!
echo.
echo  IMPORTANTE: Execute INICIAR.bat como
echo  Administrador toda vez que for jogar.
echo.
echo ============================================
echo.
pause
