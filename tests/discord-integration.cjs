'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Readable}=require('node:stream');
const path=require('node:path');

function fakeFirebase(){
  const storage=new Map();
  let next=0;
  function getValue(key){return storage.get(key)??null;}
  function ref(pathName=''){
    const key=String(pathName);
    return {
      async once(){return {val:()=>getValue(key)};},
      async set(value){storage.set(key,value);},
      push(){const id='job_'+String(++next).padStart(20,'0');return {...ref(key?key+'/'+id:id),key:id};},
      async transaction(update){
        const value=update(getValue(key));
        if(value===undefined)return {committed:false,snapshot:{val:()=>getValue(key)}};
        if(value===null)storage.delete(key);else storage.set(key,value);
        return {committed:true,snapshot:{val:()=>value}};
      },
      async update(patch){
        for(const [name,value] of Object.entries(patch)){
          const target=key?key+'/'+name:name;
          if(value===null)storage.delete(target);else storage.set(target,value);
        }
      }
    };
  }
  return {ref,storage};
}

function setup(){
  const db=fakeFirebase();
  const auth={async verifyIdToken(token){if(token==='alice-token')return{uid:'alice'};throw new Error('invalid');}};
  const walletPath=path.resolve(__dirname,'../api/site-wallet.js');
  const handlerPath=path.resolve(__dirname,'../api/discord-integration.js');
  require.cache[walletPath]={id:walletPath,filename:walletPath,loaded:true,exports:{getAdmin:()=>({db,auth})}};
  delete require.cache[handlerPath];
  const handler=require(handlerPath);
  return {db,handler};
}

async function request(handler,body,{authorization}={}){
  const req=Readable.from([JSON.stringify(body)]);
  req.method='POST';req.headers={authorization:authorization||''};
  let response;
  const res={statusCode:200,setHeader(){},end(data){response=JSON.parse(data);}};
  await handler(req,res);
  return {status:res.statusCode,body:response};
}

test('Discord gera código, site autenticado vincula e conta aparece no bot',async()=>{
  const previous=process.env.GREMORY_BRIDGE_API_KEY;
  const secret='gremory-teste-interno-12345678901234567890';
  process.env.GREMORY_BRIDGE_API_KEY=secret;
  try{
    const {db,handler}=setup();
    const discordId='123456789012345678';
    const header={authorization:'Bearer '+secret};
    const issued=await request(handler,{action:'request_link',discordId},header);
    assert.equal(issued.status,200);
    assert.match(issued.body.code,/^[A-F0-9]{18}$/);
    const unauth=await request(handler,{action:'confirm_link',code:issued.body.code,idToken:'bad-token'});
    assert.equal(unauth.status,401);
    const confirmed=await request(handler,{action:'confirm_link',code:issued.body.code,idToken:'alice-token'});
    assert.equal(confirmed.status,200);
    assert.equal(confirmed.body.discordId,discordId);
    assert.equal(db.storage.get('discordLinksByUid/alice').discordId,discordId);
    const reused=await request(handler,{action:'confirm_link',code:issued.body.code,idToken:'alice-token'});
    assert.equal(reused.status,409);
    const status=await request(handler,{action:'site_status',idToken:'alice-token'});
    assert.equal(status.body.linked,true);
    const repeated=await request(handler,{action:'request_link',discordId},header);
    assert.equal(repeated.status,429);
  }finally{
    if(previous===undefined)delete process.env.GREMORY_BRIDGE_API_KEY;
    else process.env.GREMORY_BRIDGE_API_KEY=previous;
  }
});

test('Premium do Discord só entra na fila da Charlotte se ambos os vínculos existem',async()=>{
  const previous=process.env.GREMORY_BRIDGE_API_KEY;
  const secret='gremory-teste-interno-12345678901234567890';
  process.env.GREMORY_BRIDGE_API_KEY=secret;
  try{
    const {db,handler}=setup();
    const discordId='123456789012345678';
    db.storage.set('discordLinksByDiscord/'+discordId,{uid:'alice'});
    const h={authorization:'Bearer '+secret};
    let result=await request(handler,{action:'premium_checkout',discordId,plan:'30'},h);
    assert.equal(result.status,409);
    db.storage.set('charlottePrivate/alice/whatsappJid','5511999999999@s.whatsapp.net');
    assert.equal(db.storage.has('discordCheckoutThrottle/'+discordId),false,'falha de vínculo não deve consumir o cooldown');
    result=await request(handler,{action:'premium_checkout',discordId,plan:'30'},h);
    assert.equal(result.status,200);
    assert.ok(result.body.jobId);
    const job=db.storage.get('siteBridgeJobs/alice/'+result.body.jobId);
    assert.deepEqual({type:job.type,plan:job.plan,origin:job.origin},{type:'premium_checkout',plan:'30',origin:'discord'});
    const waiting=await request(handler,{action:'premium_checkout_status',discordId,jobId:result.body.jobId},h);
    assert.deepEqual(waiting.body,{pending:true});
    db.storage.set('siteBridgeResults/alice/'+result.body.jobId,{ok:true,checkoutUrl:'https://www.mercadopago.com.br/checkout/v1/redirect'});
    const ready=await request(handler,{action:'premium_checkout_status',discordId,jobId:result.body.jobId},h);
    assert.equal(ready.body.pending,false);
    assert.match(ready.body.checkoutUrl,/mercadopago/);
  }finally{
    if(previous===undefined)delete process.env.GREMORY_BRIDGE_API_KEY;
    else process.env.GREMORY_BRIDGE_API_KEY=previous;
  }
});

test('Concurrent Discord link confirmations reserve one account without orphaning the other identity',async()=>{
 const previous=process.env.GREMORY_BRIDGE_API_KEY;process.env.GREMORY_BRIDGE_API_KEY='test-secret-for-concurrency-123456789012345';
 try{
  const {db,handler}=setup(),header={authorization:'Bearer '+process.env.GREMORY_BRIDGE_API_KEY};
  const ids=['111111111111111111','222222222222222222'];
  const issued=await Promise.all(ids.map(discordId=>request(handler,{action:'request_link',discordId},header)));
  const replies=await Promise.all(issued.map(r=>request(handler,{action:'confirm_link',code:r.body.code,idToken:'alice-token'})));
  assert.deepEqual(replies.map(r=>r.status).sort(),[200,409]);
  const winner=db.storage.get('discordLinksByUid/alice').discordId,loser=ids.find(id=>id!==winner);
  assert.equal(db.storage.get('discordLinksByDiscord/'+winner).uid,'alice');
  assert.equal(db.storage.has('discordLinksByDiscord/'+loser),false);
 }finally{if(previous===undefined)delete process.env.GREMORY_BRIDGE_API_KEY;else process.env.GREMORY_BRIDGE_API_KEY=previous;}
});

test('Vercel parsed request bodies are supported, unauthenticated bot calls rejected before Admin initialization',async()=>{
 const previous=process.env.GREMORY_BRIDGE_API_KEY;process.env.GREMORY_BRIDGE_API_KEY='test-secret-for-request-1234567890123456789';
 try{
  const {handler}=setup();let payload;
  const req={method:'POST',headers:{authorization:'Bearer '+process.env.GREMORY_BRIDGE_API_KEY},body:{action:'status',discordId:'123456789012345678'}};
  const res={setHeader(){},end(v){payload=JSON.parse(v)}};
  await handler(req,res);assert.equal(res.statusCode,200);assert.equal(payload.linked,false);
  const denied=await request(handler,{action:'status',discordId:'123456789012345678'});assert.equal(denied.status,401);
 }finally{if(previous===undefined)delete process.env.GREMORY_BRIDGE_API_KEY;else process.env.GREMORY_BRIDGE_API_KEY=previous;}
});
