'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const rules=require('../firebase.rules.production.json').rules;

test('regras de vínculo Discord proíbem criação fraudulenta pelo navegador',()=>{
  for(const key of ['discordLinkCodes','discordLinkThrottle','discordLinksByDiscord','discordCheckoutThrottle']){
    assert.equal(rules[key]?.['.read'],false,key+' deveria ser privado');
    assert.equal(rules[key]?.['.write'],false,key+' não pode ser editado pelo cliente');
  }
  assert.equal(rules.discordLinksByUid.$uid['.write'],false);
  assert.equal(rules.discordLinksByUid.$uid['.read'],'auth != null && auth.uid === $uid');
});

test('proteção financeira e caminhos anteriores preservados',()=>{
  assert.equal(rules['.read'],false);
  assert.equal(rules['.write'],false);
  assert.equal(rules.siteWallets.$uid['.write'],false);
  assert.equal(rules.charlottePrivate['.read'],false);
  assert.equal(rules.charlottePrivate['.write'],false);
  assert.equal(rules.siteGiftCards['.write'],false);
  assert.equal(rules.siteAdminAudit['.write'],false);
  for(const key of ['watchVoice','watchRtc','watchRooms','siteBridgeJobs','communityPosts','siteGiftOrders','siteGiftInbox']){
    assert.ok(rules[key],`Não remover caminho legítimo: ${key}`);
  }
});
