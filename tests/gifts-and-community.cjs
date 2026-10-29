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
test('Gift cards: valores e códigos definidos no servidor e resgate idempotente',()=>{
 const catalog=read('database/gremory_gift_catalog.js');
 assert.match(catalog,/premium_7d: Object.freeze\(\{id:'premium_7d',kind:'premium'.*price:200000/);
 assert.match(catalog,/premium_50d:/);
 assert.match(catalog,/xp_300:/);
 assert.match(bridge,/applySiteWalletEntry\(uid,jid,opId,-product.price,'gift_card'/);
 assert.match(bridge,/siteWalletOps\/\$\{uid\}\/\$\{order.operationId\}/);
 assert.match(bridge,/siteGiftInbox\/\$\{uid\}\/\$\{order.operationId\}/);
 assert.match(bridge,/gremoryGiftReceipts/);
 assert.match(bridge,/siteGiftGrants\/\$\{hash\}/);
 assert.match(bridge,/siteProgress\/\$\{uid\}/);
 assert.match(bridge,/gift_card_recover/);
 assert.doesNotMatch(ui,/set\(ref\(db,`siteGiftCards/);
 assert.match(ui,/bridgeRequest\('gift_card_buy',\{productId:sku\}/);
});
test('Menu e e-mail utilizam Auth, catálogo, correio e resgate existentes',()=>{
 for(const id of ['giftshopCatalog','giftRecoverLastBtn','giftInbox','giftRedeemForm','accountVerifyEmailBtn','feedDiscoverQuery','gtoolsLibraryList','gtoolsConvertBtn','gtoolsCollageBtn'])assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(ui,/giftshop:\['LOJA','Gift Cards'\]/);
 assert.match(ui,/sendEmailVerification\(auth\.currentUser\)/);
 assert.match(ui,/navigate\('charlotte'\)/);
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
 assert.equal(valid({type:'gift_card_buy',productId:'xp_300'}),true);
 assert.equal(valid({type:'gift_card_buy',productId:'xp_300',xp:9999999}),false);
 assert.equal(valid({type:'gift_card_buy',productId:'custom_money'}),false);
 const code='GREM-AAAAAAAA-BBBBBBBB-CCCCCCCC-DDDDDDDD';
 assert.equal(valid({type:'gift_card_redeem',code}),true);
 assert.equal(valid({type:'gift_card_redeem',code:'FALSO'}),false);
 assert.equal(valid({type:'gift_card_redeem',code,price:200000}),false);
 assert.equal(valid({type:'gift_card_redeem',code,xp:5000}),false);
 assert.equal(valid({type:'gift_card_recover'}),true);
 assert.equal(valid({type:'gift_card_recover',purchaseId:'giftbuy_'+'a'.repeat(32)}),true);
 assert.equal(valid({type:'gift_card_recover',originJobId:'giftjob_'+'a'.repeat(32)}),true);
 assert.equal(valid({type:'gift_card_recover',originJobId:'invalid'}),false);
 assert.equal(valid({type:'gift_card_recover',purchaseId:'giftbuy_'+'a'.repeat(32),code}),false);
});
