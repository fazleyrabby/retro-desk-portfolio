import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createRainWindow } from './rain';

export type DeskObjectId = 'crt' | 'lamp' | 'floppy' | 'notebook' | 'window' | 'keyboard' | 'tower' | 'fan' | 'phone';

export interface DeskScene {
  scene: THREE.Scene;
  objects: Map<DeskObjectId, THREE.Group>;
  lampLight: THREE.SpotLight;
  lampBulb: THREE.Mesh;
  screenMaterial: THREE.MeshBasicMaterial;
  screenTexture: THREE.CanvasTexture;
  mug: THREE.Group;
  headphones: THREE.Group;
  update: (time: number) => void;
}

const C = {
  wall: 0x263940,
  wallTrim: 0x17272e,
  wood: 0x76513a,
  woodLight: 0x9a6b49,
  woodDark: 0x3d281f,
  cream: 0xc9c2a8,
  creamLight: 0xe0d7bd,
  creamDark: 0x8d8b7b,
  charcoal: 0x18272d,
  metal: 0x53636a,
  cyan: 0x72c5c0,
  orange: 0xf2ad67,
  paper: 0xd9d2b9,
};

function material(color: number, roughness = .85, metalness = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function box(parent: THREE.Object3D, size: [number, number, number], at: [number, number, number], color: number, radius = .035, roughness = .85, metalness = 0) {
  const geometry = radius ? new RoundedBoxGeometry(...size, 3, Math.min(radius, ...size.map(n => n / 4))) : new THREE.BoxGeometry(...size);
  const mesh = new THREE.Mesh(geometry, material(color, roughness, metalness));
  mesh.position.set(...at);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function cylinder(parent: THREE.Object3D, radiusTop: number, radiusBottom: number, height: number, at: [number, number, number], color: number, sides = 20, rotation?: [number, number, number]) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, sides), material(color, .65, color === C.metal ? .45 : 0));
  mesh.position.set(...at);
  if (rotation) mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function label(text: string, width: number, height: number, background: string, foreground: string, font = 'bold 72px monospace') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = Math.max(128, Math.round(512 * height / width));
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = foreground;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2, canvas.width - 34);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, transparent: true }));
  return mesh;
}

function cable(parent: THREE.Object3D, points: [number, number, number][], radius = .018, color = 0x222b2c) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 28, radius, 6, false), material(color, .65));
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function tag(group: THREE.Group, id: DeskObjectId) {
  group.userData.interactiveId = id;
  return group;
}

function buildScreenTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 768;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createLinearGradient(0, 0, 1024, 768);
  gradient.addColorStop(0, '#164e63');
  gradient.addColorStop(.55, '#1b6c78');
  gradient.addColorStop(1, '#0d344c');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1024, 768);
  ctx.strokeStyle = 'rgba(205,245,227,.14)';
  for (let y = 0; y < 768; y += 5) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1024, y); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(239,249,220,.88)';
  ctx.font = 'bold 76px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('FAZLEY OS', 512, 320);
  ctx.fillStyle = 'rgba(223,240,221,.65)';
  ctx.font = '26px monospace';
  ctx.fillText('personal workspace', 512, 377);
  ctx.fillStyle = '#f1bb7d';
  ctx.fillRect(466, 438, 92, 5);
  ctx.fillStyle = 'rgba(227,247,234,.7)';
  ctx.font = '21px monospace';
  ctx.fillText('SYSTEM READY   •   1999', 512, 516);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function createDeskScene(): DeskScene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101d24);
  scene.fog = new THREE.Fog(0x101d24, 10, 22);
  const objects = new Map<DeskObjectId, THREE.Group>();

  const room = new THREE.Group();
  scene.add(room);
  box(room, [18, .2, 14], [0, -.11, -.6], 0x263037, 0);
  box(room, [18, 8, .18], [0, 3.9, -4.25], C.wall, 0);
  box(room, [.18, 8, 14], [-6.8, 3.9, 0], 0x23353b, 0);
  box(room, [18, .14, .18], [0, .28, -4.09], C.wallTrim, 0);
  for (let x = -6; x < 7; x += 1.7) box(room, [.016, 4.7, .02], [x, 3.1, -4.13], 0x30444a, 0);

  const windowGroup = tag(new THREE.Group(), 'window');
  windowGroup.position.set(2.55, 3.46, -4.04);
  scene.add(windowGroup);
  objects.set('window', windowGroup);
  box(windowGroup, [5.0, 2.82, .12], [0, 0, 0], C.wallTrim, .02);
  const rain = createRainWindow();
  const view = new THREE.Mesh(new THREE.PlaneGeometry(4.66, 2.48), new THREE.MeshBasicMaterial({ map: rain.background }));
  view.position.z = .073;
  windowGroup.add(view);
  const wetGlass = new THREE.Mesh(new THREE.PlaneGeometry(4.66, 2.48), new THREE.MeshBasicMaterial({
    map: rain.glass, transparent: true, depthWrite: false, opacity: .9,
  }));
  wetGlass.position.z = .088;
  windowGroup.add(wetGlass);
  const glassSheen = new THREE.Mesh(new THREE.PlaneGeometry(4.65, 2.47), new THREE.MeshPhysicalMaterial({
    color: 0x9cbec2, transparent: true, opacity: .035, roughness: .12, metalness: .05, depthWrite: false,
  }));
  glassSheen.position.z = .092;
  windowGroup.add(glassSheen);
  box(windowGroup, [.09, 2.65, .12], [0, 0, .15], C.creamDark, 0);
  box(windowGroup, [4.82, .085, .12], [0, 0, .15], C.creamDark, 0);
  box(windowGroup, [5.25, .16, .55], [0, -1.48, .21], C.woodDark, .02);

  const desk = new THREE.Group();
  scene.add(desk);
  box(desk, [8.6, .23, 4.75], [0, 1.02, -.05], C.wood, .065);
  box(desk, [8.72, .045, 4.83], [0, 1.145, -.05], C.woodLight, .025);
  const grainCanvas = document.createElement('canvas');
  grainCanvas.width = 1024; grainCanvas.height = 512;
  const grain = grainCanvas.getContext('2d')!;
  grain.fillStyle = '#825c42'; grain.fillRect(0, 0, 1024, 512);
  let seed = 93;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 350; i++) {
    const y = random() * 512;
    grain.strokeStyle = i % 3 ? 'rgba(39,19,10,.095)' : 'rgba(232,180,122,.08)';
    grain.lineWidth = random() * 1.8 + .25;
    grain.beginPath();
    grain.moveTo(random() * 1024, y);
    grain.bezierCurveTo(340, y + random() * 8, 720, y - random() * 7, 1024, y + random() * 5);
    grain.stroke();
  }
  const woodTexture = new THREE.CanvasTexture(grainCanvas);
  woodTexture.colorSpace = THREE.SRGBColorSpace;
  woodTexture.anisotropy = 4;
  const deskSurface = new THREE.Mesh(new THREE.PlaneGeometry(8.58, 4.67), new THREE.MeshStandardMaterial({ map: woodTexture, roughness: .81 }));
  deskSurface.rotation.x = -Math.PI / 2;
  deskSurface.position.set(0, 1.17, -.05);
  deskSurface.receiveShadow = true;
  desk.add(deskSurface);
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 128;
  const shadowContext = shadowCanvas.getContext('2d')!;
  const contactGradient = shadowContext.createRadialGradient(64, 64, 4, 64, 64, 64);
  contactGradient.addColorStop(0, 'rgba(0,0,0,.42)');
  contactGradient.addColorStop(.52, 'rgba(0,0,0,.17)');
  contactGradient.addColorStop(1, 'rgba(0,0,0,0)');
  shadowContext.fillStyle = contactGradient;
  shadowContext.fillRect(0, 0, 128, 128);
  const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
  const contactShadow = (x: number, z: number, width: number, depth: number, opacity = 1) => {
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), new THREE.MeshBasicMaterial({
      map: shadowTexture, transparent: true, depthWrite: false, opacity,
      polygonOffset: true, polygonOffsetFactor: -1,
    }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(x, 1.173, z);
    scene.add(shadow);
  };
  contactShadow(-.45, -.96, 3.35, 1.95, .75);
  contactShadow(.25, 1.35, 3.3, 1.5, .55);
  contactShadow(-3.55, 1.68, 1.35, 1.2, .68);
  contactShadow(2.05, -.62, 1.2, 1.0, .62);
  contactShadow(2.88, -1.42, 1.5, 1.2, .65);
  contactShadow(3.2, 1.67, .85, .75, .65);
  box(desk, [8.5, .14, .09], [0, .82, 2.29], C.woodDark, .015);
  for (const x of [-3.83, 3.83]) for (const z of [-1.84, 1.75]) box(desk, [.34, 1.0, .34], [x, .45, z], C.woodDark, .02);
  box(desk, [1.65, .55, 1.56], [3.32, .65, .74], C.woodDark, .03);
  for (let i = 0; i < 2; i++) {
    box(desk, [1.5, .21, .04], [3.32, .78 - i * .27, 1.54], C.wood, .012);
    box(desk, [.26, .035, .04], [3.32, .78 - i * .27, 1.59], C.metal, .01);
  }
  // Wood grain is restrained and follows the desk's length.
  for (let i = 0; i < 17; i++) {
    const grain = box(desk, [1.4 + (i % 4) * .4, .002, .008], [-3.5 + (i * .79) % 7.1, 1.169, -1.8 + (i * .53) % 3.5], i % 3 ? 0x956847 : 0x51372b, 0);
    (grain.material as THREE.MeshStandardMaterial).transparent = true;
    (grain.material as THREE.MeshStandardMaterial).opacity = .25;
  }

  const crt = tag(new THREE.Group(), 'crt');
  crt.position.set(-.45, 0, -1.02);
  scene.add(crt); objects.set('crt', crt);
  cylinder(crt, .43, .53, .1, [0, 1.23, .17], C.creamDark, 32);
  cylinder(crt, .16, .22, .35, [0, 1.44, .17], C.cream, 24);
  box(crt, [2.64, 2.36, 1.35], [0, 2.7, -.14], C.cream, .22);
  box(crt, [2.43, 2.12, .12], [0, 2.76, .59], C.creamLight, .095);
  box(crt, [2.15, 1.66, .037], [0, 2.915, .664], C.charcoal, .115);
  const screenTexture = buildScreenTexture();
  const screenMaterial = new THREE.MeshBasicMaterial({ map: screenTexture, color: 0xc0e4df, toneMapped: false });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.08, 1.56), screenMaterial);
  screen.position.set(0, 2.915, .693); crt.add(screen);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(2.08, 1.56), new THREE.MeshPhysicalMaterial({ color: 0xa5d6cf, roughness: .16, metalness: .05, transparent: true, opacity: .08, clearcoat: 1 }));
  glass.position.set(0, 2.915, .704); crt.add(glass);
  box(crt, [.55, .045, .017], [-.83, 1.77, .658], C.creamDark, .008);
  cylinder(crt, .075, .075, .025, [.94, 1.75, .654], C.charcoal, 24, [Math.PI / 2, 0, 0]);
  const led = new THREE.Mesh(new THREE.SphereGeometry(.019, 10, 8), new THREE.MeshBasicMaterial({ color: 0x9ad9ae }));
  led.position.set(.77, 1.75, .67); crt.add(led);
  for (let i = 0; i < 9; i++) box(crt, [.024, .48, .39], [-.91 + i * .14, 2.63, -.842], C.creamDark, .008);
  for (let i = 0; i < 4; i++) box(crt, [.042, .43, .58], [1.33, 2.62, -.5 + i * .19], C.creamDark, .009);
  const badge = label('FAZLEY', .56, .12, '#b7b29d', '#34444a', 'bold 67px monospace');
  badge.position.set(-.86, 1.77, .675); crt.add(badge);

  const tower = tag(new THREE.Group(), 'tower');
  tower.position.set(2.28, 0, -.91); scene.add(tower); objects.set('tower', tower);
  box(tower, [1.08, 2.42, 1.42], [0, 2.32, 0], C.cream, .095);
  box(tower, [.96, 2.22, .04], [0, 2.33, .727], C.creamLight, .035);
  box(tower, [.72, .055, .025], [0, 3.19, .754], C.charcoal, .012);
  box(tower, [.73, .18, .025], [0, 2.89, .754], C.creamDark, .015);
  box(tower, [.56, .025, .01], [0, 2.91, .769], C.charcoal, .004);
  box(tower, [.63, .075, .018], [0, 2.57, .754], C.charcoal, .01);
  cylinder(tower, .085, .085, .027, [-.24, 1.51, .762], C.charcoal, 24, [Math.PI / 2, 0, 0]);
  cylinder(tower, .035, .035, .027, [.15, 1.51, .762], C.creamDark, 20, [Math.PI / 2, 0, 0]);
  const towerLed = new THREE.Mesh(new THREE.SphereGeometry(.018, 10, 8), new THREE.MeshBasicMaterial({ color: 0x9ad9ae }));
  towerLed.position.set(.33, 1.51, .77); tower.add(towerLed);
  for (let i = 0; i < 5; i++) box(tower, [.035, .33, .46], [.55, 2.03 + i * .16, -.31], C.creamDark, .006);
  const towerBadge = label('F/99', .42, .14, '#b7b29d', '#34444a', 'bold 84px monospace');
  towerBadge.position.set(-.18, 2.13, .769); tower.add(towerBadge);

  const keyboard = tag(new THREE.Group(), 'keyboard');
  keyboard.position.set(.25, 1.21, 1.35); scene.add(keyboard); objects.set('keyboard', keyboard);
  box(keyboard, [3.04, .16, 1.02], [0, 0, 0], C.creamDark, .08);
  box(keyboard, [2.94, .075, .9], [0, .1, -.015], C.cream, .035);
  const keyGeometry = new RoundedBoxGeometry(.155, .055, .115, 2, .018);
  const keyMaterials = [material(0xe0d9c1), material(0xbbb8a6), material(0xc4ceb8)];
  for (let row = 0; row < 5; row++) for (let col = 0; col < 16; col++) {
    if (row === 4 && col > 4 && col < 10) continue;
    const key = new THREE.Mesh(keyGeometry, keyMaterials[(row + col * 3) % keyMaterials.length]);
    key.position.set(-1.35 + col * .178, .15, -.34 + row * .17);
    key.castShadow = true; keyboard.add(key);
  }
  box(keyboard, [.84, .055, .115], [-.08, .15, .34], C.creamLight, .02);
  cable(scene, [[1.67, 1.2, 1.19], [1.88, 1.16, .92], [1.7, 1.2, .28], [1.08, 1.3, -.15]], .018);

  // A single rounded shell with button surfaces fitted to its curvature.
  // The buttons face the visitor (+Z); the cable exits the opposite end.
  const mouse = new THREE.Group(); mouse.position.set(2.35, 1.17, 1.38); scene.add(mouse);
  const mouseBase = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), material(0xa9a795, .76));
  mouseBase.scale.set(.305, .105, .445); mouseBase.position.set(0, .105, -.025);
  mouseBase.castShadow = true; mouseBase.receiveShadow = true; mouse.add(mouseBase);
  const mouseShell = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), material(0xdcd7c5, .62));
  mouseShell.scale.set(.29, .16, .42); mouseShell.position.set(0, .17, -.03);
  mouseShell.castShadow = true; mouseShell.receiveShadow = true; mouse.add(mouseShell);
  const shellHeight = (x: number, z: number) => .17 + .16 * Math.sqrt(Math.max(0, 1 - (x / .29) ** 2 - ((z + .03) / .42) ** 2));
  for (const side of [-1, 1]) {
    const vertices: number[] = [];
    const indices: number[] = [];
    for (let row = 0; row <= 8; row++) {
      const t = row / 8;
      const z = .025 + t * .29;
      const inner = .052 + t * .006;
      const outer = .205 - t * .075;
      for (let col = 0; col <= 4; col++) {
        const x = side * (inner + (outer - inner) * col / 4);
        vertices.push(x, shellHeight(x, z) + .006, z);
      }
    }
    for (let row = 0; row < 8; row++) for (let col = 0; col < 4; col++) {
      const a = row * 5 + col;
      indices.push(a, a + 5, a + 1, a + 1, a + 5, a + 6);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const button = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xe6e0ce, roughness: .65, side: THREE.DoubleSide }));
    button.castShadow = true;
    mouse.add(button);
  }
  box(mouse, [.105, .008, .14], [0, .325, .13], 0x464b48, .004);
  cylinder(mouse, .032, .032, .07, [0, .35, .13], 0x3c4444, 24, [0, 0, Math.PI / 2]);
  for (let i = 0; i < 4; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.033, .0025, 6, 20), material(0x68716c, .5, .2));
    ring.rotation.y = Math.PI / 2;
    ring.position.set((i - 1.5) * .015, .35, .13);
    mouse.add(ring);
  }
  cylinder(mouse, .025, .036, .12, [0, .14, -.48], 0x3c4240, 20, [Math.PI / 2, 0, 0]);
  cable(scene, [[2.35, 1.31, .85], [2.38, 1.25, .72], [2.57, 1.2, .51], [2.82, 1.19, .17], [2.9, 1.19, -.3], [2.72, 1.19, -.76], [2.5, 1.19, -1.1]], .014, 0x2a3032);

  for (const side of [-1, 1]) {
    const speaker = new THREE.Group();
    speaker.position.set((side < 0 ? -2.2 : 1.15), 1.19, -1.05); scene.add(speaker);
    box(speaker, [.43, .93, .45], [0, .47, 0], C.creamDark, .06);
    box(speaker, [.32, .67, .035], [0, .52, .244], C.charcoal, .02);
    cylinder(speaker, .12, .12, .014, [0, .62, .265], 0x354850, 24, [Math.PI / 2, 0, 0]);
    cylinder(speaker, .06, .06, .014, [0, .32, .265], 0x354850, 24, [Math.PI / 2, 0, 0]);
    const driverRing = new THREE.Mesh(new THREE.TorusGeometry(.115, .008, 6, 24), material(0x718783, .5, .35));
    driverRing.position.set(0, .62, .281); speaker.add(driverRing);
    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI * 2 / 12;
      cylinder(speaker, .009, .009, .004, [Math.cos(angle) * .074, .62 + Math.sin(angle) * .074, .282], C.charcoal, 8, [Math.PI / 2, 0, 0]);
    }
  }

  const notebook = tag(new THREE.Group(), 'notebook');
  notebook.position.set(-2.05, 1.22, 1.34); notebook.rotation.y = -.17; scene.add(notebook); objects.set('notebook', notebook);
  box(notebook, [1.18, .09, 1.5], [0, 0, 0], 0x8d4b44, .035);
  box(notebook, [1.1, .035, 1.42], [0, .068, -.015], C.paper, .02);
  box(notebook, [1.17, .025, 1.48], [0, .096, -.013], 0xa96353, .02);
  const notebookLabel = label('FIELD NOTES', .82, .18, '#decba8', '#4b4540', 'bold 54px monospace');
  notebookLabel.rotation.x = -Math.PI / 2; notebookLabel.position.set(0, .111, -.24); notebook.add(notebookLabel);
  for (let i = 0; i < 9; i++) cylinder(notebook, .027, .027, .04, [-.56, .12, -.55 + i * .14], C.metal, 8, [Math.PI / 2, 0, 0]);
  box(notebook, [.19, .012, .63], [.37, .118, .33], 0xd0a981, .006);

  const floppy = tag(new THREE.Group(), 'floppy');
  floppy.position.set(-3.15, 1.27, -.04); floppy.rotation.y = .28; floppy.rotation.x = -.05; scene.add(floppy); objects.set('floppy', floppy);
  for (let i = 2; i >= 0; i--) {
    const disk = new THREE.Group(); disk.position.set(i * .1, -.025 * i, -.24 * i); disk.rotation.y = i * .11; floppy.add(disk);
    box(disk, [.83, .055, .84], [0, 0, 0], [0x43525b, 0x383d51, 0x4d4a49][i], .035);
    box(disk, [.48, .01, .21], [0, .035, -.28], C.metal, .008, .48, .32);
    box(disk, [.61, .012, .31], [0, .037, .16], [0xe3c4a6, 0xc3d4c9, 0xc5b4af][i], .008);
    const diskLabel = label(['WORK / 01', 'LAB / 02', 'ARCHIVE'][i], .57, .18, ['#e3c4a6', '#c3d4c9', '#c5b4af'][i], '#26313b', 'bold 58px monospace');
    diskLabel.rotation.x = -Math.PI / 2; diskLabel.position.set(0, .046, .14); disk.add(diskLabel);
  }

  const lamp = tag(new THREE.Group(), 'lamp');
  lamp.position.set(-3.53, 1.17, -1.53); scene.add(lamp); objects.set('lamp', lamp);
  cylinder(lamp, .39, .45, .09, [0, .045, 0], 0x24383b, 32);
  cylinder(lamp, .14, .14, .06, [0, .12, 0], C.metal, 20);
  cable(lamp, [[0, .16, 0], [.12, .5, 0], [.28, 1.19, -.1], [.4, 1.85, -.28], [.78, 2.28, -.22]], .038, C.metal);
  cylinder(lamp, .49, .22, .47, [.89, 2.4, -.19], 0x415b59, 28, [0, 0, -.53]);
  const lampBulb = new THREE.Mesh(new THREE.SphereGeometry(.13, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffd7a2 }));
  lampBulb.position.set(1.02, 2.17, -.15); lamp.add(lampBulb);
  cylinder(lamp, .06, .06, .065, [.31, .12, .14], C.orange, 18);
  cable(scene, [[-3.48, 1.19, -1.64], [-3.97, 1.12, -1.75], [-4.33, 1.09, -1.22]], .018);

  const lampLight = new THREE.SpotLight(0xffc482, 105, 7, Math.PI / 3.5, .55, 1.4);
  lampLight.position.set(-2.68, 3.14, -.8);
  lampLight.target.position.set(-2.15, 1, .55);
  lampLight.castShadow = true;
  lampLight.shadow.mapSize.set(window.innerWidth < 700 ? 1024 : 2048, window.innerWidth < 700 ? 1024 : 2048);
  lampLight.shadow.bias = -.00025;
  lampLight.shadow.normalBias = .02;
  lampLight.shadow.radius = 3;
  scene.add(lampLight, lampLight.target);
  scene.add(new THREE.AmbientLight(0x8ba5aa, .78));
  const fill = new THREE.DirectionalLight(0x829eb5, 1.65);
  fill.position.set(3, 6, 3);
  fill.castShadow = true;
  fill.shadow.mapSize.set(window.innerWidth < 700 ? 1024 : 2048, window.innerWidth < 700 ? 1024 : 2048);
  fill.shadow.camera.left = -7;
  fill.shadow.camera.right = 7;
  fill.shadow.camera.top = 7;
  fill.shadow.camera.bottom = -7;
  fill.shadow.camera.near = .5;
  fill.shadow.camera.far = 18;
  fill.shadow.normalBias = .025;
  scene.add(fill);
  const windowLight = new THREE.PointLight(0x7ca9b8, 28, 9);
  windowLight.position.set(2, 3.4, -3.65); scene.add(windowLight);
  const crtLight = new THREE.PointLight(0x4eb6b9, 11, 4);
  crtLight.position.set(-.45, 2.6, -.2); scene.add(crtLight);

  const mug = new THREE.Group(); mug.position.set(3.2, 1.19, 1.67); scene.add(mug);
  const mugProfile = [
    [0, .005], [.17, .005], [.2, .02], [.22, .065], [.235, .35],
    [.22, .37], [.2, .35], [.177, .09], [0, .09],
  ].map(([radius, height]) => new THREE.Vector2(radius, height));
  const mugBody = new THREE.Mesh(new THREE.LatheGeometry(mugProfile, 40), material(0x6d9c9d, .4));
  mugBody.castShadow = true; mugBody.receiveShadow = true; mug.add(mugBody);
  const mugLip = new THREE.Mesh(new THREE.TorusGeometry(.218, .012, 8, 40), material(0x8eb6b4, .34));
  mugLip.rotation.x = Math.PI / 2; mugLip.position.y = .367; mug.add(mugLip);
  cylinder(mug, .186, .186, .004, [0, .24, 0], 0x211a17, 40);
  const handleCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(.21, .31, 0), new THREE.Vector3(.39, .37, 0),
    new THREE.Vector3(.49, .23, 0), new THREE.Vector3(.4, .075, 0),
    new THREE.Vector3(.2, .105, 0),
  ]);
  const handle = new THREE.Mesh(new THREE.TubeGeometry(handleCurve, 32, .043, 10, false), material(0x6d9c9d, .4));
  handle.castShadow = true; mug.add(handle);
  const pen = cylinder(scene, .017, .017, .77, [-1.41, 1.21, 1.4], 0xc2965b, 8, [Math.PI / 2, 0, -.23]);
  pen.castShadow = true;
  box(scene, [.72, .012, .86], [2.9, 1.18, .19], C.paper, .012);
  const paperMark = label('SYSTEM MAP', .51, .09, '#d9d2b9', '#53625e', 'bold 59px monospace');
  paperMark.rotation.x = -Math.PI / 2; paperMark.position.set(2.9, 1.19, -.08); scene.add(paperMark);
  box(scene, [.63, .012, .52], [3.66, 1.18, -.65], 0xd1b77a, .007);
  const sticky = label('SHIP IT', .5, .13, '#d1b77a', '#48514b', 'bold 63px monospace');
  sticky.rotation.x = -Math.PI / 2; sticky.position.set(3.66, 1.19, -.65); scene.add(sticky);
  const plant = new THREE.Group(); plant.position.set(3.58, 1.18, -1.77); scene.add(plant);
  cylinder(plant, .22, .14, .35, [0, .18, 0], 0x8f765b, 24);
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), material(i % 2 ? 0x63866b : 0x486b57));
    const a = i * Math.PI * 2 / 7;
    leaf.scale.set(.12, .28 + (i % 3) * .04, .08);
    leaf.position.set(Math.cos(a) * .17, .47 + (i % 2) * .1, Math.sin(a) * .17);
    leaf.rotation.z = -Math.cos(a) * .5; leaf.rotation.x = Math.sin(a) * .5;
    plant.add(leaf);
  }

  const poster = new THREE.Group(); poster.position.set(-4.45, 3.25, -4.1); scene.add(poster);
  box(poster, [1.25, 1.55, .05], [0, 0, 0], C.woodDark, .015);
  box(poster, [1.11, 1.41, .012], [0, 0, .032], 0xaca88f, .006);
  const posterTitle = label('MAKE\nTHINGS', .94, .5, '#aca88f', '#263b3b', 'bold 61px monospace');
  posterTitle.position.set(0, .28, .044); poster.add(posterTitle);
  box(poster, [.72, .06, .015], [0, -.27, .047], C.orange, .004);
  box(poster, [.5, .025, .015], [0, -.48, .047], C.wallTrim, .004);

  // A pinboard, books and paper make the empty side of the room feel worked in.
  const pinboard = new THREE.Group(); pinboard.position.set(-3.55, 3.65, -4.015); scene.add(pinboard);
  box(pinboard, [2.06, 1.52, .08], [0, 0, 0], C.woodDark, .012);
  box(pinboard, [1.89, 1.35, .015], [0, 0, .05], 0x60736c, .004);
  for (const note of [
    { x: -.52, y: .35, w: .55, h: .48, c: C.paper, t: 'BUILD LOG' },
    { x: .38, y: .28, w: .48, h: .58, c: 0xb2c6b5, t: 'IDEAS' },
    { x: -.24, y: -.36, w: .68, h: .34, c: 0xb9a37d, t: 'SYSTEMS' },
  ]) {
    box(pinboard, [note.w, note.h, .005], [note.x, note.y, .065], note.c, .003);
    const heading = label(note.t, note.w * .78, .09, `#${note.c.toString(16).padStart(6, '0')}`, '#33433e', 'bold 60px monospace');
    heading.position.set(note.x, note.y + .08, .071); pinboard.add(heading);
    cylinder(pinboard, .018, .018, .018, [note.x, note.y + note.h * .39, .079], C.orange, 12, [Math.PI / 2, 0, 0]);
  }
  const shelf = new THREE.Group(); shelf.position.set(-3.73, 2.43, -3.73); scene.add(shelf);
  box(shelf, [2.55, .11, .5], [0, 0, 0], C.woodDark, .018);
  for (let i = 0; i < 9; i++) {
    const height = .51 + (i % 4) * .11;
    const spine = box(shelf, [.15 + (i % 3) * .02, height, .38], [-1.07 + i * .24, .06 + height / 2, -.02], [0x9a7960, 0x556f6a, 0x7d6060, 0x74796b][i % 4], .008);
    spine.rotation.z = i % 5 === 0 ? .08 : 0;
    box(shelf, [.007, height * .58, .24], [-1.07 + i * .24, .07 + height / 2, .18], C.paper, .002);
  }
  box(shelf, [.42, .52, .35], [1.01, .31, 0], 0x575f58, .02);
  const shelfFace = label('BITS', .32, .11, '#575f58', '#d1d1bb', 'bold 63px monospace');
  shelfFace.position.set(1.01, .37, .19); shelf.add(shelfFace);

  // Damp evening curtains frame the exterior instead of leaving the glass bare.
  for (const side of [-1, 1]) {
    const curtainGeometry = new THREE.PlaneGeometry(.72, 2.78, 8, 1);
    const positions = curtainGeometry.attributes.position;
    for (let i = 0; i < positions.count; i++) positions.setZ(i, Math.sin(positions.getX(i) * 14) * .09);
    positions.needsUpdate = true;
    curtainGeometry.computeVertexNormals();
    const curtain = new THREE.Mesh(curtainGeometry, new THREE.MeshStandardMaterial({ color: 0x344f58, roughness: 1, side: THREE.DoubleSide }));
    curtain.position.set(2.55 + side * 2.25, 3.44, -3.89);
    curtain.castShadow = true;
    scene.add(curtain);
    box(scene, [.76, .048, .13], [2.55 + side * 2.25, 4.86, -3.87], C.metal, .006);
  }

  // Books lift the fan and break the uniform tabletop line.
  for (let i = 0; i < 3; i++) {
    const height = .075 + (i % 2) * .025;
    const y = 1.21 + i * .09;
    box(scene, [1.34 - i * .08, height, .9 + i * .04], [2.88, y, -1.42], [0x5c706a, 0x765a50, 0xa69579][i], .015);
    box(scene, [1.15 - i * .08, .012, .76 + i * .04], [2.88, y + height / 2 + .004, -1.42], C.paper, .003);
  }

  const headphones = new THREE.Group(); headphones.position.set(2.05, 1.17, -.62); scene.add(headphones);
  const archPoints: THREE.Vector3[] = [];
  for (let i = 0; i <= 24; i++) {
    const angle = Math.PI - i * Math.PI / 24;
    archPoints.push(new THREE.Vector3(Math.cos(angle) * .36, .17 + Math.sin(angle) * .36, 0));
  }
  const band = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(archPoints), 48, .034, 8, false), material(C.charcoal));
  band.castShadow = true; headphones.add(band);
  for (const x of [-.27, .27]) {
    cylinder(headphones, .15, .15, .13, [x, .17, 0], C.charcoal, 24, [0, 0, Math.PI / 2]);
    cylinder(headphones, .09, .09, .015, [x + Math.sign(x) * .075, .17, 0], C.creamDark, 24, [0, 0, Math.PI / 2]);
  }

  const pencilCup = new THREE.Group(); pencilCup.position.set(3.72, 1.19, -.29); scene.add(pencilCup);
  cylinder(pencilCup, .15, .13, .29, [0, .15, 0], 0x637473, 24);
  cylinder(pencilCup, .13, .13, .004, [0, .3, 0], C.charcoal, 24);
  const cupRim = new THREE.Mesh(new THREE.TorusGeometry(.143, .012, 8, 28), material(C.metal, .45, .3));
  cupRim.rotation.x = Math.PI / 2; cupRim.position.y = .3; pencilCup.add(cupRim);
  for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI * 2 / 12;
    box(pencilCup, [.012, .18, .006], [Math.cos(angle) * .139, .17, Math.sin(angle) * .139], C.charcoal, .002).rotation.y = -angle;
  }
  for (let i = 0; i < 7; i++) {
    const a = i * Math.PI * 2 / 7;
    cylinder(pencilCup, .013, .013, .34 + (i % 3) * .09, [Math.cos(a) * .07, .39, Math.sin(a) * .07], [0xc29f6d, 0x607d77, 0xa75b4c][i % 3], 8, [.12 * Math.cos(a), 0, .1 * Math.sin(a)]);
  }

  return {
    scene, objects, lampLight, lampBulb, screenMaterial, screenTexture, mug, headphones,
    update: (time: number) => {
      rain.update(time);
      crtLight.intensity = 10.5 + Math.sin(time * 1.7) * .35;
      if (screenMaterial.map) screenMaterial.color.setScalar(.88 + Math.sin(time * 2.2) * .015);
      plant.rotation.z = Math.sin(time * .75) * .013;
    },
  };
}
