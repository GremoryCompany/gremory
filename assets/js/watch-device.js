// Browser capabilities are optional: failures must never prevent joining a room.
export function createScreenAwake({navigator: nav, document: doc, onStatus = () => {}}) {
  let active = false, enabled = true, sentinel = null, pending = null, generation = 0;
  const report = value => onStatus(value);
  async function sync() {
    if (!active || !enabled || doc.visibilityState !== 'visible') {
      generation++;
      const old = sentinel; sentinel = null;
      if (old) await old.release().catch(() => {});
      report(!active || !enabled ? 'off' : 'hidden');
      return;
    }
    if (!nav.wakeLock?.request) { report('unsupported'); return; }
    if (sentinel && !sentinel.released) { report('on'); return; }
    if (pending) return pending;
    const version = generation;
    pending = (async () => {
      try {
        const lock = await nav.wakeLock.request('screen');
        if (version !== generation || !active || !enabled || doc.visibilityState !== 'visible') {
          await lock.release(); return;
        }
        sentinel = lock;
        lock.addEventListener('release', () => {
          if (sentinel === lock) { sentinel = null; report('released'); }
        }, {once: true});
        report('on');
      } catch { report('denied'); }
      finally { pending = null; if (version !== generation && active && enabled && doc.visibilityState === 'visible') void sync(); }
    })();
    return pending;
  }
  const visible = () => { void sync(); };
  doc.addEventListener('visibilitychange', visible);
  return {
    setActive(value) { active = !!value; return sync(); },
    setEnabled(value) { enabled = !!value; return sync(); },
    retry: sync,
    async destroy() { doc.removeEventListener('visibilitychange', visible); active = false; await sync(); }
  };
}

export function setAudioMode(nav, microphoneActive) {
  // Safari may otherwise keep Bluetooth in hands-free mode after capture stops.
  // Other browsers and the operating system choose their own audio route.
  try { if (nav.audioSession) nav.audioSession.type = microphoneActive ? 'play-and-record' : 'playback'; } catch {}
}

export async function replaceMicrophone({mediaDevices, peers, previous, constraints, enabled = true, commit}) {
  const stream = await mediaDevices.getUserMedia({audio: constraints, video: false});
  const track = stream.getAudioTracks()[0];
  if (!track) { stream.getTracks().forEach(t => t.stop()); throw new Error('Microfone sem faixa de áudio.'); }
  track.enabled = !!enabled;
  const replaced = [];
  try {
    for (const sender of peers) {
      const old = sender.track;
      await sender.replaceTrack(track); replaced.push([sender, old]);
    }
    await commit(stream, track);
  } catch (error) {
    await Promise.allSettled(replaced.map(([sender, old]) => sender.replaceTrack(old)));
    stream.getTracks().forEach(t => t.stop()); throw error;
  }
  previous?.getTracks().forEach(t => t.stop());
  return stream;
}
