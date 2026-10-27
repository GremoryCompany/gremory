# Hospedagem do site

O site Gremory é hospedado na Vercel. Para os jogos, Slots, Pokémon via bridge,
ativação de música da sala e carteira, o navegador se comunica com Firebase
Realtime Database e os jobs são processados pelo bridge no BOT da Charlotte.

**Não coloque `FIREBASE_PRIVATE_KEY`, service account, tokens do bot ou segredos
no `config.js` e em nenhum outro arquivo público.** Esses segredos são somente
do ambiente do bot (Railway/Highway). A configuração web pública do Firebase
não é credencial administrativa: a segurança depende das Rules + Auth.

As APIs HTTP da Vercel continuam disponíveis para integrações específicas
(youtube_search, download/proxy etc.) que precisam de chaves **do serviço** no
servidor. O handler `api/main.js` retorna `BRIDGE_REQUIRED` para os endpoints
financeiros legados, protegendo contra rota duplicada.

Para o processo completo, leia `../LEIA-ME.txt`.
