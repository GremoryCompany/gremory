# Gremory V13 — revisão de código

Esta entrega modifica o ZIP recebido. Não foi publicada na Vercel, no Firebase ou no Railway. O GIF de login e os arquivos de mídia originais foram mantidos.

## Instalação, na ordem

1. Faça um commit/backup da versão que está funcionando. Envie o conteúdo da pasta `gremory-main` para a raiz do repositório do site, preservando suas variáveis de ambiente.
2. No Firebase → Realtime Database → Regras, publique `firebase.rules.production.json`. Compare antes com as regras atualmente publicadas: qualquer caminho adicional criado depois deste ZIP deve ser preservado. O arquivo example também foi atualizado, mas use production como referência principal.
3. No projeto da Charlotte, substitua **database/gremory_site_bridge.js** pelo arquivo desta entrega e reinicie uma única instância do bot. Esse arquivo precisa ir para o bot, não apenas para a Vercel. O restante do bot não foi fornecido nem alterado. A inicialização existente deve continuar chamando `createGremorySiteBridge(...).start()` e encaminhando comandos para `handleCommand`.
4. Publique o site na Vercel. Depois recarregue o navegador. O service worker mudou de versão e os assets deixaram de ter cache imutável de um ano.
5. Entre com a conta administradora `losermodder@gmail.com`. As novas operações privilegiadas exigem e-mail verificado. Se necessário, use “Confirmar e-mail do administrador”, abra o link recebido e saia/entre novamente.

## Configurações externas

### Transmissão de tela — Vercel

Configure `TURN_URL`, `TURN_USERNAME` e `TURN_CREDENTIAL` com os dados de um serviço TURN válido. `TURN_URL` aceita vários endereços separados por vírgula. Exemplo de formato, não de servidor real:

```
TURN_URL=turn:seu-servidor:3478,turns:seu-servidor:5349
TURN_USERNAME=usuario-fornecido-pelo-servico
TURN_CREDENTIAL=credencial-fornecida-pelo-servico
```

Sem TURN, algumas combinações de Wi-Fi, rede móvel e firewall podem não conectar. Não existem credenciais TURN no ZIP. A transmissão continua ponto a ponto: a carga de upload cresce com a quantidade de espectadores. Para salas grandes, uma arquitetura com servidor de mídia/SFU será uma etapa separada.

O código agora carrega a configuração antes de abrir as conexões, organiza a sinalização em sequência, resolve colisões de ofertas, limita a captura preferencial a 720p/24 fps e distribui o orçamento de bitrate entre os espectadores. Isso reduz fatores de atraso; não comprova latência em redes reais.

Para transmitir som, compartilhe uma **aba** com a opção de áudio marcada, em um navegador que ofereça captura de áudio. O código verifica se veio uma faixa de áudio; pedir áudio não garante que o navegador/SO entregue essa faixa. O espectador pode tocar em “Ativar reprodução e som” ou no botão de som da transmissão. O host não escuta sua própria transmissão para evitar retorno.

Em navegadores móveis sem captura de tela, o site explica a limitação; assistir continua sendo o fluxo previsto. Não houve teste em aparelhos físicos nesta revisão.

### Google Drive — prioridade da revisão

- O parser preserva `resourcekey`, necessário em alguns links compartilhados, aceita links `/file/d/ID/...` e `?id=ID` e rejeita domínios parecidos com Drive.
- Há orientação no player, botão para abrir o original e recarregar a prévia.
- O arquivo precisa ser acessível para cada espectador e estar pronto para reprodução no Drive. Teste com outra conta: sua própria conta ter acesso não prova que os convidados tenham.
- **A prévia do Drive ainda tem Play/Pause independente para cada pessoa.** Esta revisão não cria uma API de sincronização que o iframe não fornece.
- Para todos verem a mesma reprodução agora: abra o vídeo do Drive em uma aba e compartilhe essa aba com áudio, ou use um arquivo MP4/WebM servido por um endereço direto compatível com o player sincronizado.
- Não há proxy que burle permissões do Drive nem promessa de reproduzir arquivos privados, formatos incompatíveis ou vídeos ainda sendo processados. A causa específica do seu arquivo só poderá ser confirmada com o link e um teste entre contas.

### Pesquisa do YouTube — Vercel

Ative a YouTube Data API v3 no seu projeto Google e configure `YOUTUBE_API_KEY` na Vercel, somente no servidor. Configure restrições da chave e cota no Google Cloud. A busca retorna até oito vídeos incorporáveis; o host escolhe um resultado. Sem chave, aparece uma explicação e o campo de colar link continua disponível. Restrições do próprio vídeo ainda podem impedir reprodução incorporada.

### Fotos e vídeos do feed — Firebase Storage

Ative o Storage no mesmo projeto Firebase. Confira se o bucket corresponde a `firebaseConfig.storageBucket` em `assets/js/app.js`. Publique `storage.rules` nas regras do **Storage**, não nas regras do Realtime Database. Preserve outras regras de Storage que já sejam necessárias a recursos externos a este ZIP.

O feed aceita JPG, PNG, WebP, GIF (até 10 MB), MP4 e WebM (até 50 MB). Arquivos são enviados diretamente ao Storage, sem passar pelo limite de upload da função Vercel. Também há mídia por URL HTTPS. O projeto Firebase pode exigir habilitação de faturamento/serviço para ativar o bucket; verifique isso no seu console.

### Avisos no WhatsApp — Railway/bot

Configure `GREMORY_FEED_GROUPS` com IDs de grupos autorizados, separados por vírgula. Exemplo de formato:

```
GREMORY_FEED_GROUPS=120000000000000001@g.us,120000000000000002@g.us
```

A conta do bot precisa participar dos grupos e poder enviar mensagens. Não foi enviado nenhum aviso real durante esta revisão.

- Publicações comuns dos usuários não disparam mensagens automaticamente.
- O dono pode usar “Avisar grupos” em uma publicação do feed, com confirmação.
- `/anunciosite texto` ou `/anuncio site texto`, no privado e pelo dono, continua publicando nas Atualizações e agora também espelha no feed. Se os grupos estiverem configurados, o bot avisa esses grupos.
- A aba Atualizações já existente foi preservada.
- O registro `communityAnnouncements` evita reenvio automático da mesma publicação. Se um processo cair durante o envio, pode haver entrega parcial; confira esse registro e os grupos antes de qualquer reenvio manual.

## O que foi corrigido e acrescentado

- Fila do bridge: removida a espera circular entre `watchUserJobs` e `processJob`. Essa falha podia travar roleta, compras e músicas.
- Regras: os comandos implementados no bot e ausentes nas regras foram incluídos, como `slots_spin`, loja administrativa, poções e jogos. Comandos administrativos permanecem restritos. Clientes não podem forjar os campos de bloqueio de processamento.
- Administração: leitura do catálogo, status de backup e chat de suporte recebeu regras específicas; esses caminhos não existiam na versão de regras enviada.
- Sons: notification/victory estavam sendo procurados em `custom`, embora os arquivos estivessem na pasta superior. Sons sem arquivo usam agora MP3 existentes como alternativas. O áudio é preparado a partir de interação do usuário.
- Escamas: textura mais visível, inclusive nos cartões de perfil. Corrigida a política de estilos que bloqueava estilos dinâmicos usados por GIFs/efeitos. Scripts inline continuam proibidos.
- Watch Party: identidade na presença e cartões de chamada, indicação de microfone silenciado, seleção das telas existentes, tratamento da reprodução de áudio bloqueada e encerramento da sessão anterior ao trocar de sala.
- Notificações: painel mobile ocupa a tela, com texto legível e ações maiores.
- Feed: publicação, mídia, comentários, curtidas, seguir/deixar de seguir, filtro Seguindo, carregar mais, exclusão pelo autor ou administrador. A primeira página mostra as 20 publicações mais recentes. “Seguindo” filtra as páginas já carregadas.
- Emblemas: dono concede/revoga; usuário equipa no perfil da comunidade; emblema equipado também aparece no perfil público existente. Conquistas já desbloqueadas no bot podem ser equipadas como emblema do site. Isso não muda o badge do WhatsApp.
- GIFs/sprites: o formulário administrativo já existia; foi mantido, com comandos e leitura de catálogo desbloqueados pelas regras. O cadastro ainda usa URL da mídia.

## Validação realizada e limites

Passaram a checagem sintática dos JavaScripts alterados e sete testes em `tests/regression.cjs`:

1. IDs e resourcekey de links do Drive;
2. execução ordenada de dois jobs sem espera circular;
3. comandos permitidos, bloqueio de comandos administrativos para usuário comum e de locks forjados;
4. existência dos arquivos de som configurados;
5. retirada do cache imutável;
6. correspondência dos controles novos com os IDs do HTML;
7. busca YouTube sem chave e mapeamento de resposta, com chamada externa simulada.

Execute com `node --test tests/regression.cjs`.

Os testes de regras são testes unitários de expressões selecionadas, **não** uma execução no emulador Firebase. Publique/valide as regras no console e faça os testes de permissões abaixo antes de liberar aos usuários.

Não houve execução visual no navegador: o Chromium não estava instalado e o download disponibilizado ao ambiente veio inválido. Não houve login real, upload real, transmissão entre aparelhos, conferência de saldo real, chamadas às APIs de mídia com credenciais nem testes no Firebase de produção.

## Conferência após instalar

- Duas contas: PC do host e celular em outra rede. Entrar na sala antes/depois do compartilhamento; testar voz, nomes, mute, som da aba, parar/reiniciar compartilhamento e trocar de sala.
- Drive: link com acesso liberado às duas contas. Verificar a prévia separadamente e, para reprodução conjunta, compartilhar a aba com áudio.
- Roleta: aposta pequena, confirmar um único débito/resultado e saldo refletido no bot. Não repetir a aposta se houver timeout antes de conferir o saldo.
- Loja: criar GIF com o dono, tentar com conta comum (deve ser negado), comprar/equipar e abrir o perfil por outra conta.
- Feed: foto e vídeo, duas contas curtindo/comentando/seguindo; conta comum não pode excluir post alheio, conceder emblemas ou avisar grupos. Tentativa de arquivo maior que o limite deve falhar.
- Notificações: desafio em tela pequena, botões Aceitar/Recusar e rolagem.

## Próximas integrações que não estão prontas nesta entrega

Netflix/Prime com login e reprodução interna, catálogo de filmes por API, sincronização nativa do player Drive, infraestrutura de mídia para salas grandes, transcodificação de uploads e moderação automatizada. Nenhuma dessas funções foi simulada com botões sem funcionamento. Uma biblioteca de filmes precisa de uma fonte de vídeo autorizada; uma API de títulos/capas, sozinha, não entrega os filmes.

Referências técnicas consultadas: [W3C WebRTC](https://www.w3.org/TR/webrtc/), [MDN — negociação WebRTC](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation), [Google Drive — recurso Files](https://developers.google.com/workspace/drive/api/reference/rest/v3/files).
