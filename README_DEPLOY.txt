GREMORY — RECUPERAÇÃO V14 (27/10/2026)

LEIA PRIMEIRO O ARQUIVO GUIA_INSTALACAO_E_LIMITACOES.md.

Há três configurações SEPARADAS:

1. Vercel: publicar todo o site. As novas atividades de XP, pesca,
   mineração e corridas gratuitas utilizam a API /api/main?action=site_progress.
   SOMENTE PARA ESTE SERVIÇO, configurar no ambiente da Vercel:
   FIREBASE_DATABASE_URL e FIREBASE_SERVICE_ACCOUNT_JSON (credenciais Admin),
   ou FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY.
   Sem essas variáveis, os módulos de XP e atividades não funcionarão. Login,
   comunidade e jogos via Bridge não exigem essas chaves na Vercel.
   NUNCA colocar credenciais no config.js ou JavaScript público.

2. Firebase: fazer backup das regras existentes; publicar TODO o
   firebase.rules.production.json em Realtime Database > Rules;
   publicar storage.rules em Storage > Rules. Preservar dados existentes.

3. Railway (bot): substituir database/gremory_site_bridge.js dentro do BOT
   pelo arquivo correspondente desta entrega e reiniciar a Charlotte.
   Atualizar somente na Vercel não muda o Bridge que está rodando na Railway.

ATENÇÃO: versão de recuperação testada LOCALMENTE, não homologada em produção.
NÃO executar cobranças/apostas reais até conferir, em ambiente controlado,
o saldo canônico no bot, as operações antigas pendentes e as regras do banco.
