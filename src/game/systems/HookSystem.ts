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
import { createHookModel, type DebrisKind } from '../art/ProceduralModels';
import { bundleLabel } from '../domain/items';
import { sampleWaveHeight } from '../math/waves';
import { useGameStore } from '../../state/gameStore';
import type { AudioSystem } from './AudioSystem';
import type { DebrisField, SalvageTarget } from './DebrisField';
import { claimSalvageTarget } from './SalvageSystem';
import type { SplashSystem } from './SplashSystem';

export type HookState = 'idle' | 'charging' | 'flying' | 'latched' | 'retracting';

export interface HookVisualState {
  state: HookState;
  heldVisible: boolean;
  projectileVisible: boolean;
  ropeVisible: boolean;
}

export function shouldShowHeldHook(state: HookState, equipped: boolean): boolean {
  return equipped && (state === 'idle' || state === 'charging');
}

export class HookSystem {
  private readonly viewModel: Group;
  private readonly projectile: Group;
  private readonly ropeGeometry = new BufferGeometry();
  private readonly rope: Line<BufferGeometry, LineBasicMaterial>;
  private readonly hookPosition = new Vector3();
  private readonly hookVelocity = new Vector3();
  private readonly origin = new Vector3();
  private readonly target = new Vector3();
  private readonly forward = new Vector3();
  private readonly ropePositions = new Float32Array(6);
  private state: HookState = 'idle';
  private charge = 0;
  private latchedItem: SalvageTarget | null = null;
  private noticeTimer: number | null = null;
  private enabled = false;
  private equipped = false;

  constructor(
    private readonly renderer: WebGLRenderer,
    private readonly camera: PerspectiveCamera,
    scene: Scene,
    materials: MaterialLibrary,
    private readonly debris: DebrisField,
    private readonly audio: AudioSystem,
    private readonly splashes: SplashSystem,
  ) {
    this.viewModel = createHookModel(materials);
    this.viewModel.name = 'first-person-hook';
    this.viewModel.scale.setScalar(0.72);
    this.viewModel.position.set(0.47, -0.64, -0.83);
    this.viewModel.rotation.set(-0.2, -0.25, -0.22);
    this.viewModel.visible = false;
    this.camera.add(this.viewModel);

    this.projectile = this.viewModel.clone(true);
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
    this.enabled = enabled;
    if (!enabled && this.state === 'charging') this.reset();
  }

  setEquipped(equipped: boolean): void {
    this.equipped = equipped;
    if (!equipped && this.state === 'charging') this.reset();
    else this.syncHeldVisibility();
  }

  getVisualState(): HookVisualState {
    return {
      state: this.state,
      heldVisible: this.viewModel.visible,
      projectileVisible: this.projectile.visible,
      ropeVisible: this.rope.visible,
    };
  }

  update(time: number, delta: number): void {
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
        this.audio.playSplash();
      } else {
        const surface = sampleWaveHeight(this.hookPosition.x, this.hookPosition.z, time);
        if (this.hookPosition.y <= surface + 0.03 || this.hookPosition.distanceTo(this.camera.position) > 31) {
          this.hookPosition.y = Math.max(this.hookPosition.y, surface);
          this.splashes.spawn(this.hookPosition);
          this.audio.playSplash();
          this.state = 'retracting';
        }
      }
    } else if (this.state === 'latched' && this.latchedItem) {
      this.getHandWorldPosition(this.target);
      const itemPosition = this.latchedItem.model.position;
      const distance = itemPosition.distanceTo(this.target);
      const step = Math.min(distance, delta * (5.2 + Math.max(0, 9 - distance) * 0.28));
      itemPosition.lerp(this.target, distance > 0 ? step / distance : 1);
      this.hookPosition.copy(itemPosition);
      this.projectile.position.copy(itemPosition);
      if (distance < 0.72) this.completeCollection(this.latchedItem);
    } else if (this.state === 'retracting') {
      this.getHandWorldPosition(this.target);
      const distance = this.hookPosition.distanceTo(this.target);
      this.hookPosition.lerp(this.target, distance > 0 ? Math.min(1, (delta * 13) / distance) : 1);
      this.projectile.position.copy(this.hookPosition);
      if (distance < 0.35) this.reset();
    }

    const sway = this.state === 'idle' ? Math.sin(time * 1.7) * 0.012 : 0;
    const chargePull = this.state === 'charging' ? this.charge : 0;
    this.viewModel.position.set(0.47 + sway, -0.64 - chargePull * 0.045, -0.83 + chargePull * 0.14);
    this.viewModel.rotation.set(-0.2 - chargePull * 0.22, -0.25, -0.22 + chargePull * 0.35);
    this.updateRope();
  }

  dispose(scene: Scene): void {
    this.renderer.domElement.removeEventListener('mousedown', this.onPointerDown);
    document.removeEventListener('mouseup', this.onPointerUp);
    if (this.noticeTimer !== null) window.clearTimeout(this.noticeTimer);
    this.camera.remove(this.viewModel);
    scene.remove(this.projectile, this.rope);
    this.ropeGeometry.dispose();
    this.rope.material.dispose();
  }

  private cast(): void {
    this.state = 'flying';
    this.syncHeldVisibility();
    this.getHandWorldPosition(this.hookPosition);
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
    if (wear.broken) this.showNotice('打捞钩断裂 · 可近距拾取物资制作替代钩', 2600);
    useGameStore.getState().setHookCharge(0);
  }

  private completeCollection(item: SalvageTarget): void {
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
    this.audio.playSalvagePickup(result.kind);
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
    this.projectile.visible = false;
    this.rope.visible = false;
    this.syncHeldVisibility();
    useGameStore.getState().setHookCharge(0);
  }

  private syncHeldVisibility(): void {
    this.viewModel.visible = shouldShowHeldHook(this.state, this.equipped);
  }

  private getHandWorldPosition(target: Vector3): Vector3 {
    target.set(0.42, -0.34, -0.72);
    return this.camera.localToWorld(target);
  }

  private updateRope(): void {
    if (!this.rope.visible) return;
    this.getHandWorldPosition(this.origin);
    this.ropePositions[0] = this.origin.x;
    this.ropePositions[1] = this.origin.y;
    this.ropePositions[2] = this.origin.z;
    this.ropePositions[3] = this.hookPosition.x;
    this.ropePositions[4] = this.hookPosition.y;
    this.ropePositions[5] = this.hookPosition.z;
    const attribute = this.ropeGeometry.getAttribute('position') as BufferAttribute;
    attribute.needsUpdate = true;
    this.ropeGeometry.computeBoundingSphere();
  }

  private readonly onPointerDown = (event: MouseEvent): void => {
    if (event.button !== 0 || !this.enabled || !this.equipped || this.state !== 'idle') return;
    this.state = 'charging';
    this.charge = 0;
    this.syncHeldVisibility();
  };

  private readonly onPointerUp = (event: MouseEvent): void => {
    if (event.button !== 0 || this.state !== 'charging') return;
    if (!this.enabled) {
      this.reset();
      return;
    }
    this.charge = MathUtils.clamp(this.charge, 0.12, 1);
    this.cast();
  };
}
