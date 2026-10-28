'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {deleteSiteAccount,assertNoPendingFinance}=require('../database/gremory_site_admin_accounts.js');
function fakeDb(seed={}){
 const root=structuredClone(seed),keys=p=>String(p||'').split('/').filter(Boolean);
 const get=p=>keys(p).reduce((v,k)=>v?.[k],root);
 const set=(p,v)=>{let o=root,parts=keys(p),key=parts.pop();for(const k of parts)o=o[k]??={};if(v===null)delete o[key];else o[key]=structuredClone(v)};
 const ref=p=>({once:async()=>({val:()=>get(p)??null}),update:async changes=>{for(const[k,v]of Object.entries(changes))set(p?`${p}/${k}`:k,v)},transaction:async fn=>{const v=fn(get(p));if(v===undefined)return{committed:false};set(p,v);return{committed:true}}});
 return{root,ref};
}
function fakeAuth(){const users={admin:{uid:'admin',email:'losermodder@gmail.com',emailVerified:true,disabled:false},alice:{uid:'alice',email:'alice@example.org',emailVerified:true,disabled:false},third:{uid:'third',email:'third@example.org',emailVerified:true}};const steps=[];
 return{users,steps,getUser:async uid=>{if(!users[uid])throw Error('auth/user-not-found');return users[uid]},updateUser:async(uid,p)=>{steps.push('disable');Object.assign(users[uid],p)},revokeRefreshTokens:async()=>{steps.push('revoke')},deleteUser:async uid=>{steps.push('delete');delete users[uid]}}}
test('Verified admin removes Firebase Auth login, UID links, profile, username and cross references, NOT Charlotte wallet',async()=>{
 const db=fakeDb({profiles:{alice:{username:'alice123'}},directory:{alice:{username:'alice123'}},usernames:{alice123:{uid:'alice'}},
 charlottePrivate:{alice:{whatsappJid:'5511@s.whatsapp.net'}},charlotteSync:{alice:{balance:123}},
 friends:{alice:{third:true},third:{alice:true}},directChats:{third:{alice:{m1:{text:'oi'}}}},
 friendRequests:{third:{alice:{senderUid:'alice'}}},communityFollowing:{third:{alice:true}},
 communityPosts:{post1:{uid:'alice'},post2:{uid:'third'}},
 communityLikes:{post2:{alice:true,third:true}},communityComments:{post2:{comment1:{uid:'alice'},comment2:{uid:'third'}}},
 premiumGroupMemberships:{alice:{active:true,groupJid:'group@g.us'}},
 siteWalletOps:{alice:{operation:{status:'done',delta:-10}}},siteWallets:{alice:{balance:123}},
 gameWagers:{game1:{players:{alice:true},status:'done'}},
 watchUserRooms:{alice:{AB12:{role:'Host',code:'AB12'}}},watchRooms:{AB12:{meta:{ownerUid:'alice'},members:{alice:true,third:true}}},
 rpgUserRooms:{alice:{CD34:{role:'Jogador',code:'CD34'}}},rpgRooms:{CD34:{meta:{ownerUid:'third'},members:{alice:true,third:true}}}
 });const auth=fakeAuth();let left='';
 const result=await deleteSiteAccount({db,auth,requesterUid:'admin',targetUid:'alice',groupLeave:async g=>{left=g}});
 assert.equal(result.authDeleted,true);assert.equal(left,'group@g.us');assert.equal(auth.users.alice,undefined);
 assert.deepEqual(auth.steps,['disable','revoke','delete']);assert.equal(db.root.charlottePrivate?.alice,undefined);assert.equal(db.root.charlotteSync?.alice,undefined);
 assert.equal(db.root.profiles?.alice,undefined);assert.equal(db.root.usernames?.alice123,undefined);assert.equal(db.root.friends.third.alice,undefined);
 assert.equal(db.root.directChats.third.alice,undefined);assert.equal(db.root.communityPosts.post1,undefined);assert.equal(db.root.communityPosts.post2.uid,'third');
 assert.equal(db.root.communityLikes.post2.alice,undefined);assert.equal(db.root.communityComments.post2.comment1,undefined);
 assert.equal(db.root.siteWalletOps.alice.operation.delta,-10);assert.equal(db.root.gameWagers.game1.status,'done');
 assert.equal(db.root.watchRooms.AB12,undefined);assert.equal(db.root.rpgRooms.CD34.members.alice,undefined);
 assert.equal(db.root.siteAccountDeletions.alice.status,'done');
});
test('Refuses non-admin, unverified, self or admin target BEFORE any disable',async()=>{
 const db=fakeDb({}),a=fakeAuth();
 await assert.rejects(deleteSiteAccount({db,auth:a,requesterUid:'third',targetUid:'alice'}),/administrativa/);
 a.users.admin.emailVerified=false;await assert.rejects(deleteSiteAccount({db,auth:a,requesterUid:'admin',targetUid:'alice'}),/Confirme o e-mail/);
 a.users.admin.emailVerified=true;await assert.rejects(deleteSiteAccount({db,auth:a,requesterUid:'admin',targetUid:'admin'}),/própria conta/);
 assert.deepEqual(a.steps,[])
});
test('Account deletion refuses financial unsettled transactions and does not touch Firebase Auth',async()=>{
 const cases=[{siteSlotsPending:{alice:{spin:{bet:20}}}},{siteWalletOps:{alice:{debit:{status:'review'}}}},{siteBridgeJobs:{alice:{job1:{type:'slots_spin'}}}},{gameWagers:{g1:{players:{alice:true},status:'settling'}}}];
 for(const input of cases){const db=fakeDb(input),a=fakeAuth();await assert.rejects(deleteSiteAccount({db,auth:a,requesterUid:'admin',targetUid:'alice'}));assert.deepEqual(a.steps,[])}
});
test('Database operation failure leaves Firebase Auth disabled and preserves log for admin retry',async()=>{
 const db=fakeDb({profiles:{alice:{username:'a1x'}}}),a=fakeAuth(),original=db.ref;
 db.ref=p=>{const r=original(p);if(!p){r.update=async()=>{throw Error('DB offline')}}return r};
 await assert.rejects(deleteSiteAccount({db,auth:a,requesterUid:'admin',targetUid:'alice'}),/DB offline/);
 assert.equal(a.users.alice.disabled,true);assert.equal(db.root.siteAccountDeletions.alice.status,'failed');assert.equal(a.steps.includes('delete'),false);
});
test('RTDB production rules only allow verified admin to enqueue account deletion; browser cannot write deletion audit',()=>{
 const root=path.resolve(__dirname,'..');const rules=JSON.parse(fs.readFileSync(path.join(root,'firebase.rules.production.json'),'utf8')).rules;
 const jobs=rules.siteBridgeJobs.$uid.$jobId['.validate'];assert.match(jobs,/admin_delete_account/);assert.match(jobs,/auth\.token\.email_verified === true/);
 assert.equal(rules.siteAccountDeletions['.write'],false);
 const app=fs.readFileSync(path.join(root,'assets/js/app.js'),'utf8');assert.match(app,/typed!=='EXCLUIR'/);assert.match(app,/bridgeRequest\('admin_delete_account'/);
});
