'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {PRODUCTS,productById,CODE_REGEX,normalizeCode,giftHash,issueCode,giftPublicProduct}=require('../database/gremory_gift_catalog');
test('catálogo Premium e XP possui valores fixos e bounded no servidor',()=>{
 assert.equal(Object.keys(PRODUCTS).length,9);
 assert.equal(PRODUCTS.premium_7d.price,200000);
 assert.equal(PRODUCTS.premium_50d.minutes,50*1440);
 assert.equal(PRODUCTS.premium_3m.price,50);
 assert.equal(PRODUCTS.premium_3m.trial,true);
 assert.equal(PRODUCTS.xp_300.price,30000);
 assert.equal(PRODUCTS.xp_300.xp,300);
 assert.equal(productById('__invalid__'),null);
 assert.equal(productById('').id,'premium_7d');
 for(const p of Object.values(PRODUCTS)){
  assert.equal(Number.isSafeInteger(p.price)&&p.price>0,true);
  assert.equal(!!(p.minutes||p.xp),true);
  assert.equal(giftPublicProduct(p).price,p.price);
 }
});
test('códigos aleatórios e hashes seguros, normalização compatível',()=>{
 const codes=new Set(Array.from({length:120},issueCode));
 assert.equal(codes.size,120);
 for(const code of codes){assert.ok(CODE_REGEX.test(code));assert.equal(giftHash(code),giftHash(`  ${code.toLowerCase()}  `));}
 assert.equal(CODE_REGEX.test('GREM-00000000-00000000-00000000-00000000'),true);
 assert.equal(CODE_REGEX.test('GREM-INVENTADO'),false);
 assert.equal(normalizeCode(' grem-aaaaaaa1-bbbbbbb2-ccccccc3-ddddddd4 '),'GREM-AAAAAAA1-BBBBBBB2-CCCCCCC3-DDDDDDD4');
});
