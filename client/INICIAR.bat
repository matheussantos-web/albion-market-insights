@echo off
echo ============================================
echo   Albion Market Insights - Cliente
echo ============================================
echo.
echo Verificando permissoes de administrador...
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo ERRO: Execute como Administrador!
    echo Clique com botao direito → Executar como administrador
    echo.
    pause
    exit /b 1
)
echo OK - Administrador confirmado.
echo.
echo Iniciando cliente (DEBUG)...
echo.
set DEBUG=1
node "%~dp0index.js"
pause
