# Gremory Web V2

Reconstrução limpa do site Gremory. Esta versão não coloca uma interface nova por cima da antiga: o frontend antigo foi substituído.

## O que mudou

- removidos o botão flutuante antigo da Pokédex, painel antigo de downloads, modais antigos e GIFs pesados;
- navegação única: Início, Pokémon, Downloads, RPG e Premium;
- no desktop existe um único botão de perfil no topo;
- no celular o perfil fica na barra inferior;
- login só persiste entre novas sessões se **Manter conectado** estiver marcado;
- perfil escreve apenas dados de apresentação em `profiles/{uid}`;
- saldo/Premium/estatísticas antigas são somente leitura no frontend;
- nova Pokédex usando PokeAPI e equipe web de até 6 Pokémon;
- downloads com TikTok, Instagram, Pinterest e Spotify usando `/api/main`;
- Premium abre o fluxo do WhatsApp `/sitecomprar`;
- primeira mesa de RPG funcional com Firebase Realtime Database.

## RPG já funcional

- criar mesa privada por convite;
- entrar por código/link;
- lista de participantes;
- ficha rápida por jogador;
- cena da mesa editável pelo mestre;
- chat em tempo real;
- regras compartilhadas;
- dados d4, d6, d8, d10, d12, d20, d100;
- fórmulas como `2d6+3`;
- histórico de rolagens;
- iniciativa;
- link de convite;
- mestre pode excluir a mesa.

## Firebase

O arquivo `firebase.rules.example.json` contém regras compatíveis com a estrutura nova. Revise antes de publicar porque substituir regras do Firebase pode afetar estruturas antigas do seu projeto.

Estruturas usadas:

- `profiles/{uid}`
- `pokemonWeb/{uid}`
- `rpgRooms/{code}`
- `rpgUserRooms/{uid}/{code}`
- leitura do legado `users/{uid}` somente para mostrar Premium, nível e saldo.

## Vercel

Configure as variáveis em **Project > Settings > Environment Variables**:

```env
RAPIDAPI_KEY=...
DARKSTARS_API_KEY=...
GREMORY_PROXY_SECRET=uma_string_longa_e_aleatoria
```

Não coloque chaves reais no repositório.

`GREMORY_PROXY_SECRET` assina os links de proxy gerados pelo backend quando configurada.

## Login

A regra desta versão é:

- sem marcar **Manter conectado**: a sessão vale para a sessão atual do navegador; ao abrir uma nova sessão é solicitado login;
- marcando **Manter conectado**: Firebase usa persistência local e pode restaurar o login.

A versão também força logout de sessões antigas persistidas pelo site anterior quando não existe a preferência `gremory:remember`.

## Próximas etapas

A base agora está limpa para adicionar, sem voltar ao sistema antigo:

- sincronização Pokémon Site ↔ Charlotte;
- batalha Pokémon visual;
- voz e compartilhamento de tela no RPG com WebRTC/TURN;
- suporte/tickets;
- notificações globais publicadas pelo bot;
- checkout Mercado Pago no backend.
