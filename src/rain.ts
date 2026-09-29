import * as THREE from 'three';

const W = 1024;
const H = 580;

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function makeCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  return canvas;
}

export function createRainWindow() {
  const random = rng(71831);
  const background = new THREE.TextureLoader().load('/textures/rainy-exterior.webp');
  background.colorSpace = THREE.SRGBColorSpace;
  background.anisotropy = 4;

  const wetCanvas = makeCanvas();
  const wet = wetCanvas.getContext('2d')!;
  const glass = new THREE.CanvasTexture(wetCanvas);
  glass.colorSpace = THREE.SRGBColorSpace;
  const drops = Array.from({ length: 180 }, () => ({
    x: random() * W, y: random() * H, size: .65 + random() * 2.3,
    speed: 8 + random() * 26, trail: 10 + random() * 58,
  }));
  const distantRain = Array.from({ length: 190 }, () => ({
    x: random() * W, y: random() * H, length: 18 + random() * 45,
    speed: 160 + random() * 220, alpha: .025 + random() * .05,
  }));
  const fineDrops = Array.from({ length: 470 }, () => ({
    x: random() * W, y: random() * H, r: .25 + random() * .7,
  }));
  let last = -1;
  function update(time: number) {
    if (time - last < 1 / 24) return;
    last = time;
    wet.clearRect(0, 0, W, H);
    // Fine rain outside the pane falls diagonally; heavy beads travel on it.
    wet.lineCap = 'round';
    wet.fillStyle = 'rgba(222,241,239,.17)';
    for (const bead of fineDrops) {
      wet.beginPath(); wet.arc(bead.x, bead.y, bead.r, 0, Math.PI * 2); wet.fill();
    }
    for (const streak of distantRain) {
      const y = (streak.y + time * streak.speed) % (H + 70) - 35;
      wet.strokeStyle = `rgba(207,231,236,${streak.alpha})`;
      wet.lineWidth = .8;
      wet.beginPath(); wet.moveTo(streak.x, y); wet.lineTo(streak.x - streak.length * .32, y + streak.length); wet.stroke();
    }
    for (const drop of drops) {
      const y = (drop.y + time * drop.speed) % (H + 90) - 45;
      const x = drop.x + Math.sin(time * .5 + drop.x) * 1.2;
      wet.strokeStyle = 'rgba(10,31,39,.18)';
      wet.lineWidth = drop.size * 1.25;
      wet.beginPath(); wet.moveTo(x + .8, y - drop.trail); wet.quadraticCurveTo(x - 1.8, y - drop.trail * .4, x, y); wet.stroke();
      wet.strokeStyle = 'rgba(220,242,241,.29)';
      wet.lineWidth = Math.max(.45, drop.size * .33);
      wet.beginPath(); wet.moveTo(x - drop.size, y - drop.trail * .8); wet.lineTo(x - drop.size, y - drop.size); wet.stroke();
      wet.fillStyle = 'rgba(209,238,238,.33)';
      wet.beginPath(); wet.ellipse(x, y, drop.size, drop.size * 1.35, -.18, 0, Math.PI * 2); wet.fill();
      wet.fillStyle = 'rgba(25,57,61,.15)';
      wet.beginPath(); wet.ellipse(x + drop.size * .38, y + .25, drop.size * .5, drop.size * .8, 0, 0, Math.PI * 2); wet.fill();
    }
    glass.needsUpdate = true;
  }
  update(0);
  return { background, glass, update };
}
