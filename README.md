# Gremory Site V12.1 — Games Pro

Atualização de lançamento com foco em estabilidade, Watch Party, perfis, administração, Pokémon e integração com a Charlotte.

## Principais mudanças

- nova identidade visual com o dragão Gremory nos pontos principais da interface e nos ícones do PWA;
- ajustes de renderização e navegação para reduzir travamentos em telas longas;
- Watch Party ajustado para compartilhar em 30 FPS como alvo, com bitrate maior, prioridade para movimento, áudio de tela separado e ressincronização automática para quem entra depois que a transmissão já começou;
- perfil próprio passa a exibir GIF/sprite equipado;
- painel administrativo pode conceder/remover rúpias, conceder Premium, enviar notificações, atender o chat de suporte, cadastrar GIFs/sprites na loja e solicitar backup imediato do bot;
- chat entre usuário e equipe Gremory;
- JSONs operacionais da Charlotte espelhados no Firebase automaticamente a cada 10 minutos e no início do bridge;
- novas personalizações cadastradas pelo painel passam a ser reconhecidas pelo backend da loja;
- raid global avisa o site, usuários opt-in no WhatsApp e grupos com Modo Pokémon ativo;
- raid concede Premier Balls com bônus de equipe;
- Premier Ball pode ser usada nas capturas do site;
- Centro Pokémon permite mandar apenas o Pokémon escolhido para recuperação, mesmo se ainda não estiver desmaiado;
- Poções podem ser compradas no site por ₹80 e usadas individualmente em Pokémon feridos;
- cache do PWA atualizado para priorizar JS/CSS novos após deploy.


## Jogos V12.1

- 21 passou a ser PvP entre amigos confirmados; o baralho fica protegido no bridge e só as cartas já compradas aparecem no Firebase público da partida;
- Forca passou a ser PvP por turnos; a palavra secreta fica em `gameSecrets`, caminho bloqueado para o cliente;
- Slots agora é solo, usa o saldo real de Rupias da Charlotte e aceita apostas de ₹10 a ₹5.000;
- o resultado do Slots é definido pelo bridge, que debita a aposta antes de calcular o prêmio;
- telas de 21, Forca e Slots foram ampliadas;
- `victory.mp3` continua sendo usado nas vitórias e `defeat.mp3` foi adicionado para derrotas;
- no perfil existe a opção `Receber avisos do site no WhatsApp`. Quando ativada e a conta estiver vinculada, a Charlotte encaminha notificações do site (exceto raids, que continuam com a preferência própria).

Para esta versão, publique novamente `firebase.rules.production.json` porque há novas regras para `blackjackGames`, `hangmanGames`, seus índices e `gameSecrets`.

## Arquivos do bot

O bridge desta pasta precisa substituir `database/gremory_site_bridge.js` na Charlotte/Railway.

Use também o pacote `GREMORY_BOT_V13_5_GAMES_PRO.zip`, que mantém a base V13.4 e adiciona o bridge de jogos V13.5.

## Firebase Rules

Publique `firebase.rules.production.json` no Realtime Database. As regras incluem os novos jobs administrativos, Poções, loja dinâmica, chat de suporte e leitura administrativa do status de backup.

## Railway

As variáveis de persistência continuam as mesmas:

```text
GREMORY_DATA_DIR=/data/gremory-data
CHARLOTTE_SESSION_DIR=/data/session
```

O Volume continua montado em `/data`.

O backup do Firebase é uma segunda cópia dos JSONs operacionais; o Volume da Railway continua sendo a cópia de execução do bot.

## Watch Party e áudio

O site transporta a faixa de áudio entregue pelo navegador durante o compartilhamento de tela. No Chrome/Edge, compartilhar uma aba e habilitar o áudio no seletor costuma oferecer a melhor compatibilidade. A disponibilidade de áudio de "tela inteira" depende do navegador e do sistema operacional.

## Concorrência e fluidez

Os jobs do bridge agora são processados em fila por usuário. Isso preserva a ordem das ações em partidas e impede duas apostas simultâneas do Slots de tentarem usar o mesmo saldo antes do débito.

As telas de jogo assinam apenas o índice do usuário e a partida ativa, evitando listeners desnecessários de todas as salas. Ao sair/deslogar, as assinaturas de 21 e Forca são removidas.
