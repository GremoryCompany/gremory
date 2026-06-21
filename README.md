# Gremory Site

Versão ajustada: a parte de anime foi removida do modelo streaming/Gremory Play e voltou para a aba de Downloads.

## Anime

Fluxo igual ao bot:

1. Downloads → Anime
2. Digite o nome do anime
3. Escolha o resultado
4. Escolha o episódio
5. Escolha a qualidade para abrir/baixar

APIs usadas:

- `animefire?name=` para pesquisar
- `animefireEp?url=` para listar detalhes e episódios
- `animefireDow?url=` para gerar links 360p/720p
- fallback com `animes`, `animesep` e `animesver`

A API key fica em `config.js` ou `config.json`:

```js
window.GREMORY_CONFIG.darkstarsApiKey = "sua_key";
```

ou:

```json
{
  "apiBase": "",
  "darkstarsApiKey": "sua_key"
}
```

## Observação

O streaming/player de anime foi descartado. O site agora apenas prepara os links de download/abertura usando o retorno das APIs, como no bot.
