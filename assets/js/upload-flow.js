export function deadline(operation, ms, code) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Object.assign(new Error(code), {code})), ms);
    Promise.resolve(operation).then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

export function waitForUpload(task, {onProgress = () => {}, stallMs = 45000, totalMs = 900000} = {}) {
  return new Promise((resolve, reject) => {
    let settled = false, unsubscribe, stallTimer, lastBytes = -1;
    const cleanup = () => { clearTimeout(stallTimer); clearTimeout(totalTimer); unsubscribe?.(); };
    const finish = (error, snapshot) => {
      if (settled) return;
      settled = true; cleanup();
      if (error) reject(error); else resolve(snapshot);
    };
    const timeout = code => {
      finish(Object.assign(new Error(code), {code}));
      try { task.cancel(); } catch {}
    };
    const arm = () => { clearTimeout(stallTimer); stallTimer = setTimeout(() => timeout('upload/stalled'), stallMs); };
    const totalTimer = setTimeout(() => timeout('upload/timeout'), totalMs);
    arm();
    try {
      unsubscribe = task.on('state_changed', snapshot => {
        if (settled) return;
        if (snapshot.bytesTransferred !== lastBytes) { lastBytes = snapshot.bytesTransferred; arm(); }
        onProgress(snapshot);
      }, error => finish(error), () => finish(null, task.snapshot));
      if (settled) unsubscribe?.();
    } catch (error) { finish(error); }
  });
}

export function uploadMessage(error) {
  switch (error?.code) {
    case 'storage/unauthorized': return 'O Firebase Storage negou o envio. Confira as regras do Storage e o App Check desse projeto.';
    case 'storage/unauthenticated': return 'Sua sessão não foi aceita pelo Storage. Entre novamente antes de enviar.';
    case 'storage/bucket-not-found':
    case 'storage/project-not-found': return 'O bucket de arquivos não foi encontrado. Ative o Storage e confira o storageBucket do projeto.';
    case 'storage/quota-exceeded': return 'A cota do Firebase Storage foi excedida. Confira o uso e o faturamento no Firebase Console.';
    case 'storage/canceled': return 'Envio cancelado. Nenhuma nova publicação foi confirmada.';
    case 'upload/stalled': return 'O envio ficou 45 segundos sem avançar. Verifique a conexão, o bucket, as regras do Storage e o App Check. A tentativa foi cancelada.';
    case 'upload/timeout':
    case 'storage/retry-limit-exceeded': return 'O Storage não concluiu o envio no prazo. Verifique a conexão e a configuração do serviço.';
    case 'upload/url-timeout': return 'O arquivo foi enviado, mas o Storage não confirmou o endereço. Tente novamente após conferir a conexão.';
    case 'upload/publish-timeout': return 'O arquivo foi enviado, mas a publicação ainda não foi confirmada. Confira o feed antes de publicar novamente.';
    default: return 'Não foi possível publicar. Confira a conexão e a configuração do Firebase Storage.';
  }
}
