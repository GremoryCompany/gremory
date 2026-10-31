const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../..'),modules=process.env.FIREBASE_TEST_MODULES||path.dirname(path.dirname(require.resolve('firebase/package.json')));
let policy=JSON.parse(fs.readFileSync(repo+'/vercel.json')).headers[0].headers.find(h=>h.key==='Content-Security-Policy').value;
if(process.env.EXPECT_BLOCKED==='1')policy=policy.replace(' https://*.firebaseio.com;', ';').replace("frame-src 'self' https://*.firebaseio.com ", 'frame-src ');
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/'){res.setHeader('Content-Security-Policy',policy);res.setHeader('content-type','text/html');return res.end('<!doctype html><html><body>Firebase transport regression</body></html>');}
 try{let name=decodeURIComponent(url.pathname.slice('/sdk/'.length)),file;
 if(/^@firebase\/[^/]+$/.test(name)){const pkg=JSON.parse(fs.readFileSync(path.join(modules,name,'package.json')));file=path.join(modules,name,pkg.module)}else if(name==='idb')file=path.join(modules,'idb/build/index.js');else file=path.join(modules,name);
 let source=fs.readFileSync(file,'utf8').replace(/from (['"])(@firebase\/[^'"]+|idb)\1/g,(_,quote,pkg)=>`from '/sdk/${encodeURIComponent(pkg)}'`);
 // Resolve relative dependencies against their actual npm folder.
 source=source.replace(/from (['"])(\.\.?\/[^'"]+)\1/g,(_,quote,relative)=>`from '/sdk/${path.relative(modules,path.resolve(path.dirname(file),relative))}'`);
 res.setHeader('content-type','text/javascript');res.end(source);
 }catch(e){console.error('SDK serve',req.url,String(e));res.statusCode=404;res.end(String(e))}
});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{for(const mobile of [true,false]){
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile});const page=await context.newPage();let callbackId,packet=0,requests=0,segments=[],pending=[];const writes=[],violations=[];
 page.on('console',msg=>{if(msg.type()==='error')violations.push(msg.text())});page.on('pageerror',err=>violations.push(err.message));
 await context.route('https://*.firebaseio.com/**',async route=>{
  requests++;const url=new URL(route.request().url()),params=url.searchParams;
  if(params.get('dframe'))return route.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'});
  if(params.get('start')){callbackId=params.get('cb');const handshake={t:'c',d:{t:'h',d:{ts:Date.now(),v:'5',h:url.hostname,s:'test-session'}}};return route.fulfill({contentType:'text/javascript',body:`parent.pLPCommand${callbackId}('start','test-session','test-password');parent.pRTLPCB${callbackId}(${packet++},${JSON.stringify([handshake])});`});}
  const messages=[];
  for(let i=0;params.has('d'+i);i++){
   segments.push(params.get('d'+i));const total=Number(params.get('ts'+i));if(segments.length<total)continue;
   const encoded=segments.join('').replace(/\./g,'=').replace(/-/g,'+').replace(/_/g,'/');segments=[];const request=JSON.parse(Buffer.from(encoded,'base64').toString()),d=request.d,b=d.b;
   if(d.a==='p'){writes.push(b);messages.push({t:'d',d:{r:d.r,b:{s:'ok',d:''}}});}
   else if(d.a==='g')messages.push({t:'d',d:{r:d.r,b:{s:'ok',d:b.p.startsWith('/watchUserRooms')?{ROOM:{code:'ROOM',name:'Sala teste',role:'Host'}}:null}}});
   else if(d.a==='q'){messages.push({t:'d',d:{a:'d',b:{p:b.p,d:{status:'linked'}}}},{t:'d',d:{r:d.r,b:{s:'ok',d:''}}});}
   else messages.push({t:'d',d:{r:d.r,b:{s:'ok',d:''}}});
  }
  if(messages.length)return route.fulfill({contentType:'text/javascript',body:`parent.pRTLPCB${callbackId}(${packet++},${JSON.stringify(messages)});`});
  // Hold the receive poll open until the browser closes or another request needs it.
  pending.push(route);
 });
 await page.goto('http://127.0.0.1:'+server.address().port);
 const result=await page.evaluate(async()=>{
  const {initializeApp}=await import('/sdk/%40firebase%2Fapp'),fb=await import('/sdk/%40firebase%2Fdatabase');
  fb.forceLongPolling();const app=initializeApp({projectId:'transport-fixture',databaseURL:'https://gremory-transport-test.firebaseio.com'}),db=fb.getDatabase(app);
  const work=(async()=>{const rooms=(await fb.get(fb.ref(db,'watchUserRooms/alice'))).val();await fb.set(fb.ref(db,'charlotteLinkRequests/alice'),{uid:'alice',code:'ABCDEF'});await fb.set(fb.ref(db,'discordLinkRequests/alice'),{uid:'alice',codeHash:'a'.repeat(64)});return{rooms,ok:true}})();
  return Promise.race([work,new Promise(resolve=>setTimeout(()=>resolve({ok:false,timeout:true}),3500))]);
 });
 console.log(JSON.stringify({mobile,result,requests,writes:writes.map(w=>w.p),violations}));
 if(process.env.EXPECT_BLOCKED==='1'){assert.equal(result.ok,false);assert.ok(violations.some(s=>s.includes('script-src')))}else{assert.equal(result.ok,true);assert.equal(result.rooms.ROOM.name,'Sala teste');assert.equal(writes.length,2);assert.equal(violations.length,0)}
 await context.close();
}}finally{await browser.close();server.close()}})().catch(error=>{console.error(error);server.close();process.exitCode=1});
