// Boot scaffold: proves the WebGPU + TSL render path end to end.
// Replaced by the real game once the design document lands.
import * as THREE from 'three/webgpu';
import { pass, color, time, positionLocal, sin, mix, normalWorld } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';

// ?webgl forces the WebGL2 backend (same TSL materials) — used by the headless test rig and as a
// manual fallback switch; the renderer also falls back by itself when WebGPU is unavailable.
const Q = new URLSearchParams(location.search);
const renderer = new THREE.WebGPURenderer({ antialias: true, forceWebGL: Q.has('webgl') });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);
await renderer.init();

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050506);
const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 0.4, 6);

const gate = new THREE.Mesh(
  new THREE.TorusGeometry(1.5, 0.08, 32, 200),
  new THREE.MeshStandardNodeMaterial({ roughness: 0.25, metalness: 1 }),
);
const pulse = sin(time.mul(1.5).add(positionLocal.y.mul(3))).mul(0.5).add(0.5);
gate.material.emissiveNode = mix(color(0x1a0f05), color(0xffa040), pulse).mul(normalWorld.z.abs().add(0.4)).mul(2.5);
scene.add(gate);
scene.add(new THREE.HemisphereLight(0x8090ff, 0x100804, 0.6));

const pipeline = new THREE.PostProcessing(renderer);
const scenePass = pass(scene, camera);
const sceneColor = scenePass.getTextureNode();
pipeline.outputNode = sceneColor.add(bloom(sceneColor, 0.9, 0.6, 0.2));

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

let frames = 0;
renderer.setAnimationLoop(() => {
  gate.rotation.y += 0.004;
  pipeline.render();
  frames++;
  window.__boot = { frames, backend: renderer.backend.isWebGPUBackend ? 'webgpu' : 'webgl2' };
});
