const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const moduleOf=file=>import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(path.join(__dirname,'../assets/js',file),'utf8')).toString('base64'));
function fixture(request){const handlers=new Map(),statuses=[];const doc={visibilityState:'visible',addEventListener:(e,fn)=>handlers.set(e,fn),removeEventListener:e=>handlers.delete(e)};return{doc,statuses,handlers,args:{navigator:{wakeLock:{request}},document:doc,onStatus:s=>statuses.push(s)}};}
test('screen lock acquired once, released on room exit, reacquired after visibility returns',async()=>{
 const {createScreenAwake}=await moduleOf('watch-device.js');let requests=0,releases=0;
 const f=fixture(async()=>{requests++;return{released:false,addEventListener(){},async release(){this.released=true;releases++}}}),c=createScreenAwake(f.args);
 await c.setActive(true);await c.setActive(true);assert.equal(requests,1);assert.equal(f.statuses.at(-1),'on');
 f.doc.visibilityState='hidden';await f.handlers.get('visibilitychange')();await c.retry();assert.equal(releases,1);
 f.doc.visibilityState='visible';await c.retry();assert.equal(requests,2);await c.setActive(false);assert.equal(releases,2);
 await c.destroy();assert.equal(f.handlers.size,0);
});
test('late lock resolution cannot retain screen after leaving or opting out',async()=>{
 const {createScreenAwake}=await moduleOf('watch-device.js');let resolve,releases=0;
 const f=fixture(()=>new Promise(r=>resolve=r)),c=createScreenAwake(f.args),pending=c.setActive(true);
 await c.setEnabled(false);resolve({addEventListener(){},async release(){releases++}});await pending;assert.equal(releases,1);
});
test('unsupported/denied screen locks do not reject room startup; audio modes follow capture',async()=>{
 const {createScreenAwake,setAudioMode}=await moduleOf('watch-device.js');const f=fixture(async()=>{throw Error('denied')});
 await createScreenAwake(f.args).setActive(true);assert.equal(f.statuses.at(-1),'denied');
 delete f.args.navigator.wakeLock;await createScreenAwake(f.args).setActive(true);assert.equal(f.statuses.at(-1),'unsupported');
 const nav={audioSession:{}};setAudioMode(nav,true);assert.equal(nav.audioSession.type,'play-and-record');setAudioMode(nav,false);assert.equal(nav.audioSession.type,'playback');setAudioMode({},false);
});
test('microphone switching restores existing senders on failure and stops only new capture',async()=>{
 const {replaceMicrophone}=await moduleOf('watch-device.js');let oldStopped=false,newStopped=false;const old={},fresh={stop(){newStopped=true}};
 const stream={getAudioTracks:()=>[fresh],getTracks:()=>[fresh]};const a={track:old,async replaceTrack(t){this.track=t}},b={track:old,async replaceTrack(t){if(t===fresh)throw Error('sender closed')}};
 await assert.rejects(()=>replaceMicrophone({mediaDevices:{getUserMedia:async()=>stream},peers:[a,b],previous:{getTracks:()=>[{stop(){oldStopped=true}}]},constraints:{},commit:async()=>{}}));
 assert.equal(a.track,old);assert.equal(newStopped,true);assert.equal(oldStopped,false);
});
test('microphone switching commits new track before releasing the old capture',async()=>{
 const {replaceMicrophone}=await moduleOf('watch-device.js');let stopped=false,committed=false;const fresh={},stream={getAudioTracks:()=>[fresh],getTracks:()=>[fresh]},sender={async replaceTrack(t){assert.equal(t,fresh);assert.equal(t.enabled,false)}};
 await replaceMicrophone({mediaDevices:{getUserMedia:async()=>stream},peers:[sender],enabled:false,previous:{getTracks:()=>[{stop(){assert.equal(committed,true);stopped=true}}]},constraints:{},commit:async()=>{assert.equal(stopped,false);committed=true}});assert.equal(stopped,true);
});
test('public profile details are bounded and links reject executable schemes and credentials',async()=>{
 const {profileDetails,safeProfileUrl}=await moduleOf('profile-details.js');assert.equal(safeProfileUrl('javascript:alert(1)'),'');assert.equal(safeProfileUrl('https://user:password@example.org/'),'');assert.equal(safeProfileUrl('https://example.org/'),'https://example.org/');
 const d=profileDetails({favoriteGame:'x'.repeat(100),accent:'red',website:'data:text/html,abc',balance:999});assert.equal(d.favoriteGame.length,80);assert.equal(d.accent,'violet');assert.equal(d.website,'');assert.equal(d.balance,undefined);
});
test('a pending lock from an old visibility cycle is discarded and reacquired for the current room',async()=>{
 const {createScreenAwake}=await moduleOf('watch-device.js');let resolve,requests=0,releases=0;
 const lock=()=>({released:false,addEventListener(){},async release(){this.released=true;releases++}});
 const f=fixture(()=>{requests++;return requests===1?new Promise(r=>resolve=r):Promise.resolve(lock())}),c=createScreenAwake(f.args);
 const first=c.setActive(true);await c.setActive(false);const current=c.setActive(true);resolve(lock());await Promise.all([first,current]);await c.retry();assert.equal(requests,2);assert.equal(releases,1);assert.equal(f.statuses.at(-1),'on');await c.destroy();
});
