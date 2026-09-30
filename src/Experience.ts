import * as THREE from 'three';
import gsap from 'gsap';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createDeskScene, type DeskObjectId } from './scene';
import { applyAssetFinish } from './assetFinish';
import { featuredDisks } from './data';
import { floppyLabelTexture, notebookLabelTexture } from './labels';

export type NotebookKind = 'writing' | 'career';

export type ExperienceState = {
  focused: DeskObjectId | null;
  lampOn: boolean;
  hovered: DeskObjectId | null;
  hoverLabel: string | null;
  projectId: string | null;
  notebookKind: NotebookKind | null;
};

export interface Hit {
  id: DeskObjectId;
  projectId: string | null;
  notebookKind: NotebookKind | null;
}

export interface ExperienceHandlers {
  onState: (state: ExperienceState) => void;
  onReady: () => void;
  onActivate: (hit: Hit) => void;
  /** Called after each rendered frame so the screen-anchored UI can follow the monitor. */
  onFrame?: () => void;
  /** Mechanical cues for the floppy drive, played only when sound is enabled. */
  onSound?: (cue: 'diskSlide' | 'diskSeat' | 'diskEject') => void;
}

const views: Record<Exclude<DeskObjectId, 'lamp'>, { position: [number, number, number]; target: [number, number, number] }> = {
  crt: { position: [-.45, 2.91, 2.84], target: [-.45, 2.91, -.28] },
  tower: { position: [.35, 2.15, 2.45], target: [-.45, 1.46, -.3] },
  keyboard: { position: [.55, 2.75, 3.8], target: [.25, 1.25, 1.15] },
  floppy: { position: [-2.92, 2.6, 2.15], target: [-2.9, 1.27, .08] },
  notebook: { position: [-2.16, 2.8, 2.9], target: [-2.16, 1.28, 1.36] },
  window: { position: [2.35, 3.7, 1.65], target: [2.55, 3.5, -4] },
  fan: { position: [3.5, 2.65, 2.8], target: [2.75, 2.2, -1.32] },
  phone: { position: [-3.55, 2.85, 3.25], target: [-3.55, 1.42, 1.66] },
};

export class Experience {
  readonly canvas: HTMLCanvasElement;
  readonly handlers: ExperienceHandlers;
  readonly camera = new THREE.PerspectiveCamera(38, 1, .1, 40);
  readonly sceneData = createDeskScene();
  readonly renderer: THREE.WebGLRenderer;
  readonly raycaster = new THREE.Raycaster();
  readonly pointer = new THREE.Vector2();
  readonly lookTarget = new THREE.Vector3(0, 2.04, -.6);
  readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  readonly state: ExperienceState = { focused: null, lampOn: true, hovered: null, hoverLabel: null, projectId: null, notebookKind: null };
  readonly disks = new Map<string, THREE.Object3D>();
  readonly notebooks = new Map<NotebookKind, THREE.Object3D>();
  private readonly home = new THREE.Vector3(5.65, 4.55, 8.5);
  private moving = false;
  private inputLocked = false;
  private down: { x: number; y: number } | null = null;
  private lastPointer = { x: 0, y: 0 };
  private dragging = false;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private pinchDistance = 0;
  private readonly deskPivot = new THREE.Vector3(0, 2.04, -.6);
  private readonly orbit = { theta: .555, phi: 1.34, radius: 11, targetTheta: .555, targetPhi: 1.34, targetRadius: 11 };
  private frame = 0;
  private clock = new THREE.Clock();
  private towerWrapper: THREE.Group | null = null;
  private diskLed: THREE.Mesh | null = null;
  private screenMesh: THREE.Mesh | null = null;
  private screenBaseTexture: THREE.Texture | null = null;

  constructor(canvas: HTMLCanvasElement, handlers: ExperienceHandlers) {
    this.canvas = canvas;
    this.handlers = handlers;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 700 ? 1.5 : 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.camera.position.copy(this.home);
    this.camera.lookAt(this.lookTarget);
    this.resize();
    window.addEventListener('resize', this.resize);
    canvas.addEventListener('pointermove', this.pointerMove);
    canvas.addEventListener('pointerdown', this.pointerDown);
    canvas.addEventListener('pointerup', this.pointerUp);
    canvas.addEventListener('pointerleave', this.pointerLeave);
    canvas.addEventListener('wheel', this.wheel, { passive: false });
    window.addEventListener('keydown', this.keyDown);
    this.sceneData.lampLight.intensity = 105;
    void this.loadAssets();
    this.tick();
  }

  private async loadAssets() {
    try {
      const gltf = await new GLTFLoader().loadAsync('/models/hero-props.glb');
      applyAssetFinish(gltf.scene);
      const placements: Partial<Record<DeskObjectId, [number, number, number, number]>> = {
        crt: [-.45, 1.19, -.96, 0],
        tower: [-.45, 1.17, -.96, 0],
        keyboard: [.25, 1.17, 1.35, 0],
        lamp: [-3.68, 1.17, -.74, 0],
        fan: [2.88, 1.43, -1.42, 0],
        phone: [-3.55, 1.17, 1.68, -.15],
      };
      for (const [id, placement] of Object.entries(placements) as [DeskObjectId, [number, number, number, number]][]) {
        const asset = gltf.scene.getObjectByName(id.toUpperCase());
        if (!asset) continue;
        const previous = this.sceneData.objects.get(id);
        if (previous) this.sceneData.scene.remove(previous);
        const wrapper = new THREE.Group();
        wrapper.name = `${id}-interactive`;
        wrapper.userData.interactiveId = id;
        wrapper.position.set(placement[0], placement[1], placement[2]);
        wrapper.rotation.y = placement[3];
        wrapper.add(asset);
        asset.traverse(node => {
          if (node instanceof THREE.Mesh) {
            node.castShadow = true;
            // The phone's stacked, near-coplanar dial parts show shadow-map
            // banding; its contact and desk shadows carry the grounding.
            node.receiveShadow = id !== 'phone';
          }
        });
        if (id === 'crt') this.attachCrtScreen(wrapper);
        if (id === 'lamp') {
          const bulb = asset.getObjectByName('lamp bulb');
          if (bulb instanceof THREE.Mesh) this.sceneData.lampBulb = bulb;
        }
        if (id === 'tower') {
          this.towerWrapper = wrapper;
          const led = asset.getObjectByName('disk LED');
          if (led instanceof THREE.Mesh) {
            led.material = (led.material as THREE.Material).clone();
            this.diskLed = led;
          }
        }
        this.sceneData.scene.add(wrapper);
        this.sceneData.objects.set(id, wrapper);
      }
      this.buildDisks(gltf.scene);
      this.buildNotebooks(gltf.scene);
      this.attachMugAndHeadphones(gltf.scene);
    } catch (error) {
      console.warn('Detailed models could not be loaded; using the built-in scene.', error);
    } finally {
      this.handlers.onReady();
    }
  }

  private attachCrtScreen(wrapper: THREE.Group) {
    // Vintage CRT glass bows gently toward the viewer while its rim
    // remains tucked behind the deep inner bezel.
    const glassShape = new THREE.PlaneGeometry(2.08, 1.56, 40, 30);
    const points = glassShape.attributes.position;
    for (let i = 0; i < points.count; i++) {
      const x = points.getX(i) / 1.04;
      const y = points.getY(i) / .78;
      points.setZ(i, .085 * (1 - .55 * x * x - .45 * y * y));
    }
    points.needsUpdate = true;
    glassShape.computeVertexNormals();
    const liveScreen = new THREE.Mesh(glassShape, this.sceneData.screenMaterial);
    liveScreen.position.set(0, 1.725, .675);
    wrapper.add(liveScreen);
    this.screenMesh = liveScreen;
    const glare = new THREE.Mesh(glassShape.clone(), new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormalWorld;
        varying vec3 vWorldPosition;
        void main() {
          vUv = uv;
          vNormalWorld = normalize(mat3(modelMatrix) * normal);
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        varying vec3 vNormalWorld;
        varying vec3 vWorldPosition;
        void main() {
          vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
          float fresnel = pow(1.0 - max(dot(normalize(vNormalWorld), viewDirection), 0.0), 2.0);
          float slant = vUv.x + vUv.y * 0.13;
          float softPane = exp(-pow((slant - 0.26) / 0.14, 2.0));
          float paneHeight = smoothstep(0.38, 0.55, vUv.y) * (1.0 - smoothstep(0.84, 0.98, vUv.y));
          float slimGlint = exp(-pow((slant - 0.42) / 0.018, 2.0)) * paneHeight;
          float highlight = 0.012 + fresnel * 0.28 + softPane * paneHeight * 0.29 + slimGlint * 0.12;
          gl_FragColor = vec4(0.78, 0.93, 0.94, highlight);
        }
      `,
    }));
    glare.position.set(0, 1.725, .679);
    wrapper.add(glare);
  }

  private addLabelPlane(
    parent: THREE.Object3D,
    texture: THREE.CanvasTexture,
    size: [number, number],
    position: [number, number, number],
    hide: string[],
  ) {
    for (const name of hide) {
      const node = parent.getObjectByName(name);
      if (node) node.visible = false;
    }
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(size[0], size[1]),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false }),
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(...position);
    plane.renderOrder = 2;
    parent.add(plane);
  }

  private buildDisks(gltfScene: THREE.Object3D) {
    const source = gltfScene.getObjectByName('FLOPPY');
    if (!source) return;
    const previous = this.sceneData.objects.get('floppy');
    if (previous) this.sceneData.scene.remove(previous);
    const parent = new THREE.Group();
    parent.name = 'floppy-interactive';
    parent.userData.interactiveId = 'floppy';
    parent.position.set(0, 0, 0);
    // Resting as a pile; on zoom the disks fan out so each label is selectable.
    const diskScale = .76;
    const base = new THREE.Vector3(-2.92, 1.17, .12);
    const fan = new THREE.Vector3(-2.9, 1.17, .16);
    featuredDisks.forEach((project, index) => {
      const disk = source.clone(true);
      disk.name = `floppy-${project.id}`;
      disk.userData.interactiveId = 'floppy';
      disk.userData.projectId = project.id;
      const strip = disk.getObjectByName('label color strip');
      if (strip instanceof THREE.Mesh && project.diskStyle) {
        const stripMaterial = (strip.material as THREE.MeshStandardMaterial).clone();
        stripMaterial.color.set(project.diskStyle.strip);
        strip.material = stripMaterial;
      }
      const texture = floppyLabelTexture(project.diskLabel ?? project.title, project.diskIndex ?? index + 1, project.diskStyle!);
      this.addLabelPlane(disk, texture, [.68, .4], [0, .086, .14], ['disk archive title', 'disk handwritten index', 'disk brand']);
      disk.traverse(node => {
        if (node instanceof THREE.Mesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
      });
      const pile = new THREE.Vector3(base.x + index * .062, base.y + index * .056, base.z - index * .05);
      const pileRotation = -.14 + index * .05;
      const spread = new THREE.Vector3(fan.x + (index - 1.5) * .6, fan.y + index * .004, fan.z + (index - 1.5) * .09);
      const spreadRotation = (index - 1.5) * .14;
      disk.scale.setScalar(diskScale);
      disk.position.copy(pile);
      disk.rotation.y = pileRotation;
      disk.userData.pilePosition = pile.clone();
      disk.userData.pileRotationY = pileRotation;
      disk.userData.spreadPosition = spread.clone();
      disk.userData.spreadRotationY = spreadRotation;
      disk.userData.home = pile.clone();
      disk.userData.homeRotation = new THREE.Euler(0, pileRotation, 0);
      disk.userData.baseScale = diskScale;
      parent.add(disk);
      this.disks.set(project.id, disk);
    });
    this.sceneData.scene.add(parent);
    this.sceneData.objects.set('floppy', parent);
  }

  private buildNotebooks(gltfScene: THREE.Object3D) {
    const source = gltfScene.getObjectByName('NOTEBOOK');
    if (!source) return;
    const previous = this.sceneData.objects.get('notebook');
    if (previous) this.sceneData.scene.remove(previous);
    const parent = new THREE.Group();
    parent.name = 'notebook-interactive';
    parent.userData.interactiveId = 'notebook';
    parent.position.set(0, 0, 0);
    const bookScale = .56;
    // Resting as a pile; on zoom the two books fan apart so each is selectable.
    const config: { kind: NotebookKind; title: string; subtitle: string; accent: string; position: THREE.Vector3; rotation: number; spread: THREE.Vector3; spreadRotation: number }[] = [
      { kind: 'career', title: 'Work Log', subtitle: 'CAREER  /  FAZLEY', accent: '#a05b4c', position: new THREE.Vector3(-2.22, 1.17, 1.34), rotation: -.16, spread: new THREE.Vector3(-2.6, 1.17, 1.2), spreadRotation: -.24 },
      { kind: 'writing', title: 'Field Notes', subtitle: 'WRITING  /  FAZLEY', accent: '#5b86a8', position: new THREE.Vector3(-2.12, 1.266, 1.4), rotation: .07, spread: new THREE.Vector3(-1.62, 1.17, 1.46), spreadRotation: .2 },
    ];
    for (const entry of config) {
      const book = source.clone(true);
      book.name = `notebook-${entry.kind}`;
      book.userData.interactiveId = 'notebook';
      book.userData.notebookKind = entry.kind;
      const texture = notebookLabelTexture(entry.title, entry.subtitle, entry.accent);
      this.addLabelPlane(book, texture, [.79, .36], [0, .162, -.24], ['notebook title', 'notebook subtitle']);
      book.traverse(node => {
        if (node instanceof THREE.Mesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
      });
      book.scale.setScalar(bookScale);
      book.position.copy(entry.position);
      book.rotation.y = entry.rotation;
      book.userData.pilePosition = entry.position.clone();
      book.userData.pileRotationY = entry.rotation;
      book.userData.spreadPosition = entry.spread.clone();
      book.userData.spreadRotationY = entry.spreadRotation;
      book.userData.home = entry.position.clone();
      book.userData.baseScale = bookScale;
      parent.add(book);
      this.notebooks.set(entry.kind, book);
    }
    this.sceneData.scene.add(parent);
    this.sceneData.objects.set('notebook', parent);
  }

  private attachMugAndHeadphones(gltfScene: THREE.Object3D) {
    const mug = gltfScene.getObjectByName('MUG');
    if (mug) {
      this.sceneData.scene.remove(this.sceneData.mug);
      mug.position.set(3.2, 1.17, 1.67);
      mug.traverse(node => {
        if (node instanceof THREE.Mesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
      });
      this.sceneData.scene.add(mug);
    }
    const headphones = gltfScene.getObjectByName('HEADPHONES');
    if (headphones) {
      this.sceneData.scene.remove(this.sceneData.headphones);
      // Kept clear of the notebook and disk area on the left of the desk.
      headphones.position.set(2.05, 1.17, -.62);
      headphones.traverse(node => {
        if (node instanceof THREE.Mesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
      });
      this.sceneData.scene.add(headphones);
    }
  }

  private emit() { this.handlers.onState({ ...this.state }); }

  private resize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.fov = width < 700 ? 53 : width < 1100 ? 43 : 38;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, width < 700 ? 1.5 : 2));
  };

  private findAt(clientX: number, clientY: number): Hit | null {
    const bounds = this.canvas.getBoundingClientRect();
    this.pointer.set(((clientX - bounds.left) / bounds.width) * 2 - 1, -((clientY - bounds.top) / bounds.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects([...this.sceneData.objects.values()], true);
    for (const hit of hits) {
      let node: THREE.Object3D | null = hit.object;
      while (node) {
        if (node.userData.interactiveId) {
          return {
            id: node.userData.interactiveId as DeskObjectId,
            projectId: (node.userData.projectId as string | undefined) ?? null,
            notebookKind: (node.userData.notebookKind as NotebookKind | undefined) ?? null,
          };
        }
        node = node.parent;
      }
    }
    return null;
  }

  private hitLabel(hit: Hit): string {
    if (hit.id === 'floppy') {
      const project = featuredDisks.find(item => item.id === hit.projectId);
      return project ? project.title : 'Project disks';
    }
    if (hit.id === 'notebook') return hit.notebookKind === 'career' ? 'Work Log' : 'Field Notes';
    return labels[hit.id];
  }

  private pointerMove = (event: PointerEvent) => {
    if (this.pointers.has(event.pointerId)) this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.pointers.size === 2) { this.handlePinch(); return; }
    if (this.moving || this.inputLocked) return;
    const selectableFocus = this.state.focused === 'floppy' || this.state.focused === 'notebook';
    if (this.state.focused && !selectableFocus) return;
    if (this.down && !this.state.focused) {
      const dx = event.clientX - this.down.x;
      const dy = event.clientY - this.down.y;
      if (!this.dragging && Math.hypot(dx, dy) > 6) this.dragging = true;
      if (this.dragging) {
        this.orbitBy(event.clientX - this.lastPointer.x, event.clientY - this.lastPointer.y);
        this.lastPointer = { x: event.clientX, y: event.clientY };
        if (this.state.hovered) {
          this.highlight(this.state.hovered, false, this.state.projectId, this.state.notebookKind);
          this.state.hovered = null;
          this.state.hoverLabel = null;
          this.emit();
        }
        this.canvas.style.cursor = 'grabbing';
        return;
      }
    }
    const next = this.findAt(event.clientX, event.clientY);
    const nextId = next?.id ?? null;
    const changed = nextId !== this.state.hovered || (next?.projectId ?? null) !== this.state.projectId || (next?.notebookKind ?? null) !== this.state.notebookKind;
    if (!changed) return;
    if (this.state.hovered) this.highlight(this.state.hovered, false, this.state.projectId, this.state.notebookKind);
    this.state.hovered = nextId;
    this.state.projectId = next?.projectId ?? null;
    this.state.notebookKind = next?.notebookKind ?? null;
    this.state.hoverLabel = next ? this.hitLabel(next) : null;
    if (next) this.highlight(next.id, true, next.projectId, next.notebookKind);
    this.canvas.style.cursor = next ? 'pointer' : 'grab';
    this.emit();
  };

  private pointerDown = (event: PointerEvent) => {
    this.down = { x: event.clientX, y: event.clientY };
    this.lastPointer = { x: event.clientX, y: event.clientY };
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  };

  private pointerUp = (event: PointerEvent) => {
    this.pointers.delete(event.pointerId);
    if (this.pointers.size < 2) this.pinchDistance = 0;
    if (this.dragging) {
      this.dragging = false;
      this.down = null;
      this.canvas.style.cursor = 'grab';
      return;
    }
    if (!this.down || Math.hypot(event.clientX - this.down.x, event.clientY - this.down.y) > 8) { this.down = null; return; }
    this.down = null;
    const selectableFocus = this.state.focused === 'floppy' || this.state.focused === 'notebook';
    if (this.moving || this.inputLocked || (this.state.focused && !selectableFocus)) return;
    const hit = this.findAt(event.clientX, event.clientY);
    if (hit) this.activate(hit);
  };

  private pointerLeave = () => {
    if (this.dragging) return;
    if (this.state.hovered) this.highlight(this.state.hovered, false, this.state.projectId, this.state.notebookKind);
    this.state.hovered = null;
    this.state.projectId = null;
    this.state.notebookKind = null;
    this.state.hoverLabel = null;
    this.canvas.style.cursor = 'grab';
    this.emit();
  };

  private wheel = (event: WheelEvent) => {
    if (this.state.focused || this.inputLocked || this.moving) return;
    event.preventDefault();
    this.dolly(event.deltaY > 0 ? 1.09 : 0.918);
  };

  private handlePinch() {
    if (this.state.focused || this.inputLocked || this.moving) return;
    const [a, b] = [...this.pointers.values()];
    const distance = Math.hypot(a.x - b.x, a.y - b.y);
    if (this.pinchDistance > 0 && distance > 0) {
      this.dragging = true;
      this.dolly(this.pinchDistance / distance);
    }
    this.pinchDistance = distance;
  }

  private orbitBy(dx: number, dy: number) {
    this.orbit.targetTheta = THREE.MathUtils.clamp(this.orbit.targetTheta - dx * .005, -.5, 1.15);
    this.orbit.targetPhi = THREE.MathUtils.clamp(this.orbit.targetPhi - dy * .005, .62, 1.52);
  }

  /** Zoom the surrounding desk view in or out. */
  dolly(factor: number) {
    this.orbit.targetRadius = THREE.MathUtils.clamp(this.orbit.targetRadius * factor, 5.4, 15.5);
  }

  /** Restore the default three-quarter desk view. */
  resetView() {
    this.orbit.targetTheta = .555;
    this.orbit.targetPhi = 1.34;
    this.orbit.targetRadius = 11;
  }

  private updateOrbit() {
    const orbit = this.orbit;
    orbit.theta += (orbit.targetTheta - orbit.theta) * .18;
    orbit.phi += (orbit.targetPhi - orbit.phi) * .18;
    orbit.radius += (orbit.targetRadius - orbit.radius) * .18;
    const sinPhi = Math.sin(orbit.phi);
    this.home.set(
      this.deskPivot.x + orbit.radius * sinPhi * Math.sin(orbit.theta),
      this.deskPivot.y + orbit.radius * Math.cos(orbit.phi),
      this.deskPivot.z + orbit.radius * sinPhi * Math.cos(orbit.theta),
    );
    this.camera.position.copy(this.home);
  }

  private keyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && this.state.focused && !this.inputLocked) this.back();
    if (this.state.focused || this.inputLocked) return;
    if (event.key === 'ArrowLeft') this.orbit.targetTheta = THREE.MathUtils.clamp(this.orbit.targetTheta - .09, -.5, 1.15);
    else if (event.key === 'ArrowRight') this.orbit.targetTheta = THREE.MathUtils.clamp(this.orbit.targetTheta + .09, -.5, 1.15);
    else if (event.key === 'ArrowUp') this.orbit.targetPhi = THREE.MathUtils.clamp(this.orbit.targetPhi - .06, .62, 1.52);
    else if (event.key === 'ArrowDown') this.orbit.targetPhi = THREE.MathUtils.clamp(this.orbit.targetPhi + .06, .62, 1.52);
    else if (event.key === '+' || event.key === '=') this.dolly(.9);
    else if (event.key === '-' || event.key === '_') this.dolly(1.11);
  };

  private highlight(id: DeskObjectId, active: boolean, projectId: string | null, notebookKind: NotebookKind | null) {
    const target = id === 'floppy' && projectId
      ? this.disks.get(projectId)
      : id === 'notebook' && notebookKind
        ? this.notebooks.get(notebookKind)
        : this.sceneData.objects.get(id);
    if (!target) return;
    const base = (target.userData.baseScale as number | undefined) ?? 1;
    const scale = base * (active ? 1.06 : 1);
    gsap.to(target.scale, {
      x: scale, y: scale, z: scale,
      duration: this.reducedMotion ? 0 : .22, ease: 'power2.out', overwrite: true,
    });
  }

  private toggleLamp() {
    this.state.lampOn = !this.state.lampOn;
    gsap.to(this.sceneData.lampLight, { intensity: this.state.lampOn ? 105 : 0, duration: this.reducedMotion ? 0 : .5 });
    const bulbMaterial = this.sceneData.lampBulb.material;
    if (bulbMaterial instanceof THREE.MeshBasicMaterial || bulbMaterial instanceof THREE.MeshStandardMaterial) {
      bulbMaterial.color.setHex(this.state.lampOn ? 0xffd7a2 : 0x596360);
    }
    if (bulbMaterial instanceof THREE.MeshStandardMaterial) bulbMaterial.emissiveIntensity = this.state.lampOn ? 1.4 : 0;
    this.emit();
  }

  private activate(hit: Hit) {
    if (hit.id === 'lamp') { this.toggleLamp(); return; }
    if (hit.id === 'floppy' || hit.id === 'notebook' || hit.id === 'crt') {
      this.handlers.onActivate(hit);
      return;
    }
    if (this.state.focused) this.back(() => this.focus(hit.id as Exclude<DeskObjectId, 'lamp'>));
    else this.focus(hit.id as Exclude<DeskObjectId, 'lamp'>);
  }

  /** Public entry for the on-screen object controls. */
  select(id: DeskObjectId) {
    if (this.moving || this.inputLocked) return;
    this.activate({ id, projectId: null, notebookKind: null });
  }

  /** Move the camera to a focused object (used by the interaction controller). */
  focusObject(id: Exclude<DeskObjectId, 'lamp'>) {
    if (this.moving || this.inputLocked) return;
    if (this.state.focused === id) return;
    if (this.state.focused) this.back(() => this.focus(id));
    else this.focus(id);
  }

  private focus(id: Exclude<DeskObjectId, 'lamp'>) {
    const view = views[id];
    const position = new THREE.Vector3(...view.position);
    if (window.innerWidth < 700 && id === 'crt') position.z += 1.25;
    this.moving = true;
    if (this.state.hovered) this.highlight(this.state.hovered, false, this.state.projectId, this.state.notebookKind);
    this.state.hovered = null;
    this.state.hoverLabel = null;
    this.state.focused = id;
    if (id !== 'floppy') this.state.projectId = null;
    if (id !== 'notebook') this.state.notebookKind = null;
    this.emit();
    const duration = this.reducedMotion ? 0 : .95;
    gsap.to(this.camera.position, { x: position.x, y: position.y, z: position.z, duration, ease: 'power2.inOut', overwrite: true, onComplete: () => { this.moving = false; } });
    gsap.to(this.lookTarget, { x: view.target[0], y: view.target[1], z: view.target[2], duration, ease: 'power2.inOut', overwrite: true });
  }

  back(after?: () => void) {
    if (!this.state.focused || this.moving) return;
    this.moving = true;
    this.state.focused = null;
    this.state.projectId = null;
    this.state.notebookKind = null;
    this.state.hoverLabel = null;
    this.emit();
    const duration = this.reducedMotion ? 0 : .85;
    gsap.to(this.camera.position, { x: this.home.x, y: this.home.y, z: this.home.z, duration, ease: 'power2.inOut', overwrite: true, onComplete: () => { this.moving = false; after?.(); } });
    gsap.to(this.lookTarget, { x: 0, y: 2.04, z: -.6, duration, ease: 'power2.inOut', overwrite: true });
  }

  get isMoving(): boolean {
    return this.moving;
  }

  /**
   * While the DOM interface is shown on the monitor, blank the backing screen
   * texture so there is no ghost image behind it; restore it on close.
   */
  setScreenSource(active: boolean) {
    const material = this.sceneData.screenMaterial;
    if (active) {
      if (!this.screenBaseTexture) this.screenBaseTexture = material.map as THREE.Texture | null;
      material.map = null;
      material.color.setHex(0x0b2225);
    } else if (this.screenBaseTexture) {
      material.map = this.screenBaseTexture;
      material.color.setScalar(.9);
    }
    material.needsUpdate = true;
  }

  /** Fan the disk pile open (or back into a stack) for the zoomed selection view. */
  spreadDisks(open: boolean) {
    for (const disk of this.disks.values()) {
      if (!disk.visible) continue;
      this.tweenToLayout(
        disk,
        (open ? disk.userData.spreadPosition : disk.userData.pilePosition) as THREE.Vector3,
        (open ? disk.userData.spreadRotationY : disk.userData.pileRotationY) as number,
      );
    }
  }

  /** Fan the two notebooks apart (or back into a stack) for the zoomed selection view. */
  spreadNotebooks(open: boolean) {
    for (const book of this.notebooks.values()) {
      this.tweenToLayout(
        book,
        (open ? book.userData.spreadPosition : book.userData.pilePosition) as THREE.Vector3,
        (open ? book.userData.spreadRotationY : book.userData.pileRotationY) as number,
      );
    }
  }

  private tweenToLayout(object: THREE.Object3D, position: THREE.Vector3, rotationY: number) {
    const duration = this.reducedMotion ? 0 : .5;
    gsap.to(object.position, { x: position.x, y: position.y, z: position.z, duration, ease: 'power2.inOut', overwrite: 'auto' });
    gsap.to(object.rotation, { y: rotationY, duration, ease: 'power2.inOut', overwrite: 'auto' });
  }

  /** World-space corners of the monitor picture: TL, TR, BR, BL. */
  getScreenQuad(): THREE.Vector3[] | null {
    if (!this.screenMesh) return null;
    this.screenMesh.updateWorldMatrix(true, false);
    // One 4:3 picture plane, shared by the glass and projected DOM surface.
    const halfWidth = 2.08 / 2;
    const halfHeight = 1.56 / 2;
    const center = new THREE.Vector3(0, 0, 0);
    return [
      this.screenMesh.localToWorld(new THREE.Vector3(-halfWidth, halfHeight, 0).add(center)),
      this.screenMesh.localToWorld(new THREE.Vector3(halfWidth, halfHeight, 0).add(center)),
      this.screenMesh.localToWorld(new THREE.Vector3(halfWidth, -halfHeight, 0).add(center)),
      this.screenMesh.localToWorld(new THREE.Vector3(-halfWidth, -halfHeight, 0).add(center)),
    ];
  }

  /** Lock desk input while a full-screen reading view owns the screen. */
  setInputLocked(locked: boolean) {
    this.inputLocked = locked;
    if (locked && this.state.hovered) {
      this.highlight(this.state.hovered, false, this.state.projectId, this.state.notebookKind);
      this.state.hovered = null;
      this.state.hoverLabel = null;
      this.emit();
    }
  }

  /**
   * Signature disk interaction: the camera follows the disk as it lifts, carries
   * across the desk, aligns with the drive and slides in, then the LED pulses.
   */
  insertDisk(projectId: string, onComplete: () => void) {
    const disk = this.disks.get(projectId);
    if (!disk) { onComplete(); return; }
    this.moving = true;
    this.setInputLocked(true);
    const target = new THREE.Vector3();
    if (this.towerWrapper) target.copy(this.towerWrapper.position).add(new THREE.Vector3(.24, .42, .88));
    else target.set(-.2, 1.5, .75);
    const base = (disk.userData.baseScale as number | undefined) ?? 1;
    const pile = disk.userData.pilePosition as THREE.Vector3 | undefined;
    const liftY = (pile?.y ?? disk.position.y) + .62;
    const reduced = this.reducedMotion;
    const moveTime = reduced ? 0 : .8;

    const seat = () => {
      if (this.diskLed && this.diskLed.material instanceof THREE.MeshStandardMaterial) {
        const material = this.diskLed.material;
        const restored = material.emissiveIntensity;
        gsap.fromTo(material, { emissiveIntensity: restored }, { emissiveIntensity: 3.4, duration: .12, yoyo: true, repeat: 5, onComplete: () => { material.emissiveIntensity = restored; } });
      }
      this.handlers.onSound?.('diskSeat');
    };

    const timeline = gsap.timeline({ onComplete: () => {
      this.moving = false;
      this.setInputLocked(false);
      onComplete();
    } });
    // Camera swings round to face the drive so the insertion is fully visible.
    timeline.to(this.camera.position, { x: -.1, y: 2.3, z: 2.15, duration: moveTime, ease: 'power2.inOut', overwrite: true }, 0);
    timeline.to(this.lookTarget, { x: -.2, y: 1.56, z: -.05, duration: moveTime, ease: 'power2.inOut', overwrite: true }, 0);
    // Lift out of the fan.
    timeline.to(disk.position, { y: liftY, duration: reduced ? 0 : .3, ease: 'power2.out' }, reduced ? 0 : .15);
    timeline.to(disk.rotation, { x: .22, y: 0, duration: reduced ? 0 : .3, ease: 'power2.out' }, reduced ? 0 : .15);
    // Carry across the desk into the drive mouth.
    timeline.call(() => this.handlers.onSound?.('diskSlide'), undefined, reduced ? 0 : .5);
    timeline.to(disk.position, { x: target.x, y: target.y, z: target.z, duration: reduced ? 0 : .62, ease: 'power2.inOut' }, reduced ? 0 : .5);
    timeline.to(disk.rotation, { x: 0, y: 0, duration: reduced ? 0 : .62, ease: 'power2.inOut' }, reduced ? 0 : .5);
    // Slide home and clamp down.
    timeline.to(disk.scale, { y: base * .34, duration: reduced ? 0 : .18, ease: 'power2.in' }, reduced ? 0 : 1.12);
    timeline.call(seat, undefined, reduced ? 0 : 1.28);
    timeline.to(disk, { duration: .04, onComplete: () => { disk.visible = false; } }, reduced ? 0 : 1.3);
    timeline.to({}, { duration: reduced ? 0 : .32 });
  }

  /** Restore a disk to its home spot after eject. */
  restoreDisk(projectId: string) {
    const disk = this.disks.get(projectId);
    if (!disk) return;
    const home = (disk.userData.pilePosition as THREE.Vector3 | undefined) ?? (disk.userData.home as THREE.Vector3);
    const homeRotation = new THREE.Euler(0, (disk.userData.pileRotationY as number | undefined) ?? 0, 0);
    const base = (disk.userData.baseScale as number | undefined) ?? 1;
    disk.visible = true;
    gsap.to(disk.scale, { x: base, y: base, z: base, duration: this.reducedMotion ? 0 : .3, ease: 'power2.out' });
    gsap.to(disk.position, { x: home.x, y: home.y, z: home.z, duration: this.reducedMotion ? 0 : .5, ease: 'power2.out' });
    gsap.to(disk.rotation, { x: homeRotation.x, y: homeRotation.y, z: homeRotation.z, duration: this.reducedMotion ? 0 : .5 });
  }

  private tick = () => {
    this.frame = requestAnimationFrame(this.tick);
    this.sceneData.update(this.clock.getElapsedTime());
    if (!this.state.focused && !this.moving && !this.inputLocked) this.updateOrbit();
    this.camera.lookAt(this.lookTarget);
    this.renderer.render(this.sceneData.scene, this.camera);
    this.handlers.onFrame?.();
  };

  dispose() {
    cancelAnimationFrame(this.frame);
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('keydown', this.keyDown);
    this.canvas.removeEventListener('pointermove', this.pointerMove);
    this.canvas.removeEventListener('pointerdown', this.pointerDown);
    this.canvas.removeEventListener('pointerup', this.pointerUp);
    this.canvas.removeEventListener('pointerleave', this.pointerLeave);
    this.sceneData.scene.traverse(object => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(m => m.dispose());
      }
    });
    this.renderer.dispose();
  }
}

const labels: Record<DeskObjectId, string> = {
  crt: 'The computer',
  tower: 'The tower',
  keyboard: 'The keyboard',
  floppy: 'Project disks',
  notebook: 'Field notes',
  window: 'Beyond the window',
  lamp: 'Desk lamp',
  fan: 'Desk fan',
  phone: 'Desk phone',
};
