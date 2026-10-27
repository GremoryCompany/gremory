'use strict';
// Jogo da Velha, 21 / 21 Pesadelo e Forca: regras e RNG no servidor do site.
// Charlotte nao recebe turnos, cartas, convites, nem calcula vencedor.
const crypto=require('crypto');
const {authenticate,publicError,SiteError,applyEntry,MAX_BALANCE}=require('./site-wallet');
const META={ttt:['ticTacToeGames','ticTacToeIndex'],blackjack:['blackjackGames','blackjackIndex'],hangman:['hangmanGames','hangmanIndex']};
const HANGMAN_WORDS=['CHARLOTTE','POKEMON','GREMORY','DRAGAO','MAGIA','ANIME','AVENTURA','MISTERIO','AMIZADE','BATALHA','ESTRELA','VITORIA','CASTELO','DEMONIO','TREINADOR','FANTASIA','GUERREIRO','IMPERIO','LENDARIO','RAIO','RUPIAS','GINASIO','MESTRE','CRISTAL','GALAXIA','ESPADA','CORAGEM','TEMPLO','PORTAL','SOMBRA'];
const U=()=>Date.now(),uidSafe=id=>/^[-_a-zA-Z0-9]{5,150}$/.test(String(id||''));
function shuffleDeck(){const a=['♠','♥','♦','♣'].flatMap(s=>['A','2','3','4','5','6','7','8','9','10','J','Q','K'].map(r=>({s,r})));for(let i=a.length-1;i>0;i--){const j=crypto.randomInt(i+1);[a[i],a[j]]=[a[j],a[i]]}return a}
function score(cards=[]){let total=cards.reduce((n,c)=>n+(c.r==='A'?11:['J','Q','K'].includes(c.r)?10:Number(c.r)),0),aces=cards.filter(c=>c.r==='A').length;while(total>21&&aces>0){total-=10;aces--}return total}
function ticWinner(board){const lines=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];for(const [a,b,c] of lines)if(board[a]&&board[a]===board[b]&&board[a]===board[c])return board[a];return null}
function newGame(type,gameId,u1,u2,bet,mode,names){const ts=U(),first=crypto.randomInt(2)?u1:u2,players={[u1]:{uid:u1,name:names[0]},[u2]:{uid:u2,name:names[1]}},base={id:gameId,type,mode,status:'active',createdAt:ts,updatedAt:ts,turnUid:first,players,bet,wager:{amount:bet,pot:bet*2,settled:!bet},log:{}};
 if(type==='ttt'){base.board=Array(9).fill('');players[u1].symbol='X';players[u2].symbol='O';base.turnUid=u1;}
 if(type==='blackjack'){base.deck=shuffleDeck();base.hands={};for(const uid of [u1,u2]){const cards=[base.deck.pop(),base.deck.pop()];base.hands[uid]={cards,score:score(cards),busted:false,stood:false};}}
 if(type==='hangman'){base.answer=HANGMAN_WORDS[crypto.randomInt(HANGMAN_WORDS.length)];base.mask='_'.repeat(base.answer.length);base.guessed={};base.misses=[];base.maxMisses=6;players[u1].score=0;players[u2].score=0;}
 return base;
}
function log(g,message){g.log=g.log||{};g.log[`m_${U()}_${crypto.randomBytes(3).toString('hex')}`]={text:message,at:new Date().toISOString()};}
function winner21(g){const rows=Object.entries(g.hands).map(([uid,h])=>({uid,s:h.score,bust:h.busted||h.score>21})).filter(x=>!x.bust);if(rows.length===1)return rows[0].uid;if(rows.length!==2||rows[0].s===rows[1].s)return null;return rows[0].s>rows[1].s?rows[0].uid:rows[1].uid}
function drawCard(g,hand){if(!g.deck.length)throw new SiteError(409,'DECK_EMPTY','O baralho terminou.');hand.cards.push(g.deck.pop());hand.score=score(hand.cards);if(hand.score>21){if(hand.shield){hand.shield=false;hand.shieldSaved=true;hand.cards.pop();hand.score=score(hand.cards)}else{hand.busted=true;hand.stood=true}}if(hand.score===21)hand.stood=true}
function end(g,winner=null,reason='Partida encerrada.'){g.status='finished';g.winnerUid=winner;g.turnUid=null;g.finishedAt=U();g.updatedAt=U();log(g,reason)}
function applyAction(g,uid,body){
 const otherUid=Object.keys(g.players).find(x=>x!==uid),me=g.players[uid];if(g.status!=='active')throw new SiteError(409,'GAME_FINISHED','Partida já encerrada.');
 if(body.type.endsWith('_exit')){g.leftUid=uid;g.finishReason='exit';end(g,otherUid,`${me.name} desistiu da partida.`);return;}
 if(g.turnUid!==uid)throw new SiteError(409,'NOT_YOUR_TURN','Espere a sua vez.');
 if(g.type==='ttt'){
  const i=Number(body.index);if(!Number.isInteger(i)||i<0||i>8||g.board[i])throw new SiteError(400,'MOVE_INVALID','Casa inválida ou ocupada.');
  g.board[i]=me.symbol;log(g,`${me.name} marcou ${me.symbol}.`);const win=ticWinner(g.board);
  if(win)end(g,uid,`${me.name} venceu a partida.`);else if(g.board.every(Boolean))end(g,null,'Empate.');else g.turnUid=otherUid;
 }else if(g.type==='hangman'){
  const letter=String(body.letter||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z]/g,'').slice(0,1);
  if(!letter||g.guessed[letter])throw new SiteError(400,'LETTER_INVALID','Letra inválida ou repetida.');
  const hits=[...g.answer].filter(x=>x===letter).length;g.guessed[letter]=hits?'hit':'miss';if(hits)me.score+=hits;else g.misses.push(letter);
  g.mask=[...g.answer].map(c=>g.guessed[c]==='hit'?c:'_').join('');log(g,`${me.name} ${hits?`acertou ${letter}`:`errou ${letter}`}.`);
  if(!g.mask.includes('_')||g.misses.length>=g.maxMisses){if(!g.mask.includes('_'))me.score+=2;const rows=Object.values(g.players).sort((a,b)=>b.score-a.score);end(g,rows[0].score===rows[1].score?null:rows[0].uid,'A rodada de Forca terminou.');}else g.turnUid=otherUid;
 }else if(g.type==='blackjack'){
  const h=g.hands[uid],opp=g.hands[otherUid],action=String(body.action||'');if(h.stood||h.busted)throw new SiteError(409,'HAND_DONE','Você já terminou sua mão.');
  if(action==='hit'){drawCard(g,h);h.lockStand=false;log(g,`${me.name} comprou uma carta.`)}
  else if(action==='stand'){if(h.lockStand)throw new SiteError(409,'STAND_LOCKED','A carta Trava exige comprar antes de parar.');h.stood=true;log(g,`${me.name} parou.`)}
  else if(action==='special'&&g.mode==='nightmare'){
   const special=String(body.special||'');if(!['shield','omen','order','lock','swap'].includes(special))throw new SiteError(400,'SPECIAL_INVALID','Carta especial inválida.');h.specialsUsed=h.specialsUsed||{};if(h.specialsUsed[special])throw new SiteError(409,'SPECIAL_USED','Carta especial já utilizada.');
   if(special==='shield')h.shield=true;
   if(special==='omen'){const c=g.deck[g.deck.length-1];if(!c)throw new SiteError(409,'DECK_EMPTY','Sem mais cartas.');const p=c.r==='A'?11:['J','Q','K'].includes(c.r)?10:Number(c.r);h.omen=p<=5?'Carta baixa (2–5)':p<=9?'Carta média (6–9)':'Carta alta (10 ou Ás)';}
   if(special==='order'){if(opp.stood||opp.busted)throw new SiteError(409,'OPPONENT_DONE','A mão do adversário já terminou.');drawCard(g,opp)}
   if(special==='lock'){if(opp.stood||opp.busted)throw new SiteError(409,'OPPONENT_DONE','A mão do adversário já terminou.');opp.lockStand=true}
   if(special==='swap'){if(h.cards.length<3)throw new SiteError(409,'NOT_ENOUGH_CARDS','Compre uma carta antes de usar Troca.');h.cards.pop();drawCard(g,h)}
   h.specialsUsed[special]=true;log(g,`${me.name} usou uma carta especial.`);
  }else throw new SiteError(400,'MOVE_INVALID','Jogada inválida.');
  if(Object.values(g.hands).every(x=>x.stood||x.busted))end(g,winner21(g),'A partida de 21 terminou.');
  else g.turnUid=!(opp.stood||opp.busted)?otherUid:uid;
 }
 g.updatedAt=U();
}
function publicView(g){const out={id:g.id,mode:g.mode,status:g.status,createdAt:g.createdAt,updatedAt:g.updatedAt,turnUid:g.turnUid,wager:g.wager,players:JSON.parse(JSON.stringify(g.players)),log:g.log||{}};
 for(const k of ['winnerUid','finishedAt','leftUid','finishReason'])if(g[k]!=null)out[k]=g[k];
 if(g.type==='ttt')out.board=g.board;
 if(g.type==='hangman'){out.mask=g.mask;out.guessed=g.guessed;out.misses=g.misses;out.maxMisses=g.maxMisses;if(g.status==='finished')out.answer=g.answer;}
 if(g.type==='blackjack'){for(const [uid,hand]of Object.entries(g.hands)){Object.assign(out.players[uid],{cardCount:hand.cards.length,stood:!!hand.stood,busted:!!hand.busted});}if(g.status==='finished')out.revealedHands=g.hands;}
 return out;
}
async function publish(db,g){const [games,index]=META[g.type],updates={[`${games}/${g.id}`]:publicView(g)};
 for(const uid of Object.keys(g.players)){updates[`${index}/${uid}/${g.id}`]={status:g.status,createdAt:g.createdAt,updatedAt:g.updatedAt,opponentUid:Object.keys(g.players).find(x=>x!==uid),winnerUid:g.winnerUid||null};}
 if(g.type==='blackjack'){for(const [uid,h]of Object.entries(g.hands))updates[`blackjackPrivate/${g.id}/${uid}`]=g.status==='active'?h:null;}
 await db.ref().update(updates);
}
async function chargeBoth(db,g){if(!g.bet)return;
 const uids=Object.keys(g.players),op=`entry_${g.id}`,ref=db.ref('siteWallets');
 const tx=await ref.transaction(all=>{
  if(!all)return;
  for(const uid of uids){const w=all[uid];if(!w||!Number.isSafeInteger(Number(w.balance)))return;if(!w.receipts?.[op]&&Number(w.balance)<g.bet)return;}
  for(const uid of uids){const w=all[uid],updated=applyEntry(w,op,-g.bet,'game_entry',{gameId:g.id,bet:g.bet});if(!updated)return;all[uid]=updated;}
  return all;
 },undefined,false);
 if(!tx.committed)throw new SiteError(409,'GAME_BET_FUNDS','Saldo insuficiente ou conta ainda não sincronizada para um dos jogadores.');
}
async function payWager(db,g){if(!g.bet||g.status!=='finished')return;
 const uids=Object.keys(g.players),op=`prize_${g.id}`,ref=db.ref('siteWallets'),win=g.winnerUid;
 const tx=await ref.transaction(all=>{
  if(!all)return;
  for(const uid of uids){if(!all[uid]||!all[uid].receipts?.[`entry_${g.id}`])return;}
  for(const uid of uids){const amt=win?(uid===win?g.bet*2:0):g.bet;
   if(!Number.isSafeInteger(amt)||amt>MAX_BALANCE)return;
   if(amt){const updated=applyEntry(all[uid],op,amt,'game_payout',{gameId:g.id,winnerUid:win||null});if(!updated)return;all[uid]=updated;}
  }
  return all;
 },undefined,false);
 if(!tx.committed)throw new SiteError(503,'GAME_PAYOUT_PENDING','Prêmio pendente de sincronização. Ele não será pago duas vezes.');
 g.wager={amount:g.bet,pot:g.bet*2,settled:true};
}
async function handleGame(req,res,{readJsonBody,sendJson}){
 res.setHeader('Cache-Control','no-store');
 try{
  const {uid,db,body}=await authenticate(req,readJsonBody),type=String(body.type||''),base=type.split('_')[0],gType=base==='blackjack'?'blackjack':base==='hangman'?'hangman':base==='ttt'?'ttt':null;
  if(!gType||!['create','move','guess','exit','status'].includes(type.split('_').slice(1).join('_')))throw new SiteError(400,'GAME_ACTION_INVALID','Ação de jogo inválida.');
  let g,gameId;
  if(type.endsWith('_create')){
   const challengeId=String(body.challengeId||'');if(!uidSafe(challengeId))throw new SiteError(400,'CHALLENGE_INVALID','Convite inválido.');
   const challenge=(await db.ref(`siteGameChallenges/${uid}/${challengeId}`).once('value')).val();
   if(!challenge||challenge.type!==gType||!uidSafe(challenge.fromUid)||challenge.fromUid===uid)throw new SiteError(403,'CHALLENGE_NOT_FOUND','O convite não existe mais.');
   const opponent=challenge.fromUid;
   const [a,b]=await Promise.all([db.ref(`friends/${uid}/${opponent}`).once('value'),db.ref(`friends/${opponent}/${uid}`).once('value')]);
   if(!a.exists()||!b.exists())throw new SiteError(403,'NOT_FRIENDS','Vocês precisam ser amigos para jogar.');
   if(!Number.isFinite(Number(challenge.createdAt))||Date.now()-Number(challenge.createdAt)>7*86400000||Number(challenge.createdAt)>Date.now()+60000)throw new SiteError(409,'CHALLENGE_EXPIRED','Convite expirado. Peça outro convite.');
   const bet=Number(challenge.bet||0);
   if(!Number.isSafeInteger(bet)||bet<0||(bet>0&&bet<10)||bet>1_000_000_000)throw new SiteError(400,'BET_INVALID','Aposta inválida.');
   gameId=`sg_${crypto.createHash('sha256').update(`${gType}|${uid}|${challengeId}`).digest('hex').slice(0,32)}`;
   const ref=db.ref(`siteGameEngine/${gameId}`),existing=(await ref.once('value')).val();
   if(existing){g=existing;if(!g.players?.[uid])throw new SiteError(403,'NOT_PLAYER','Partida inválida.');}
   else{
    const [n1,n2]=await Promise.all([db.ref(`directory/${uid}/nome`).once('value'),db.ref(`directory/${opponent}/nome`).once('value')]);
    g=newGame(gType,gameId,uid,opponent,bet,challenge.mode==='nightmare'?'nightmare':'classic',[String(n1.val()||'Jogador').slice(0,40),String(n2.val()||'Jogador').slice(0,40)]);
    // O recibo de débito é gravado na MESMA transação que subtrai os dois saldos.
    await chargeBoth(db,g);
    const claim=await ref.transaction(v=>v||g,undefined,false);g=claim.snapshot.val();
   }
  }else{
   gameId=String(body.gameId||'');if(!uidSafe(gameId))throw new SiteError(400,'GAME_ID_INVALID','Partida inválida.');
   const ref=db.ref(`siteGameEngine/${gameId}`),snapshot=(await ref.once('value')).val();
   if(!snapshot||snapshot.type!==gType||!snapshot.players?.[uid])throw new SiteError(404,'GAME_NOT_FOUND','Partida não encontrada.');
   if(type.endsWith('_status'))g=snapshot;
   else{
    let moveError=null;
    const moveId=String(body.actionId||'');if(!/^act_[a-f0-9]{32}$/.test(moveId))throw new SiteError(400,'ACTION_ID_INVALID','Identificador da jogada inválido.');
    const tx=await ref.transaction(state=>{
     if(!state)return;
     if(state.actions?.[moveId])return state;
     const copy=JSON.parse(JSON.stringify(state));
     try{applyAction(copy,uid,body)}catch(e){moveError=e;return}
     copy.actions=copy.actions||{};copy.actions[moveId]=U();
     const keys=Object.keys(copy.actions);if(keys.length>100)for(const key of keys.slice(0,keys.length-100))delete copy.actions[key];
     return copy;
    },undefined,false);
    if(!tx.committed)throw moveError||new SiteError(409,'GAME_CONFLICT','Jogada não confirmada; sincronize sua partida.');
    g=tx.snapshot.val();
   }
  }
  if(g.status==='finished'&&g.bet&&!g.wager?.settled)await payWager(db,g);
  await publish(db,g);
  return sendJson(res,200,{ok:true,gameId,gameStatus:g.status,winnerUid:g.winnerUid||null,wager:g.wager});
 }catch(e){const err=publicError(e,'SITE GAMES');return sendJson(res,err.status,{erro:err.erro,code:err.code});}
}
module.exports={handleGame,score,ticWinner,newGame,applyAction,publicView};
