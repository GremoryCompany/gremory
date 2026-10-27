# Hospedagem do Gremory

- Firebase Auth + Realtime Database atendem o frontend e os jogos com bridge.
- Apenas **Charlotte/Railway** é autoridade das transações em Rúpias e da
  sincronização Pokémon. Nunca confiar em saldos/prêmios calculados no cliente.
- O `api/main.js` mantém endpoints financeiros legados desativados com status
  HTTP 410. `api/site-wallet.js` usa Firebase Admin para autenticar as novas
  APIs de progressão e também rejeita qualquer tentativa direta de `applyWallet`.
- A atividade XP de presença, feed, pesca/mineração e corridas usa
  `/api/main?action=site_progress` e **PRECISA** de credenciais Firebase Admin
  no servidor Vercel: `FIREBASE_DATABASE_URL` e `FIREBASE_SERVICE_ACCOUNT_JSON`
  ou `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`.
  Não confundir com credenciais do navegador. Guardar somente em Environment
  Variables da Vercel, sem expor valores em logs, `config.js` ou Git.
- Publicar Realtime Database Rules em `firebase.rules.production.json` e
  Storage Rules em `storage.rules` em seus respectivos produtos no Console.
- Leia `../GUIA_INSTALACAO_E_LIMITACOES.md` antes de subir a versão.
