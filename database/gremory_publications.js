'use strict';
const crypto=require('node:crypto');
const ADMIN_EMAIL='losermodder@gmail.com';
const PREFIX='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7#gremory-image=';
function destination(value){
 if(!value||typeof value.label!=='string'||!value.label.trim()||value.label.length>60||value.enabled!==true)throw Error('Destino desativado ou inválido.');
 if(value.platform==='discord'&&/^\d{17,22}$/.test(value.address)&&/^\d{17,22}$/.test(value.guildId))return value;
 if(value.platform==='whatsapp'&&/^(?:[0-9-]{5,40}@g\.us|[0-9]{5,40}@newsletter)$/.test(value.address))return value;
 throw Error('Endereço de destino inválido.');
}
async function imageBuffer(db,post,postId){
 const url=String(post.mediaUrl||'');if(!url)return null;
 if(post.mediaKind==='video')throw Error('Publicação com vídeo: compartilhe uma foto ou um texto.');
 if(url.startsWith(PREFIX)){
  const expected=`community/${post.uid}/${postId}`;if(url!==PREFIX+expected)throw Error('Referência de imagem inválida.');
  const value=(await db.ref('siteMedia/'+expected).once('value')).val();
  if(!value||typeof value.data!=='string'||value.data.length>98304||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(value.data))throw Error('A foto original não está disponível.');
  const buffer=Buffer.from(value.data.split(',')[1],'base64');if(buffer[0]!==255||buffer[1]!==216)throw Error('A foto não é um JPEG válido.');return buffer;
 }
 const parsed=new URL(url);if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.port)throw Error('Link de imagem inválido.');return{url:parsed.href};
}
async function prepare(db,auth,job,platform){
 if(!job||!/^[-A-Za-z0-9_]{1,120}$/.test(job.postId||'')||!/^[-A-Za-z0-9_]{1,80}$/.test(job.destinationId||''))throw Error('Pedido de publicação inválido.');
 const user=await auth.getUser(job.requestedBy);if(user.disabled||!user.emailVerified||user.email!==ADMIN_EMAIL)throw Error('Publicação externa restrita ao administrador.');
 const target=destination((await db.ref(`publicationDestinations/${job.destinationId}`).once('value')).val());if(target.platform!==platform)throw Error('Plataforma do destino não corresponde ao pedido.');
 if(job.destinationAddress!==target.address||job.destinationGuildId!==(target.guildId||''))throw Error('O destino mudou desde o agendamento. Confirme o destino antes de tentar novamente.');
 const post=(await db.ref(`communityPosts/${job.postId}`).once('value')).val();if(!post||typeof post.text!=='string'||post.text.length>1800)throw Error('Publicação não encontrada ou texto inválido.');
 const image=await imageBuffer(db,post,job.postId);if(!post.text&&!image)throw Error('Publicação vazia.');return{target,text:post.text,image,postId:job.postId};
}
async function deliver({db,auth,platform,jobId,send}){
 const ref=db.ref(`publicationOutbox/${platform}/${jobId}`),owner=crypto.randomUUID();
 const claim=await ref.transaction(value=>value?.status==='pending'?{...value,status:'preparing',owner,startedAt:Date.now()}:undefined,undefined,false);
 if(!claim.committed)return false;
 let sending=false;
 try{
  const payload=await prepare(db,auth,claim.snapshot.val(),platform);
  // Prepare media before this boundary. A failure after it has an unknown delivery outcome.
  const message=await send(payload,async()=>{const begun=await ref.transaction(value=>value?.owner===owner&&value.status==='preparing'?{...value,status:'sending'}:undefined,undefined,false);if(!begun.committed)throw Error('A preparação não está mais ativa.');sending=true;});
  const finished=await ref.transaction(value=>value?.owner===owner&&value.status==='sending'?{...value,status:'sent',messageId:String(message||'').slice(0,200),finishedAt:Date.now()}:undefined,undefined,false);return !!finished.committed;
 }catch(error){
  await ref.transaction(value=>value?.owner===owner&&['preparing','sending'].includes(value.status)?{...value,status:sending?'review':'failed',error:sending?'O destino ainda não confirmou o envio. Confira a mensagem antes de repetir.':String(error.message||'Falha ao preparar publicação.').slice(0,220),finishedAt:Date.now()}:undefined,undefined,false).catch(()=>{});return false;
 }
}
function startWorker({db,auth,platform,send,logger=console}){
 let queue=Promise.resolve(),stopped=false;
 const pending=new Set(),root=db.ref(`publicationOutbox/${platform}`).orderByChild('status').equalTo('pending');
 const handle=snapshot=>{if(snapshot.val()?.status!=='pending'||pending.has(snapshot.key))return;pending.add(snapshot.key);queue=queue.catch(()=>{}).then(()=>stopped?false:deliver({db,auth,platform,jobId:snapshot.key,send})).catch(error=>logger.log('[PUBLICAÇÕES] Falha na fila:',error.code||'database-error')).finally(()=>pending.delete(snapshot.key));};
 root.on('child_added',handle,error=>logger.log('[PUBLICAÇÕES] Fila indisponível:',error.code||'database-error'));
 const recover=async()=>{const snapshot=await db.ref(`publicationOutbox/${platform}`).orderByChild('status').equalTo('preparing').once('value');for(const [id,value]of Object.entries(snapshot.val()||{})){if(Date.now()-Number(value.startedAt||0)<120000)continue;await db.ref(`publicationOutbox/${platform}/${id}`).transaction(current=>current?.status==='preparing'&&Date.now()-Number(current.startedAt||0)>=120000?{...current,status:'failed',error:'Preparação interrompida antes do envio. Você pode tentar novamente.',finishedAt:Date.now()}:undefined,undefined,false);}};
 const timer=setInterval(()=>recover().catch(()=>{}),60000);timer.unref?.();recover().catch(()=>{});
 return()=>{stopped=true;clearInterval(timer);root.off('child_added',handle);};
}
// HTTPS downloads are restricted to approved public hosts and bounded in memory.
async function externalImage(image,fetcher=fetch){
 if(!image||Buffer.isBuffer(image))return image;
 const url=new URL(image.url),hosts=['files.catbox.moe','i.imgur.com','images.unsplash.com','firebasestorage.googleapis.com',...(process.env.PUBLICATION_IMAGE_HOSTS||'').split(',').map(v=>v.trim()).filter(Boolean)];
 if(url.protocol!=='https:'||url.username||url.password||url.port||!hosts.includes(url.hostname))throw Error('Para esse link de imagem, envie a foto pelo dispositivo ou configure um host de imagens autorizado.');
 const response=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(15000)});if(!response.ok||!/^image\/(jpeg|png|webp)/i.test(response.headers.get('content-type')||''))throw Error('Não foi possível carregar a foto.');
 const chunks=[];let total=0;for await(const chunk of response.body){total+=chunk.length;if(total>5*1024*1024)throw Error('Foto maior que 5 MB.');chunks.push(Buffer.from(chunk));}return Buffer.concat(chunks);
}
module.exports={destination,imageBuffer,prepare,deliver,startWorker,externalImage};
