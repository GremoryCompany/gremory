# Gremory Web V3

## Principais mudanças

- entrada em tela cheia com `login.gif`;
- o GIF é descarregado depois do login;
- sem **Manter conectado**, recarregar a página pede login novamente;
- início redesenhado;
- amigos e solicitações;
- vínculo real Charlotte ↔ conta do site por `/vincular CODIGO`;
- sincronização dos Pokémon do bot;
- desafio e duelo Pokémon processados pelo bridge da Charlotte;
- RPG corrigido para criar a mesa em uma escrita atômica;
- regras Firebase novas em `firebase.rules.production.json`;
- downloads do site + atalhos para continuar na Charlotte;
- YouTube abre o `/play` no bot.

## Antes de testar RPG, amigos ou integração

Publique `firebase.rules.production.json` no **Realtime Database > Rules**.

Sem publicar as novas regras, o Firebase continuará respondendo `permission_denied` com as regras antigas.

## Bot

A pasta `BOT_PATCH` fica no ZIP principal e contém o bridge da Charlotte.
Ela não faz parte do deploy da Vercel.

## Variáveis da Vercel

```env
RAPIDAPI_KEY=
DARKSTARS_API_KEY=
GREMORY_PROXY_SECRET=
```

Nunca coloque tokens reais em arquivos públicos do frontend.
