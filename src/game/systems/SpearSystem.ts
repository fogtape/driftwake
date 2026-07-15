import { Group, MathUtils, PerspectiveCamera, type WebGLRenderer } from 'three';
import type { MaterialLibrary } from '../art/Materials';
import { createSpearModel } from '../art/ProceduralModels';
import type { AudioSystem } from './AudioSystem';

export class SpearSystem {
  private readonly viewModel: Group;
  private equipped = false;
  private inputEnabled = false;
  private attackTime = 0;
  private impactResolved = false;

  constructor(
    private readonly renderer: WebGLRenderer,
    private readonly camera: PerspectiveCamera,
    materials: MaterialLibrary,
    private readonly audio: AudioSystem,
    private readonly strikeTarget: () => boolean,
  ) {
    this.viewModel = createSpearModel(materials);
    this.viewModel.name = 'first-person-spear';
    this.viewModel.scale.setScalar(0.78);
    this.viewModel.visible = false;
    this.camera.add(this.viewModel);
    this.renderer.domElement.addEventListener('mousedown', this.onPointerDown);
  }

  setEquipped(equipped: boolean): void {
    this.equipped = equipped;
    this.viewModel.visible = equipped;
    if (!equipped) this.attackTime = 0;
  }

  setInputEnabled(enabled: boolean): void {
    this.inputEnabled = enabled;
  }

  update(time: number, delta: number): void {
    this.attackTime = Math.max(0, this.attackTime - delta);
    const attackProgress = this.attackTime > 0 ? 1 - this.attackTime / 0.52 : 0;
    const lunge = this.attackTime > 0 ? Math.pow(Math.sin(attackProgress * Math.PI), 1.4) : 0;
    const settle = Math.sin(time * 1.7) * 0.008;
    this.viewModel.position.set(0.62 + settle, -0.92 + lunge * 0.12, -0.56 - lunge * 0.76);
    this.viewModel.rotation.set(-1.08 - lunge * 0.18, -0.18, -0.28 + lunge * 0.12);
    if (this.attackTime > 0 && !this.impactResolved && attackProgress >= 0.38) {
      this.impactResolved = true;
      if (!this.strikeTarget()) this.audio.playDenied();
    }
  }

  dispose(): void {
    this.renderer.domElement.removeEventListener('mousedown', this.onPointerDown);
    this.camera.remove(this.viewModel);
  }

  private readonly onPointerDown = (event: MouseEvent): void => {
    if (event.button !== 0 || !this.equipped || !this.inputEnabled || this.attackTime > 0) return;
    this.attackTime = 0.52;
    this.impactResolved = false;
    this.audio.playSpearSwing();
  };
}
