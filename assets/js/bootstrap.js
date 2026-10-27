import('./app.js?v=20261027-raids-salas-slots').catch(error=>{
 console.error('[GREMORY BOOT]',error);
 const status=document.getElementById('authStatus');
 if(status)status.textContent='O painel não carregou. Recarregue a página e verifique sua conexão.';
});
