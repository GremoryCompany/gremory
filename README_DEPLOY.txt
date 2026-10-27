GREMORY V14 — DEPLOY DO PROJETO COMPLETO

Site: Vercel. Frontend usa Firebase Auth e Realtime Database para os jogos,
carteira, Pokémon e sala. Não requer Firebase Admin na Vercel nesses fluxos.

Bot: Railway/Highway. Atualizar o arquivo database/gremory_site_bridge.js NA
PASTA DO BOT e reiniciar. Firebase Admin + credenciais privadas ficam só aqui.

Firebase: publicar TODO firebase.rules.production.json em Realtime Database
Rules. Fazer backup do estado anterior. Não publicar firebase.rules.example.json.

Ordem recomendada: backup, atualizar bridge do bot, publicar as regras, deploy
do site, recarregar navegador com Ctrl+F5 e testar primeiro Jogo da Velha sem
aposta, depois saldo, personalização, música e um giro de valor pequeno.

Não limpar giros/apostas que já estejam em análise sem conferência financeira.
Mais detalhes e comandos de teste: LEIA-ME.txt.
