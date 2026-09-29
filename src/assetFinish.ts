import * as THREE from 'three';

type Finish = 'plastic' | 'paper' | 'metal' | 'leather' | 'paint' | 'ceramic';

function makeFinish(kind: Finish) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d')!;
  const pixels = context.createImageData(size, size);
  let seed = 90210 + kind.length * 3167;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const variance = { plastic: 11, paper: 18, metal: 15, leather: 20, paint: 7, ceramic: 8 }[kind];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const broad = Math.sin(x * .06 + Math.sin(y * .07) * 2) * 2.5;
      const grain = (random() - .5) * variance;
      const brush = kind === 'metal' ? Math.sin(y * 1.7) * 3 : 0;
      const fibers = kind === 'paper' ? Math.sin(x * .37) * 2 : 0;
      const value = Math.max(206, Math.min(255, 247 + broad + grain + brush + fibers));
      pixels.data[i] = value;
      pixels.data[i + 1] = kind === 'plastic' || kind === 'paper' ? value - 2 : value;
      pixels.data[i + 2] = kind === 'plastic' || kind === 'paper' ? value - 5 : value;
      pixels.data[i + 3] = 255;
    }
  }
  context.putImageData(pixels, 0, 0);
  for (let i = 0; i < (kind === 'metal' ? 175 : kind === 'paint' ? 18 : 78); i++) {
    const x = random() * size;
    const y = random() * size;
    const length = kind === 'metal' ? 3 + random() * 23 : 1 + random() * 8;
    context.strokeStyle = kind === 'paper' ? 'rgba(99,74,46,.055)' : kind === 'paint' ? 'rgba(53,52,44,.025)' : 'rgba(53,52,44,.07)';
    context.lineWidth = .35 + random() * .6;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + (kind === 'metal' ? length : length * .3), y + (kind === 'metal' ? 0 : length));
    context.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

export function applyAssetFinish(root: THREE.Object3D) {
  const finishes = new Map<Finish, THREE.CanvasTexture>();
  const kinds: [RegExp, Finish][] = [
    [/ivory|beige|plastic|keys/i, 'plastic'],
    [/paper|printed|ink/i, 'paper'],
    [/steel|chrome|pewter/i, 'metal'],
    [/leather|rubber/i, 'leather'],
    [/telephone red|oxblood|mint|blue/i, 'paint'],
    [/ceramic|glaze/i, 'ceramic'],
  ];
  const treated = new Set<THREE.Material>();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!(material instanceof THREE.MeshStandardMaterial) || treated.has(material)) continue;
      treated.add(material);
      const kind = kinds.find(([pattern]) => pattern.test(material.name))?.[1];
      if (!kind) continue;
      if (!finishes.has(kind)) finishes.set(kind, makeFinish(kind));
      const texture = finishes.get(kind)!;
      material.map = texture;
      material.roughnessMap = texture;
      material.bumpMap = texture;
      material.bumpScale = kind === 'paper' || kind === 'leather' ? .008 : .004;
      material.needsUpdate = true;
    }
  });
}
