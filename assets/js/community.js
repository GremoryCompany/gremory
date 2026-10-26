import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js';
import {ref,get,set,push,remove,onValue,query,orderByChild,limitToLast,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-database.js';
import {getStorage,ref as storageRef,uploadBytesResumable,getDownloadURL,deleteObject} from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-storage.js';

export function initCommunity({app,db,getUser,isAdmin,toast,getSelectedUid,bridgeRequest}){
 const $=id=>document.getElementById(id),storage=getStorage(app);
 let posts={},following={},directory={},onlyFollowing=false,limit=20,subscriptions=[],postSub=null,rowSubs=[],busy=false,upload=null,epoch=0;
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n};
 const button=(text,action)=>{const b=node('button',text,'btn');b.type='button';b.onclick=()=>Promise.resolve().then(action).catch(e=>toast(e.message));return b};
 const name=uid=>uid==='charlotte'?'Charlotte':directory[uid]?.nome||directory[uid]?.name||'Participante';
 const safeUrl=value=>{try{const u=new URL(value);return u.protocol==='https:'?u.href:''}catch{return ''}};
 const cleanupRows=()=>{rowSubs.splice(0).forEach(fn=>fn())};
 function subscribePosts(){postSub?.();postSub=onValue(query(ref(db,'communityPosts'),orderByChild('createdAt'),limitToLast(limit)),sn=>{posts=sn.val()||{};render()},e=>{$('feedList').textContent='Não foi possível carregar o feed. Verifique as regras do Firebase.';toast(e.message)})}
 function render(){
  cleanupRows();const box=$('feedList');box.replaceChildren();
  const rows=Object.entries(posts).filter(([,p])=>!onlyFollowing||following[p.uid]||p.uid===getUser()?.uid).sort((a,b)=>b[1].createdAt-a[1].createdAt);
  for(const [id,p] of rows){
   const card=node('article',null,'panel feed-post'),head=node('div',null,'feed-post-head');
   const avatar=node('img');avatar.src=safeUrl(directory[p.uid]?.avatar)||'/assets/img/profile.jpg';avatar.alt='';avatar.loading='lazy';avatar.classList.add('feed-post-avatar');avatar.role='button';avatar.tabIndex=0;avatar.onclick=()=>showProfile(p.uid).catch(e=>toast(e.message));avatar.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showProfile(p.uid).catch(err=>toast(err.message))}};
   head.append(avatar,button(name(p.uid),()=>showProfile(p.uid)));const time=node('small',new Date(p.createdAt).toLocaleString('pt-BR'));head.append(time);card.append(head,node('p',p.text,'feed-post-text'));
   const url=safeUrl(p.mediaUrl);if(url){const media=node(p.mediaKind==='video'?'video':'img');media.className='feed-media';media.src=url;if(p.mediaKind==='video'){media.controls=true;media.playsInline=true;media.preload='metadata'}else{media.loading='lazy';media.alt='Imagem da publicação'}media.onerror=()=>{media.replaceWith(node('p','Mídia indisponível. O link pode ter expirado.','muted'))};card.append(media)}
   const actions=node('div',null,'feed-actions');let liked=false;
   const like=button('♡ Curtir',async()=>{like.disabled=true;try{const path=ref(db,`communityLikes/${id}/${getUser().uid}`);await(liked?remove(path):set(path,true))}finally{like.disabled=false}});
   rowSubs.push(onValue(ref(db,`communityLikes/${id}`),sn=>{const likes=sn.val()||{};liked=!!likes[getUser()?.uid];like.textContent=`${liked?'♥':'♡'} ${Object.keys(likes).length}`;like.setAttribute('aria-pressed',String(liked))}));
   const comments=node('div',null,'feed-comments');comments.hidden=true;let commentSub=null;
   actions.append(like,button('Comentários',()=>{comments.hidden=!comments.hidden;if(comments.hidden){commentSub?.();commentSub=null;return}const list=node('div'),form=node('form',null,'feed-comment-form'),input=node('input');input.required=true;input.maxLength=500;input.placeholder='Escreva um comentário';input.setAttribute('aria-label','Comentário');const send=node('button','Enviar','btn');form.append(input,send);comments.replaceChildren(list,form);commentSub=onValue(query(ref(db,`communityComments/${id}`),orderByChild('createdAt'),limitToLast(30)),sn=>{list.replaceChildren();for(const [cid,c] of Object.entries(sn.val()||{})){const row=node('div',null,'feed-comment');row.append(node('strong',name(c.uid)),node('p',c.text));if(c.uid===getUser()?.uid||isAdmin())row.append(button('Apagar',()=>remove(ref(db,`communityComments/${id}/${cid}`))));list.append(row)}});rowSubs.push(()=>commentSub?.());form.onsubmit=async e=>{e.preventDefault();if(!input.value.trim())return;send.disabled=true;try{await push(ref(db,`communityComments/${id}`),{uid:getUser().uid,text:input.value.trim(),createdAt:serverTimestamp()});input.value=''}catch(e){toast(e.message)}finally{send.disabled=false}}}));
   if(p.uid===getUser()?.uid||isAdmin())actions.append(button('Excluir',async()=>{if(!confirm('Excluir esta publicação?'))return;await remove(ref(db,`communityPosts/${id}`));if(p.storagePath?.startsWith(`community/${p.uid}/`))await deleteObject(storageRef(storage,p.storagePath)).catch(()=>toast('Publicação removida; o arquivo precisa ser removido no Storage.'))}));
   if(isAdmin())actions.append(button('Avisar grupos',async()=>{if(!confirm('Enviar esta publicação aos grupos configurados no bot?'))return;const r=await bridgeRequest('admin_feed_announce',{postId:id},60000,false);toast(`Aviso enviado a ${r.sent} grupo(s).`)}));
   card.append(actions,comments);box.append(card);
  }
  if(!rows.length)box.append(node('p',onlyFollowing?'Nenhuma publicação das pessoas seguidas nesta página. Carregue mais ou explore Todos.':'Ainda não há publicações.','empty-state'));
  $('feedMore').hidden=Object.keys(posts).length<limit;
 }
 async function showProfile(uid){
  const box=$('feedProfile');box.hidden=false;box.textContent='Carregando perfil...';const version=epoch;
  const [badgesSn,equippedSn,followingSn]=await Promise.all([get(ref(db,`profileBadges/${uid}`)),get(ref(db,`profileEquippedBadge/${uid}`)),get(ref(db,`communityFollowing/${uid}`))]);if(version!==epoch)return;
  const badges=badgesSn.val()||{},equipped=equippedSn.val(),mine=uid===getUser()?.uid;box.replaceChildren(node('h3',name(uid)),node('p',directory[uid]?.bio||''));box.append(node('p',`Seguindo ${Object.keys(followingSn.val()||{}).length} pessoas`));
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
   if(version!==epoch)throw new Error('Sessão alterada. Entre novamente.');await set(post,{uid,text,mediaUrl,mediaKind,storagePath,createdAt:serverTimestamp()});e.target.reset();$('feedProgress').textContent='Publicado!';
  }catch(err){if(storagePath)await deleteObject(storageRef(storage,storagePath)).catch(()=>{});$('feedProgress').textContent='Falha ao publicar. Verifique a configuração e as regras do Firebase Storage.';toast(err.message)}finally{busy=false;submit.disabled=false;upload=null}
 };
 $('feedAll').onclick=()=>{onlyFollowing=false;render()};$('feedFollowing').onclick=()=>{onlyFollowing=true;render()};$('feedMyProfile').onclick=()=>showProfile(getUser().uid).catch(e=>toast(e.message));$('feedRefresh').onclick=subscribePosts;$('feedMore').onclick=()=>{limit+=20;subscribePosts()};
 $('adminBadgeForm').onsubmit=async e=>{e.preventDefault();if(!isAdmin())return;const uid=getSelectedUid(),id=$('adminBadgeId').value.trim();if(!uid)return toast('Localize o usuário primeiro.');try{await set(ref(db,`profileBadges/${uid}/${id}`),{name:$('adminBadgeName').value.trim(),icon:$('adminBadgeIcon').value.trim()});toast('Emblema concedido.')}catch(e){toast(e.message)}};
 $('adminBadgeRevoke').onclick=async()=>{if(!isAdmin()||!getSelectedUid())return;const id=$('adminBadgeId').value.trim();if(!/^[a-z0-9_-]{3,40}$/.test(id))return toast('Informe um ID válido.');try{await remove(ref(db,`profileBadges/${getSelectedUid()}/${id}`));toast('Emblema revogado.')}catch(e){toast(e.message)}};
 onAuthStateChanged(getAuth(app),user=>{epoch++;upload?.cancel();postSub?.();subscriptions.splice(0).forEach(fn=>fn());cleanupRows();posts={};directory={};following={};limit=20;$('feedProfile').hidden=true;$('feedList').replaceChildren();if(!user)return;subscriptions.push(onValue(ref(db,'directory'),sn=>{directory=sn.val()||{};render()}));subscriptions.push(onValue(ref(db,`communityFollowing/${user.uid}`),sn=>{following=sn.val()||{};render()}));subscribePosts()});
}
