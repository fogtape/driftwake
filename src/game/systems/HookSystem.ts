import {
  BufferAttribute,
  BufferGeometry,
  Group,
  Line,
  LineBasicMaterial,
  MathUtils,
  PerspectiveCamera,
  Scene,
  Vector3,
  type WebGLRenderer,
} from 'three';
import type { MaterialLibrary } from '../art/Materials';
import { createSalvageHandsRig, type SalvageHandsRig } from '../art/FirstPersonModels';
import { bundleLabel } from '../domain/items';
import { sampleWaveHeight } from '../math/waves';
import {
  HOOK_ROPE_SEGMENTS,
  createHookHandPose,
  sampleHookHandPose,
  sampleHookRopeTension,
  writeHookRopeCurve,
  type HookPresentationState,
} from '../presentation/hookPresentation';
import { useGameStore } from '../../state/gameStore';
import type { AudioSystem } from './AudioSystem';
import type { DebrisField, SalvageTarget } from './DebrisField';
import { claimSalvageTarget } from './SalvageSystem';
import type { SplashSystem } from './SplashSystem';

export type HookState = HookPresentationState;

export interface HookVisualState {
  state: HookState;
  heldVisible: boolean;
  handsVisible: boolean;
  projectileVisible: boolean;
  ropeVisible: boolean;
  ropeTension: number;
  ropeSag: number;
}

export function shouldShowHeldHook(state: HookState, equipped: boolean): boolean {
  return equipped && (state === 'idle' || state === 'charging');
}

export interface HookPointerDownGate {
  button: number;
  enabled: boolean;
  equipped: boolean;
  state: HookState;
  pointerLocked: boolean;
  now: number;
  armedAt: number;
}

/** Keeps a pointer-lock transition from turning the resume click into a cast. */
export function shouldBeginHookCast(input: HookPointerDownGate): boolean {
  return input.button === 0
    && input.enabled
    && input.equipped
    && input.state === 'idle'
    && input.pointerLocked
    && input.now >= input.armedAt;
}

export class HookSystem {
  private readonly handsRig: SalvageHandsRig;
  private readonly projectile: Group;
  private readonly ropeGeometry = new BufferGeometry();
  private readonly rope: Line<BufferGeometry, LineBasicMaterial>;
  private readonly hookPosition = new Vector3();
  private readonly hookVelocity = new Vector3();
  private readonly origin = new Vector3();
  private readonly target = new Vector3();
  private readonly forward = new Vector3();
  private readonly ropePositions = new Float32Array((HOOK_ROPE_SEGMENTS + 1) * 3);
  private readonly handPose = createHookHandPose();
  private state: HookState = 'idle';
  private charge = 0;
  private castAge = 0;
  private ropeTension = 0;
  private ropeSag = 0;
  private latchedItem: SalvageTarget | null = null;
  private noticeTimer: number | null = null;
  private enabled = false;
  private equipped = false;
  private inputArmedAt = Number.POSITIVE_INFINITY;

  constructor(
    private readonly renderer: WebGLRenderer,
    private readonly camera: PerspectiveCamera,
    scene: Scene,
    materials: MaterialLibrary,
    private readonly debris: DebrisField,
    private readonly audio: AudioSystem,
    private readonly splashes: SplashSystem,
  ) {
    this.handsRig = createSalvageHandsRig(materials);
    this.handsRig.root.visible = false;
    this.camera.add(this.handsRig.root);
    this.handsRig.applyPose(this.handPose);

    this.projectile = this.handsRig.heldHook.clone(true);
    this.projectile.name = 'thrown-hook';
    this.projectile.scale.setScalar(0.28);
    this.projectile.visible = false;
    scene.add(this.projectile);

    this.ropeGeometry.setAttribute('position', new BufferAttribute(this.ropePositions, 3));
    this.rope = new Line(this.ropeGeometry, new LineBasicMaterial({ color: 0xd2aa71, transparent: true, opacity: 0.9 }));
    this.rope.visible = false;
    this.rope.frustumCulled = false;
    scene.add(this.rope);

    renderer.domElement.addEventListener('mousedown', this.onPointerDown);
    document.addEventListener('mouseup', this.onPointerUp);
  }

  setEnabled(enabled: boolean): void {
    if (enabled && !this.enabled) {
      // Pointer Lock may dispatch a mouse event from the gesture that acquired it.
      // Keep casting disarmed until the resume gesture has fully settled.
      this.inputArmedAt = performance.now() + 140;
    }
    this.enabled = enabled;
    if (!enabled) {
      this.inputArmedAt = Number.POSITIVE_INFINITY;
      if (this.state !== 'idle') this.reset();
    }
  }

  setEquipped(equipped: boolean): void {
    this.equipped = equipped;
    if (!equipped && this.state !== 'idle') this.reset();
    else this.syncHeldVisibility();
  }

  getVisualState(): HookVisualState {
    return {
      state: this.state,
      heldVisible: this.handsRig.root.visible && this.handsRig.heldHook.visible,
      handsVisible: this.handsRig.root.visible,
      projectileVisible: this.projectile.visible,
      ropeVisible: this.rope.visible,
      ropeTension: this.ropeTension,
      ropeSag: this.ropeSag,
    };
  }

  update(time: number, delta: number): void {
    if (this.state === 'flying' || this.state === 'latched' || this.state === 'retracting') this.castAge += delta;
    if (this.state === 'charging') {
      this.charge = Math.min(1, this.charge + delta / 1.05);
      useGameStore.getState().setHookCharge(this.charge);
    } else if (this.state === 'flying') {
      this.hookVelocity.y -= 5.6 * delta;
      this.hookPosition.addScaledVector(this.hookVelocity, delta);
      this.projectile.position.copy(this.hookPosition);
      this.projectile.rotation.z += delta * 5.2;
      const hit = this.debris.findCollision(this.hookPosition, 0.78);
      if (hit) {
        this.debris.latch(hit);
        this.latchedItem = hit;
        this.state = 'latched';
        this.audio.playSplash(this.hookPosition);
      } else {
        const surface = sampleWaveHeight(this.hookPosition.x, this.hookPosition.z, time);
        if (this.hookPosition.y <= surface + 0.03 || this.hookPosition.distanceTo(this.camera.position) > 31) {
          this.hookPosition.y = Math.max(this.hookPosition.y, surface);
          this.splashes.spawn(this.hookPosition);
          this.audio.playSplash(this.hookPosition);
          this.state = 'retracting';
        }
      }
    } else if (this.state === 'latched' && this.latchedItem) {
      this.getRopeGuideWorldPosition(this.target);
      const itemPosition = this.latchedItem.model.position;
      const distance = itemPosition.distanceTo(this.target);
      const step = Math.min(distance, delta * (5.2 + Math.max(0, 9 - distance) * 0.28));
      itemPosition.lerp(this.target, distance > 0 ? step / distance : 1);
      this.hookPosition.copy(itemPosition);
      this.projectile.position.copy(itemPosition);
      if (distance < 0.72) this.completeCollection(this.latchedItem);
    } else if (this.state === 'retracting') {
      this.getRopeGuideWorldPosition(this.target);
      const distance = this.hookPosition.distanceTo(this.target);
      this.hookPosition.lerp(this.target, distance > 0 ? Math.min(1, (delta * 13) / distance) : 1);
      this.projectile.position.copy(this.hookPosition);
      if (distance < 0.35) this.reset();
    }

    const ropeDistance = this.rope.visible ? this.hookPosition.distanceTo(this.camera.position) : 0;
    this.ropeTension = sampleHookRopeTension(this.state, ropeDistance);
    sampleHookHandPose(this.state, this.charge, time, this.castAge, this.ropeTension, this.handPose);
    this.handsRig.applyPose(this.handPose);
    this.updateRope(time);
    if (this.state === 'latched' || this.state === 'retracting') this.audio.playHookRope(this.ropeTension);
  }

  dispose(scene: Scene): void {
    this.renderer.domElement.removeEventListener('mousedown', this.onPointerDown);
    document.removeEventListener('mouseup', this.onPointerUp);
    if (this.noticeTimer !== null) window.clearTimeout(this.noticeTimer);
    this.camera.remove(this.handsRig.root);
    scene.remove(this.projectile, this.rope);
    this.ropeGeometry.dispose();
    this.rope.material.dispose();
  }

  private cast(): void {
    this.state = 'flying';
    this.castAge = 0;
    this.syncHeldVisibility();
    this.getCastWorldPosition(this.hookPosition);
    this.camera.getWorldDirection(this.forward);
    const strength = 12.5 + this.charge * 12.5;
    this.hookVelocity.copy(this.forward).multiplyScalar(strength);
    this.hookVelocity.y += 2.4 + this.charge * 2.6;
    this.projectile.position.copy(this.hookPosition);
    this.projectile.quaternion.copy(this.camera.quaternion);
    this.projectile.visible = true;
    this.rope.visible = true;
    this.audio.playCast(this.charge);
    const wear = useGameStore.getState().damageTool('hook');
    if (wear.broken) {
      this.audio.playHookBreak();
      this.showNotice('打捞钩断裂 · 可近距拾取物资制作替代钩', 2600);
    }
    useGameStore.getState().setHookCharge(0);
  }

  private completeCollection(item: SalvageTarget): void {
    this.target.copy(item.model.position);
    const result = claimSalvageTarget(item, this.debris);
    this.latchedItem = null;
    const accepted = bundleLabel(result.accepted);
    const rejected = Object.keys(result.rejected).length > 0;
    if (!accepted) {
      this.audio.playDenied();
      this.showNotice('背包已满，物资仍留在水面');
      this.reset();
      return;
    }
    this.audio.playSalvagePickup(result.kind, this.target);
    this.showNotice(rejected ? `${accepted} · 剩余物资留在水面` : accepted);
    this.reset();
  }

  private showNotice(notice: string, duration = 1450): void {
    useGameStore.getState().showNotice(notice);
    if (this.noticeTimer !== null) window.clearTimeout(this.noticeTimer);
    this.noticeTimer = window.setTimeout(() => {
      if (useGameStore.getState().notice === notice) useGameStore.getState().showNotice(null);
    }, duration);
  }

  private reset(): void {
    if (this.latchedItem) this.debris.release(this.latchedItem);
    this.latchedItem = null;
    this.state = 'idle';
    this.charge = 0;
    this.castAge = 0;
    this.ropeTension = 0;
    this.ropeSag = 0;
    this.projectile.visible = false;
    this.rope.visible = false;
    this.syncHeldVisibility();
    useGameStore.getState().setHookCharge(0);
  }

  private syncHeldVisibility(): void {
    this.handsRig.root.visible = this.equipped;
    this.handsRig.heldHook.visible = shouldShowHeldHook(this.state, this.equipped);
  }

  private getRopeGuideWorldPosition(target: Vector3): Vector3 {
    return this.handsRig.ropeGuide.getWorldPosition(target);
  }

  private getCastWorldPosition(target: Vector3): Vector3 {
    return this.handsRig.castOrigin.getWorldPosition(target);
  }

  private updateRope(time: number): void {
    if (!this.rope.visible) return;
    this.getRopeGuideWorldPosition(this.origin);
    const distance = this.origin.distanceTo(this.hookPosition);
    this.ropeTension = sampleHookRopeTension(this.state, distance);
    this.ropeSag = writeHookRopeCurve(this.ropePositions, this.origin, this.hookPosition, this.ropeTension, time);
    this.rope.material.color.setRGB(
      MathUtils.lerp(0.62, 0.94, this.ropeTension),
      MathUtils.lerp(0.42, 0.7, this.ropeTension),
      MathUtils.lerp(0.24, 0.38, this.ropeTension),
    );
    const attribute = this.ropeGeometry.getAttribute('position') as BufferAttribute;
    attribute.needsUpdate = true;
  }

  private readonly onPointerDown = (event: MouseEvent): void => {
    if (!shouldBeginHookCast({
      button: event.button,
      enabled: this.enabled,
      equipped: this.equipped,
      state: this.state,
      pointerLocked: document.pointerLockElement === this.renderer.domElement,
      now: performance.now(),
      armedAt: this.inputArmedAt,
    })) return;
    this.state = 'charging';
    this.charge = 0;
    this.syncHeldVisibility();
  };

  private readonly onPointerUp = (event: MouseEvent): void => {
    if (event.button !== 0 || this.state !== 'charging') return;
    if (!this.enabled || document.pointerLockElement !== this.renderer.domElement) {
      this.reset();
      return;
    }
    this.charge = MathUtils.clamp(this.charge, 0.12, 1);
    this.cast();
  };
}
