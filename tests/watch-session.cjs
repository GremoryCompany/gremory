const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../assets/js/app.js'),'utf8');
const code=source.slice(source.indexOf('let watchRtcSessionPending=null;'),source.indexOf('let watchVoiceJoinPending=null;'))+'\n({ensureWatchRtcSession})';
function fixture(){let resolve,enteredResolve,writes=0,removed=0;const entered=new Promise(r=>enteredResolve=r);const state={user:{uid:'alice'},watchCode:'ROOM',watchRtc:{joined:false}};const gate=new Promise(r=>resolve=r);const f=vm.runInNewContext(code,{state,db:{},ref:(_db,p)=>p,loadRtcConfig:async()=>{},set:async()=>{writes++;enteredResolve();await gate},remove:async()=>{removed++},displayName:()=>'',avatarFor:()=>'',onDisconnect:()=>({remove:async()=>{}}),watchWatchRtcInbox(){},watchWatchPresence(){},setWatchRtcStatus(){},watchVoiceUi(){},toast(){},permissionMessage:()=>''});return{state,f,entered,release:()=>resolve(),get writes(){return writes},get removed(){return removed}}}
test('simultaneous room startup and voice entry wait for one confirmed presence instead of resetting audio later',async()=>{
 const x=fixture(),a=x.f.ensureWatchRtcSession(),b=x.f.ensureWatchRtcSession();await x.entered;assert.equal(x.state.watchRtc.joined,false);assert.equal(x.writes,1);x.release();assert.deepEqual(await Promise.all([a,b]),[true,true]);assert.equal(x.state.watchRtc.joined,true);assert.equal(x.writes,1);
});
test('leaving a room during presence initialization never reactivates its old session',async()=>{
 const x=fixture(),pending=x.f.ensureWatchRtcSession();await x.entered;x.state.watchCode=null;x.state.watchRtc.signalEpoch=1;x.release();assert.equal(await pending,false);assert.equal(x.state.watchRtc.joined,false);assert.equal(x.removed,1);
});
