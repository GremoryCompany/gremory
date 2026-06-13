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
