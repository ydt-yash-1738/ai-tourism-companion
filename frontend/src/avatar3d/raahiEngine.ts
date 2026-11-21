/**
 * Raahi in 3D: one shared WebGL renderer draws the avatar into every visible
 * <canvas> that registers with it, so several avatars on a page cost a single
 * GL context. The model is a standard humanoid rig in T-pose; this module poses
 * it procedurally (arms down, breathing, head motion, talking gestures).
 *
 * Loaded with a dynamic import, so three.js is fetched only when Raahi first
 * appears.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

export type Framing = 'bust' | 'head';

interface Instance {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  framing: Framing;
  speaking: boolean;
  visible: boolean;
  /** per-instance offset so avatars side by side do not move in lockstep */
  phase: number;
  observer: IntersectionObserver;
}

const MODEL_URL = `${import.meta.env.BASE_URL}models/raahi.glb`;
const FPS = 30;

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let rig: Rig | null = null;
let loading: Promise<void> | null = null;
let rafId = 0;
let lastFrame = 0;
const instances = new Set<Instance>();
const reducedMotion =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------------------
// Rig: world-space posing that works whatever the bones' local axes are
// ---------------------------------------------------------------------------

const BONE_NAMES = [
  'Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head',
  'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand',
  'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
] as const;
type BoneName = (typeof BONE_NAMES)[number];

const FINGERS = ['Index', 'Middle', 'Ring', 'Pinky'];

class Rig {
  bones: Partial<Record<BoneName, THREE.Bone>> = {};
  rest = new Map<THREE.Object3D, THREE.Quaternion>();
  fingers: { left: THREE.Bone[]; right: THREE.Bone[] } = { left: [], right: [] };
  root: THREE.Object3D;
  private tmpQ = new THREE.Quaternion();
  private tmpQ2 = new THREE.Quaternion();
  private tmpV = new THREE.Vector3();
  private tmpV2 = new THREE.Vector3();

  constructor(root: THREE.Object3D) {
    this.root = root;
    root.traverse((obj) => {
      if ((obj as THREE.Bone).isBone) {
        const name = obj.name as BoneName;
        if ((BONE_NAMES as readonly string[]).includes(name)) this.bones[name] = obj as THREE.Bone;
        for (const f of FINGERS) {
          if (new RegExp(`^LeftHand${f}[12]$`).test(obj.name)) this.fingers.left.push(obj as THREE.Bone);
          if (new RegExp(`^RightHand${f}[12]$`).test(obj.name)) this.fingers.right.push(obj as THREE.Bone);
        }
        this.rest.set(obj, obj.quaternion.clone());
      }
    });
  }

  reset() {
    for (const [bone, q] of this.rest) bone.quaternion.copy(q);
    this.root.updateMatrixWorld(true);
  }

  /** Rotate a bone so the direction to its child points along `dir` (world space). */
  aim(name: BoneName, child: BoneName, dir: THREE.Vector3) {
    const bone = this.bones[name];
    const end = this.bones[child];
    if (!bone || !end) return;
    const from = bone.getWorldPosition(this.tmpV);
    const to = end.getWorldPosition(this.tmpV2).sub(from).normalize();
    const delta = this.tmpQ.setFromUnitVectors(to, dir.clone().normalize());
    this.applyWorld(bone, delta);
  }

  /** Rotate a bone by `angle` around a world-space axis. */
  turn(name: BoneName, axis: THREE.Vector3, angle: number) {
    const bone = this.bones[name];
    if (!bone || angle === 0) return;
    this.applyWorld(bone, this.tmpQ.setFromAxisAngle(axis, angle));
  }

  curlFingers(side: 'left' | 'right', amount: number) {
    for (const f of this.fingers[side]) {
      // fingers bend around their local X axis in this rig
      f.quaternion.multiply(this.tmpQ2.setFromAxisAngle(new THREE.Vector3(1, 0, 0), amount));
    }
  }

  private applyWorld(bone: THREE.Object3D, worldDelta: THREE.Quaternion) {
    const parent = bone.parent;
    const parentWorld = parent ? parent.getWorldQuaternion(new THREE.Quaternion()) : new THREE.Quaternion();
    const boneWorld = bone.getWorldQuaternion(new THREE.Quaternion());
    const nextWorld = worldDelta.clone().multiply(boneWorld);
    bone.quaternion.copy(parentWorld.invert().multiply(nextWorld));
    bone.updateMatrixWorld(true);
  }
}

// ---------------------------------------------------------------------------
// Mouth: the model ships without face blendshapes or a jaw bone, so a
// "jaw open" morph target is built from the face geometry at load time.
// Measured on this model (bind pose, metres): mouth line at y≈1.656, chin
// at y≈1.604, face front at z≈0.09.
// ---------------------------------------------------------------------------

const MOUTH_Y = 1.656;
const CHIN_Y = 1.6;
const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function addJawMorph(mesh: THREE.SkinnedMesh): boolean {
  const geo = mesh.geometry;
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  if (!pos) return false;
  // Positions may be quantized (stored in -1..1 with the scale moved into the
  // skeleton), so take each vertex's real rest-pose position through skinning,
  // and fit the per-axis scale that maps stored units to metres.
  mesh.updateMatrixWorld(true);
  mesh.skeleton.update();
  const world = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  const qMin = [Infinity, Infinity, Infinity];
  const qMax = [-Infinity, -Infinity, -Infinity];
  const wMin = [Infinity, Infinity, Infinity];
  const wMax = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.count; i++) {
    const q = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld);
    const w = [v.x, v.y, v.z];
    for (let k = 0; k < 3; k++) {
      world[i * 3 + k] = w[k];
      qMin[k] = Math.min(qMin[k], q[k]);
      qMax[k] = Math.max(qMax[k], q[k]);
      wMin[k] = Math.min(wMin[k], w[k]);
      wMax[k] = Math.max(wMax[k], w[k]);
    }
  }
  const scale = [0, 1, 2].map((k) => (wMax[k] - wMin[k]) / (qMax[k] - qMin[k] || 1));

  const deltas = new Float32Array(pos.count * 3);
  let moved = 0;
  for (let i = 0; i < pos.count; i++) {
    const x = world[i * 3];
    const y = world[i * 3 + 1];
    const z = world[i * 3 + 2];
    if (y < CHIN_Y - 0.03 || y > MOUTH_Y + 0.02 || Math.abs(x) > 0.075) continue;
    // front of the lower face only, fading out toward the cheeks and under the jaw
    const wx = 1 - smoothstep(0.028, 0.07, Math.abs(x));
    const wz = smoothstep(0.0, 0.06, z);
    let dy: number;
    let dz = 0;
    if (y <= MOUTH_Y) {
      // lower lip and chin drop together, like a jaw hinging open
      const wy = smoothstep(CHIN_Y - 0.03, CHIN_Y + 0.01, y);
      dy = -0.0062 * wy;
      dz = -0.0016 * wy;
    } else {
      // upper lip lifts a little
      dy = 0.0012 * (1 - smoothstep(MOUTH_Y, MOUTH_Y + 0.012, y));
    }
    const w = wx * wz;
    if (w <= 0) continue;
    deltas[i * 3 + 1] = (dy * w) / scale[1];
    deltas[i * 3 + 2] = (dz * w) / scale[2];
    moved++;
  }
  if (!moved) return false;

  // Open the lips: drop the thin strip of triangles that joins the upper and
  // lower lip across the mouth, so parting them reveals the mouth cavity.
  const index = geo.getIndex();
  if (index) {
    const kept: number[] = [];
    const inMouth = (i: number) =>
      Math.abs(world[i * 3]) < 0.026 && world[i * 3 + 2] > 0.05 && Math.abs(world[i * 3 + 1] - MOUTH_Y) < 0.006;
    const below = (i: number) => world[i * 3 + 1] <= MOUTH_Y;
    for (let t = 0; t < index.count; t += 3) {
      const a = index.getX(t);
      const b = index.getX(t + 1);
      const c = index.getX(t + 2);
      const spansLips =
        inMouth(a) && inMouth(b) && inMouth(c) && !(below(a) === below(b) && below(b) === below(c));
      if (!spansLips) kept.push(a, b, c);
    }
    geo.setIndex(kept);
  }

  geo.morphAttributes.position = [new THREE.BufferAttribute(deltas, 3)];
  geo.morphTargetsRelative = true;
  mesh.updateMorphTargets();
  return true;
}

let jawMesh: THREE.SkinnedMesh | null = null;

/** A dark mouth cavity with a hint of upper teeth, fixed to the head behind the lips. */
function addMouthCavity(head: THREE.Bone) {
  head.updateMatrixWorld(true);
  const toHead = head.matrixWorld.clone().invert();
  const group = new THREE.Group();
  const cavity = new THREE.Mesh(
    new THREE.SphereGeometry(1, 20, 12),
    new THREE.MeshBasicMaterial({ color: 0x2a0d0a }),
  );
  cavity.scale.set(0.032, 0.015, 0.02);
  cavity.position.set(0, MOUTH_Y - 0.004, 0.054);
  // upper teeth: a short curved band set back in the shade of the upper lip
  const teeth = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.0032, 24, 1, true, -0.42, 0.84),
    new THREE.MeshStandardMaterial({ color: 0xcfc6b8, roughness: 0.6, side: THREE.DoubleSide }),
  );
  teeth.position.set(0, MOUTH_Y - 0.0014, 0.047);
  group.add(cavity, teeth);
  // convert from world (rest pose) into the head bone's space so it follows the head
  group.applyMatrix4(toHead);
  head.add(group);
}
let mouthOverride: number | null = null;
/** Test hook: hold the mouth at a fixed openness (null to release). */
export function setMouthOverride(v: number | null) {
  mouthOverride = v;
}

/** Mouth openness 0..1: syllable-like pulses (~5/s) with phrase-level swells and short pauses. */
function mouthOpen(time: number): number {
  const syllable = 0.5 + 0.5 * Math.sin(time * 31);
  const vowel = 0.5 + 0.5 * Math.sin(time * 17.3 + 1.1);
  const phrase = smooth(Math.min(1, Math.max(0, 0.65 + 0.6 * Math.sin(time * 2.3))));
  return Math.min(1, (0.55 * syllable + 0.45 * vowel) ** 1.4 * phrase * 1.15);
}

// ---------------------------------------------------------------------------
// Pose: computed fresh each frame from time and state
// ---------------------------------------------------------------------------

const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const mix = (a: THREE.Vector3, b: THREE.Vector3, t: number) => a.clone().lerp(b, t);
const smooth = (x: number) => x * x * (3 - 2 * x);

// The model faces +Z; its left side is +X.
const ARM_DOWN = { upper: v(0.12, -1, 0.06), fore: v(0.05, -1, 0.18) };
const ARM_EXPLAIN = { upper: v(0.16, -0.92, 0.36), fore: v(-0.5, 0.32, 1) };
const ARM_OPEN = { upper: v(0.26, -0.88, 0.38), fore: v(0.02, 0.5, 1) };

function poseArm(r: Rig, side: 'left' | 'right', a: { upper: THREE.Vector3; fore: THREE.Vector3 }) {
  const s = side === 'left' ? 1 : -1;
  const mirror = (d: THREE.Vector3) => v(d.x * s, d.y, d.z);
  const L = side === 'left' ? 'Left' : 'Right';
  r.aim(`${L}Arm` as BoneName, `${L}ForeArm` as BoneName, mirror(a.upper));
  r.aim(`${L}ForeArm` as BoneName, `${L}Hand` as BoneName, mirror(a.fore));
}

function applyPose(r: Rig, t: number, speaking: boolean, phase: number) {
  r.reset();
  const time = t + phase;
  if (jawMesh?.morphTargetInfluences) jawMesh.morphTargetInfluences[0] = mouthOverride ?? (speaking ? mouthOpen(time) * 1.15 - 0.15 : -0.15);

  // breathing and a slow idle sway
  const breath = Math.sin(time * 1.6) * 0.012;
  r.turn('Spine1', X, breath);
  r.turn('Spine2', Y, Math.sin(time * 0.35) * 0.04);

  if (speaking) {
    // two hands gesturing out of step: explain (palms in) <-> open (palms out)
    const lt = smooth(0.5 + 0.5 * Math.sin(time * 2.1));
    const rt = smooth(0.5 + 0.5 * Math.sin(time * 1.55 + 1.3));
    const lift = 0.5 + 0.5 * Math.sin(time * 0.7);
    poseArm(r, 'left', {
      upper: mix(ARM_EXPLAIN.upper, ARM_OPEN.upper, lt),
      fore: mix(ARM_EXPLAIN.fore, ARM_OPEN.fore, lt).add(v(0, 0.15 * lift, 0)),
    });
    // the right hand rests now and then, so it never looks like a loop
    const rRest = smooth(Math.max(0, Math.sin(time * 0.45)));
    poseArm(r, 'right', {
      upper: mix(mix(ARM_EXPLAIN.upper, ARM_OPEN.upper, rt), ARM_DOWN.upper, rRest * 0.85),
      fore: mix(mix(ARM_EXPLAIN.fore, ARM_OPEN.fore, rt), ARM_DOWN.fore, rRest * 0.85),
    });
    r.turn('LeftHand', Z, Math.sin(time * 2.6) * 0.25);
    r.turn('RightHand', Z, -Math.sin(time * 2.2 + 0.6) * 0.25);
    r.curlFingers('left', 0.18 + 0.12 * Math.sin(time * 3));
    r.curlFingers('right', 0.22 + 0.1 * Math.sin(time * 2.7));
    // nodding and small turns of the head while talking
    r.turn('Neck', X, Math.sin(time * 4.2) * 0.035 + Math.sin(time * 1.3) * 0.03);
    r.turn('Head', Y, Math.sin(time * 0.9) * 0.12);
    r.turn('Head', Z, Math.sin(time * 1.7) * 0.03);
  } else {
    poseArm(r, 'left', ARM_DOWN);
    poseArm(r, 'right', ARM_DOWN);
    r.curlFingers('left', 0.35);
    r.curlFingers('right', 0.35);
    // glance around now and then
    r.turn('Head', Y, Math.sin(time * 0.5) * 0.1 + Math.sin(time * 0.23) * 0.06);
    r.turn('Neck', X, Math.sin(time * 0.8) * 0.02);
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const cameras: Record<Framing, THREE.PerspectiveCamera> = {
  bust: new THREE.PerspectiveCamera(24, 1, 0.1, 20),
  head: new THREE.PerspectiveCamera(22, 1, 0.1, 20),
};
cameras.bust.position.set(0, 1.52, 2.3);
cameras.bust.lookAt(0, 1.45, 0);
cameras.head.position.set(0, 1.66, 0.95);
cameras.head.lookAt(0, 1.63, 0);

async function ensureLoaded(): Promise<void> {
  if (rig) return;
  if (loading) return loading;
  loading = (async () => {
    const r = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.setClearColor(0x000000, 0);
    renderer = r;

    const s = new THREE.Scene();
    s.add(new THREE.HemisphereLight(0xfff4e6, 0x2a3346, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(1.2, 2.4, 2.2);
    s.add(key);
    const fill = new THREE.DirectionalLight(0xffe9d2, 0.9);
    fill.position.set(-1.4, 1.6, 2);
    s.add(fill);
    const rim = new THREE.DirectionalLight(0xffd7a8, 1.4);
    rim.position.set(-1.6, 2, -1.4);
    s.add(rim);
    scene = s;

    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const gltf = await loader.loadAsync(MODEL_URL);
    gltf.scene.traverse((o) => {
      const mesh = o as THREE.SkinnedMesh;
      if (mesh.isMesh) mesh.frustumCulled = false; // skinned bounds do not follow the pose
      if ((mesh as THREE.SkinnedMesh).isSkinnedMesh && /body/i.test(mesh.name) && !jawMesh && addJawMorph(mesh)) {
        jawMesh = mesh;
      }
    });
    s.add(gltf.scene);
    rig = new Rig(gltf.scene);
    if (jawMesh && rig.bones.Head) addMouthCavity(rig.bones.Head);
  })();
  return loading;
}

function drawInstance(inst: Instance, t: number) {
  if (!renderer || !scene || !rig) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.round(inst.canvas.clientWidth * dpr));
  const h = Math.max(1, Math.round(inst.canvas.clientHeight * dpr));
  if (inst.canvas.width !== w || inst.canvas.height !== h) {
    inst.canvas.width = w;
    inst.canvas.height = h;
  }
  const size = renderer.getSize(new THREE.Vector2());
  if (size.x < w || size.y < h) renderer.setSize(Math.max(size.x, w), Math.max(size.y, h), false);

  applyPose(rig, reducedMotion ? 0 : t, inst.speaking && !reducedMotion, inst.phase);
  const cam = cameras[inst.framing];
  cam.aspect = w / h;
  cam.updateProjectionMatrix();

  // render into the bottom-left w×h of the shared canvas, then copy it out
  const full = renderer.getSize(new THREE.Vector2());
  renderer.setScissorTest(true);
  renderer.setViewport(0, 0, w, h);
  renderer.setScissor(0, 0, w, h);
  renderer.clear();
  renderer.render(scene, cam);
  renderer.setScissorTest(false);
  inst.ctx.clearRect(0, 0, w, h);
  inst.ctx.drawImage(renderer.domElement, 0, full.y - h, w, h, 0, 0, w, h);
}

// While the page scrolls, hold the last drawn frame: the scroll gets the whole
// frame budget, and the avatar picks up again a moment after scrolling stops.
let lastScrollAt = -Infinity;
if (typeof window !== 'undefined') {
  window.addEventListener(
    'scroll',
    () => {
      lastScrollAt = performance.now();
    },
    { passive: true, capture: true },
  );
}

function frame(now: number) {
  rafId = 0;
  const live = [...instances].filter((i) => i.visible);
  if (!live.length) return;
  const scrolling = now - lastScrollAt < 180;
  if (!scrolling && now - lastFrame >= 1000 / FPS - 2) {
    lastFrame = now;
    for (const inst of live) drawInstance(inst, now / 1000);
  }
  if (!reducedMotion) rafId = requestAnimationFrame(frame);
}

function kick() {
  if (!rafId && rig) rafId = requestAnimationFrame(frame);
}

export function isWebGLAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Start drawing Raahi into `canvas`. Resolves once the model is ready; returns a controller. */
export async function attachAvatar(canvas: HTMLCanvasElement, framing: Framing, speaking: boolean) {
  await ensureLoaded();
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  const inst: Instance = {
    canvas,
    ctx,
    framing,
    speaking,
    visible: true,
    phase: Math.random() * 20,
    observer: new IntersectionObserver((entries) => {
      inst.visible = entries.some((e) => e.isIntersecting);
      if (inst.visible) kick();
    }),
  };
  inst.observer.observe(canvas);
  instances.add(inst);
  drawInstance(inst, performance.now() / 1000);
  kick();
  return {
    setSpeaking(next: boolean) {
      inst.speaking = next;
      if (reducedMotion) drawInstance(inst, 0);
      kick();
    },
    detach() {
      inst.observer.disconnect();
      instances.delete(inst);
    },
  };
}

/** True once the generated jaw morph is attached (used by tests). */
export function hasMouthMorph(): boolean {
  return Boolean(jawMesh?.morphTargetInfluences?.length);
}
