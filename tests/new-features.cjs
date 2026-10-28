'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
test('Studio offers real local tools without opening Firebase wallet writes',()=>{
 const html=read('index.html'), js=read('assets/js/gremory-tools.js');
 for (const x of ['gtoolsCompressBtn','gtoolsStickerBtn','gtoolsThumbBtn']) assert.match(html, new RegExp(x));
 assert.match(js,/canvas\.toBlob/);assert.doesNotMatch(js,/fetch\(/);
 assert.doesNotMatch(js,/(?:database\(\)|siteWallets|siteBridgeJobs)/);
});
test('Race winner remains backend result, sprites are colored SVG',()=>{
 const js=read('assets/js/app.js');
 assert.match(js,/raceWinner/); assert.match(js,/SITE_SPRITES/);
 assert.match(js,/--race-color/);assert.match(js,/bridgeRequest\('site_progress'/);
});
test('PWA cache includes new tools and offline assets',()=>{
 const sw=read('sw.js');assert.match(sw,/gremory-tools\.js/);assert.match(sw,/gremory-tools\.css/);
});
