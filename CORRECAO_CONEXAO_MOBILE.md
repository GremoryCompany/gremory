# Conexão com o Firebase e códigos de vínculo

O cabeçalho Content-Security-Policy da Vercel permitia Firebase por WebSocket, mas bloqueava os scripts e o iframe do transporte alternativo HTTP long polling. Um navegador novo ou uma rede sem WebSocket podia autenticar normalmente (Authentication usa outra conexão) e depois ficar sem resposta do Realtime Database. Isso afeta perfis, salas e códigos, e não é exclusivo de celulares.

`vercel.json` agora permite scripts e frames dos hosts firebaseio.com, inclusive hosts internos escolhidos pelo Firebase. As outras restrições de segurança continuam, sem liberar scripts inline ou eval. O SDK mantém a escolha automática de transporte; nenhuma permissão de banco foi aberta e não é necessário publicar regras novas para esta correção de conexão.

O botão da Charlotte informa o andamento, bloqueia toques duplicados, encerra a espera visível e reutiliza o mesmo pedido ao tentar novamente após timeout. Códigos só aparecem após confirmação do banco. Resultados de uma conta anterior não aparecem ao trocar de usuário. O vínculo mostra que está sendo consultado enquanto a leitura não chega, em vez de afirmar que a conta não está vinculada. As listas Watch Party oferecem Tentar novamente. O aplicativo e o service worker receberam nova revisão para atualizar cópias instaladas.

Validação: 87 testes do site. A regressão em Chromium usa o SDK real Firebase 12.10.0 com servidor RTDB simulado: o cabeçalho anterior bloqueia as requisições; o novo completa a leitura de salas e as duas gravações de códigos, em contextos de celular e computador. Não foi possível verificar o deploy público ou o telefone físico a partir deste ambiente.

Depois do deploy da Vercel, atualize a página ou feche e abra o aplicativo instalado. Não apague a conta nem gere outras credenciais para corrigir este bloqueio.
