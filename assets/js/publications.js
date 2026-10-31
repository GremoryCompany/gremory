import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js';
import {ref,onValue,set,update,query,limitToLast} from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-database.js';
import {deadline} from './upload-flow.js';
const ADMIN='losermodder@gmail.com';
export function initPublications({app,db,getUser,isAdmin,toast}){
 const $=id=>document.getElementById(id);let targets={},receipts={},unsubs=[],epoch=0,administrator=false;
 const statuses={pending:'Aguardando o bot',preparing:'Preparando',sending:'Enviando',sent:'Enviado',failed:'Falha antes do envio',review:'Confira o destino antes de repetir'};
 function render(){
  const box=$('feedPublicationTargets');if(!box)return;const checked=new Set(selected());box.replaceChildren();$('feedPublicationOptions').hidden=!administrator;
  for(const [id,target]of Object.entries(targets).filter(([,v])=>v.enabled)){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.value=id;input.name='publicationTarget';input.checked=checked.has(id);label.append(input,document.createTextNode(' '+target.label+' · '+(target.platform==='discord'?'Discord':'WhatsApp')));box.append(label);}
  if(!box.children.length)box.textContent='Cadastre os destinos em Administração → Publicações.';
  const list=$('publicationDestinationList');list?.replaceChildren();
  for(const [id,target]of Object.entries(targets)){const row=document.createElement('div');row.className='admin-row-actions';const text=document.createElement('span');text.textContent=target.label+' · '+target.platform+' · '+(target.enabled?'ativo':'pausado');const button=document.createElement('button');button.type='button';button.className='btn';button.textContent=target.enabled?'Pausar':'Ativar';button.onclick=()=>update(ref(db,`publicationDestinations/${id}`),{enabled:!target.enabled}).catch(error=>toast(error.message));row.append(text,button);list?.append(row);}
  const history=$('publicationDeliveryList');history?.replaceChildren();
  for(const [platform,items]of Object.entries(receipts))for(const [jobId,job] of Object.entries(items||{}).sort((a,b)=>b[1].createdAt-a[1].createdAt).slice(0,30)){const line=document.createElement('p');line.textContent=new Date(job.createdAt).toLocaleString('pt-BR')+' · '+(targets[job.destinationId]?.label||job.destinationId)+' · '+(statuses[job.status]||job.status)+(job.error?' — '+job.error:'');if(job.status==='failed'){const retry=document.createElement('button');retry.type='button';retry.className='btn';retry.textContent='Tentar envio novamente';retry.onclick=async()=>{retry.disabled=true;try{await update(ref(db,`publicationOutbox/${platform}/${jobId}`),{status:'pending',owner:null,error:null,startedAt:null,finishedAt:null,destinationAddress:targets[job.destinationId]?.address||'',destinationGuildId:targets[job.destinationId]?.guildId||''});}catch{toast('Não foi possível reenviar. Confira se o destino está ativo.');}finally{retry.disabled=false;}};line.append(' ',retry);}history?.append(line);}
 }
 function selected(){return [...document.querySelectorAll('#feedPublicationTargets input:checked')].map(input=>input.value);}
 async function enqueue(postId,ids=selected()){
  if(!ids.length)return 0;if(!isAdmin())throw Error('Publicação externa restrita ao administrador.');
  const uid=getUser()?.uid;if(!uid)throw Error('Entre na sua conta.');const patch={};
  for(const id of [...new Set(ids)]){const target=targets[id];if(!target?.enabled)throw Error('Um dos destinos está pausado.');patch[`publicationOutbox/${target.platform}/${postId}_${id}`]={postId,destinationId:id,requestedBy:uid,createdAt:Date.now(),status:'pending',destinationAddress:target.address,destinationGuildId:target.guildId||''};}
  // A permanent deterministic ID prevents a second click from sending the same post twice.
  await deadline(update(ref(db),patch),15000,'PUBLICATION_TIMEOUT');return ids.length;
 }
 async function choose(postId){
  if(!isAdmin())return;const available=Object.entries(targets).filter(([,target])=>target.enabled);if(!available.length)return toast('Cadastre os destinos em Administração → Publicações.');
  const dialog=$('publicationChooseDialog'),list=$('publicationChooseList'),status=$('publicationChooseStatus');list.replaceChildren();status.textContent='Selecione os destinos para esta publicação.';
  for(const [id,target]of available){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.value=id;label.append(input,document.createTextNode(' '+target.label+' · '+target.platform));list.append(label);}
  dialog.showModal();$('publicationChooseCancel').onclick=()=>dialog.close();$('publicationChooseSend').onclick=async()=>{const ids=[...list.querySelectorAll('input:checked')].map(input=>input.value);if(!ids.length){status.textContent='Escolha pelo menos um destino.';return;}const button=$('publicationChooseSend');button.disabled=true;try{await enqueue(postId,ids);dialog.close();toast('Envio agendado. Acompanhe por destino na Administração.');}catch(error){status.textContent=error.code==='PUBLICATION_TIMEOUT'?'O banco ainda não confirmou. Confira o histórico antes de repetir.':'Não foi possível agendar. Confira se esta publicação já foi enviada a esse destino.';}finally{button.disabled=false;}};
 }
 $('publicationPlatform').addEventListener('change',()=>{$('publicationGuildField').hidden=$('publicationPlatform').value!=='discord';$('publicationGuild').required=$('publicationPlatform').value==='discord';});$('publicationGuild').required=true;
 $('publicationDestinationForm')?.addEventListener('submit',async event=>{
  event.preventDefault();if(!isAdmin())return;const platform=$('publicationPlatform').value,label=$('publicationLabel').value.trim(),address=$('publicationAddress').value.trim(),guildId=$('publicationGuild').value.trim(),id=$('publicationDestinationId').value.trim();
  if(!/^[a-z0-9_-]{3,40}$/.test(id))return toast('Use um ID com 3 a 40 letras minúsculas, números, hífen ou sublinhado.');
  if(platform==='discord'&&(!/^\d{17,22}$/.test(address)||!/^\d{17,22}$/.test(guildId)))return toast('Informe os IDs do canal e do servidor Discord.');
  if(platform==='whatsapp'&&!/^(?:[0-9-]{5,40}@g\.us|[0-9]{5,40}@newsletter)$/.test(address))return toast('Informe o identificador do grupo (@g.us) ou canal (@newsletter).');
  try{await deadline(set(ref(db,`publicationDestinations/${id}`),{label,platform,address,guildId:platform==='discord'?guildId:'',enabled:true}),15000,'PUBLICATION_TIMEOUT');toast('Destino salvo. Ele poderá ser selecionado nas publicações.');}catch{toast('Não foi possível salvar o destino. Confira as regras e a conexão.');}
 });
 onAuthStateChanged(getAuth(app),user=>{epoch++;unsubs.splice(0).forEach(fn=>fn());targets={};receipts={};administrator=!!user&&user.email===ADMIN&&user.emailVerified;$('feedPublicationOptions').hidden=true;$('publicationChooseDialog')?.close();if(!user||user.email!==ADMIN||!user.emailVerified)return;const version=epoch;unsubs.push(onValue(ref(db,'publicationDestinations'),snapshot=>{if(version!==epoch)return;targets=snapshot.val()||{};render()},()=>{if(version===epoch)$('feedPublicationTargets').textContent='Publique as regras atualizadas para configurar os destinos.'}));for(const platform of ['discord','whatsapp'])unsubs.push(onValue(query(ref(db,`publicationOutbox/${platform}`),limitToLast(40)),snapshot=>{if(version!==epoch)return;receipts[platform]=snapshot.val()||{};render()},()=>{}));});
 return{selected,enqueue,choose};
}
