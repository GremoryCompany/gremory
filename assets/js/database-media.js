import { deadline } from './upload-flow.js';
// Keep image bytes outside feeds and profiles. Those contain only a small pointer.
export const IMAGE_PREFIX='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7#gremory-image=';
export const IMAGE_LIMIT=96*1024;
export const AVATAR_LIMIT=24*1024;
const PATH=/^(avatars|community|stories)\/[A-Za-z0-9_-]{1,128}\/[A-Za-z0-9_-]{1,120}$/;
export function mediaPath(value){const s=String(value||'');if(!s.startsWith(IMAGE_PREFIX))return '';const path=s.slice(IMAGE_PREFIX.length);return PATH.test(path)?path:'';}
export function imageReference(path){if(!PATH.test(path))throw new Error('Caminho de imagem inválido.');return IMAGE_PREFIX+path;}
export function validImageData(data,max=IMAGE_LIMIT){return typeof data==='string'&&data.length<=max&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(data);}
export function mediaError(error){
 const code=String(error?.code||'').toLowerCase();
 if(/permission[-_ ]denied/.test(code))return 'O banco negou o envio da foto. Publique as regras atualizadas do Realtime Database para imagens.';
 if(code==='media/write-timeout')return 'O banco ainda não confirmou a foto. Verifique sua conexão e tente novamente.';
 if(code==='media/read-timeout')return 'A foto demorou para carregar. Verifique a conexão.';
 if(code==='storage/canceled')return 'Envio cancelado porque a sessão mudou.';
 if(code==='upload/publish-timeout')return 'A foto foi enviada, mas a publicação ainda não foi confirmada. Confira o feed antes de repetir.';
 return error?.message||'Não foi possível salvar a foto no banco.';
}
export async function compressImage(file,{avatar=false,document:doc=globalThis.document}={}){
 if(!/^image\/(jpeg|png|webp|gif)$/.test(file?.type||''))throw new Error('Escolha uma foto JPG, PNG, WebP ou GIF. Para vídeo, use um link HTTPS.');
 if(file.size>10*1024*1024)throw new Error('A foto original precisa ter até 10 MB.');
 const source=URL.createObjectURL(file),image=new Image();
 try{
  image.src=source;await deadline(image.decode(),15000,'media/read-timeout');
  if(!image.naturalWidth||!image.naturalHeight||image.naturalWidth*image.naturalHeight>40000000)throw new Error('Essa imagem tem dimensões muito grandes. Escolha uma versão menor.');
  const canvas=doc.createElement('canvas'),ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw new Error('Este navegador não conseguiu preparar a foto.');
  let edge=avatar?384:960;const cap=avatar?AVATAR_LIMIT:IMAGE_LIMIT;
  for(let pass=0;pass<5;pass++){
   const scale=Math.min(1,edge/Math.max(image.naturalWidth,image.naturalHeight));canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
   ctx.fillStyle='#11141b';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
   for(const quality of [.82,.68,.54,.4,.28]){const data=canvas.toDataURL('image/jpeg',quality);if(validImageData(data,cap))return data;}
   edge=Math.floor(edge*.75);
  }
  throw new Error('A foto não coube no limite gratuito. Escolha uma imagem mais simples ou menor.');
 }finally{URL.revokeObjectURL(source);}
}
export async function saveDatabaseImage(file,{kind,uid,id,expiresAt,write,onStage=()=>{},signal,encode=compressImage}){
 const path=`${kind}/${uid}/${id}`;imageReference(path);
 const check=()=>{if(signal?.aborted)throw Object.assign(new Error('Sessão alterada'),{code:'storage/canceled'});};
 check();onStage('Comprimindo foto…');const data=await encode(file,{avatar:kind==='avatars'});check();
 if(!validImageData(data,kind==='avatars'?AVATAR_LIMIT:IMAGE_LIMIT))throw new Error('Foto fora do limite permitido.');
 const record={uid,data,createdAt:Date.now()};if(kind==='stories')record.expiresAt=expiresAt;
 onStage('Salvando foto no banco…');await deadline(write(`siteMedia/${path}`,record),15000,'media/write-timeout');check();
 return{path,reference:imageReference(path)};
}
export function installImageResolver({root=document.documentElement,read,isSignedIn=()=>true,fallback='/assets/img/profile.jpg'}){
 const cache=new Map(),tracked=new Set();let epoch=0;
 function load(path){if(cache.has(path))return cache.get(path);const result=deadline(read(`siteMedia/${path}`),12000,'media/read-timeout').then(record=>{if(!validImageData(record?.data,path.startsWith('avatars/')?AVATAR_LIMIT:IMAGE_LIMIT))throw new Error('Foto indisponível.');return record.data;}).catch(error=>{cache.delete(path);throw error});cache.set(path,result);if(cache.size>64)cache.delete(cache.keys().next().value);return result;}
 function resolve(image){
  const reference=image.getAttribute('src'),path=mediaPath(reference);if(!path){if(!String(reference||'').startsWith('data:image/jpeg;base64,')){tracked.delete(image);delete image.dataset.gremoryImageRef;}return;}
  image.dataset.gremoryImageRef=reference;tracked.add(image);if(!isSignedIn())return;
  const version=epoch;image.dataset.mediaState='loading';
  load(path).then(data=>{if(version!==epoch||!image.isConnected||image.getAttribute('src')!==reference||!isSignedIn())return;image.src=data;image.dataset.mediaState='ready';}).catch(()=>{if(version!==epoch||image.getAttribute('src')!==reference)return;image.src=fallback;image.dataset.mediaState='error';image.title='Foto indisponível. Tente atualizar após conferir a conexão.';});
 }
 const intersection=globalThis.IntersectionObserver?new IntersectionObserver(entries=>{for(const item of entries)if(item.isIntersecting){intersection.unobserve(item.target);resolve(item.target)}} ,{rootMargin:'240px'}):null;
 const watch=image=>{if(!mediaPath(image.getAttribute('src'))){resolve(image);return;}if(intersection)intersection.observe(image);else resolve(image);};
 const scan=node=>{for(const image of tracked)if(!image.isConnected)tracked.delete(image);if(node.nodeType!==1)return;if(node.tagName==='IMG')watch(node);node.querySelectorAll?.('img').forEach(watch);};
 const observer=new MutationObserver(records=>{for(const record of records){if(record.type==='attributes')watch(record.target);else record.addedNodes.forEach(scan);}});
 observer.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['src']});scan(root);
 return{refresh(){scan(root)},reset(){epoch++;cache.clear();for(const image of tracked){if(image.isConnected&&image.dataset.gremoryImageRef)image.src=image.dataset.gremoryImageRef;}tracked.clear();scan(root);},destroy(){observer.disconnect();intersection?.disconnect();cache.clear();tracked.clear();}};
}
