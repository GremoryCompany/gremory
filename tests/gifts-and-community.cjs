const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(base,f),'utf8');
const rules=JSON.parse(read('firebase.rules.production.json')).rules;
const html=read('index.html'),ui=read('assets/js/app.js'),bridge=read('database/gremory_site_bridge.js'),community=read('assets/js/community.js');

test('Gift cards: regras mantêm códigos globais inacessíveis e inbox privativa',()=>{
 for(const key of ['siteGiftOrders','siteGiftCards']){assert.equal(rules[key]['.read'],false);assert.equal(rules[key]['.write'],false)}
 assert.match(rules.siteGiftInbox.$uid['.read'],/auth\.uid === \$uid/);
 assert.equal(rules.siteGiftInbox.$uid['.write'],false);
 assert.match(rules.siteBridgeJobs.$uid.$jobId['.validate'],/gift_card_buy/);
 assert.match(rules.siteBridgeJobs.$uid.$jobId['.validate'],/gift_card_redeem/);
 assert.match(rules.siteBridgeJobs.$uid.$jobId['.validate'],/!newData\.child\('price'\)\.exists\(\)/);
});
test('Gift cards: prêmio/valor e criação de código só no bridge',()=>{
 assert.match(bridge,/const GIFT_PRICE=200000, GIFT_DAYS=7/);
 assert.match(bridge,/crypto\.randomBytes\(16\)/);
 assert.match(bridge,/applySiteWalletEntry\(uid,jid,operationId,-GIFT_PRICE/);
 assert.match(bridge,/siteGiftCards\/\$\{order\.hash\}/);
 assert.match(bridge,/status:'claiming'/);
 assert.match(bridge,/status:'redeemed'/);
 assert.match(bridge,/withExclusiveKeys\(walletLocks,\['gift:'/);
 assert.doesNotMatch(ui,/set\(ref\(db,`siteGiftCards/);
 assert.match(ui,/bridgeRequest\('gift_card_buy',\{\}/);
});
test('Novo menu usa rotas reais e e-mail verificado pelo Firebase Auth',()=>{
 for(const id of ['giftBuyBtn','giftInbox','giftRedeemForm','accountVerifyEmailBtn','feedDiscoverQuery','gtoolsLibraryList','gtoolsConvertBtn','gtoolsCollageBtn'])assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(ui,/giftshop:\['LOJA','Gift Cards'\]/);
 assert.match(ui,/sendEmailVerification\(auth\.currentUser\)/);
});
test('Grémorium: posts salvos são privados e posts públicos não viram carteira',()=>{
 assert.match(rules.communitySaved.$uid['.read'],/auth\.uid === \$uid/);
 assert.match(rules.communitySaved.$uid.$postId['.write'],/communityPosts/);
 assert.match(community,/communitySaved\/\$\{getUser\(\)\.uid\}/);
 assert.match(community,/function renderDiscover/);
 assert.match(community,/function richCaption/);
 assert.equal(rules.siteWallets.$uid['.write'],false);
});

test('Gift jobs: regras aceitam compra sem preço cliente e resgate com formato correto',()=>{
 class Snap{constructor(v){this.v=v}child(k){return new Snap(this.v?.[k])}exists(){return this.v!==undefined&&this.v!==null}val(){return this.v??null}isString(){return typeof this.v==='string'}isNumber(){return typeof this.v==='number'}}
 const expression=rules.siteBridgeJobs.$uid.$jobId['.validate'];
 const fn=new Function('newData','auth','$jobId',`return !!(${expression.replaceAll('.matches(','.match(')})`);
 const auth={uid:'alice',token:{email:'alice@example.test',email_verified:true}};
 const valid=(data)=>fn(new Snap(data),auth,'job_new_test');
 assert.equal(valid({type:'gift_card_buy',createdAt:Date.now()}),true);
 assert.equal(valid({type:'gift_card_buy',price:1}),false);
 const code='GREM-AAAAAAAA-BBBBBBBB-CCCCCCCC-DDDDDDDD';
 assert.equal(valid({type:'gift_card_redeem',code}),true);
 assert.equal(valid({type:'gift_card_redeem',code:'FALSO'}),false);
 assert.equal(valid({type:'gift_card_redeem',code,price:200000}),false);
});
