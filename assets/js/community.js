import { profileDetails } from './profile-details.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js';
import {ref,get,set,push,remove,onValue,query,orderByChild,limitToLast,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-database.js';
import {getStorage,ref as storageRef,uploadBytesResumable,getDownloadURL,deleteObject} from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-storage.js';

export function initCommunity({app,db,getUser,isAdmin,toast,getSelectedUid,bridgeRequest}){
 const $=id=>document.getElementById(id),storage=getStorage(app);
 let posts={},stories={},following={},saved={},directory={},communityTab='home',searchTerm='',onlyFollowing=false,limit=20,subscriptions=[],postSub=null,rowSubs=[],busy=false,upload=null,epoch=0;
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n};
 const button=(text,action)=>{const b=node('button',text,'btn');b.type='button';b.onclick=()=>Promise.resolve().then(action).catch(e=>toast(e.message));return b};
 const name=uid=>uid==='charlotte'?'Charlotte':directory[uid]?.nome||directory[uid]?.name||'Participante';
 const safeUrl=value=>{try{const u=new URL(value);return u.protocol==='https:'?u.href:''}catch{return ''}};
 const cleanupRows=()=>{rowSubs.splice(0).forEach(fn=>fn())};
 // Stories persistidos no Firebase, separados da Charlotte. Exibição expira em 24h.
 function renderStories(){
  const strip=$('feedStories');if(!strip)return;strip.replaceChildren();const now=Date.now();
  const active=Object.entries(stories).flatMap(([owner,items])=>Object.entries(items||{}).filter(([,st])=>Number(st.expiresAt)>now&&Number(st.createdAt)<=now+60000).map(([id,st])=>({owner,id,...st}))).sort((a,b)=>b.createdAt-a.createdAt);
  const owners=new Set();for(const story of active){if(owners.has(story.owner))continue;owners.add(story.owner);
   const item=node('button',null,'feed-story-person');item.type='button';const img=node('img');img.alt='';img.loading='lazy';img.src=safeUrl(directory[story.owner]?.avatar)||'/assets/img/profile.jpg';item.append(img,node('span',name(story.owner)));
   item.onclick=()=>{const view=$('feedStoryViewer'),body=$('feedStoryViewerContent');body.replaceChildren(node('p',name(story.owner),'story-author'));const photo=node('img');photo.src=safeUrl(story.mediaUrl)||'/assets/img/profile.jpg';photo.alt=`Story de ${name(story.owner)}`;body.append(photo);if(story.owner===getUser()?.uid||isAdmin())body.append(button('Excluir story',async()=>{await remove(ref(db,`communityStories/${story.owner}/${story.id}`));view.hidden=true;if(story.storagePath?.startsWith(`stories/${story.owner}/`))await deleteObject(storageRef(storage,story.storagePath)).catch(()=>{})}));view.hidden=false};strip.appendChild(item);
  }
  if(!owners.size)strip.append(node('small','Ninguém publicou stories nas últimas 24 horas.','muted'));
 }
 $('feedStoryClose')?.addEventListener('click',()=>{$('feedStoryViewer').hidden=true});
 $('feedStoryViewer')?.addEventListener('click',event=>{if(event.target.id==='feedStoryViewer')event.target.hidden=true});
 $('feedStoryFile')?.addEventListener('change',async event=>{
  const user=getUser(),file=event.target.files?.[0],status=$('feedStoryStatus');if(!user||!file)return;
  if(!/^image\/(jpeg|png|webp|gif)$/.test(file.type)||file.size>5*1024*1024){status.textContent='Story aceita JPG, PNG, GIF ou WebP até 5 MB.';event.target.value='';return}
  const id=push(ref(db,`communityStories/${user.uid}`)).key,storagePath=`stories/${user.uid}/${id}`,key=storageRef(storage,storagePath);
  try{
    status.textContent='Enviando story…';await new Promise((resolve,reject)=>uploadBytesResumable(key,file,{contentType:file.type}).on('state_changed',null,reject,resolve));
    const mediaUrl=await getDownloadURL(key);await set(ref(db,`communityStories/${user.uid}/${id}`),{uid:user.uid,mediaUrl,storagePath,createdAt:Date.now(),expiresAt:Date.now()+86400000});status.textContent='Story publicado! Visível por 24 horas.';
  }catch(e){await deleteObject(key).catch(()=>{});status.textContent='Erro ao publicar story.';toast(e.message)}finally{event.target.value=''}
 });
 function subscribePosts(){postSub?.();postSub=onValue(query(ref(db,'communityPosts'),orderByChild('createdAt'),limitToLast(limit)),sn=>{posts=sn.val()||{};render()},e=>{$('feedList').textContent='Não foi possível carregar o feed. Verifique as regras do Firebase.';toast(e.message)})}
 function setCommunityTab(tab){
  communityTab=tab;document.querySelector('.community-view')?.setAttribute('data-community-view',tab);document.querySelectorAll('[data-community-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.communityTab===tab);b.setAttribute('aria-pressed',String(b.dataset.communityTab===tab))});
  const explore=$('feedDiscover'),compose=$('feedComposer');if(explore)explore.hidden=tab!=='explore';if(compose)compose.hidden=tab!=='create';
  if(tab!=='explore'){searchTerm='';if($('feedDiscoverQuery'))$('feedDiscoverQuery').value='';}
  if(tab==='create'){compose?.scrollIntoView({behavior:'smooth',block:'start'});$('feedText')?.focus()}
  if(tab==='profile')showProfile(getUser()?.uid).catch(e=>toast(e.message));
  if(tab!=='profile')$('feedProfile').hidden=true;
  render();renderDiscover();
 }
 function renderDiscover(){const box=$('feedDiscoverResults');if(!box)return;box.replaceChildren();if(communityTab!=='explore')return;
  const term=searchTerm.replace(/^[@#]/,'').toLocaleLowerCase('pt-BR');if(!term){box.append(node('p','Pesquise pelo nome, arroba ou por um assunto das publicações.','muted'));return}
  for(const [uid,person] of Object.entries(directory).filter(([uid,v])=>[v.nome,v.username,v.name].some(n=>String(n||'').toLowerCase().includes(term))).slice(0,20)){
   const b=button(`${person.nome||person.name||'Participante'} ${person.username?'@'+person.username:''}`,()=>showProfile(uid));b.classList.add('gremorium-person-result');box.append(b);
  }
  if(!box.children.length)box.append(node('p','Nenhum perfil encontrado.','muted'));
 }
 function richCaption(container,text){const re=/(#[\p{L}\p{N}_]{2,50}|@[a-z][a-z0-9_]{2,19})/giu;let last=0;for(const hit of String(text||'').matchAll(re)){const at=hit.index;container.append(document.createTextNode(text.slice(last,at)));const term=hit[0],b=button(term,()=>{if(term.startsWith('#')){$('feedDiscoverQuery').value=term;searchTerm=term.toLowerCase();setCommunityTab('explore');$('feedDiscoverQuery').value=term;searchTerm=term.toLowerCase();render();renderDiscover();}else{const user=Object.entries(directory).find(([,p])=>String(p.username||'').toLowerCase()===term.slice(1).toLowerCase());if(user)showProfile(user[0]);else toast('Perfil não encontrado.')}});b.className='gremorium-caption-link';container.append(b);last=at+term.length;}container.append(document.createTextNode(text.slice(last)));}
 $('feedCreateBtn')?.addEventListener('click',()=>setCommunityTab('create'));
 document.querySelectorAll('[data-community-tab]').forEach(b=>b.addEventListener('click',()=>setCommunityTab(b.dataset.communityTab)));
 $('feedDiscoverQuery')?.addEventListener('input',e=>{searchTerm=String(e.target.value||'').trim().toLowerCase();renderDiscover();render()});
 function render(){
  cleanupRows();const box=$('feedList');box.replaceChildren();
  const rows=Object.entries(posts).filter(([id,p])=>(communityTab!=='profile'||p.uid===getUser()?.uid)&&(communityTab!=='saved'||saved[id])&&(communityTab!=='videos'||p.mediaKind==='video')&&(!onlyFollowing||following[p.uid]||p.uid===getUser()?.uid)&&(communityTab!=='explore'||!searchTerm||String(p.text||'').toLowerCase().includes(searchTerm.replace(/^#/,'').replace(/^@/,''))||String(directory[p.uid]?.username||'').toLowerCase().includes(searchTerm.replace(/^@/,'')))).sort((a,b)=>b[1].createdAt-a[1].createdAt);
  for(const [id,p] of rows){
   const card=node('article',null,'panel feed-post'),head=node('div',null,'feed-post-head');
   const avatar=node('img');avatar.src=safeUrl(directory[p.uid]?.avatar)||'/assets/img/profile.jpg';avatar.alt='';avatar.loading='lazy';avatar.classList.add('feed-post-avatar');avatar.role='button';avatar.tabIndex=0;avatar.onclick=()=>showProfile(p.uid).catch(e=>toast(e.message));avatar.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showProfile(p.uid).catch(err=>toast(err.message))}};
   const author=node('div',null,'feed-author');author.append(button(name(p.uid),()=>showProfile(p.uid)));if(directory[p.uid]?.username)author.append(node('small','@'+directory[p.uid].username));head.append(avatar,author);const time=node('small',new Date(p.createdAt).toLocaleString('pt-BR'));head.append(time);const caption=node('p',null,'feed-post-text');richCaption(caption,p.text||'');card.append(head,caption);
   const url=safeUrl(p.mediaUrl);if(url){const media=node(p.mediaKind==='video'?'video':'img');media.className='feed-media';media.src=url;if(p.mediaKind==='video'){media.controls=true;media.playsInline=true;media.preload='metadata';media.addEventListener('play',()=>{document.querySelectorAll('#feedList video').forEach(other=>{if(other!==media)other.pause()})})}else{media.loading='lazy';media.alt='Imagem da publicação'}media.onerror=()=>{media.replaceWith(node('p','Mídia indisponível. O link pode ter expirado.','muted'))};card.append(media)}
   const actions=node('div',null,'feed-actions');let liked=false;
   const like=button('♡ Curtir',async()=>{like.disabled=true;try{const path=ref(db,`communityLikes/${id}/${getUser().uid}`),wasLiked=liked;await(wasLiked?remove(path):set(path,true));if(!wasLiked)window.dispatchEvent(new CustomEvent('gremory:social',{detail:{action:'like',itemId:`${id}_like_${getUser().uid}`}}))}finally{like.disabled=false}});
   rowSubs.push(onValue(ref(db,`communityLikes/${id}`),sn=>{const likes=sn.val()||{};liked=!!likes[getUser()?.uid];like.textContent=`${liked?'♥':'♡'} ${Object.keys(likes).length}`;like.setAttribute('aria-pressed',String(liked))}));
   const save=button(saved[id]?'★ Salvo':'☆ Salvar',async()=>{const r=ref(db,`communitySaved/${getUser().uid}/${id}`);await(saved[id]?remove(r):set(r,true));toast(saved[id]?'Removido dos salvos.':'Publicação salva no seu perfil.');});
   const share=button('↗ Compartilhar',async()=>{const url=location.origin+'/#feed';const title='Publicação de '+name(p.uid);if(navigator.share)await navigator.share({title,text:String(p.text||'').slice(0,160),url});else{await navigator.clipboard.writeText(url);toast('Link da comunidade copiado.')}});
   const comments=node('div',null,'feed-comments');comments.hidden=true;let commentSub=null;
   actions.append(like,save,share,button('Comentários',()=>{comments.hidden=!comments.hidden;if(comments.hidden){commentSub?.();commentSub=null;return}const list=node('div'),form=node('form',null,'feed-comment-form'),input=node('input');input.required=true;input.maxLength=500;input.placeholder='Escreva um comentário';input.setAttribute('aria-label','Comentário');const send=node('button','Enviar','btn');form.append(input,send);comments.replaceChildren(list,form);commentSub=onValue(query(ref(db,`communityComments/${id}`),orderByChild('createdAt'),limitToLast(30)),sn=>{list.replaceChildren();for(const [cid,c] of Object.entries(sn.val()||{})){const row=node('div',null,'feed-comment');row.append(node('strong',name(c.uid)),node('p',c.text));if(c.uid===getUser()?.uid||isAdmin())row.append(button('Apagar',()=>remove(ref(db,`communityComments/${id}/${cid}`))));list.append(row)}});rowSubs.push(()=>commentSub?.());form.onsubmit=async e=>{e.preventDefault();if(!input.value.trim())return;send.disabled=true;try{const comment=await push(ref(db,`communityComments/${id}`),{uid:getUser().uid,text:input.value.trim(),createdAt:serverTimestamp()});window.dispatchEvent(new CustomEvent('gremory:social',{detail:{action:'comment',itemId:`${id}_comment_${comment.key}`}}));input.value=''}catch(e){toast(e.message)}finally{send.disabled=false}}}));
   if(p.uid===getUser()?.uid||isAdmin())actions.append(button('Excluir',async()=>{if(!confirm('Excluir esta publicação?'))return;await remove(ref(db,`communityPosts/${id}`));if(p.storagePath?.startsWith(`community/${p.uid}/`))await deleteObject(storageRef(storage,p.storagePath)).catch(()=>toast('Publicação removida; o arquivo precisa ser removido no Storage.'))}));
   if(isAdmin())actions.append(button('Avisar grupos',async()=>{if(!confirm('Enviar esta publicação aos grupos configurados no bot?'))return;const r=await bridgeRequest('admin_feed_announce',{postId:id},60000,false);toast(`Aviso enviado a ${r.sent} grupo(s).`)}));
   card.append(actions,comments);box.append(card);
  }
  if(!rows.length)box.append(node('p',communityTab==='saved'?'Você ainda não salvou publicações.':onlyFollowing?'Nenhuma publicação das pessoas seguidas nesta página. Carregue mais ou explore Todos.':'Nenhuma publicação encontrada.','empty-state'));
  $('feedMore').hidden=Object.keys(posts).length<limit;
 }
 async function showProfile(uid){
  const box=$('feedProfile');box.hidden=false;box.textContent='Carregando perfil...';const version=epoch;
  const [badgesSn,equippedSn,followingSn]=await Promise.all([get(ref(db,`profileBadges/${uid}`)),get(ref(db,`profileEquippedBadge/${uid}`)),get(ref(db,`communityFollowing/${uid}`))]);if(version!==epoch)return;
  const badges=badgesSn.val()||{},equipped=equippedSn.val(),mine=uid===getUser()?.uid;
  const header=node('div',null,'feed-profile-header'),photo=node('img');photo.src=safeUrl(directory[uid]?.avatar)||'/assets/img/profile.jpg';photo.alt='';photo.className='feed-post-avatar';
  const identity=node('div');identity.append(node('h3',name(uid)),node('p',directory[uid]?.username?'@'+directory[uid].username:'@participante','muted'));header.append(photo,identity);
  box.replaceChildren(header,node('p',directory[uid]?.bio||'Nenhuma biografia adicionada.'));
  const details=profileDetails(directory[uid]?.details);box.dataset.profileAccent=details.accent;const extra=node('div',null,'social-profile-chips');for(const [key,label]of [['pronouns','Pronomes'],['favoriteGame','Joga'],['interests','Curte'],['lookingFor','Bora?']])if(details[key])extra.append(node('span',label+': '+details[key]));if(details.website){const link=node('a','Meu link ↗','mini-btn');link.href=details.website;link.target='_blank';link.rel='noopener noreferrer';extra.append(link)}box.append(extra);
  box.append(node('p',`Seguindo ${Object.keys(followingSn.val()||{}).length} pessoas`));
  const gallery=node('div',null,'feed-profile-gallery');
  for(const [pid,post] of Object.entries(posts).filter(([,post])=>post.uid===uid&&post.mediaKind==='image'&&safeUrl(post.mediaUrl)).sort((a,b)=>b[1].createdAt-a[1].createdAt).slice(0,18)){
    const im=node('img');im.src=safeUrl(post.mediaUrl);im.alt=post.text||'Foto publicada';im.loading='lazy';im.title='Publicação '+pid;gallery.append(im);
  }
  box.append(node('h4','Galeria de publicações recentes'),gallery);if(!gallery.children.length)box.append(node('small','Nenhuma foto entre as publicações recentes.','muted'));
  if(badges[equipped])box.append(node('p',`${badges[equipped].icon} ${badges[equipped].name}`,'profile-badge'));
  if(!mine&&uid!=='charlotte')box.append(button(following[uid]?'Deixar de seguir':'Seguir',async()=>{const r=ref(db,`communityFollowing/${getUser().uid}/${uid}`);await(following[uid]?remove(r):set(r,true));await showProfile(uid)}));
  if(mine){box.append(node('h4','Seus emblemas'));for(const [id,badge] of Object.entries(badges)){box.append(button(`${badge.icon} ${badge.name}${id===equipped?' • equipado':''}`,async()=>{await set(ref(db,`profileEquippedBadge/${uid}`),id);await showProfile(uid)}))}if(!Object.keys(badges).length)box.append(node('p','Você ainda não recebeu emblemas.'));box.append(button('Remover emblema equipado',async()=>{await remove(ref(db,`profileEquippedBadge/${uid}`));await showProfile(uid)}));
   const ach=(await get(ref(db,`charlotteSync/${uid}/achievements`))).val()||{};if(version!==epoch)return;for(const a of Array.isArray(ach.unlocked)?ach.unlocked:[]){box.append(button(`${a.emoji||'🏆'} Equipar ${a.name||a.id}`,async()=>{await bridgeRequest('equip_achievement',{achievementId:String(a.id)},25000,false);await showProfile(uid)}))}
  }
  box.append(button('Fechar perfil',()=>{box.hidden=true}));box.scrollIntoView({behavior:'smooth',block:'start'});
 }
 $('feedForm').onsubmit=async e=>{
  e.preventDefault();if(busy||!getUser())return;const text=$('feedText').value.trim(),file=$('feedFile').files[0];let mediaUrl=safeUrl($('feedUrl').value.trim()),mediaKind=$('feedKind').value,storagePath='';
  if($('feedUrl').value.trim()&&!mediaUrl)return toast('Use um link HTTPS válido.');if(!text&&!file&&!mediaUrl)return toast('Escreva algo ou selecione uma mídia.');
  const uid=getUser().uid,version=epoch,post=push(ref(db,'communityPosts'));busy=true;const submit=e.target.querySelector('button[type="submit"]');submit.disabled=true;
  try{
   if(file){if(!/^(image\/(jpeg|png|webp|gif)|video\/(mp4|webm))$/.test(file.type))throw new Error('Formato não suportado. Use JPG, PNG, GIF, WebP, MP4 ou WebM.');mediaKind=file.type.startsWith('video/')?'video':'image';if(file.size>(mediaKind==='video'?50:10)*1024*1024)throw new Error('O arquivo excede o limite.');storagePath=`community/${uid}/${post.key}`;upload=uploadBytesResumable(storageRef(storage,storagePath),file,{contentType:file.type});await new Promise((resolve,reject)=>upload.on('state_changed',sn=>{$('feedProgress').textContent=`Enviando: ${Math.round(100*sn.bytesTransferred/sn.totalBytes)}%`},reject,resolve));mediaUrl=await getDownloadURL(upload.snapshot.ref);upload=null}
   if(version!==epoch)throw new Error('Sessão alterada. Entre novamente.');await set(post,{uid,text,mediaUrl,mediaKind,storagePath,createdAt:serverTimestamp()});window.dispatchEvent(new CustomEvent('gremory:social',{detail:{action:'post',itemId:post.key}}));e.target.reset();$('feedProgress').textContent='Publicado!';setCommunityTab('home');toast('Sua publicação já está no Grémorium.');
  }catch(err){if(storagePath)await deleteObject(storageRef(storage,storagePath)).catch(()=>{});$('feedProgress').textContent='Falha ao publicar. Verifique a configuração e as regras do Firebase Storage.';toast(err.message)}finally{busy=false;submit.disabled=false;upload=null}
 };
 $('feedAll').onclick=()=>{onlyFollowing=false;$('feedAll').classList.add('active');$('feedFollowing').classList.remove('active');render()};$('feedFollowing').onclick=()=>{onlyFollowing=true;$('feedFollowing').classList.add('active');$('feedAll').classList.remove('active');render()};$('feedMyProfile').onclick=()=>showProfile(getUser().uid).catch(e=>toast(e.message));$('feedRefresh').onclick=subscribePosts;$('feedMore').onclick=()=>{limit+=20;subscribePosts()};
 $('adminBadgeForm').onsubmit=async e=>{e.preventDefault();if(!isAdmin())return;const uid=getSelectedUid(),id=$('adminBadgeId').value.trim();if(!uid)return toast('Localize o usuário primeiro.');try{await set(ref(db,`profileBadges/${uid}/${id}`),{name:$('adminBadgeName').value.trim(),icon:$('adminBadgeIcon').value.trim()});toast('Emblema concedido.')}catch(e){toast(e.message)}};
 $('adminBadgeRevoke').onclick=async()=>{if(!isAdmin()||!getSelectedUid())return;const id=$('adminBadgeId').value.trim();if(!/^[a-z0-9_-]{3,40}$/.test(id))return toast('Informe um ID válido.');try{await remove(ref(db,`profileBadges/${getSelectedUid()}/${id}`));toast('Emblema revogado.')}catch(e){toast(e.message)}};
 onAuthStateChanged(getAuth(app),user=>{epoch++;upload?.cancel();postSub?.();subscriptions.splice(0).forEach(fn=>fn());cleanupRows();posts={};stories={};directory={};following={};saved={};communityTab='home';searchTerm='';limit=20;if($('feedComposer'))$('feedComposer').hidden=true;document.querySelectorAll('[data-community-tab]').forEach(b=>b.classList.toggle('active',b.dataset.communityTab==='home'));$('feedProfile').hidden=true;$('feedList').replaceChildren();if(!user)return;subscriptions.push(onValue(ref(db,'directory'),sn=>{directory=sn.val()||{};render();renderStories()}));subscriptions.push(onValue(ref(db,'communityStories'),sn=>{stories=sn.val()||{};renderStories()},e=>{console.warn('[STORIES]',e?.message);$('feedStories').textContent='Stories indisponíveis. Verifique as regras Firebase.'}));subscriptions.push(onValue(ref(db,`communityFollowing/${user.uid}`),sn=>{following=sn.val()||{};render()}));subscriptions.push(onValue(ref(db,`communitySaved/${user.uid}`),sn=>{saved=sn.val()||{};render()},e=>console.warn('[GRÉMORIUM SALVOS]',e.message)));subscribePosts()});
}
