import * as THREE from 'three/webgpu';
import {
  pass, mrt, normalView, renderOutput, uniform, screenUV, builtinAOContext, vec3, vec4, float, mix,
  luminance, smoothstep, length, rand, time, fract, pow, max, clamp,
} from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { fxaa } from 'three/addons/tsl/display/FXAANode.js';
import { settings } from '../core/settings.js';
import { bus } from '../core/events.js';

// Graphics profiles change fidelity only — never collision, AI or puzzle readability (GDD 18.1).
export const PROFILES = {
  low:      { scale: 0.66, maxDpr: 1,    ao: false, aoScale: 0.5, aoSamples: 8,  bloom: true, shadow: 512,  lanternShadow: false, aa: true, aniso: 2,  particles: 0.4 },
  balanced: { scale: 0.85, maxDpr: 1.25, ao: true,  aoScale: 0.5, aoSamples: 8,  bloom: true, shadow: 1024, lanternShadow: false, aa: true, aniso: 4,  particles: 0.7 },
  high:     { scale: 1.0,  maxDpr: 1.5,  ao: true,  aoScale: 1.0, aoSamples: 16, bloom: true, shadow: 2048, lanternShadow: true,  aa: true, aniso: 8,  particles: 1.0 },
};

export function detectPreset(gl) {
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const r = (ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '').toLowerCase();
    if (/swiftshader|llvmpipe|software/.test(r)) return 'low';
    if (/rtx|radeon rx|radeon pro|arc\(tm\) a|geforce gtx 1[0-9]{3}|apple m[1-9]|apple gpu/.test(r)) return 'high';
    if (/intel|iris|uhd|hd graphics|mali|adreno/.test(r)) return 'balanced';
  } catch { /* fall through */ }
  return 'balanced';
}

export class Gfx {
  constructor(parent) {
    this.parent = parent;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.08, 400);
    this.profileName = 'balanced';
    this.profile = PROFILES.balanced;
    this.dynScale = 1; // adaptive resolution multiplier (PerformanceGovernor)

    // Authored grade — driven per zone and per beat by the director.
    this.grade = {
      tint: uniform(new THREE.Color(1, 1, 1)),
      lift: uniform(new THREE.Color(0, 0, 0)),
      saturation: uniform(1),
      contrast: uniform(1),
      vignette: uniform(0.35),
      grain: uniform(0.035),
      fade: uniform(0),        // 1 = black
      damage: uniform(0),      // edge desaturation when hurt
      gamma: uniform(1),       // brightness calibration
      bloom: uniform(0.35),
    };
  }

  async init() {
    const q = new URLSearchParams(location.search);
    const wantGPU = (settings.graphics.backend === 'webgpu' || q.has('webgpu')) && !q.has('webgl') && !!navigator.gpu;
    const renderer = new THREE.WebGPURenderer({ antialias: false, forceWebGL: !wantGPU, powerPreference: 'high-performance' });
    await renderer.init();
    this.renderer = renderer;
    this.backend = renderer.backend.isWebGPUBackend ? 'webgpu' : 'webgl2';
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.id = 'view';
    this.parent.prepend(renderer.domElement);

    let preset = settings.graphics.preset;
    if (preset === 'auto') {
      const gl = renderer.backend.gl || document.createElement('canvas').getContext('webgl2');
      preset = gl ? detectPreset(gl) : 'balanced';
    }
    this.pipeline = new THREE.RenderPipeline(renderer);
    this.pipeline.outputColorTransform = false;
    this.setProfile(preset);
    addEventListener('resize', () => this.resize());
    bus.on('settings.changed', ({ path }) => {
      if (path === 'graphics.preset') this.setProfile(settings.graphics.preset === 'auto' ? this.autoPreset || 'balanced' : settings.graphics.preset);
      if (path.startsWith('graphics') || path.startsWith('access')) this.applySettings();
    });
    this.autoPreset = preset;
    this.applySettings();
    return this;
  }

  applySettings() {
    this.grade.gamma.value = 1 / settings.access.brightness;
    this.grainBase = settings.graphics.filmGrain ? 0.035 : 0;
    this.grade.grain.value = this.grainBase;
    this.resize();
  }

  setProfile(name) {
    if (!PROFILES[name]) name = 'balanced';
    this.profileName = name;
    this.profile = PROFILES[name];
    this.buildPipeline();
    this.resize();
    bus.emit('graphics.profile_changed', { name, profile: this.profile });
  }

  buildPipeline() {
    const { scene, camera, profile: p, grade: g } = this;
    const scenePass = pass(scene, camera);
    if (p.ao) {
      const pre = pass(scene, camera);
      pre.setMRT(mrt({ output: normalView }));
      const aoPass = ao(pre.getTextureNode('depth'), pre.getTextureNode(), camera);
      aoPass.resolutionScale = p.aoScale;
      aoPass.samples.value = p.aoSamples;
      aoPass.radius.value = 0.45;
      aoPass.thickness.value = 1.2;
      aoPass.distanceFallOff.value = 0.9;
      aoPass.scale.value = 1.25;
      this.aoPass = aoPass;
      scenePass.contextNode = builtinAOContext(aoPass.getTextureNode().sample(screenUV).r);
    } else this.aoPass = null;

    let lin = scenePass.getTextureNode();
    if (p.bloom) {
      const b = bloom(lin, 1, 0.55, 1.0);
      this.bloomPass = b;
      lin = lin.add(b.mul(g.bloom));
    }
    lin = lin.mul(vec4(g.tint, 1));
    let out = renderOutput(lin, THREE.ACESFilmicToneMapping, THREE.SRGBColorSpace);
    if (p.aa) out = fxaa(out);

    // Display-referred finishing.
    const c0 = out.rgb;
    const d = length(screenUV.sub(0.5));
    const edge = smoothstep(0.25, 0.85, d);
    const lum = luminance(c0);
    const sat = g.saturation.mul(float(1).sub(g.damage.mul(edge).mul(0.9)));
    let c = mix(vec3(lum), c0, sat);
    c = c.sub(0.5).mul(g.contrast).add(0.5);
    c = c.add(g.lift.mul(float(1).sub(lum)));
    c = c.mul(float(1).sub(edge.mul(edge).mul(g.vignette.add(g.damage.mul(0.35)))));
    const n = rand(screenUV.add(fract(time.mul(7.13)))).sub(0.5);
    c = c.add(n.mul(g.grain).mul(float(1.2).sub(lum)));
    c = pow(max(c, 0), vec3(g.gamma));
    c = c.mul(float(1).sub(g.fade));
    this.pipeline.outputNode = vec4(clamp(c, 0, 1), 1);
    this.pipeline.needsUpdate = true;
  }

  resize() {
    if (!this.renderer) return;
    const w = this.parent.clientWidth || innerWidth, h = this.parent.clientHeight || innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, this.profile.maxDpr) * this.profile.scale * settings.graphics.renderScale * this.dynScale;
    this.renderer.setPixelRatio(Math.max(0.3, dpr));
    this.renderer.setSize(w, h, false);
    const el = this.renderer.domElement;
    el.style.width = '100%'; el.style.height = '100%';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setDynScale(s) {
    if (Math.abs(s - this.dynScale) < 0.01) return;
    this.dynScale = s; this.resize();
  }

  render() { this.pipeline.render(); }
  info() { return this.renderer.info.render; }
}
