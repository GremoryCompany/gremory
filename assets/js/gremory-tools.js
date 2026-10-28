// Gremory Studio: processamento 100% local. Nenhuma imagem é enviada ao servidor.
'use strict';
const $ = (id) => document.getElementById(id);
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_PIXELS = 20_000_000;
const IMG_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const status = (id, msg, error=false) => { const el=$(id); if(el){el.textContent=msg;el.classList.toggle('gtools-error',error);} };
function safeName(name){return String(name||'imagem').replace(/\.[^.]*$/,'').replace(/[^a-z\d_-]+/gi,'-').slice(0,50)||'imagem';}
function saveBlob(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10_000);}
function canvasBlob(canvas,type,quality){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('O navegador não conseguiu exportar a imagem.')),type,quality));}
function makeCanvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function readImage(file){
 return new Promise((resolve,reject)=>{
   if(!file||!IMG_TYPES.has(file.type)||file.size>MAX_BYTES){reject(new Error('Use JPG, PNG ou WebP de até 8 MB.'));return;}
   const url=URL.createObjectURL(file),image=new Image();
   const cleanup=()=>URL.revokeObjectURL(url);
   image.onload=()=>{cleanup();if(!image.naturalWidth||!image.naturalHeight||image.naturalWidth*image.naturalHeight>MAX_PIXELS){reject(new Error('Imagem muito grande (máximo de 20 megapixels).'));return;}resolve(image);};
   image.onerror=()=>{cleanup();reject(new Error('Não foi possível ler esta imagem.'));};image.src=url;
 });
}
const inProgress=new Set();
async function guarded(key,button,fn,output){
 if(inProgress.has(key))return;inProgress.add(key);button.disabled=true;status(output,'Processando no seu dispositivo…');
 try {await fn();if($(output)?.textContent==='Processando no seu dispositivo…')status(output,'Pronto! Arquivo salvo no dispositivo.');} catch(err) {status(output,err?.message||'Falha ao criar arquivo.',true);}finally{inProgress.delete(key);button.disabled=false;}
}
function fitImage(ctx,img,x,y,w,h,mode='contain'){
 const scale=(mode==='cover'?Math.max:Math.min)(w/img.naturalWidth,h/img.naturalHeight);
 const iw=img.naturalWidth*scale,ih=img.naturalHeight*scale;
 ctx.drawImage(img,x+(w-iw)/2,y+(h-ih)/2,iw,ih);
}
function centerText(ctx,text,x,y,maxWidth){
 const parts=String(text||'').trim().slice(0,90).split(/\s+/).filter(Boolean);let row='',lines=[];
 for(const part of parts){const test=row?row+' '+part:part;if(row&&ctx.measureText(test).width>maxWidth){lines.push(row);row=part;}else row=test;}
 if(row)lines.push(row);
 if(lines.length>3)lines=lines.slice(0,3);
 lines.forEach((ln,i)=>ctx.fillText(ln,x,y+(i-(lines.length-1)/2)*42,maxWidth));
}
function init(){
 const compress=$('gtoolsCompressBtn');
 compress?.addEventListener('click',()=>guarded('compress',compress,async()=>{
   const file=$('gtoolsCompressImage')?.files?.[0];const img=await readImage(file);
   const max=Math.min(2400,Math.max(320,Number($('gtoolsCompressMax')?.value)||1600));
   const ratio=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));
   const w=Math.max(1,Math.round(img.naturalWidth*ratio)),h=Math.max(1,Math.round(img.naturalHeight*ratio));
   const c=makeCanvas(w,h),ctx=c.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);
   const q=Math.max(.45,Math.min(.95,Number($('gtoolsCompressQuality')?.value||78)/100));
   const blob=await canvasBlob(c,'image/jpeg',q);
   saveBlob(blob,safeName(file.name)+'-comprimida.jpg');
   status('gtoolsCompressStatus',`Pronto! ${(file.size/1024).toFixed(0)} KB → ${(blob.size/1024).toFixed(0)} KB`);
 },'gtoolsCompressStatus'));
 const sticker=$('gtoolsStickerBtn');
 sticker?.addEventListener('click',()=>guarded('sticker',sticker,async()=>{
   const file=$('gtoolsStickerImage')?.files?.[0],img=await readImage(file),canvas=makeCanvas(512,512),ctx=canvas.getContext('2d');
   ctx.clearRect(0,0,512,512);
   const zoom=Math.max(1,Math.min(2,Number($('gtoolsStickerZoom')?.value||100)/100));
   const size=440*zoom;fitImage(ctx,img,(512-size)/2,(512-size)/2,size,size,'contain');
   const label=String($('gtoolsStickerLabel')?.value||'').trim();
   if(label){ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';ctx.font='bold 33px system-ui,sans-serif';ctx.lineWidth=8;ctx.strokeStyle='#17111f';centerText(ctx,label,256,460,470);ctx.fillStyle='#fff';centerText(ctx,label,256,460,470);}
   const blob=await canvasBlob(canvas,'image/webp',.82);saveBlob(blob,'gremory-figurinha.webp');
 },'gtoolsStickerStatus'));
 const thumb=$('gtoolsThumbBtn');
 thumb?.addEventListener('click',()=>guarded('thumb',thumb,async()=>{
   const file=$('gtoolsThumbImage')?.files?.[0];const c=makeCanvas(1280,720),ctx=c.getContext('2d');
   const grad=ctx.createLinearGradient(0,0,1280,720);grad.addColorStop(0,'#4d2469');grad.addColorStop(1,'#100f1f');ctx.fillStyle=grad;ctx.fillRect(0,0,1280,720);
   if(file){const img=await readImage(file);ctx.globalAlpha=.58;fitImage(ctx,img,0,0,1280,720,'cover');ctx.globalAlpha=1;}
   const shade=ctx.createLinearGradient(0,400,0,720);shade.addColorStop(0,'#0000');shade.addColorStop(1,'#000c');ctx.fillStyle=shade;ctx.fillRect(0,0,1280,720);
   const title=String($('gtoolsThumbTitle')?.value||'Gremory').trim().slice(0,90);
   ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';ctx.font='900 80px system-ui,sans-serif';ctx.lineWidth=12;ctx.strokeStyle='#140e22';centerText(ctx,title,640,570,1130);ctx.fillStyle='#fff';centerText(ctx,title,640,570,1130);
   saveBlob(await canvasBlob(c,'image/png'),'gremory-thumbnail.png');
 },'gtoolsThumbStatus'));
 for(const node of document.querySelectorAll('.gtools-upload')){
   node.addEventListener('dragover',e=>{e.preventDefault();node.classList.add('gtools-over');});
   node.addEventListener('dragleave',()=>node.classList.remove('gtools-over'));
   node.addEventListener('drop',e=>{e.preventDefault();node.classList.remove('gtools-over');const input=node.querySelector('input[type=file]');if(!input||!e.dataTransfer?.files?.length)return;try{input.files=e.dataTransfer.files;}catch{};});
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
