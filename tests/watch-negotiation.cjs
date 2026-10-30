const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../assets/js/app.js'),'utf8');
const code=source.slice(source.indexOf('async function bindWatchVoiceSender('),source.indexOf('async function flushWatchCandidates('))+'\n({bindWatchVoiceSender,createWatchPeer})';
test('answerer uses the offered audio transceiver in sendrecv mode instead of creating an unassociated sender',async()=>{
 let added=0;const track={readyState:'live'},stream={getAudioTracks:()=>[track]},transceivers=[];
 class Peer{constructor(){this.signalingState='stable'}getTransceivers(){return transceivers}addTransceiver(){added++;throw Error('Must not create an extra transceiver before the offer')}}
 const state={user:{uid:'a'},watchRtc:{localStream:stream,peers:new Map(),remoteVoiceStreams:new Map(),remoteScreenStreams:new Map(),remoteStreams:new Map()}};
 const f=vm.runInNewContext(code,{state,RTCPeerConnection:Peer,RTC_CONFIG:{},MediaStream:class{},ensureWatchCallCard(){}});
 const pc=await f.createWatchPeer('b',false);assert.equal(added,0);
 let replaced;const sender={async replaceTrack(t){replaced=t},setStreams(s){assert.equal(s,stream)}};
 const offered={mid:'0',receiver:{track:{kind:'audio'}},sender,direction:'recvonly'};transceivers.push(offered);
 await f.bindWatchVoiceSender(pc,false);assert.equal(offered.direction,'sendrecv');assert.equal(replaced,track);assert.equal(pc.__watchVoiceAudioSender,sender);assert.equal(added,0);
});
