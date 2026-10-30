'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');

const walletPath=path.resolve(__dirname,'../api/site-wallet.js');
require.cache[walletPath]={id:walletPath,filename:walletPath,loaded:true,exports:{getAdmin:()=>({auth:{
  async verifyIdToken(token){if(token==='valid-user-token')return{uid:'alice'};throw new Error('negado');}
}})}};
const handler=require('../api/main.js');

async function call(token){
  const req={url:'/api/main?action=rtc_config',method:'GET',headers:token?{authorization:'Bearer '+token}:{}};
  const headers={};let response;
  const res={statusCode:200,setHeader(name,value){headers[name.toLowerCase()]=value;},end(body){response=JSON.parse(body);}};
  await handler(req,res);
  return {status:res.statusCode,headers,response};
}

test('TURN não vaza ao visitante anônimo ou com token inválido',async()=>{
  const old={url:process.env.TURN_URL,user:process.env.TURN_USERNAME,credential:process.env.TURN_CREDENTIAL};
  process.env.TURN_URL='turn:turn.gremory.example:3478';
  process.env.TURN_USERNAME='test-user';
  process.env.TURN_CREDENTIAL='segredo-que-nao-pode-vazar';
  try{
    for(const token of [undefined,'invalid-token']){
      const r=await call(token);
      assert.equal(r.status,200);
      assert.equal(r.response.turnConfigured,false);
      assert.equal(JSON.stringify(r.response).includes(process.env.TURN_CREDENTIAL),false);
      assert.equal(r.headers['cache-control'],'private, no-store');
    }
    const authorized=await call('valid-user-token');
    assert.equal(authorized.response.turnConfigured,true);
    assert.equal(authorized.response.iceServers.at(-1).credential,process.env.TURN_CREDENTIAL);
  }finally{
    for(const [key,envKey] of [['url','TURN_URL'],['user','TURN_USERNAME'],['credential','TURN_CREDENTIAL']]){
      if(old[key]===undefined)delete process.env[envKey];else process.env[envKey]=old[key];
    }
  }
});
