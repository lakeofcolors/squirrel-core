// src/utils/audio.js

const getAudioContext = () => {
  if (typeof window === "undefined") return null;
  if (!window.audioCtx) {
    window.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return window.audioCtx;
};

// Проверяет, включен ли звук в системе
function canPlay() {
  const ctx = getAudioContext();
  if (!ctx) return false;
  
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  return ctx.state === "running";
}

// Легкий щелчок / шлепок карты
export const playCardDropSound = () => {
  if (!canPlay()) return;
  const ctx = getAudioContext();
  
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(150, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.1);

  gainNode.gain.setValueAtTime(0, ctx.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.1);
};

// Звук тиканья (когда мало времени)
export const playTickSound = () => {
  if (!canPlay()) return;
  const ctx = getAudioContext();

  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();

  osc.type = "triangle";
  osc.frequency.setValueAtTime(800, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.05);

  gainNode.gain.setValueAtTime(0, ctx.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.05);
};

// Зиммеринг (твой ход)
export const playMyTurnSound = () => {
  if (!canPlay()) return;
  const ctx = getAudioContext();

  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(400, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.2);

  gainNode.gain.setValueAtTime(0, ctx.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.1);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.4);
};

// Звук раздачи новой раздачи/сдачи
export const playDealSound = () => {
  if (!canPlay()) return;
  const ctx = getAudioContext();

  let t = ctx.currentTime;
  for(let i=0; i<4; i++) {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = "square";
    osc.frequency.setValueAtTime(300 + i*50, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.05);

    gainNode.gain.setValueAtTime(0, t);
    gainNode.gain.linearRampToValueAtTime(0.1, t + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.1);

    t += 0.05;
  }
};
