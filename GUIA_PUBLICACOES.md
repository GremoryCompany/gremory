# Publicações para Discord e WhatsApp

Na Administração, abra a área Operação e localize Publicações. Cadastre um destino com ID curto (ex.: neon-discord), nome, plataforma e endereço. Para Discord, informe o ID do canal e o ID do servidor; o comando `/destino canal:#canal` mostra os dois. Para WhatsApp, informe o identificador do grupo (`...@g.us`) ou canal (`...@newsletter`), não o link de convite. O dono pode usar `/destinosite` com a Charlotte no grupo/canal para consultar o identificador.

O bot precisa participar do destino e ter permissão de envio; em canais WhatsApp, precisa ter permissão administrativa de publicação e a hospedagem deve suportar essa função do WhatsApp. Configure as credenciais Firebase já usadas pelos bots. Não são necessários novos webhooks ou chaves privadas no navegador.

Ao criar uma publicação no Grémorium, o administrador pode marcar os destinos que receberão uma cópia. Também é possível usar Compartilhar nos canais em uma publicação existente. Publicações comuns ficam somente na comunidade; nenhuma opção vem marcada automaticamente.

O texto e suas quebras de linha são preservados. Fotos enviadas pelo dispositivo são anexadas diretamente a partir do Realtime Database, sem Storage ou upload público intermediário. No WhatsApp, textos com mais de 1.024 caracteres vão em uma mensagem após a foto, preservando o texto completo. Vídeos não fazem parte desse encaminhamento. Para imagens por link, o WhatsApp aceita hosts públicos autorizados; outros exigem que a foto seja enviada pelo dispositivo ou que o administrador configure PUBLICATION_IMAGE_HOSTS na Charlotte.

O histórico na Administração mostra o estado de cada destino. Bots desligados deixam o pedido aguardando. Uma falha antes do envio permite Tentar envio novamente. Uma entrega sem confirmação fica para conferência; não há reenvio automático de um resultado incerto. Uma preparação interrompida antes do envio é liberada para nova tentativa após cerca de dois minutos. A mesma publicação não é enviada novamente ao mesmo destino por um segundo clique.

Editar um destino depois de agendar não redireciona silenciosamente o pedido: ele precisa ser confirmado por uma nova tentativa. Pausar um destino impede novas preparações, mas não cancela uma mensagem já enviada à plataforma. Excluir a publicação da comunidade não apaga mensagens que já chegaram a Discord ou WhatsApp.

Publique o arquivo completo `firebase.rules.production.json` em Realtime Database → Regras. Os novos caminhos são publicationDestinations e publicationOutbox, com escrita administrativa; os bots validam a identidade novamente no servidor. Nunca coloque contas de serviço ou tokens nos formulários.

As verificações usam destinos simulados. A instalação no DisCloud e a confirmação de uma entrega real nos seus canais devem ser feitas após configurar os identificadores e permissões.
