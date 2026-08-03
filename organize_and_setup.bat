@echo off
echo ==========================================
echo BrilhoCar - Limpeza e Setup do Projeto React
echo ==========================================

echo [1] Criando pasta de documentacao e design...
if not exist docs mkdir docs
if not exist design mkdir design

echo [2] Salvando referencias importantes...
move conversa.txt docs\ >nul 2>&1
move firebase-setup.md docs\ >nul 2>&1
move firebase-seed.js docs\ >nul 2>&1
move *.jpeg design\ >nul 2>&1

echo [3] Apagando arquivos lixo (versoes antigas)...
del /q "app (1).js" >nul 2>&1
del /q "index (1).html" >nul 2>&1
del /q "style (1).css" >nul 2>&1
del /q firebase-diagnose.js >nul 2>&1
del /q firebase-rules.txt >nul 2>&1
del /q seed.html >nul 2>&1
rmdir /s /q js >nul 2>&1

echo [4] Limpeza feita com sucesso!
echo [5] Instalando dependencias do Node...
npm install

echo ==========================================
echo SETUP CONCLUIDO! 
echo Para rodar o projeto, digite: npm run dev
echo ==========================================
pause
