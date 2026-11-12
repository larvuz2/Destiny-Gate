import * as THREE from 'three/webgpu';
import { bus } from '../core/events.js';
import { Collision } from './collision.js';
import { Character } from './character.js';
import { Player } from './player.js';
import { FollowCamera } from './camera.js';
import { FractureController } from './fracture.js';
import { ToolManager } from './tools.js';
import { Madness, CLIPS as MAD_CLIPS } from './madness.js';
import { Director } from './director.js';
import { PropBatch } from '../world/props.js';
import { Vfx } from '../gfx/vfx.js';

// Simulation root. `step` runs at the fixed tick; `present` runs per rendered frame.
export class Game {
  constructor({ gfx, world, lights, input }) {
    this.gfx = gfx; this.world = world; this.lights = lights; this.input = input;
    this.col = new Collision(world);
    this.cam = new FollowCamera(gfx.camera, this.col);
    this.player = new Player(this);
    this.t = 0; this.scrollRate = 1;
    this.focusPos = new THREE.Vector3();
  }

  async load(onProgress = () => {}) {
    const [mitchell, madness] = await Promise.all([
      Character.load('mitchell', Player.CLIPS, { height: 1.78, onProgress: (k) => onProgress(k * 0.5) }),
      Character.load('madness', MAD_CLIPS, { height: 2.45, onProgress: (k) => onProgress(0.5 + k * 0.5) }),
    ]);
    this.player.attach(mitchell);
    this.fracture = new FractureController(this);
    this.tools = new ToolManager(this);
    this.tools.buildViews(new PropBatch(this.world.props));
    this.madness = new Madness(this);
    this.madness.attach(madness);
    this.director = new Director(this);
    this.director.setup();
    this.vfx = new Vfx(this);
    this.gfx.scene.fog = new THREE.FogExp2(0x000000, 0.01);
    this.gfx.scene.background = new THREE.Color(0x000000);
  }

  start(checkpoint = 'start') { this.director.load(checkpoint); }

  /** A sound the hunter can hear. */
  noise(x, z, radius, type) { this.madness.hear(x, z, radius, type); bus.emit('noise', { x, z, radius, type }); }
  onFloorChanged() { this.madness.nav.dirty = true; }

  step(dt) {
    this.t += dt;
    this.world.update(dt, this.t);   // doors, gates and mechanisms are gameplay: fixed tick
    if (this.world.navDirty) { this.world.navDirty = false; this.madness.nav.dirty = true; }
    this.player.step(dt);
    this.tools.step(dt);
    this.madness.step(dt);
    this.fracture.step(dt);
    this.director.step(dt);
  }

  applyAtmosphere(dt, zone) {
    const scene = this.gfx.scene;
    const f = zone.fog || { color: 0x000000, density: 0.01 };
    const k = Math.min(1, dt * 1.5);
    scene.fog.color.lerp((this._fc ||= new THREE.Color()).set(f.color), k);
    scene.fog.density += (f.density - scene.fog.density) * k;
    scene.background.copy(scene.fog.color);
    const h = zone.hemi || { sky: 0x9aa6bd, ground: 0x3a2a1c, intensity: 0.55 };
    const hl = this.lights.hemi;
    hl.color.lerp((this._hs ||= new THREE.Color()).set(h.sky), k); hl.groundColor.lerp((this._hg ||= new THREE.Color()).set(h.ground), k);
    hl.intensity += (h.intensity - hl.intensity) * k;
    const r = this.gfx.renderer;
    r.toneMappingExposure += ((zone.exposure || 1) - r.toneMappingExposure) * k;
    // hurt: edge desaturation instead of a health bar (GDD 4.4)
    const g = this.gfx.grade, hurt = this.player.damaged ? 1 : 0;
    g.damage.value += (hurt - g.damage.value) * Math.min(1, dt * 3);
  }

  present(dt, alpha) {
    const p = this.player;
    if (dt > 0) { const look = this.input.consumeLook(); if (p.state !== 'cinematic' && !this.director.endT >= 0) this.cam.addLook(look.x, look.y); }
    p.present(dt, alpha);
    this.tools.present(dt);
    this.madness.present(dt, alpha);
    const subject = p.char.root.position;
    const zone = this.world.zoneAt(subject.x);
    this.world.setActiveZone(zone, subject.x);
    this.cam.ceiling = () => zone.ceiling || 2.6;
    this.cam.height = p.state === 'seated' ? 1.12 : p.state === 'standing' ? 1.12 + Math.min(1, p.stateT / 1.6) * 0.4 : p.state === 'knocked' ? 0.9 : 1.52;
    this.cam.arm = p.state === 'seated' ? 1.25 : 2.2;
    this.cam.update(dt, subject);
    // when a wall forces the camera into Mitchell's shoulders, drop him out rather than fill the frame
    const near = this.cam.override ? false : this.cam.armNow < (this._nearHide ? 0.66 : 0.52);
    if (near !== this._nearHide) { this._nearHide = near; p.char.mesh.visible = !near; }
    this.applyAtmosphere(dt, zone);
    this.world.uniforms.scroll.value += dt * 0.02 * this.scrollRate;
    this.vfx.update(dt);
    this.fracture.present(this.t, this.tools.has.lantern ? this.tools.lanternPos : null, this.tools.focusK);
    this.focusPos.copy(subject);
    this.lights.update(dt, this.focusPos, (l) => Math.abs(l.pos.x - subject.x) < 16 || l.kind === 'station');
    this.lights.ceiling = zone.keyHeight || 2.75;
    this.lights.updateKey(dt, subject, 1, this.director.keyLevel ?? 1, zone.key || null);
  }
}
