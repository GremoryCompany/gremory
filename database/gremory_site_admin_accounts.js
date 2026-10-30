'use strict';
// Operações administrativas de identidade, executadas APENAS pelo Firebase Admin
// do bot/worker confiável. Nenhuma credencial é exposta ao navegador.
const USER_PATHS = Object.freeze([
  'profiles','directory','users','friends','friendRequests','pokemonWeb',
  'charlotteLinkRequests','charlottePublic','charlotteSync','charlottePrivate',
  'siteBridgeJobs','siteBridgeResults','pokemonSiteChallenges','pokemonSiteDuelIndex',
  'rpgUserRooms','siteInventory','siteCustomization','pokemonSiteEncounter',
  'pokemonHealing','pokemonSiteMeta','ticTacToeIndex','watchUserRooms',
  'siteNotifications','siteBans','siteTinderProfiles','communityFollowing',
  'profileBadges','profileEquippedBadge','supportChats','siteNotificationDismissed',
  'siteGameChallenges','blackjackIndex','hangmanIndex','blackjackHands',
  'userPlaylists','directChats','premiumSiteGroups','nightmare21Index',
  'chaosIndex','pokerIndex','horseRaceLast','siteFishing','siteMining',
  'siteProgress','premiumGroupMemberships','premiumPurchases',
  'siteWallets','siteSlotsPending','siteSlotsSettlements','siteGameAccepts'
]);
function safeUid(uid){return typeof uid==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(uid)}
function snapshotValue(snapshot){return snapshot&&typeof snapshot.val==='function'?snapshot.val():null}
async function read(db,path){return snapshotValue(await db.ref(path).once('value'))}
function isNonFinal(status){return !['done','settled','refunded','cancelled','canceled','failed','expired'].includes(String(status||'').toLowerCase())}
async function assertNoPendingFinance(db,uid){
  const [pending,ops,jobs,wagers]=await Promise.all([
    read(db,`siteSlotsPending/${uid}`),read(db,`siteWalletOps/${uid}`),
    read(db,`siteBridgeJobs/${uid}`),read(db,'gameWagers')
  ]);
  if(pending&&Object.keys(pending).length)throw new Error('Existe giro financeiro pendente. Concilie o Slots antes de apagar a conta.');
  if(jobs&&Object.keys(jobs).length)throw new Error('Existem ações em processamento. Aguarde a conclusão antes de apagar a conta.');
  if(Object.values(ops||{}).some(v=>v&&isNonFinal(v.status)))throw new Error('Existem lançamentos de Rúpias pendentes de conferência.');
  if(Object.values(wagers||{}).some(v=>v?.players?.[uid]&&isNonFinal(v.status)))throw new Error('Existe uma aposta pendente ou não liquidada. Conclua a partida antes da exclusão.');
}
async function deleteSiteAccount({db,auth,requesterUid,targetUid,groupLeave}){
  if(!safeUid(requesterUid)||!safeUid(targetUid))throw new Error('UID inválido.');
  if(requesterUid===targetUid)throw new Error('Não é permitido apagar a própria conta de administrador.');
  // Validação no servidor: nunca confiar na tela, no e-mail de um payload
  // ou em permissões de leitura do RTDB para operações no Firebase Auth.
  const adminUser=await auth.getUser(requesterUid);
  if(adminUser.disabled||!adminUser.emailVerified||String(adminUser.email||'').toLowerCase()!=='losermodder@gmail.com')throw new Error('Permissão administrativa inválida. Confirme o e-mail do administrador.');
  const target=await auth.getUser(targetUid);
  if(String(target.email||'').toLowerCase()==='losermodder@gmail.com'||target.customClaims?.admin===true)throw new Error('Não é permitido excluir contas administrativas.');
  await assertNoPendingFinance(db,targetUid);
  const lockRef=db.ref(`siteAccountDeletions/${targetUid}`),startedAt=Date.now();
  const tx=await lockRef.transaction(v=>{
    if(v?.status==='done'||(v?.status==='running'&&startedAt-Number(v.startedAt||0)<5*60*1000))return;
    return{status:'running',targetUid,requestedBy:requesterUid,startedAt};
  },undefined,false);
  if(!tx.committed)throw new Error('A exclusão já está em processamento ou foi concluída.');
  let disabled=false,staged=false;
  try{
    // Desativa primeiro para impedir novos logins; se uma etapa falhar,
    // a exclusão pode ser repetida, mas a conta não continua ativa.
    await auth.updateUser(targetUid,{disabled:true});disabled=true;
    await auth.revokeRefreshTokens(targetUid);
    const [profile,directory,friends,watchRooms,rpgRooms,group,groups,posts,comments,likes,follows,requests]=await Promise.all([
      read(db,`profiles/${targetUid}`),read(db,`directory/${targetUid}`),
      read(db,`friends/${targetUid}`),read(db,`watchUserRooms/${targetUid}`),
      read(db,`rpgUserRooms/${targetUid}`),read(db,`premiumGroupMemberships/${targetUid}`),
      read(db,'premiumGroupMemberships'),read(db,'communityPosts'),
      read(db,'communityComments'),read(db,'communityLikes'),
      read(db,'communityFollowing'),read(db,'friendRequests')
    ]);
    const updates={};for(const path of USER_PATHS)updates[`${path}/${targetUid}`]=null;
    // Manter siteWalletOps, gameWagers e recibos financeiros como registros
    // servidor-only contra double-spend, sem apagar o saldo do WhatsApp.
    const username=String(profile?.username||directory?.username||'').toLowerCase();
    if(/^[a-z][a-z0-9_]{2,19}$/.test(username)&&
       (await read(db,`usernames/${username}`))?.uid===targetUid)updates[`usernames/${username}`]=null;
    for(const peer of Object.keys(friends||{}))if(safeUid(peer)){
      updates[`friends/${peer}/${targetUid}`]=null;
      updates[`directChats/${peer}/${targetUid}`]=null;
      updates[`friendRequests/${peer}/${targetUid}`]=null;
    }
    for(const [uid,requestsForUid]of Object.entries(requests||{}))if(safeUid(uid)&&uid!==targetUid&&requestsForUid?.[targetUid])updates[`friendRequests/${uid}/${targetUid}`]=null;
    for(const [uid,following]of Object.entries(follows||{}))if(safeUid(uid)&&uid!==targetUid&&following?.[targetUid])updates[`communityFollowing/${uid}/${targetUid}`]=null;
    for(const [postId,post]of Object.entries(posts||{})){
      if(post?.uid===targetUid)updates[`communityPosts/${postId}`]=null;
    }
    for(const [postId,items]of Object.entries(comments||{}))for(const [id,comment]of Object.entries(items||{})){
      if(comment?.uid===targetUid)updates[`communityComments/${postId}/${id}`]=null;
    }
    for(const [postId,users]of Object.entries(likes||{}))if(users?.[targetUid])updates[`communityLikes/${postId}/${targetUid}`]=null;
    // Salas pertencentes ao usuário são encerradas; para convidados,
    // remove somente a participação, sem quebrar a sala dos outros.
    for(const code of Object.keys(watchRooms||{})){
      if(!/^[A-Za-z0-9_-]{2,40}$/.test(code))continue;
      const room=await read(db,`watchRooms/${code}`);
      if(room?.meta?.ownerUid===targetUid){
        updates[`watchRooms/${code}`]=null;updates[`watchPublicRooms/${code}`]=null;
        updates[`watchInvites/${code}`]=null;updates[`watchVoice/${code}`]=null;
        updates[`watchRtc/${code}`]=null;updates[`watchModeration/${code}`]=null;
        for(const uid of Object.keys(room.members||{}))if(uid!==targetUid&&safeUid(uid))updates[`watchUserRooms/${uid}/${code}`]=null;
      }else{
        updates[`watchRooms/${code}/members/${targetUid}`]=null;
        updates[`watchVoice/${code}/${targetUid}`]=null;
        updates[`watchRtc/${code}/${targetUid}`]=null;
        updates[`watchInvites/${code}/${targetUid}`]=null;
      }
    }
    for(const code of Object.keys(rpgRooms||{})){
      if(!/^[A-Za-z0-9_-]{2,40}$/.test(code))continue;
      const room=await read(db,`rpgRooms/${code}`);
      if(room?.meta?.ownerUid===targetUid){
        updates[`rpgRooms/${code}`]=null;updates[`rpgVoice/${code}`]=null;updates[`rpgRtc/${code}`]=null;
        for(const uid of Object.keys(room.members||{}))if(uid!==targetUid&&safeUid(uid))updates[`rpgUserRooms/${uid}/${code}`]=null;
      }else{
        updates[`rpgRooms/${code}/members/${targetUid}`]=null;
        updates[`rpgVoice/${code}/${targetUid}`]=null;
        updates[`rpgRtc/${code}/${targetUid}`]=null;
      }
    }
    if(group?.active&&group.groupJid){
      const otherActive=Object.entries(groups||{}).some(([uid,r])=>uid!==targetUid&&r?.active&&r.groupJid===group.groupJid);
      if(!otherActive){
        if(typeof groupLeave!=='function')throw new Error('Não é possível garantir a saída da Charlotte do grupo atual.');
        await groupLeave(group.groupJid); // Falhas devem interromper, nunca silenciar.
      }
    }
    // Remove todas as referências em uma atualização multipath (atômica no RTDB).
    await db.ref().update(updates);staged=true;
    // Somente depois de limpar os dados, apaga a identidade e os provedores
    // (e-mail/senha, Google etc.) do Firebase Authentication.
    await auth.deleteUser(targetUid);
    await lockRef.update({status:'done',completedAt:Date.now(),disabled:true});
    return{targetUid,deleted:true,authDeleted:true,linkReleased:true,botDataPreserved:true,pathsCleared:Object.keys(updates).length};
  }catch(error){
    await lockRef.update({status:'failed',failedAt:Date.now(),authDisabled:disabled,databaseCleaned:staged,error:String(error?.message||error).slice(0,200)}).catch(()=>{});
    throw error;
  }
}
module.exports={deleteSiteAccount,assertNoPendingFinance,USER_PATHS};
