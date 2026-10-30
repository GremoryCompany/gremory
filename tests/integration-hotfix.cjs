'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=path.join(__dirname,'..');const load=f=>fs.readFileSync(path.join(base,f),'utf8');
const ui=load('assets/js/app.js'),html=load('index.html'),storage=load('storage.rules');
const rules=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/rules-patch01-fixture.json'),'utf8')).rules;
test('Gift-card verify is allowed with read-only inputs and rejected with forged price/reward',()=>{
 const validate=rules.siteBridgeJobs.$uid.$jobId['.validate'];
 class Snap{constructor(v){this.v=v}child(k){return new Snap(this.v?.[k])}exists(){return this.v!==undefined&&this.v!==null}val(){return this.v??null}isString(){return typeof this.v==='string'}isNumber(){return typeof this.v==='number'}}
 const fn=new Function('newData','auth','$jobId',`return !!(${validate.replaceAll('.matches(','.match(')})`);
 const code='GREM-AAAAAAAA-BBBBBBBB-CCCCCCCC-DDDDDDDD',auth={uid:'alice',token:{email:'alice@example.com'}};
 assert.equal(fn(new Snap({type:'gift_card_verify',code}),auth,'test_job'),true);
 assert.equal(fn(new Snap({type:'gift_card_verify',code,price:1}),auth,'test_job'),false);
 assert.equal(fn(new Snap({type:'gift_card_verify',code,reward:123}),auth,'test_job'),false);
 assert.equal(fn(new Snap({type:'gift_card_verify',code:'invalid'}),auth,'test_job'),false);
});
test('Profile names are reserved transactionally, profile+directory written atomically',()=>{
 assert.match(ui,/runTransaction\(ref\(db,`usernames\/\$\{username\}`\)/);
 assert.match(ui,/await update\(ref\(db\),\{\[`profiles\/\$\{state\.user\.uid\}`\]:payload,\[`directory\/\$\{state\.user\.uid\}`\]:publicProfile\(payload\)\}\)/);
 assert.match(ui,/usernameOk=false;\s*if\(String\(e\?\.code/);
});
test('Avatar paths are unique and restricted to owner with content-type and size guard',()=>{
 assert.match(ui,/avatars\/\$\{state\.user\.uid\}\/profile_\$\{Date\.now\(\)\}/);
 assert.match(storage,/file\.matches\('profile_\[0-9\]\{13\}/);
 assert.match(storage,/request\.auth\.uid == uid/);
 assert.match(storage,/request\.resource\.size <= 5 \* 1024 \* 1024/);
});
test('Catálogo do site só disponibiliza produtos definidos na Charlotte atual',()=>{
 const {PRODUCTS}=require('../database/gremory_gift_catalog.js');
 const all=[...html.matchAll(/<button\b[^>]*\bdata-gift-product="([^"]+)"[^>]*>/g)];
 assert.equal(all.length,Object.keys(PRODUCTS).length);
 const seen=new Set();
 for(const [tag,sku] of all){
   assert.ok(PRODUCTS[sku],`SKU sem implementação no servidor: ${sku}`);
   assert.equal(seen.has(sku),false,`SKU duplicado no catálogo: ${sku}`);
   seen.add(sku);
   assert.doesNotMatch(tag,/\bdisabled\b/,`Produto implementado desativado: ${sku}`);
 }
 assert.match(ui,/bridgeRequest\('gift_card_verify',\{code:item\.code\}/);
});
