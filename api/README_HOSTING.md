# Hospedagem — correção dos jogos do site

A API da Vercel executa convites/partidas de Velha, 21 e Forca, slots e música da Watch Party. O bridge atual acompanha siteWallets e espelha ganhos/perdas na Charlotte. Pokémon e integrações WhatsApp continuam usando o bridge existente.

Configure no ambiente de servidor da Vercel, no mesmo projeto Firebase usado pelo site:

- FIREBASE_DATABASE_URL: URL exata do Realtime Database atual.
- FIREBASE_SERVICE_ACCOUNT_JSON: JSON da conta de serviço Firebase Admin, como variável secreta da hospedagem. Também é aceito o JSON em base64.

Alternativa ao JSON: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY (ou FIREBASE_PRIVATE_KEY_BASE64), sempre junto de FIREBASE_DATABASE_URL.

Faça novo deploy após configurar as variáveis. firebase-admin já consta nas dependências da V14. Não coloque credenciais em config.js, HTML, JavaScript público ou no repositório. Não é necessário refazer o vínculo existente.

YOUTUBE_API_KEY é opcional para pesquisar música por nome; links YouTube funcionam sem essa chave. Reprodução continua sujeita às permissões do navegador e à disponibilidade de incorporação do vídeo.

Mantenha o bridge e as regras atuais enviados nos TXT. Não abra escrita pública na carteira. A API valida a sessão Firebase e executa as operações com Firebase Admin. O bot precisa estar conectado para espelhar o saldo, mas não para concluir cada jogada do site após a carteira já ter sido sincronizada.

As instruções antigas que limitavam Firebase Admin ao bot ou exigiam BRIDGE_REQUIRED nas rotas dos jogos são substituídas por este documento.
