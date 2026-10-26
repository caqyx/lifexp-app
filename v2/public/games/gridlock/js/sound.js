// [MODULE] Synthetic Web Audio - every game and UI sound.
// [MODULE] Split out of cube_master.js - lines moved verbatim, no logic changed.
// [MODULE] Load order matters: see the script tags at the bottom of index.html.
// ══════════════════════════════════════════════════
// SOUND (Web Audio API — synthetic)
// ══════════════════════════════════════════════════
let audioCtx = null;
function getAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)();
  return audioCtx;
}

// [2.0-sdk] Mute everything for the duration of an ad. Every sound connects straight to
// ac.destination — there is no master gain node — so suspending the whole context is the
// one non-invasive way to silence them all.
// Deliberately does NOT call getAudio(): that CONSTRUCTS a context when none exists, so
// muting before the first sound ever played would create one purely to suspend it (and
// browsers block construction before a user gesture anyway). No context = nothing to mute.
function _cgMuteAudio(mute) {
  if (!audioCtx) return;
  try {
    if (mute && audioCtx.state === 'running') audioCtx.suspend();
    else if (!mute && audioCtx.state === 'suspended') audioCtx.resume();
  } catch (e) {}
}

// [1.9.2] Dispatcher — all existing call sites unchanged
function playSound(type) {
  if      (type==='dash')         playDash();
  else if (type==='laser_charge') playRoundStart();
  else if (type==='laser_fire')   playLaserFire();
  else if (type==='coin')         playCoin();
  else if (type==='die')          playDeath();
  else if (type==='near_miss')    playNearMiss();
  else if (type==='click')        playUISound('click');
}

function playDash() { // [1.9.2]
  try {
    const ac=getAudio(), now=ac.currentTime;
    const o=ac.createOscillator(), g=ac.createGain();
    o.type='sine';
    o.frequency.setValueAtTime(150,now); o.frequency.exponentialRampToValueAtTime(1000,now+0.1);
    g.gain.setValueAtTime(0.14,now); g.gain.exponentialRampToValueAtTime(0.001,now+0.13);
    o.connect(g); g.connect(ac.destination); o.start(); o.stop(now+0.13);
    const buf=ac.createBuffer(1,Math.floor(ac.sampleRate*0.09),ac.sampleRate);
    const d=buf.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*(1-i/d.length);
    const src=ac.createBufferSource(), f=ac.createBiquadFilter(), g2=ac.createGain();
    f.type='highpass'; f.frequency.value=2200; src.buffer=buf; g2.gain.value=0.1;
    src.connect(f); f.connect(g2); g2.connect(ac.destination); src.start(); src.stop(now+0.09);
  } catch(e){}
}

function playRoundStart() { // [1.9.2]
  try {
    const ac=getAudio(), now=ac.currentTime;
    const o=ac.createOscillator(), f=ac.createBiquadFilter(), g=ac.createGain();
    f.type='bandpass'; f.frequency.value=600; f.Q.value=3; o.type='sawtooth';
    o.frequency.setValueAtTime(40,now); o.frequency.exponentialRampToValueAtTime(220,now+0.48);
    g.gain.setValueAtTime(0.03,now); g.gain.linearRampToValueAtTime(0.12,now+0.42);
    g.gain.exponentialRampToValueAtTime(0.001,now+0.55);
    o.connect(f); f.connect(g); g.connect(ac.destination); o.start(); o.stop(now+0.55);
    const buf=ac.createBuffer(1,Math.floor(ac.sampleRate*0.42),ac.sampleRate);
    const dd=buf.getChannelData(0);
    for(let i=0;i<dd.length;i++) dd[i]=(Math.random()*2-1)*0.04*(i/dd.length);
    const src=ac.createBufferSource(), f2=ac.createBiquadFilter(), g2=ac.createGain();
    f2.type='highpass'; f2.frequency.value=3500; g2.gain.value=0.9; src.buffer=buf;
    src.connect(f2); f2.connect(g2); g2.connect(ac.destination); src.start(); src.stop(now+0.42);
  } catch(e){}
}

function playLaserFire() { // [1.9.2]
  try {
    const ac=getAudio(), now=ac.currentTime;
    const buf=ac.createBuffer(1,Math.floor(ac.sampleRate*0.14),ac.sampleRate);
    const d=buf.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,1.5);
    const src=ac.createBufferSource(), f=ac.createBiquadFilter(), g=ac.createGain();
    f.type='bandpass'; f.frequency.value=1800; f.Q.value=0.8; src.buffer=buf;
    g.gain.setValueAtTime(0.6,now); g.gain.exponentialRampToValueAtTime(0.001,now+0.14);
    src.connect(f); f.connect(g); g.connect(ac.destination); src.start(); src.stop(now+0.14);
    const o=ac.createOscillator(), g2=ac.createGain();
    o.type='sine'; o.frequency.setValueAtTime(3000,now); o.frequency.exponentialRampToValueAtTime(400,now+0.08);
    g2.gain.setValueAtTime(0.18,now); g2.gain.exponentialRampToValueAtTime(0.001,now+0.1);
    o.connect(g2); g2.connect(ac.destination); o.start(); o.stop(now+0.1);
  } catch(e){}
}

function playCoin() { // [1.9.2]
  try {
    const ac=getAudio(), now=ac.currentTime;
    [[880,0.22,0],[1760,0.09,0.01],[2640,0.04,0.018]].forEach(([freq,vol,delay])=>{
      const o=ac.createOscillator(), g=ac.createGain();
      o.type='sine'; o.frequency.value=freq;
      g.gain.setValueAtTime(vol,now+delay); g.gain.exponentialRampToValueAtTime(0.001,now+delay+0.38);
      o.connect(g); g.connect(ac.destination); o.start(now+delay); o.stop(now+delay+0.38);
    });
  } catch(e){}
}

function playDeath() { // [1.9.2]
  try {
    const ac=getAudio(), now=ac.currentTime;
    const o1=ac.createOscillator(), g1=ac.createGain();
    o1.type='sine'; o1.frequency.setValueAtTime(90,now); o1.frequency.exponentialRampToValueAtTime(18,now+0.35);
    g1.gain.setValueAtTime(0.7,now); g1.gain.exponentialRampToValueAtTime(0.001,now+0.4);
    o1.connect(g1); g1.connect(ac.destination); o1.start(); o1.stop(now+0.4);
    const buf=ac.createBuffer(1,Math.floor(ac.sampleRate*0.65),ac.sampleRate);
    const d=buf.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,2);
    const src=ac.createBufferSource(), f=ac.createBiquadFilter(), g2=ac.createGain();
    f.type='lowpass'; f.frequency.value=700; src.buffer=buf;
    g2.gain.setValueAtTime(0.55,now); g2.gain.exponentialRampToValueAtTime(0.001,now+0.65);
    src.connect(f); f.connect(g2); g2.connect(ac.destination); src.start(); src.stop(now+0.65);
    const o2=ac.createOscillator(), g3=ac.createGain();
    o2.type='sawtooth'; o2.frequency.setValueAtTime(1400,now); o2.frequency.exponentialRampToValueAtTime(80,now+0.45);
    g3.gain.setValueAtTime(0.22,now); g3.gain.exponentialRampToValueAtTime(0.001,now+0.48);
    o2.connect(g3); g3.connect(ac.destination); o2.start(); o2.stop(now+0.48);
  } catch(e){}
}

function playNearMiss() { // [1.9.2]
  try {
    const ac=getAudio(), now=ac.currentTime;
    [0,0.055].forEach(delay=>{
      const o=ac.createOscillator(), g=ac.createGain();
      o.type='square'; o.frequency.value=480+delay*200;
      g.gain.setValueAtTime(0.07,now+delay); g.gain.exponentialRampToValueAtTime(0.001,now+delay+0.05);
      o.connect(g); g.connect(ac.destination); o.start(now+delay); o.stop(now+delay+0.05);
    });
  } catch(e){}
}

function playCombo(level) { // [1.9.2] level: 1=x5, 2=x10, 3=x20+
  try {
    const ac=getAudio(), now=ac.currentTime;
    const seqs=[[440,550,660],[440,554,659,880,1109],[440,554,659,880,1109,1318]];
    const vols=[0.17,0.21,0.26];
    const seq=seqs[Math.min(level-1,2)], vol=vols[Math.min(level-1,2)];
    seq.forEach((freq,i)=>{
      const o=ac.createOscillator(), g=ac.createGain();
      o.type='sine'; o.frequency.value=freq; const t=now+i*0.07;
      g.gain.setValueAtTime(vol*(1-i*0.04),t); g.gain.exponentialRampToValueAtTime(0.001,t+0.32);
      o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t+0.32);
    });
    if(level>=3){
      const o=ac.createOscillator(), g=ac.createGain();
      o.type='triangle'; o.frequency.setValueAtTime(280,now); o.frequency.exponentialRampToValueAtTime(2200,now+0.55);
      g.gain.setValueAtTime(0.09,now); g.gain.exponentialRampToValueAtTime(0.001,now+0.6);
      o.connect(g); g.connect(ac.destination); o.start(); o.stop(now+0.6);
    }
  } catch(e){}
}

function playRecord() { // [1.9.2]
  try {
    const ac=getAudio(), now=ac.currentTime;
    [523,659,784,1047].forEach((freq,i)=>{
      const o=ac.createOscillator(), g=ac.createGain();
      o.type='triangle'; o.frequency.value=freq;
      const t=now+i*0.13, dur=i===3?0.55:0.13;
      g.gain.setValueAtTime(0.2,t); g.gain.setValueAtTime(0.2,t+dur*0.6);
      g.gain.exponentialRampToValueAtTime(0.001,t+dur);
      o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t+dur);
    });
  } catch(e){}
}

function playGridlockStart() { // [1.12] epic synth chord + rising sweep
  try {
    const ac=getAudio(), now=ac.currentTime;
    [[220,.18],[330,.14],[440,.11]].forEach(([freq,vol],i)=>{
      const o=ac.createOscillator(),g=ac.createGain();
      o.type='sawtooth'; o.frequency.value=freq;
      g.gain.setValueAtTime(0,now+i*.025); g.gain.linearRampToValueAtTime(vol,now+i*.025+.07);
      g.gain.exponentialRampToValueAtTime(.001,now+.82);
      o.connect(g); g.connect(ac.destination); o.start(now+i*.025); o.stop(now+.82);
    });
    const os=ac.createOscillator(),gs=ac.createGain();
    os.type='sine'; os.frequency.setValueAtTime(90,now); os.frequency.exponentialRampToValueAtTime(2600,now+.72);
    gs.gain.setValueAtTime(.13,now); gs.gain.exponentialRampToValueAtTime(.001,now+.78);
    os.connect(gs); gs.connect(ac.destination); os.start(now); os.stop(now+.78);
  } catch(e){}
}

function playGridlockEnd() { // [1.12] descending sweep
  try {
    const ac=getAudio(), now=ac.currentTime;
    const o=ac.createOscillator(),g=ac.createGain();
    o.type='sine'; o.frequency.setValueAtTime(1400,now); o.frequency.exponentialRampToValueAtTime(80,now+.5);
    g.gain.setValueAtTime(.16,now); g.gain.exponentialRampToValueAtTime(.001,now+.52);
    o.connect(g); g.connect(ac.destination); o.start(now); o.stop(now+.52);
  } catch(e){}
}

function playBlackHole() { // [2.0-s2] deep whoosh + low rumble, ~0.5s
  try {
    const ac=getAudio(), now=ac.currentTime;
    // deep whoosh
    const o1=ac.createOscillator(), g1=ac.createGain();
    o1.type='sine'; o1.frequency.setValueAtTime(80,now); o1.frequency.exponentialRampToValueAtTime(20,now+0.5);
    g1.gain.setValueAtTime(0.0001,now); g1.gain.exponentialRampToValueAtTime(0.18,now+0.12);
    g1.gain.exponentialRampToValueAtTime(0.001,now+0.5);
    o1.connect(g1); g1.connect(ac.destination); o1.start(now); o1.stop(now+0.52);
    // low rumble (slightly detuned)
    const o2=ac.createOscillator(), g2=ac.createGain();
    o2.type='sine'; o2.frequency.setValueAtTime(42,now); o2.detune.setValueAtTime(-8,now);
    g2.gain.setValueAtTime(0.0001,now); g2.gain.exponentialRampToValueAtTime(0.12,now+0.14);
    g2.gain.exponentialRampToValueAtTime(0.001,now+0.5);
    o2.connect(g2); g2.connect(ac.destination); o2.start(now); o2.stop(now+0.52);
  } catch(e){}
}

function playSolarFlareCharge() { // [2.0-s2] cosmic rising charge — building tension
  try {
    const ac=getAudio(), now=ac.currentTime;
    // rising shimmer (triangle sweep up)
    const o=ac.createOscillator(), f=ac.createBiquadFilter(), g=ac.createGain();
    f.type='bandpass'; f.frequency.value=900; f.Q.value=4; o.type='triangle';
    o.frequency.setValueAtTime(180,now); o.frequency.exponentialRampToValueAtTime(1300,now+0.55);
    g.gain.setValueAtTime(0.0001,now); g.gain.exponentialRampToValueAtTime(0.10,now+0.45);
    g.gain.exponentialRampToValueAtTime(0.001,now+0.6);
    o.connect(f); f.connect(g); g.connect(ac.destination); o.start(now); o.stop(now+0.6);
    // warm sub layer following the rise
    const o2=ac.createOscillator(), g2=ac.createGain();
    o2.type='sine'; o2.frequency.setValueAtTime(90,now); o2.frequency.exponentialRampToValueAtTime(330,now+0.55);
    g2.gain.setValueAtTime(0.0001,now); g2.gain.exponentialRampToValueAtTime(0.06,now+0.5);
    g2.gain.exponentialRampToValueAtTime(0.001,now+0.6);
    o2.connect(g2); g2.connect(ac.destination); o2.start(now); o2.stop(now+0.6);
  } catch(e){}
}

function playSolarFlareRelease() { // [2.0-s2] sharp warm burst as the beam fires
  try {
    const ac=getAudio(), now=ac.currentTime;
    // bright noise burst (the flash)
    const buf=ac.createBuffer(1,Math.floor(ac.sampleRate*0.18),ac.sampleRate);
    const d=buf.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,1.4);
    const src=ac.createBufferSource(), bf=ac.createBiquadFilter(), bg=ac.createGain();
    bf.type='bandpass'; bf.frequency.value=1400; bf.Q.value=0.7; src.buffer=buf;
    bg.gain.setValueAtTime(0.5,now); bg.gain.exponentialRampToValueAtTime(0.001,now+0.18);
    src.connect(bf); bf.connect(bg); bg.connect(ac.destination); src.start(now); src.stop(now+0.18);
    // warm descending body (the heat)
    const o=ac.createOscillator(), g=ac.createGain();
    o.type='sawtooth'; o.frequency.setValueAtTime(520,now); o.frequency.exponentialRampToValueAtTime(120,now+0.16);
    g.gain.setValueAtTime(0.22,now); g.gain.exponentialRampToValueAtTime(0.001,now+0.2);
    o.connect(g); g.connect(ac.destination); o.start(now); o.stop(now+0.2);
  } catch(e){}
}

function playTurretFire() { // [2.0-s4e] focused energy beam striking the boss (distinct from laser/flare)
  try {
    const ac=getAudio(), now=ac.currentTime;
    // focused descending tonal beam
    const o=ac.createOscillator(), f=ac.createBiquadFilter(), g=ac.createGain();
    f.type='bandpass'; f.frequency.value=1500; f.Q.value=6; o.type='square';
    o.frequency.setValueAtTime(1800,now); o.frequency.exponentialRampToValueAtTime(600,now+0.13);
    g.gain.setValueAtTime(0.0001,now); g.gain.exponentialRampToValueAtTime(0.18,now+0.02);
    g.gain.exponentialRampToValueAtTime(0.001,now+0.16);
    o.connect(f); f.connect(g); g.connect(ac.destination); o.start(now); o.stop(now+0.16);
    // punchy low impact (beam hitting the boss)
    const o2=ac.createOscillator(), g2=ac.createGain();
    o2.type='sine'; o2.frequency.setValueAtTime(160,now+0.06); o2.frequency.exponentialRampToValueAtTime(60,now+0.2);
    g2.gain.setValueAtTime(0.0001,now+0.06); g2.gain.exponentialRampToValueAtTime(0.26,now+0.09);
    g2.gain.exponentialRampToValueAtTime(0.001,now+0.24);
    o2.connect(g2); g2.connect(ac.destination); o2.start(now+0.06); o2.stop(now+0.26);
    // short metallic ping (focused energy)
    const o3=ac.createOscillator(), g3=ac.createGain();
    o3.type='triangle'; o3.frequency.setValueAtTime(2400,now);
    g3.gain.setValueAtTime(0.10,now); g3.gain.exponentialRampToValueAtTime(0.001,now+0.07);
    o3.connect(g3); g3.connect(ac.destination); o3.start(now); o3.stop(now+0.08);
  } catch(e){}
}

function playBossShield() { // [2.0-s4e] barrier-up shimmer — the boss is now protected
  try {
    const ac=getAudio(), now=ac.currentTime;
    const mk=(f0,f1,gain)=>{ // rising detuned sine swell
      const o=ac.createOscillator(), g=ac.createGain();
      o.type='sine'; o.frequency.setValueAtTime(f0,now); o.frequency.exponentialRampToValueAtTime(f1,now+0.4);
      g.gain.setValueAtTime(0.0001,now); g.gain.exponentialRampToValueAtTime(gain,now+0.18);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.55);
      o.connect(g); g.connect(ac.destination); o.start(now); o.stop(now+0.6);
    };
    mk(500,950,0.08); mk(752,1300,0.07);
    // high sparkle on top
    const o=ac.createOscillator(), g=ac.createGain();
    o.type='triangle'; o.frequency.setValueAtTime(1500,now); o.frequency.exponentialRampToValueAtTime(2200,now+0.35);
    g.gain.setValueAtTime(0.0001,now); g.gain.exponentialRampToValueAtTime(0.05,now+0.2);
    g.gain.exponentialRampToValueAtTime(0.001,now+0.5);
    o.connect(g); g.connect(ac.destination); o.start(now); o.stop(now+0.55);
  } catch(e){}
}

function playError() { // [1.9.2]
  try {
    const ac=getAudio(), now=ac.currentTime;
    const o=ac.createOscillator(), g=ac.createGain();
    o.type='sawtooth'; o.frequency.setValueAtTime(230,now); o.frequency.exponentialRampToValueAtTime(70,now+0.18);
    g.gain.setValueAtTime(0.14,now); g.gain.exponentialRampToValueAtTime(0.001,now+0.2);
    o.connect(g); g.connect(ac.destination); o.start(); o.stop(now+0.2);
  } catch(e){}
}

function playShopOpen() { // [1.9.2]
  try {
    const ac=getAudio(), now=ac.currentTime;
    const o=ac.createOscillator(), g=ac.createGain();
    o.type='sine'; o.frequency.setValueAtTime(180,now); o.frequency.exponentialRampToValueAtTime(700,now+0.14);
    g.gain.setValueAtTime(0.09,now); g.gain.exponentialRampToValueAtTime(0.001,now+0.18);
    o.connect(g); g.connect(ac.destination); o.start(); o.stop(now+0.18);
    const o2=ac.createOscillator(), g2=ac.createGain();
    o2.type='sine'; o2.frequency.value=1800;
    g2.gain.setValueAtTime(0.07,now+0.1); g2.gain.exponentialRampToValueAtTime(0.001,now+0.38);
    o2.connect(g2); g2.connect(ac.destination); o2.start(now+0.1); o2.stop(now+0.38);
  } catch(e){}
}

function playSkinSelect() { // [1.9.2]
  try {
    const ac=getAudio(), now=ac.currentTime;
    const o=ac.createOscillator(), g=ac.createGain();
    o.type='square'; o.frequency.setValueAtTime(900,now); o.frequency.exponentialRampToValueAtTime(450,now+0.07);
    g.gain.setValueAtTime(0.09,now); g.gain.exponentialRampToValueAtTime(0.001,now+0.09);
    o.connect(g); g.connect(ac.destination); o.start(); o.stop(now+0.09);
  } catch(e){}
}
// ── UI SOUNDS ──
function playUISound(type){ // [1.9.2] enhanced
  try {
    const ac=getAudio(), now=ac.currentTime;
    if(type==='click'){
      const o=ac.createOscillator(), g=ac.createGain();
      o.type='sine'; o.frequency.setValueAtTime(700,now); o.frequency.exponentialRampToValueAtTime(280,now+0.05);
      g.gain.setValueAtTime(0.07,now); g.gain.exponentialRampToValueAtTime(0.001,now+0.065);
      o.connect(g); g.connect(ac.destination); o.start(); o.stop(now+0.065);
    } else if(type==='tab'){
      const o=ac.createOscillator(), g=ac.createGain();
      o.type='sine'; o.frequency.setValueAtTime(220,now);
      o.frequency.exponentialRampToValueAtTime(550,now+0.08);
      o.frequency.exponentialRampToValueAtTime(380,now+0.16);
      g.gain.setValueAtTime(0.06,now); g.gain.exponentialRampToValueAtTime(0.001,now+0.19);
      o.connect(g); g.connect(ac.destination); o.start(); o.stop(now+0.19);
    } else if(type==='reward'){
      [[660,0],[990,0.1]].forEach(([freq,delay])=>{
        const o=ac.createOscillator(), g=ac.createGain();
        o.type='sine'; o.frequency.value=freq;
        g.gain.setValueAtTime(0.13,now+delay); g.gain.exponentialRampToValueAtTime(0.001,now+delay+0.28);
        o.connect(g); g.connect(ac.destination); o.start(now+delay); o.stop(now+delay+0.28);
      });
    }
  } catch(e){}
}

function playCapybaraPop() { // [2.0-capybara] cute upward "boop" — the idle easter egg popping up
  try {
    const ac=getAudio(), now=ac.currentTime;
    const o=ac.createOscillator(), g=ac.createGain();
    o.type='sine'; o.frequency.setValueAtTime(260,now); o.frequency.exponentialRampToValueAtTime(720,now+0.11);
    g.gain.setValueAtTime(0.001,now); g.gain.exponentialRampToValueAtTime(0.16,now+0.03);
    g.gain.exponentialRampToValueAtTime(0.001,now+0.22);
    o.connect(g); g.connect(ac.destination); o.start(); o.stop(now+0.22);
    // soft second voice a fifth above, slightly delayed, rounds the "boop" out
    const o2=ac.createOscillator(), g2=ac.createGain();
    o2.type='sine'; o2.frequency.setValueAtTime(390,now+0.02); o2.frequency.exponentialRampToValueAtTime(880,now+0.14);
    g2.gain.setValueAtTime(0.001,now+0.02); g2.gain.exponentialRampToValueAtTime(0.09,now+0.05);
    g2.gain.exponentialRampToValueAtTime(0.001,now+0.24);
    o2.connect(g2); g2.connect(ac.destination); o2.start(now+0.02); o2.stop(now+0.24);
  } catch(e){}
}
