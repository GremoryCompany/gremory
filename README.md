# Gremory Pokédex Vercel

Projeto estático pronto para subir na Vercel.

## Como usar

1. Envie esta pasta para um repositório no GitHub.
2. Importe o repositório na Vercel.
3. Deploy normal, sem build command.

## Importante

Este projeto não inclui GIFs locais pesados. Ele usa sprites externos por número da Pokédex:

- 1ª geração: #001 até #151
- 2ª geração: #152 até #251
- 3ª geração: #252 até #386

Assim o deploy fica leve e não estoura limite da Vercel.

## Integração no seu Gremory existente

Se quiser integrar em outro projeto, copie:

- O HTML do botão e modal do index.html
- O CSS de assets/css/style.css
- O JS de assets/js/app.js

## Gremory Play: Anime, APK e Ranking

Esta versão inclui uma tela nova no estilo streaming:

- botão superior esquerdo para **Assistir Anime**;
- botão superior esquerdo para **Baixar APK**;
- tela cheia `Gremory Play` com recomendações, busca, episódios, player e comentários;
- ranking de atividade integrado ao Firebase quando o usuário está logado;
- personalização extra no perfil: bio, anime favorito e tema;
- rotas novas em `/api/main`:
  - `action=anime_search`
  - `action=anime_eps`
  - `action=anime_download`
  - `action=apk_search`
  - `action=apk_download`

### Variáveis de ambiente recomendadas na Vercel

Para proteger sua chave da Dark Stars API, configure uma destas variáveis no painel da Vercel:

```txt
DARKSTARS_API_KEY=sua_apikey
```

Também aceito pelo backend:

```txt
DARK_API_KEY=sua_apikey
GREMORY_APIKEY=sua_apikey
APIKEY=sua_apikey
```

Se nenhuma variável estiver configurada, o site ainda tenta usar a ApiKey salva no perfil do usuário logado.
