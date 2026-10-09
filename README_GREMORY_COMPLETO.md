# Gremory Web • Hub sem Feed

Esta versão mantém o site como um **hub Gremory**, não como uma rede social estilo Instagram.

## O que existe agora

- identidade visual Gremory dark com detalhes vermelhos
- padrão sutil inspirado em escamas no CSS
- navegação lateral no desktop
- navegação inferior no mobile
- login/registro com opção de manter conectado
- perfil com bio, foto, wallpaper, links e tema
- downloads existentes preservados
- loja/Premium existente preservada
- Pokédex existente preservada
- nova área Pokémon para organizar a expansão futura
- cards para Watch Party e RPG sem fingir que os recursos já estão prontos
- campo de API key removido do perfil
- chave RapidAPI hard-coded removida do backend
- arquivo `.env.example`
- headers de segurança básicos da Vercel
- exemplo de regras Firebase que bloqueia escrita do usuário em saldo/Premium/pontuação do servidor

## Importante sobre as regras Firebase

`firebase.rules.example.json` é um exemplo seguro para a nova arquitetura. Confira sua estrutura atual antes de publicar essas regras no Firebase, porque elas restringem a leitura da coleção de usuários ao próprio dono da conta.

## Variáveis da Vercel

Configure no painel da Vercel, não no GitHub:

```env
RAPIDAPI_KEY=...
DARKSTARS_API_KEY=...
```

## Próximas integrações recomendadas

1. API Gremory compartilhada com a Charlotte
2. vínculo seguro entre Firebase UID e WhatsApp
3. Pokémon real compartilhado entre bot e site
4. batalhas Pokémon web com cálculo no servidor
5. salas/watch party
6. RPG Gremory
7. Mercado Pago web com webhook verificado

