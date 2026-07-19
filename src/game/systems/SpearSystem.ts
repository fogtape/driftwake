import { Group, MathUtils, PerspectiveCamera, type WebGLRenderer } from 'three';
import type { MaterialLibrary } from '../art/Materials';
import { createSpearModel } from '../art/ProceduralModels';
import { SPEAR_ATTACK_SECONDS, SPEAR_IMPACT_PROGRESS } from '../domain/combat';
import type { AudioSystem } from './AudioSystem';

export function resolveSpearImpact(
  upgraded: boolean,
  strikeTarget: (damage: number, counterPrimed: boolean) => boolean,
  onSpearHit: (upgraded: boolean) => void,
  counterPrimed = false,
): boolean {
  const hit = strikeTarget(upgraded ? 52 : 34, counterPrimed);
  if (hit) onSpearHit(upgraded);
  return hit;
}

export class SpearSystem {
  private readonly viewModels: { wood: Group; metal: Group };
  private equipped = false;
  private upgraded = false;
  private inputEnabled = false;
  private attackTime = 0;
  private impactResolved = false;
  private counterPrimed = false;

  constructor(
    private readonly renderer: WebGLRenderer,
    private readonly camera: PerspectiveCamera,
    materials: MaterialLibrary,
    private readonly audio: AudioSystem,
    private readonly strikeTarget: (damage: number, counterPrimed: boolean) => boolean,
    private readonly onSpearHit: (upgraded: boolean) => void = () => undefined,
    private readonly canPrimeCounter: () => boolean = () => false,
  ) {
    this.viewModels = {
      wood: createSpearModel(materials),
      metal: createSpearModel(materials, true),
    };
    this.viewModels.wood.name = 'first-person-wood-spear';
    this.viewModels.metal.name = 'first-person-metal-spear';
    for (const model of Object.values(this.viewModels)) {
      model.scale.setScalar(0.78);
      model.visible = false;
      this.camera.add(model);
    }
    this.renderer.domElement.addEventListener('mousedown', this.onPointerDown);
  }

  setEquipped(equipped: boolean, upgraded = false): void {
    this.equipped = equipped;
    this.upgraded = upgraded;
    this.viewModels.wood.visible = equipped && !upgraded;
    this.viewModels.metal.visible = equipped && upgraded;
    if (!equipped) {
      this.attackTime = 0;
      this.counterPrimed = false;
    }
  }

  setInputEnabled(enabled: boolean): void {
    this.inputEnabled = enabled;
  }

  update(time: number, delta: number): void {
    const viewModel = this.upgraded ? this.viewModels.metal : this.viewModels.wood;
    this.attackTime = Math.max(0, this.attackTime - delta);
    const attackProgress = this.attackTime > 0 ? 1 - this.attackTime / SPEAR_ATTACK_SECONDS : 0;
    const lunge = this.attackTime > 0 ? Math.pow(Math.sin(attackProgress * Math.PI), 1.4) : 0;
    const settle = Math.sin(time * 1.7) * 0.008;
    viewModel.position.set(0.62 + settle, -0.92 + lunge * 0.12, -0.56 - lunge * 0.76);
    viewModel.rotation.set(-1.08 - lunge * 0.18, -0.18, -0.28 + lunge * 0.12);
    if (this.attackTime > 0 && !this.impactResolved && attackProgress >= SPEAR_IMPACT_PROGRESS) {
      this.impactResolved = true;
      const counterPrimed = this.counterPrimed;
      this.counterPrimed = false;
      if (!resolveSpearImpact(
        this.upgraded,
        this.strikeTarget,
        this.onSpearHit,
        counterPrimed,
      )) this.audio.playDenied();
    }
  }

  dispose(): void {
    this.renderer.domElement.removeEventListener('mousedown', this.onPointerDown);
    this.camera.remove(this.viewModels.wood, this.viewModels.metal);
  }

  private readonly onPointerDown = (event: MouseEvent): void => {
    if (event.button !== 0 || !this.equipped || !this.inputEnabled || this.attackTime > 0) return;
    this.attackTime = SPEAR_ATTACK_SECONDS;
    this.impactResolved = false;
    this.counterPrimed = this.canPrimeCounter();
    this.audio.playSpearSwing();
  };
}
