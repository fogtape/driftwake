import {
  Color,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Quaternion,
  Ray,
  Vector3,
  type WebGLRenderer,
} from 'three';
import { createHammerModel, createRaftTile } from '../art/ProceduralModels';
import type { MaterialLibrary } from '../art/Materials';
import { ITEM_DEFINITIONS, hasItems, type ItemBundle } from '../domain/items';
import { useGameStore } from '../../state/gameStore';
import type { AudioSystem } from './AudioSystem';
import { RAFT_TILE_X, RAFT_TILE_Z, type GridCoordinate, type RaftSystem } from './RaftSystem';
import type { SplashSystem } from './SplashSystem';

type PreviewMode = 'build' | 'repair' | 'invalid' | 'hidden';
export type HammerAction = 'build' | 'repair' | 'dismantle';

const FOUNDATION_COST: ItemBundle = { timber: 2, polymer: 1 };
const REPAIR_COST: ItemBundle = { timber: 1 };

function coordinateEquals(a: GridCoordinate | null, b: GridCoordinate | null): boolean {
  return Boolean(a && b && a.x === b.x && a.z === b.z);
}

export class BuildSystem {
  private readonly viewModel: Group;
  private readonly preview: Group;
  private readonly previewMaterials: MeshStandardMaterial[] = [];
  private readonly ray = new Ray();
  private readonly localOrigin = new Vector3();
  private readonly localDirection = new Vector3();
  private readonly localHit = new Vector3();
  private readonly worldHit = new Vector3();
  private readonly forward = new Vector3();
  private readonly inverseRaftRotation = new Quaternion();
  private readonly validColor = new Color(0x72d4b3);
  private readonly repairColor = new Color(0xefc35c);
  private readonly invalidColor = new Color(0xe26f55);
  private targetCoordinate: GridCoordinate | null = null;
  private hoveredTileCoordinate: GridCoordinate | null = null;
  private mode: PreviewMode = 'hidden';
  private equipped = false;
  private inputEnabled = false;
  private swing = 0;
  private noticeTimer: number | null = null;

  constructor(
    private readonly renderer: WebGLRenderer,
    private readonly camera: PerspectiveCamera,
    materials: MaterialLibrary,
    private readonly raft: RaftSystem,
    private readonly audio: AudioSystem,
    private readonly splashes: SplashSystem,
    private readonly hasOccupant: (coordinate: GridCoordinate) => boolean = () => false,
    private readonly dismantleOccupant: (coordinate: GridCoordinate) => boolean = () => false,
    private readonly onHammerUsed: (action: HammerAction) => void = () => undefined,
  ) {
    this.viewModel = createHammerModel(materials);
    this.viewModel.name = 'first-person-building-hammer';
    this.viewModel.scale.setScalar(0.73);
    this.viewModel.position.set(0.52, -0.72, -0.88);
    this.viewModel.rotation.set(-0.18, -0.28, -0.32);
    this.viewModel.visible = false;
    this.camera.add(this.viewModel);

    this.preview = createRaftTile(materials, 47);
    this.preview.name = 'raft-foundation-preview';
    this.preview.visible = false;
    this.preview.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const material = new MeshStandardMaterial({
        color: 0x72d4b3,
        roughness: 0.72,
        transparent: true,
        opacity: 0.54,
        depthWrite: false,
      });
      this.previewMaterials.push(material);
      object.material = material;
      object.castShadow = false;
      object.receiveShadow = false;
    });
    this.preview.renderOrder = 3;
    this.raft.group.add(this.preview);

    this.renderer.domElement.addEventListener('mousedown', this.onPointerDown);
    this.renderer.domElement.addEventListener('contextmenu', this.onContextMenu);
  }

  setEquipped(equipped: boolean): void {
    this.equipped = equipped;
    this.viewModel.visible = equipped;
    if (!equipped) {
      this.preview.visible = false;
      this.mode = 'hidden';
      this.targetCoordinate = null;
      this.hoveredTileCoordinate = null;
    }
  }

  setInputEnabled(enabled: boolean): void {
    this.inputEnabled = enabled;
    if (!enabled) {
      this.preview.visible = false;
      useGameStore.getState().setInteraction(null, 'build');
    }
  }

  getDiagnostics(): {
    mode: PreviewMode;
    target: GridCoordinate | null;
    hovered: GridCoordinate | null;
  } {
    return {
      mode: this.mode,
      target: this.targetCoordinate ? { ...this.targetCoordinate } : null,
      hovered: this.hoveredTileCoordinate ? { ...this.hoveredTileCoordinate } : null,
    };
  }

  update(time: number, delta: number): void {
    if (!this.equipped) return;
    this.swing = Math.max(0, this.swing - delta);
    const swingPhase = this.swing > 0 ? 1 - this.swing / 0.34 : 0;
    const strike = this.swing > 0 ? Math.sin(swingPhase * Math.PI) : 0;
    this.viewModel.position.set(0.52, -0.72 + strike * 0.07, -0.88 - strike * 0.18);
    this.viewModel.rotation.set(-0.18 - strike * 0.72, -0.28, -0.32 + strike * 0.22);
    this.viewModel.position.x += Math.sin(time * 1.6) * 0.008;

    if (!this.inputEnabled) return;
    this.updatePreview();
  }

  dispose(): void {
    this.renderer.domElement.removeEventListener('mousedown', this.onPointerDown);
    this.renderer.domElement.removeEventListener('contextmenu', this.onContextMenu);
    if (this.noticeTimer !== null) window.clearTimeout(this.noticeTimer);
    this.camera.remove(this.viewModel);
    this.raft.group.remove(this.preview);
    this.previewMaterials.forEach((material) => material.dispose());
  }

  private updatePreview(): void {
    this.camera.getWorldDirection(this.forward);
    this.inverseRaftRotation.copy(this.raft.group.quaternion).invert();
    this.localOrigin.copy(this.camera.position).sub(this.raft.group.position).applyQuaternion(this.inverseRaftRotation);
    this.localDirection.copy(this.forward).applyQuaternion(this.inverseRaftRotation).normalize();
    this.ray.set(this.localOrigin, this.localDirection);
    if (Math.abs(this.ray.direction.y) < 0.02) {
      this.hidePreview();
      return;
    }
    const distance = (0.08 - this.ray.origin.y) / this.ray.direction.y;
    if (distance <= 0 || distance > 6.2) {
      this.hidePreview();
      return;
    }
    this.ray.at(distance, this.localHit);
    const hitCoordinate = this.raft.localToGrid(this.localHit);
    const hitTile = this.raft.getTile(hitCoordinate);
    this.hoveredTileCoordinate = hitTile ? hitCoordinate : null;
    let coordinate = hitCoordinate;
    let mode: PreviewMode = 'invalid';

    if (hitTile) {
      const centerX = hitTile.x * RAFT_TILE_X;
      const centerZ = hitTile.z * RAFT_TILE_Z;
      const offsetX = (this.localHit.x - centerX) / RAFT_TILE_X;
      const offsetZ = (this.localHit.z - centerZ) / RAFT_TILE_Z;
      if (hitTile.health < 100 && Math.abs(offsetX) < 0.38 && Math.abs(offsetZ) < 0.38) {
        mode = 'repair';
      } else if (Math.abs(offsetX) > Math.abs(offsetZ)) {
        coordinate = { x: hitTile.x + Math.sign(offsetX || 1), z: hitTile.z };
        mode = this.raft.canAddTile(coordinate) ? 'build' : 'invalid';
      } else {
        coordinate = { x: hitTile.x, z: hitTile.z + Math.sign(offsetZ || 1) };
        mode = this.raft.canAddTile(coordinate) ? 'build' : 'invalid';
      }
    } else {
      mode = this.raft.canAddTile(coordinate) ? 'build' : 'invalid';
    }

    const inventory = useGameStore.getState().inventory;
    const cost = mode === 'repair' ? REPAIR_COST : FOUNDATION_COST;
    const affordable = hasItems(inventory, cost);
    this.setPreview(coordinate, mode, affordable);
  }

  private setPreview(coordinate: GridCoordinate, mode: PreviewMode, affordable: boolean): void {
    const changedTarget = !coordinateEquals(this.targetCoordinate, coordinate) || this.mode !== mode;
    this.targetCoordinate = coordinate;
    this.mode = mode;
    this.preview.visible = true;
    this.preview.position.set(
      coordinate.x * RAFT_TILE_X,
      mode === 'repair' ? 0.045 : 0.015,
      coordinate.z * RAFT_TILE_Z,
    );
    this.preview.scale.setScalar(mode === 'repair' ? 1.018 : 1);
    const color = mode === 'invalid' || !affordable ? this.invalidColor : mode === 'repair' ? this.repairColor : this.validColor;
    this.previewMaterials.forEach((material) => {
      material.color.copy(color);
      material.opacity = mode === 'invalid' || !affordable ? 0.34 : 0.54;
    });
    if (!changedTarget) return;
    if (mode === 'repair') {
      useGameStore.getState().setInteraction(affordable ? '修补受损筏格 · 1 漂木' : '缺少修补材料', 'build');
    } else if (mode === 'build') {
      if (affordable) {
        useGameStore.getState().setInteraction('扩建基础筏格 · 2 漂木  1 聚合片', 'build');
      } else {
        const inventory = useGameStore.getState().inventory;
        const missing = (Object.entries(FOUNDATION_COST) as [keyof typeof FOUNDATION_COST, number][])
          .filter(([id, amount]) => (inventory[id] ?? 0) < amount)
          .map(([id]) => ITEM_DEFINITIONS[id].shortName)
          .join('、');
        useGameStore.getState().setInteraction(`缺少 ${missing}`, 'build');
      }
    } else {
      const inventory = useGameStore.getState().inventory;
      const missing = (Object.entries(FOUNDATION_COST) as [keyof typeof FOUNDATION_COST, number][])
        .filter(([id, amount]) => (inventory[id] ?? 0) < amount)
        .map(([id]) => ITEM_DEFINITIONS[id].shortName)
        .join('、');
      useGameStore.getState().setInteraction(missing ? `缺少 ${missing}` : '此处无法连接结构', 'build');
    }
  }

  private hidePreview(): void {
    this.preview.visible = false;
    this.mode = 'hidden';
    this.targetCoordinate = null;
    this.hoveredTileCoordinate = null;
    useGameStore.getState().setInteraction(null, 'build');
  }

  private performBuild(): void {
    if (!this.targetCoordinate || this.mode === 'invalid' || this.mode === 'hidden') {
      this.audio.playDenied();
      return;
    }
    const store = useGameStore.getState();
    const coordinate = { ...this.targetCoordinate };
    let action: HammerAction;
    if (this.mode === 'repair') {
      action = 'repair';
      if (!store.spendItems(REPAIR_COST)) {
        this.audio.playDenied();
        return;
      }
      const result = this.raft.repairTile(coordinate, 42);
      if (!result.changed) {
        store.addItemBundle(REPAIR_COST);
        this.audio.playDenied();
        return;
      }
      this.raft.gridToLocal(coordinate, this.worldHit);
      this.raft.localPointToWorld(this.worldHit, this.worldHit);
      this.splashes.spawnImpact(this.worldHit, 0xefc35c, 15);
      this.audio.playRepair();
      this.showNotice('结构已修补');
    } else {
      action = 'build';
      if (!this.raft.canAddTile(coordinate) || !store.spendItems(FOUNDATION_COST)) {
        this.audio.playDenied();
        return;
      }
      if (!this.raft.addTile(coordinate)) {
        store.addItemBundle(FOUNDATION_COST);
        this.audio.playDenied();
        return;
      }
      this.raft.gridToLocal(coordinate, this.worldHit);
      this.raft.localPointToWorld(this.worldHit, this.worldHit);
      this.splashes.spawnImpact(this.worldHit, 0xd8ae70, 20);
      this.audio.playBuild();
      this.showNotice('木筏基础 +1');
    }
    this.swing = 0.34;
    store.setRaft(this.raft.getIntegrityStats());
    this.updatePreview();
    this.onHammerUsed(action);
  }

  private showNotice(message: string): void {
    useGameStore.getState().showNotice(message);
    if (this.noticeTimer !== null) window.clearTimeout(this.noticeTimer);
    this.noticeTimer = window.setTimeout(() => {
      if (useGameStore.getState().notice === message) useGameStore.getState().showNotice(null);
    }, 1450);
  }

  private performDismantle(): void {
    if (this.hoveredTileCoordinate && this.hasOccupant(this.hoveredTileCoordinate)) {
      const coordinate = { ...this.hoveredTileCoordinate };
      if (!this.dismantleOccupant(coordinate)) return;
      this.raft.gridToLocal(coordinate, this.worldHit);
      this.raft.localPointToWorld(this.worldHit, this.worldHit);
      this.splashes.spawnImpact(this.worldHit, 0x8f5742, 20);
      this.audio.playBuild();
      this.swing = 0.34;
      this.updatePreview();
      this.onHammerUsed('dismantle');
      return;
    }
    if (!this.hoveredTileCoordinate || !this.raft.canRemoveTile(this.hoveredTileCoordinate)) {
      this.audio.playDenied();
      this.showNotice('拆除会破坏结构连通');
      return;
    }
    const coordinate = { ...this.hoveredTileCoordinate };
    if (!this.raft.removeTile(coordinate)) {
      this.audio.playDenied();
      return;
    }
    useGameStore.getState().addItemBundle({ timber: 1 });
    this.raft.gridToLocal(coordinate, this.worldHit);
    this.raft.localPointToWorld(this.worldHit, this.worldHit);
    this.splashes.spawnImpact(this.worldHit, 0xa87150, 24);
    this.audio.playBuild();
    this.swing = 0.34;
    useGameStore.getState().setRaft(this.raft.getIntegrityStats());
    this.showNotice('拆除返还 +1 漂木');
    this.updatePreview();
    this.onHammerUsed('dismantle');
  }

  private readonly onPointerDown = (event: MouseEvent): void => {
    if (!this.equipped || !this.inputEnabled || this.swing > 0) return;
    if (event.button === 0) this.performBuild();
    else if (event.button === 2) this.performDismantle();
  };

  private readonly onContextMenu = (event: MouseEvent): void => {
    if (this.equipped && this.inputEnabled) event.preventDefault();
  };
}
