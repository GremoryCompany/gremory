'use strict';
// Catálogo fixo no servidor. O navegador só informa o identificador do produto.
const crypto = require('node:crypto');
const PRODUCTS = Object.freeze({
  premium_3m: Object.freeze({id:'premium_3m',kind:'premium',title:'Degustação Premium · 3 minutos',price:50,minutes:3,trial:true,group:false}),
  premium_1d: Object.freeze({id:'premium_1d',kind:'premium',title:'Premium · 1 dia',price:25000,minutes:1440,group:false}),
  premium_3d: Object.freeze({id:'premium_3d',kind:'premium',title:'Premium · 3 dias',price:85000,minutes:4320,group:false}),
  premium_7d: Object.freeze({id:'premium_7d',kind:'premium',title:'Premium · 7 dias',price:200000,minutes:10080,group:true}),
  premium_15d: Object.freeze({id:'premium_15d',kind:'premium',title:'Premium · 15 dias',price:390000,minutes:21600,group:true}),
  premium_30d: Object.freeze({id:'premium_30d',kind:'premium',title:'Premium · 30 dias',price:700000,minutes:43200,group:true}),
  premium_50d: Object.freeze({id:'premium_50d',kind:'premium',title:'Premium · 50 dias',price:1000000,minutes:72000,group:true}),
  xp_300: Object.freeze({id:'xp_300',kind:'xp',title:'Pacote de 300 XP',price:30000,xp:300,group:false}),
  xp_1000: Object.freeze({id:'xp_1000',kind:'xp',title:'Pacote de 1.000 XP',price:90000,xp:1000,group:false})
});
const CODE_REGEX=/^GREM-(?:[A-F0-9]{8}-){3}[A-F0-9]{8}$/;
function productById(id){return PRODUCTS[String(id||'premium_7d')]||null}
function normalizeCode(code){return String(code||'').trim().toUpperCase().replace(/\s+/g,'')}
function giftHash(code){return crypto.createHash('sha256').update(normalizeCode(code)).digest('hex')}
function issueCode(){const h=crypto.randomBytes(16).toString('hex').toUpperCase();return `GREM-${h.match(/.{8}/g).join('-')}`}
function giftPublicProduct(product){return {id:product.id,kind:product.kind,title:product.title,price:product.price,minutes:product.minutes||0,xp:product.xp||0,group:!!product.group,trial:!!product.trial}}
module.exports={PRODUCTS,productById,CODE_REGEX,normalizeCode,giftHash,issueCode,giftPublicProduct};
