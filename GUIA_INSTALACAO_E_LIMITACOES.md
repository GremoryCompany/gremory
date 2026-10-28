# Gremory — recuperação V14 — 27/10/2026

## Objetivo e fonte

Pacote **completo** de recuperação montado a partir da V14 recebida, comparada à
versão do site e do bot enviadas. Não é uma cópia cega de patches V12/V13.
O código preserva Watch Party, rede social, Premium, comunidade, suporte,
perfil, Pokémon, Raid e sistemas administrativos existentes. O Bridge enviado
pelo usuário é uma versão **diferente** da versão do site; não misturar os dois.

## Melhorias implementadas nesta entrega

- **Charlotte fonte de verdade financeira**: Bridge consulta
  `MoneyOfSender`, realiza `delkoin`/`addkoin` no bot e atualiza a visão
  `siteWallets`. Nunca importar automaticamente de `siteWallets` para creditar
  Charlotte. Ledger separado em `siteWalletOps` evita reaplicar ID financeiro.
  Se uma etapa estiver em estado `processing`/`review`, **não repetir manualmente**
  sem verificar o saldo do bot e o lançamento; reconciliar por operação.
- **Daily VIP**: no Bridge, bônus de 50% nas Rúpias e XP do Daily da Charlotte,
  sem confiar em valores enviados pelo navegador.
- **Atividades do site**: pesca/mineração gratuitas com energia 6 por 24 horas
  (Premium 8), inventário no Firebase e RNG com `crypto.randomInt` no servidor;
  corrida de cavalo/carrinho gratuita por colocação (sem aposta), XP, presença
  a cada 5 minutos, XP por posts/comentários/likes verificados com limites
  diários e recibos por atividade; Premium dá 2× XP do SITE.
- **Perfil**: upload de avatar JPEG/PNG/WebP/GIF de até 5 MB no Firebase Storage,
  além do campo existente de foto por URL; salvar perfil após upload.
- **Admin**: opção de banimento temporário e permanente; regras de escrita
  social permitem novamente conta cujo banimento temporário expirou.
- **Proteção HTML**: escape de conteúdo dinâmico na interface para reduzir XSS.
- **Interface**: grade enxuta para atividades, inventário/XP e CSS móvel
  compacto, preservando separação de microfone, filme/tela e música.
- **Regras**: arquivo completo RTDB, fechado na raiz, incluindo `siteProgress`,
  `siteWalletOps`, caminhos Premium e caminhos V14; Storage atualizado para avatar.

## O que já estava no código-base e foi preservado

- Premium por ₹200.000 durante sete dias, com grupo WhatsApp opcional e saída
  automática ao expirar, sujeito a o bot estar conectado e ter permissão
  para entrar/sair do grupo.
- Watch Party com modos público, privado e por convite, chat, moderação,
  vozes individuais, transmissão de tela/filme separada; o host não deve
  reproduzir de volta o áudio da própria captura.
- Jogos Jogo da Velha, 21/21 Pesadelo e Forca; apostas opcionais com servidor.
- Pokémon, Raid Global, Slots, feed, suporte, administração, backup/restauração.

## Limitações IMPORTANTES — não considerar tudo finalizado

- Poker Texas Hold'em (2–6 jogadores), Cores e Caos e captura individual
  posterior de um mesmo boss de Raid **não estão implementados por completo**.
  Alguns tipos aparecem em regras da V14 de origem, mas o Bridge desta
  entrega não suporta essas partidas: não expor telas fictícias.
- Corridas adicionadas são atividades rápidas, gratuitas, **não** jogos
  completos de apostas ou corridas com veículos animados.
- A XP das atividades do site é separada da XP da Charlotte. Bônus de Daily
  da Charlotte é processado no bot. Sincronizar a XP do site com comandos do
  bot requer uma especificação separada para evitar XP duplicado.
- O fluxo de Slots, Raid e Pokémon existentes ainda depende do Bridge da
  Charlotte. Não é seguro torná-los totalmente locais sem implementar outro
  servidor financeiro e reconciliação idempotente.
- O projeto não foi conectado ao Firebase de produção, Railway nem Vercel
  para teste real de pagamentos, permissões, login, WebRTC, integração de
  WhatsApp ou desempenho em múltiplos aparelhos. Não afirmar 100% funcional.

## Instalação segura

1. Backup **dos dados** do Realtime Database e dos JSONs do bot. Guardar
   também as regras atuais. NÃO copiar sessão/sessions de WhatsApp para Firebase.
2. Auditar `siteWallets`, `siteWalletOps` e `siteSlotsPending` antigos:
   qualquer operação com `version > syncedVersion` ou `processing` deve ser
   conciliada **antes** de colocar novas apostas em produção. NUNCA zerar
   dados antigos só porque a tela travou.
3. Publicar **todo** `firebase.rules.production.json` no Firebase Console,
   em **Realtime Database > Rules**. Não use `firebase.rules.example.json`.
4. Publicar **todo** `storage.rules` em **Storage > Rules** (regras de
   Realtime Database e Storage são serviços separados).
5. Atualizar no repositório da Charlotte na Railway o arquivo
   `database/gremory_site_bridge.js` e reiniciar bot. Confirmar que a aplicação
   realmente importa e inicia esse módulo, mantendo o `index.js` corrigido.
6. Fazer deploy do site na Vercel. As atividades de pesca, mineração,
   corridas e XP foram movidas para jobs do Bridge na Railway, usando as
   credenciais Firebase Admin **já presentes no bot**. A Vercel NÃO precisa
   dessas credenciais para executar essas atividades. Outros endpoints antigos
   que ainda dependem de Firebase Admin no servidor devem ser auditados antes
   de reativá-los, e nunca receber segredos no frontend.
7. Esvaziar cache antigo via reload forçado e testar em **ambiente de teste**:
   conta, recuperação de senha, foto, post, curtir/comentar, pesca/mineração,
   convite sem aposta, áudio do host e convidado, Premium e sincronização.
   Só depois validar transações financeiras pequenas e conferindo ambos os
   saldos com logs no bot. Não repetir transações pendentes.

## Testes locais

`npm test` (32 testes, sem Firebase de produção)

`node --check database/gremory_site_bridge.js`

`node --check api/main.js`

`node --input-type=module --check < assets/js/app.js`

`node --input-type=module --check < assets/js/community.js`

JSON: `node -e "JSON.parse(require('fs').readFileSync('firebase.rules.production.json','utf8'))"`

Os testes NÃO substituem testes integrados com Firebase Emulator, Railway,
Vercel e múltiplos dispositivos reais.

## Direitos autorais

O 21 Pesadelo usa mecânicas originais. Resident Evil 7 **não é domínio público**:
não reutilizar imagens, personagens, músicas ou textos protegidos do jogo.

## Patch incremental — melhorias adicionais 27/10

- **Watch Party:** começa com "Fora da chamada". Apenas o botão "Entrar na voz"
  pede permissão de microfone; o status só muda após o Firebase confirmar `audio:true`.
  RTC para vídeo/transmissão continua separado; nenhuma captura local é reproduzida no host.
- **Slots:** prêmios comuns usam `assets/audio/custom/money-win.mp3` (som de moedas);
  não altera a lógica financeira ou o RNG.
- **Premium:** seis vantagens reais destacadas e quatro cartões mais claros.
  Os preços/durações não mudaram. **Não inventar diferenças de permissões entre os
  planos pagos:** novas vantagens específicas de cada plano precisam de controle
  de acesso no servidor antes de serem anunciadas como ativadas.
- **Progressão:** `site_progress` é job validado pelo Bridge no Railway. Atualizar
  o Bridge e publicar as novas regras do RTDB ANTES de publicar o site; caso
  contrário o Firebase negará a operação.
- **Exclusão de conta pelo administrador:** botão no painel Contas, confirmações
  explícitas e ação privilegiada `admin_delete_account` no Bridge. A conta é
  desativada/revogada primeiro e excluída de Firebase Authentication por último.
  Limpa o perfil, nome único, vínculo e referências sociais selecionadas do RTDB.
  Os dados da carteira, Pokémon e Premium na Charlotte ligados ao WhatsApp NÃO
  são apagados: na conta nova é necessário vincular pelo código do bot.
  Bloqueia exclusão com jobs, giros ou apostas financeiras pendentes.
  Mantém recibos financeiros de servidor (`siteWalletOps`/`gameWagers`) para auditoria
  e segurança contra reaplicação. Backups históricos não são reescritos.
  Grava um registro mínimo em `siteAccountDeletions` (somente leitura Admin).
  Se falhar entre as etapas, a conta permanece desativada; o admin deve resolver
  a causa e repetir a operação, **não** recriar o vínculo antes de concluir.
  Não remove automaticamente avatares já enviados ao Firebase Storage nem caches
  históricos de outros serviços; isso requer uma rotina específica de retenção/
  exclusão e verificação em ambiente real.

## Verificações finais desta revisão

- Rodar `npm test`, `node --check database/gremory_site_bridge.js`,
  `node --check database/gremory_site_admin_accounts.js`,
  `node --check database/gremory_site_progress.js`,
  `node --input-type=module --check < assets/js/app.js`.
- Conferir o JSON das regras antes de publicar e fazer um teste com conta
  descartável no Firebase Emulator, incluindo exclusão + novo cadastro + /vincular.
- O processamento ainda depende do bot na Railway online, embora o navegador
  não precise acessar suas APIs para executar as novas atividades.
