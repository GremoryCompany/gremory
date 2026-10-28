# Gremory V14 — Patch de Atividades e Comunidade (28/10/2026)

## O que foi implementado

- **Pesca**: animação de arremesso, probabilidade de 22% de não capturar nada, seis energias por ciclo de 24 horas (oito para Premium) e itens com raridades. O servidor sorteia o resultado.
- **Mineração**: animação simples de picareta, inventário persistente no Firebase e energias com o mesmo ciclo.
- **Venda**: o usuário pode vender **uma unidade por clique** de peixe ou minério. Tabela fixa **servidor**: Lambari ₹2, Tilápia ₹4, Traíra ₹7, Peixe-dourado ₹13, Carpa-lendária ₹30; Pedra ₹1, Cobre ₹3, Ferro ₹5, Prata ₹9, Cristal raro ₹24. Exige conta Charlotte vinculada.
- **Corridas**: seis cavalos e seis carros selecionáveis; animação somente após o servidor decidir o vencedor. Acerto de 1/6 rende ₹18 **somente quando há vínculo com Charlotte**; caso contrário, continua sendo grátis e dá XP. Máximo de dez corridas por modalidade por dia e espera mínima de 60 segundos entre corridas da mesma modalidade.
- **XP**: ações equilibradas (pesca +8, mineração +10, corrida +5, multiplicador Premium 2x). Publicações/curtidas/comentários mantêm limites do servidor.
- **Feed**: faixa de stories de imagens (5 MB), expiração de exibição em 24h, exclusão do próprio story e apresentação do perfil com galeria de fotos recentes. O feed mantém publicações, fotos, vídeos, curtir, comentar e seguir já existentes.
- **Segurança**: novas regras Realtime Database apenas em `communityStories`; novas regras Storage somente em `stories/{uid}/{file}`. A raiz segue fechada, `siteProgress` e `siteWallets` sem escrita pública. Recibos financeiros são emitidos pelo Bridge com IDs únicos.

## Instalação

1. Faça backups do Firebase Realtime Database, Storage, da Charlotte no Railway e do site V14 em produção.
2. Extraia o ZIP **Gremory_PATCH_SITE_20261028.zip** na raiz do projeto **V14 otimizado de 27/10**, preservando a estrutura das pastas. Faça o deploy na Vercel.
3. Cole o **arquivo completo** `firebase.rules.production.json` do patch em **Firebase Console → Realtime Database → Rules** e publique. Não cole apenas o trecho de stories.
4. Cole o **arquivo completo** `storage.rules` em **Firebase Console → Storage → Rules** e publique.
5. Extraia **Gremory_PATCH_BOT_20261028.zip** sobre o projeto Charlotte da Railway. **Não** substitua o bot inteiro. Confirme se o bot iniciou, o Bridge está ativo e o vínculo funciona.
6. Teste com conta secundária: pescar vazia ou cheia; vender um peixe; conferir inventário, recibo `siteWalletOps`, Rúpias no bot e extrato no site; testar duas corridas; postar um story; verificar stories em outra conta; verificar expiração visual.
7. **Não** confirme a liberação financeira para todos antes de verificar o fluxo de venda e premiação com dados reais da Charlotte. Se `siteWalletOps` constar como `review` ou `processing`, **não reenvie pagamento manualmente** até conferir saldo e recibos. Em falhas entre a reserva e o crédito, a venda fica pendente para reconciliação, sem creditar duas vezes.

### O que não foi alterado

Watch Party, áudio, Slots, Premium, Pokémon, convites, administração, backup e saldo não foram reescritos. A única modificação no Bridge é a lógica das atividades, vendas e premiações de corrida.

### Limitações e próximas fases

- Stories ficam ocultos após 24h, porém objetos expirados **ainda existem** no RTDB e Storage até uma rotina segura de limpeza do servidor ser adicionada; isto não é exclusão automática de dados.
- A galeria mostra fotos dentre as publicações recentemente carregadas; não é uma paginação completa de todas as fotos da vida da conta.
- A API antiga `api/site-progress.js` continua como compatibilidade e ainda exige Firebase Admin caso acessada diretamente. As novas atividades da interface usam jobs do Bridge na Railway.
- Não foi feito teste real de deploy em Vercel/Railway, notificações push, sessão móvel nem de créditos reais. Os testes automáticos cobrem invariantes básicos, não substituem homologação.

## Como fazer um APK do site Gremory

O site já contém `manifest.webmanifest`, ícones de app e `sw.js`: é uma base para **PWA**. O caminho mais simples é usar [PWABuilder](https://www.pwabuilder.com/) (interface gráfica) ou **Bubblewrap** (linha de comando). É necessário um domínio HTTPS público da Vercel e um computador com ferramentas Android.

1. Primeiro teste a instalação PWA no Android: Chrome → menu → **Adicionar à tela inicial / Instalar app**. No iPhone: Safari → Compartilhar → **Adicionar à Tela de Início**.
2. No PC, abra https://www.pwabuilder.com/ e informe o domínio HTTPS do site, execute a inspeção do manifesto e corrija os avisos. Gere um projeto Android e assine seu APK com uma chave de assinatura **sua**, guardada em segurança. Como alternativa técnica, instale o Bubblewrap `npm i -g @bubblewrap/cli`, execute `bubblewrap init --manifest=https://SEU-DOMINIO/manifest.webmanifest` e depois `bubblewrap build`.
3. Configure o arquivo `/.well-known/assetlinks.json` no domínio com nome do pacote e SHA-256 do certificado de assinatura gerado, seguindo o guia oficial de Trusted Web Activity, para o app abrir em tela cheia sem barra de navegador.
4. O conteúdo web do app atualiza quando você faz o deploy da Vercel e o usuário reabre/atualiza o app (respeitando cache). Alterações no **invólucro Android** (ícone, permissões nativas, versão, novos recursos) exigem novo APK assinado. Nunca inclua credenciais privadas no APK.
5. **Notificações push ainda não estão implementadas neste patch.** Para adicionar, configure Firebase Cloud Messaging, permissão explícita do usuário, tokens por instalação e endpoint privilegiado no servidor/Bridge, com preferências de opt-out. Não envie chave de servidor pelo navegador. Para Android 13+ há permissão de notificações em tempo de execução.

Referências: [Android Developer: Trusted Web Activities](https://developer.android.com/develop/ui/views/layout/webapps/guide-trusted-web-activities-version2?hl=pt-BR) · [Firebase Cloud Messaging Web](https://firebase.google.com/docs/cloud-messaging/web/get-started).
