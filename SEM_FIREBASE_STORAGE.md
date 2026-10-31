# Fotos sem contratar Firebase Storage

Esta versão usa o Realtime Database existente para fotos. Não precisa ativar Storage, adicionar cartão ou configurar bucket. Publique o arquivo completo `firebase.rules.production.json` na aba Realtime Database > Regras e aguarde o deploy do site.

Avatares são comprimidos em JPEG com até 24 KiB de texto; fotos do feed e stories, até 96 KiB. A resolução máxima é 384 px para avatar e 960 px para fotos. GIFs enviados viram imagens estáticas. Vídeos continuam aceitos por link HTTPS; arquivos de vídeo não são enviados ao banco.

Perfis e publicações guardam somente uma referência pequena. As imagens ficam em `siteMedia`, carregadas separadamente quando aparecem na tela. Usuários autenticados podem ver fotos; cada pessoa só cria e exclui seus próprios arquivos. Administradores também podem excluir arquivos, mas clientes não podem substituir arquivos existentes nem editar saldo.

Stories deixam de ser acessíveis após 24 horas; os arquivos expirados são removidos quando o autor abre o feed novamente. Se ele não voltar, permanecem ocupando espaço até uma limpeza administrativa. Excluir uma publicação remove sua foto. A exclusão administrativa da conta também remove suas imagens. Avatares anteriores permanecem para preservar referências antigas.

As fotos usam as cotas de armazenamento e transferência do Realtime Database. Esta solução tem limites e não oferece armazenamento ilimitado; acompanhe Uso no console Firebase.

Validação: 83 testes automatizados; Chromium com tela de celular e computador, compressão real de PNG para JPEG e carregamento pela referência. Firebase foi simulado nesses testes de navegador. Deploy e permissões reais do projeto precisam ser conferidos após publicar as regras. As regras de Storage antigas não são necessárias para este fluxo.
