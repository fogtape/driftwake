import {
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  TorusGeometry,
  Vector3,
} from 'three';
import { ITEM_DEFINITIONS, bundleLabel, type InventoryMutation } from '../domain/items';
import { useGameStore } from '../../state/gameStore';
import type { AudioSystem } from './AudioSystem';
import type { DebrisField, SalvageTarget } from './DebrisField';
import type { SplashSystem } from './SplashSystem';

export interface SalvageClaimResult extends InventoryMutation {
  source: SalvageTarget['source'];
  kind: SalvageTarget['kind'];
}

export function claimSalvageTarget(target: SalvageTarget, debris: DebrisField): SalvageClaimResult {
  const result = useGameStore.getState().receiveItemBundle(debris.getLoot(target));
  debris.settleCollection(target, result.accepted, result.rejected);
  return { ...result, source: target.source, kind: target.kind };
}

export function selectSalvageFocus(
  targets: readonly SalvageTarget[],
  cameraPosition: Vector3,
  forward: Vector3,
  toTarget: Vector3,
): SalvageTarget | null {
  let best: SalvageTarget | null = null;
  let bestAlong = Number.POSITIVE_INFINITY;
  for (const target of targets) {
    if (!target.active || target.latched) continue;
    toTarget.copy(target.model.position).sub(cameraPosition);
    const distanceSquared = toTarget.lengthSq();
    const largeTarget = target.kind === 'cache' || target.kind === 'barrel' || target.source === 'drop';
    const range = largeTarget ? 3.8 : 3.25;
    if (distanceSquared > range * range) continue;
    const along = toTarget.dot(forward);
    if (along <= 0 || along >= bestAlong) continue;
    const radius = largeTarget ? 0.72 : 0.48;
    const perpendicularSquared = Math.max(0, distanceSquared - along * along);
    if (perpendicularSquared > radius * radius) continue;
    best = target;
    bestAlong = along;
  }
  return best;
}

function targetLabel(target: SalvageTarget): string {
  if (target.source === 'drop') return '散落物资';
  if (target.kind === 'cache') return '盐封补给箱';
  if (target.kind === 'barrel') return '漂流补给桶';
  return ITEM_DEFINITIONS[target.kind].name;
}

export class SalvageSystem {
  private readonly forward = new Vector3();
  private readonly toTarget = new Vector3();
  private readonly targetPosition = new Vector3();
  private readonly highlight = new Mesh(
    new TorusGeometry(0.46, 0.025, 7, 32),
    new MeshBasicMaterial({ color: 0x75d7c2, transparent: true, opacity: 0.72, depthWrite: false }),
  );
  private focused: SalvageTarget | null = null;
  private enabled = false;
  private lastPrompt: string | null = null;
  private noticeTimer: number | null = null;

  constructor(
    private readonly scene: Scene,
    private readonly camera: PerspectiveCamera,
    private readonly debris: DebrisField,
    private readonly audio: AudioSystem,
    private readonly splashes: SplashSystem,
  ) {
    this.highlight.name = 'salvage-focus-ring';
    this.highlight.rotation.x = Math.PI / 2;
    this.highlight.visible = false;
    this.highlight.renderOrder = 4;
    this.scene.add(this.highlight);
    window.addEventListener('keydown', this.onKeyDown);
  }

  get focusedKind(): SalvageTarget['kind'] | null {
    return this.focused?.kind ?? null;
  }

  setInputEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (enabled) return;
    this.focused = null;
    this.highlight.visible = false;
    this.clearPrompt();
  }

  update(time: number): void {
    if (!this.enabled) return;
    this.camera.getWorldDirection(this.forward);
    const best = selectSalvageFocus(this.debris.targets, this.camera.position, this.forward, this.toTarget);

    this.focused = best;
    if (!best) {
      this.highlight.visible = false;
      this.clearPrompt();
      return;
    }
    this.highlight.visible = true;
    this.highlight.position.copy(best.model.position);
    this.highlight.position.y += 0.06;
    const pulse = 0.92 + Math.sin(time * 4.8) * 0.08;
    this.highlight.scale.setScalar(pulse * (best.kind === 'cache' || best.kind === 'barrel' ? 1.18 : 0.86));
    const command = best.source === 'drop' ? '捡起' : best.kind === 'cache' || best.kind === 'barrel' ? '开启' : '拾取';
    this.setPrompt(`${command}${targetLabel(best)} · E`);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    if (this.noticeTimer !== null) window.clearTimeout(this.noticeTimer);
    this.clearPrompt();
    this.scene.remove(this.highlight);
    this.highlight.geometry.dispose();
    this.highlight.material.dispose();
  }

  private collectFocused(): void {
    const target = this.focused;
    if (!target) return;
    this.targetPosition.copy(target.model.position);
    const result = claimSalvageTarget(target, this.debris);
    const acceptedLabel = bundleLabel(result.accepted);
    const rejected = Object.keys(result.rejected).length > 0;
    if (!acceptedLabel) {
      this.audio.playDenied();
      this.showNotice('背包已满，物资仍留在水面');
      return;
    }
    this.audio.playSalvagePickup(result.kind);
    this.splashes.spawnImpact(this.targetPosition, result.kind === 'cache' ? 0xefc35c : 0x83d8ca, result.kind === 'cache' ? 18 : 10);
    this.showNotice(rejected ? `${acceptedLabel} · 剩余物资留在水面` : acceptedLabel);
    this.focused = null;
    this.highlight.visible = false;
    this.clearPrompt();
  }

  private setPrompt(prompt: string): void {
    this.lastPrompt = prompt;
    useGameStore.getState().setInteraction(prompt, 'salvage');
  }

  private clearPrompt(): void {
    const store = useGameStore.getState();
    if (this.lastPrompt && store.interaction === this.lastPrompt) store.setInteraction(null, 'salvage');
    this.lastPrompt = null;
  }

  private showNotice(message: string): void {
    useGameStore.getState().showNotice(message);
    if (this.noticeTimer !== null) window.clearTimeout(this.noticeTimer);
    this.noticeTimer = window.setTimeout(() => {
      if (useGameStore.getState().notice === message) useGameStore.getState().showNotice(null);
    }, 1450);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (
      event.code !== 'KeyE'
      || event.repeat
      || !this.enabled
      || !this.focused
      || useGameStore.getState().interactionOwner !== 'salvage'
    ) return;
    event.preventDefault();
    this.collectFocused();
  };
}
