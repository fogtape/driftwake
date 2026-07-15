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
import { sampleWaveHeight } from '../math/waves';
import { useGameStore, type InventorySnapshot } from '../../state/gameStore';
import type { AudioSystem } from './AudioSystem';
import type { DebrisField, DebrisItem } from './DebrisField';
import type { SplashSystem } from './SplashSystem';

type HookState = 'idle' | 'charging' | 'flying' | 'latched' | 'retracting';

const INVENTORY_LABELS: Record<DebrisKind, string> = {
  timber: '木料',
  polymer: '聚合片',
  fiber: '纤维',
  cache: '补给箱',
};

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
  private latchedItem: DebrisItem | null = null;
  private noticeTimer: number | null = null;
  private enabled = false;

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

  update(time: number, delta: number, waveScale = 1): void {
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
        const surface = sampleWaveHeight(this.hookPosition.x, this.hookPosition.z, time, waveScale);
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
    useGameStore.getState().setHookCharge(0);
  }

  private completeCollection(item: DebrisItem): void {
    const kind = this.debris.collect(item);
    this.latchedItem = null;
    useGameStore.getState().addInventory(kind as keyof InventorySnapshot, 1);
    useGameStore.getState().showNotice(`+1 ${INVENTORY_LABELS[kind]}`);
    if (this.noticeTimer !== null) window.clearTimeout(this.noticeTimer);
    this.noticeTimer = window.setTimeout(() => useGameStore.getState().showNotice(null), 1250);
    this.audio.playCollect();
    this.reset();
  }

  private reset(): void {
    if (this.latchedItem) this.latchedItem.latched = false;
    this.latchedItem = null;
    this.state = 'idle';
    this.charge = 0;
    this.projectile.visible = false;
    this.rope.visible = false;
    useGameStore.getState().setHookCharge(0);
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
    if (event.button !== 0 || !this.enabled || this.state !== 'idle') return;
    this.state = 'charging';
    this.charge = 0;
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
