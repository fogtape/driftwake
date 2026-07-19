import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Quaternion,
  Ray,
  Vector3,
  type WebGLRenderer,
} from 'three';
import { createHammerModel, createRaftTile } from '../art/ProceduralModels';
import { createRaftStructureParts } from '../art/RaftStructureParts';
import type { MaterialLibrary } from '../art/Materials';
import {
  INVENTORY_SLOT_CAPACITY,
  ITEM_DEFINITIONS,
  addItems,
  exchangeInventoryBundles,
  hasItems,
  type ItemBundle,
  type ItemId,
} from '../domain/items';
import {
  RAFT_BUILD_PIECES,
  RAFT_BUILD_CATEGORY_DEFINITIONS,
  RAFT_BUILD_PIECE_DEFINITIONS,
  RAFT_STRUCTURE_DEFINITIONS,
  normalizeRaftRotation,
  nextRaftBuildCategory,
  raftStructureReplacementSettlement,
  raftBuildCategoryForPiece,
  structurePlacementKey,
  type RaftBuildCategory,
  type RaftBuildPiece,
  type RaftRotation,
  type SavedRaftStructure,
  type RaftStructureReplacementSettlement,
  type StructurePlacementReason,
  type StructureReplacementReason,
} from '../domain/raftStructures';
import { useGameStore } from '../../state/gameStore';
import type { AudioSystem } from './AudioSystem';
import { RAFT_TILE_X, RAFT_TILE_Z, type GridCoordinate, type RaftSystem } from './RaftSystem';
import type { RaftStructureSystem, StructurePlacementCandidate } from './RaftStructureSystem';
import type { SplashSystem } from './SplashSystem';

type PreviewMode = 'build' | 'repair' | 'replace' | 'invalid' | 'hidden';
export type HammerAction = 'build' | 'repair' | 'replace' | 'dismantle';

const FOUNDATION_COST: ItemBundle = RAFT_BUILD_PIECE_DEFINITIONS.foundation.cost;
const REPAIR_COST: ItemBundle = { timber: 1 };
const FOUNDATION_REFUND: ItemBundle = { timber: 1 };
const REINFORCEMENT_COST: ItemBundle = RAFT_BUILD_PIECE_DEFINITIONS.reinforcement.cost;
const REINFORCEMENT_REFUND: ItemBundle = { metalIngot: 1, scrap: 1 };
const PLACEMENT_REASON_LABEL: Record<Exclude<StructurePlacementReason, 'valid'>, string> = {
  occupied: '此处已有同类承位结构',
  unsupported: '缺少足够的下层承重结构',
  'out-of-bounds': '结构超出木筏建造边界',
  'invalid-level': '当前层高无法放置该结构',
  limit: '木筏结构数量已达上限',
};

const REPLACEMENT_REASON_LABEL: Partial<Record<Exclude<StructureReplacementReason, 'valid'>, string>> = {
  'not-found': '替换目标已不存在',
  incompatible: '当前件型不能占用这个结构槽位',
  unchanged: '当前件型与目标结构相同',
  dependent: '替换会使上层结构失去承重',
  occupied: '替换位置与其他结构冲突',
  unsupported: '替换后的结构缺少承重',
  'out-of-bounds': '替换结构超出木筏边界',
  'invalid-level': '替换层高无效',
  limit: '木筏结构数量已达上限',
};

function replacementReasonLabel(reason: StructureReplacementReason): string {
  return reason === 'valid' ? '当前结构可以替换' : REPLACEMENT_REASON_LABEL[reason] ?? '当前结构无法替换';
}

function isEdgeStructure(type: RaftBuildPiece): boolean {
  return type === 'wall' || type === 'door';
}

function coordinateEquals(a: GridCoordinate | null, b: GridCoordinate | null): boolean {
  return Boolean(a && b && a.x === b.x && a.z === b.z);
}

function costLabel(cost: ItemBundle): string {
  return (Object.entries(cost) as [ItemId, number][])
    .filter(([, amount]) => amount > 0)
    .map(([itemId, amount]) => `${amount} ${ITEM_DEFINITIONS[itemId].shortName}`)
    .join('  ');
}

function missingCostLabel(cost: ItemBundle, inventory: ItemBundle): string {
  return (Object.entries(cost) as [ItemId, number][])
    .filter(([itemId, amount]) => (inventory[itemId] ?? 0) < amount)
    .map(([itemId]) => ITEM_DEFINITIONS[itemId].shortName)
    .join('、');
}

function pieceLevel(piece: RaftBuildPiece): number {
  return piece === 'floor' || piece === 'roof' ? 1 : 0;
}

function occupiesDeviceCell(candidate: StructurePlacementCandidate): boolean {
  return candidate.level === 0 && (candidate.type === 'pillar' || candidate.type === 'stairs');
}

export class BuildSystem {
  private readonly viewModel: Group;
  private readonly foundationPreview: Group;
  private readonly foundationPreviewMaterials: MeshStandardMaterial[] = [];
  private readonly structurePreview = new Group();
  private readonly reinforcementPreview = new Group();
  private readonly structurePreviewMaterial = new MeshStandardMaterial({
    color: 0x72d4b3,
    roughness: 0.68,
    metalness: 0.02,
    transparent: true,
    opacity: 0.54,
    depthWrite: false,
  });
  private readonly previewBoxGeometry = new BoxGeometry(1, 1, 1);
  private readonly previewCylinderGeometry = new CylinderGeometry(0.5, 0.5, 1, 8);
  private readonly ray = new Ray();
  private readonly localOrigin = new Vector3();
  private readonly localDirection = new Vector3();
  private readonly localHit = new Vector3();
  private readonly worldHit = new Vector3();
  private readonly forward = new Vector3();
  private readonly inverseRaftRotation = new Quaternion();
  private readonly validColor = new Color(0x72d4b3);
  private readonly repairColor = new Color(0xefc35c);
  private readonly replaceColor = new Color(0x72c8d4);
  private readonly invalidColor = new Color(0xe26f55);
  private targetCoordinate: GridCoordinate | null = null;
  private hoveredTileCoordinate: GridCoordinate | null = null;
  private hoveredStructure: SavedRaftStructure | null = null;
  private targetStructure: StructurePlacementCandidate | null = null;
  private replacementSettlement: RaftStructureReplacementSettlement | null = null;
  private foundationBlocked = false;
  private selectedPiece: RaftBuildPiece = 'foundation';
  private readonly selectedByCategory: Record<RaftBuildCategory, RaftBuildPiece> = {
    hull: 'foundation',
    frame: 'wall',
    deck: 'stairs',
  };
  private selectedRotation: RaftRotation = 0;
  private selectedLevel = 0;
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
    private readonly structures: RaftStructureSystem,
    private readonly audio: AudioSystem,
    private readonly splashes: SplashSystem,
    private readonly hasOccupant: (coordinate: GridCoordinate) => boolean = () => false,
    private readonly dismantleOccupant: (coordinate: GridCoordinate) => boolean = () => false,
    private readonly onHammerUsed: (action: HammerAction) => void = () => undefined,
    private readonly blocksFoundationAt: (coordinate: GridCoordinate) => boolean = () => false,
    private readonly blocksStructure: (candidate: StructurePlacementCandidate) => boolean = () => false,
  ) {
    this.viewModel = createHammerModel(materials);
    this.viewModel.name = 'first-person-building-hammer';
    this.viewModel.scale.setScalar(0.73);
    this.viewModel.position.set(0.52, -0.72, -0.88);
    this.viewModel.rotation.set(-0.18, -0.28, -0.32);
    this.viewModel.visible = false;
    this.camera.add(this.viewModel);

    this.foundationPreview = createRaftTile(materials, 47);
    this.foundationPreview.name = 'raft-foundation-preview';
    this.foundationPreview.visible = false;
    this.foundationPreview.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const material = new MeshStandardMaterial({
        color: 0x72d4b3,
        roughness: 0.72,
        transparent: true,
        opacity: 0.54,
        depthWrite: false,
      });
      this.foundationPreviewMaterials.push(material);
      object.material = material;
      object.castShadow = false;
      object.receiveShadow = false;
    });
    this.foundationPreview.renderOrder = 3;
    this.raft.group.add(this.foundationPreview);

    this.structurePreview.name = 'raft-structure-preview';
    this.structurePreview.visible = false;
    this.structurePreview.renderOrder = 3;
    this.raft.group.add(this.structurePreview);
    this.reinforcementPreview.name = 'raft-reinforcement-preview';
    this.reinforcementPreview.visible = false;
    this.reinforcementPreview.renderOrder = 3;
    this.raft.group.add(this.reinforcementPreview);
    this.rebuildReinforcementPreview();
    this.rebuildStructurePreview();

    this.renderer.domElement.addEventListener('mousedown', this.onPointerDown);
    this.renderer.domElement.addEventListener('contextmenu', this.onContextMenu);
    this.renderer.domElement.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('keydown', this.onKeyDown);
    this.publishFeedback();
  }

  setEquipped(equipped: boolean): void {
    this.equipped = equipped;
    this.viewModel.visible = equipped;
    if (!equipped) this.hidePreview();
    this.publishFeedback();
  }

  setInputEnabled(enabled: boolean): void {
    this.inputEnabled = enabled;
    if (!enabled) this.hidePreview();
  }

  getDiagnostics(): {
    mode: PreviewMode;
    target: GridCoordinate | null;
    hovered: GridCoordinate | null;
    piece: RaftBuildPiece;
    category: RaftBuildCategory;
    rotation: RaftRotation;
    level: number;
    hoveredStructure: string | null;
    structureTarget: string | null;
    structureCount: number;
    repairTarget: string | null;
    repairHealth: number;
    replacementTarget: string | null;
    replacementFrom: RaftBuildPiece | null;
    replacementCost: ItemBundle;
    replacementRefund: ItemBundle;
  } {
    return {
      mode: this.mode,
      target: this.targetCoordinate ? { ...this.targetCoordinate } : null,
      hovered: this.hoveredTileCoordinate ? { ...this.hoveredTileCoordinate } : null,
      piece: this.selectedPiece,
      category: raftBuildCategoryForPiece(this.selectedPiece),
      rotation: this.selectedRotation,
      level: this.selectedLevel,
      hoveredStructure: this.hoveredStructure?.id ?? null,
      structureTarget: this.targetStructure
        ? `${this.targetStructure.type}:${this.targetStructure.x},${this.targetStructure.z}:${this.targetStructure.level}:${this.targetStructure.rotation}`
        : null,
      structureCount: this.structures.count,
      repairTarget: this.mode === 'repair'
        && this.hoveredStructure
        && this.hoveredStructure.health < RAFT_STRUCTURE_DEFINITIONS[this.hoveredStructure.type].maxHealth
        ? this.hoveredStructure.id
        : null,
      repairHealth: this.mode === 'repair'
        && this.hoveredStructure
        && this.hoveredStructure.health < RAFT_STRUCTURE_DEFINITIONS[this.hoveredStructure.type].maxHealth
        ? this.hoveredStructure.health
        : 0,
      replacementTarget: this.mode === 'replace' && this.hoveredStructure ? this.hoveredStructure.id : null,
      replacementFrom: this.mode === 'replace' && this.hoveredStructure ? this.hoveredStructure.type : null,
      replacementCost: this.replacementSettlement?.cost ?? {},
      replacementRefund: this.replacementSettlement?.refund ?? {},
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
    if (this.inputEnabled) this.updatePreview();
  }

  selectBuildPiece(piece: RaftBuildPiece): boolean {
    if (!this.equipped || !this.inputEnabled || !RAFT_BUILD_PIECES.includes(piece)) return false;
    return this.applySelectedPiece(piece);
  }

  selectBuildCategory(category: RaftBuildCategory): boolean {
    if (!this.equipped || !this.inputEnabled || !RAFT_BUILD_CATEGORY_DEFINITIONS[category]) return false;
    return this.applySelectedPiece(this.selectedByCategory[category]);
  }

  dispose(): void {
    this.renderer.domElement.removeEventListener('mousedown', this.onPointerDown);
    this.renderer.domElement.removeEventListener('contextmenu', this.onContextMenu);
    this.renderer.domElement.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('keydown', this.onKeyDown);
    if (this.noticeTimer !== null) window.clearTimeout(this.noticeTimer);
    this.camera.remove(this.viewModel);
    this.raft.group.remove(this.foundationPreview, this.structurePreview, this.reinforcementPreview);
    this.foundationPreviewMaterials.forEach((material) => material.dispose());
    this.structurePreviewMaterial.dispose();
    this.previewBoxGeometry.dispose();
    this.previewCylinderGeometry.dispose();
  }

  private updatePreview(): void {
    this.replacementSettlement = null;
    this.camera.getWorldDirection(this.forward);
    this.inverseRaftRotation.copy(this.raft.group.quaternion).invert();
    this.localOrigin.copy(this.camera.position).sub(this.raft.group.position).applyQuaternion(this.inverseRaftRotation);
    this.localDirection.copy(this.forward).applyQuaternion(this.inverseRaftRotation).normalize();
    this.ray.set(this.localOrigin, this.localDirection);
    this.hoveredStructure = this.structures.findRayTarget(this.ray, 6.2);
    const replacementCandidate = this.hoveredStructure
      ? this.createReplacementCandidate(this.hoveredStructure)
      : null;
    if (replacementCandidate && this.hoveredStructure) {
      this.setStructureReplacementPreview(this.hoveredStructure, replacementCandidate);
      return;
    }
    if (
      this.hoveredStructure
      && this.hoveredStructure.health < RAFT_STRUCTURE_DEFINITIONS[this.hoveredStructure.type].maxHealth
    ) {
      this.setStructureRepairPreview(this.hoveredStructure);
      return;
    }
    if (Math.abs(this.ray.direction.y) < 0.02) {
      this.hidePlacementOnly();
      this.publishDismantlePrompt();
      return;
    }
    const distance = (0.08 - this.ray.origin.y) / this.ray.direction.y;
    if (distance <= 0 || distance > 6.2) {
      this.hidePlacementOnly();
      this.publishDismantlePrompt();
      return;
    }
    this.ray.at(distance, this.localHit);
    if (this.selectedPiece === 'foundation') this.updateFoundationPreview();
    else if (this.selectedPiece === 'reinforcement') this.updateReinforcementPreview();
    else this.updateStructurePreview();
  }

  private updateFoundationPreview(): void {
    const hitCoordinate = this.raft.localToGrid(this.localHit);
    const hitTile = this.raft.getTile(hitCoordinate);
    this.hoveredTileCoordinate = hitTile ? hitCoordinate : null;
    this.targetStructure = null;
    let coordinate = hitCoordinate;
    let mode: PreviewMode = 'invalid';
    this.foundationBlocked = false;

    if (hitTile) {
      const centerX = hitTile.x * RAFT_TILE_X;
      const centerZ = hitTile.z * RAFT_TILE_Z;
      const offsetX = (this.localHit.x - centerX) / RAFT_TILE_X;
      const offsetZ = (this.localHit.z - centerZ) / RAFT_TILE_Z;
      if (hitTile.health < 100 && Math.abs(offsetX) < 0.38 && Math.abs(offsetZ) < 0.38) {
        mode = 'repair';
      } else if (Math.abs(offsetX) > Math.abs(offsetZ)) {
        coordinate = { x: hitTile.x + Math.sign(offsetX || 1), z: hitTile.z };
        this.foundationBlocked = this.blocksFoundationAt(coordinate);
        mode = this.raft.canAddTile(coordinate) && !this.foundationBlocked ? 'build' : 'invalid';
      } else {
        coordinate = { x: hitTile.x, z: hitTile.z + Math.sign(offsetZ || 1) };
        this.foundationBlocked = this.blocksFoundationAt(coordinate);
        mode = this.raft.canAddTile(coordinate) && !this.foundationBlocked ? 'build' : 'invalid';
      }
    } else {
      this.foundationBlocked = this.blocksFoundationAt(coordinate);
      mode = this.raft.canAddTile(coordinate) && !this.foundationBlocked ? 'build' : 'invalid';
    }

    const inventory = useGameStore.getState().inventory;
    const cost = mode === 'repair' ? REPAIR_COST : FOUNDATION_COST;
    this.setFoundationPreview(coordinate, mode, hasItems(inventory, cost));
  }

  private createReplacementCandidate(structure: SavedRaftStructure): StructurePlacementCandidate | null {
    if (this.selectedPiece === 'foundation' || this.selectedPiece === 'reinforcement') return null;
    const rotation = isEdgeStructure(this.selectedPiece) ? structure.rotation : this.selectedRotation;
    const candidate: StructurePlacementCandidate = {
      type: this.selectedPiece,
      x: structure.x,
      z: structure.z,
      level: structure.level,
      rotation,
    };
    if (structurePlacementKey(candidate) !== structurePlacementKey(structure)) return null;
    if (candidate.type === structure.type && candidate.rotation === structure.rotation) return null;
    return candidate;
  }

  private setStructureReplacementPreview(
    structure: SavedRaftStructure,
    candidate: StructurePlacementCandidate,
  ): void {
    const definition = RAFT_STRUCTURE_DEFINITIONS[candidate.type];
    const settlement = raftStructureReplacementSettlement(structure.type, candidate.type);
    this.replacementSettlement = settlement;
    const blocked = (occupiesDeviceCell(candidate) && this.hasOccupant(candidate)) || this.blocksStructure(candidate);
    const reason: StructureReplacementReason = blocked ? 'occupied' : this.structures.canReplace(structure.id, candidate);
    const inventory = useGameStore.getState().inventory;
    const exchange = reason === 'valid'
      ? exchangeInventoryBundles(inventory, settlement.cost, settlement.refund, INVENTORY_SLOT_CAPACITY)
      : { ok: false, inventory, reason: 'missing' as const };
    const valid = reason === 'valid' && exchange.ok;
    this.targetCoordinate = { x: structure.x, z: structure.z };
    this.hoveredTileCoordinate = this.raft.hasTile(structure) ? { x: structure.x, z: structure.z } : null;
    this.targetStructure = candidate;
    this.mode = 'replace';
    this.foundationPreview.visible = false;
    this.reinforcementPreview.visible = false;
    this.structurePreview.visible = true;
    this.structurePreview.scale.setScalar(1.025);
    this.structures.positionObject(this.structurePreview, this.structures.createCandidate(candidate));
    this.applyPreviewColor(valid ? this.replaceColor : this.invalidColor, valid ? 0.48 : 0.34);

    if (reason !== 'valid') {
      useGameStore.getState().setInteraction(replacementReasonLabel(reason), 'build');
    } else if (!exchange.ok) {
      useGameStore.getState().setInteraction(
        exchange.reason === 'target-full'
          ? '背包没有空间收回替换余料'
          : `缺少 ${missingCostLabel(settlement.cost, inventory)}`,
        'build',
      );
    } else {
      const cost = costLabel(settlement.cost);
      const refund = costLabel(settlement.refund);
      const settlementLabel = cost
        ? `消耗 ${cost}${refund ? ` · 返还 ${refund}` : ''}`
        : refund
          ? `返还 ${refund} · 仅磨损锤具`
          : '仅磨损锤具';
      useGameStore.getState().setInteraction(
        `替换${RAFT_STRUCTURE_DEFINITIONS[structure.type].shortName}为${definition.shortName} · ${settlementLabel}`,
        'build',
      );
    }
    this.publishFeedback(valid);
  }

  private updateStructurePreview(): void {
    if (this.selectedPiece === 'foundation' || this.selectedPiece === 'reinforcement') return;
    const structureType = this.selectedPiece;
    const coordinate = this.raft.localToGrid(this.localHit);
    this.hoveredTileCoordinate = this.raft.hasTile(coordinate) ? coordinate : null;
    const candidate: StructurePlacementCandidate = {
      type: structureType,
      x: coordinate.x,
      z: coordinate.z,
      level: this.selectedLevel,
      rotation: this.selectedRotation,
    };
    this.targetCoordinate = coordinate;
    this.targetStructure = candidate;
    const reason = (occupiesDeviceCell(candidate) && this.hasOccupant(coordinate)) || this.blocksStructure(candidate)
      ? 'occupied'
      : this.structures.canPlace(candidate);
    const cost = RAFT_STRUCTURE_DEFINITIONS[candidate.type].cost;
    const inventory = useGameStore.getState().inventory;
    const affordable = hasItems(inventory, cost);
    this.mode = reason === 'valid' ? 'build' : 'invalid';
    this.foundationPreview.visible = false;
    this.reinforcementPreview.visible = false;
    this.structurePreview.visible = true;
    this.structures.positionObject(this.structurePreview, this.structures.createCandidate(candidate));
    this.structurePreview.scale.setScalar(1);
    this.applyPreviewColor(reason === 'valid' && affordable ? this.validColor : this.invalidColor, reason === 'valid' && affordable ? 0.54 : 0.34);
    const definition = RAFT_STRUCTURE_DEFINITIONS[candidate.type];
    if (reason !== 'valid') {
      useGameStore.getState().setInteraction(PLACEMENT_REASON_LABEL[reason], 'build');
    } else if (!affordable) {
      useGameStore.getState().setInteraction(`缺少 ${missingCostLabel(cost, inventory)}`, 'build');
    } else {
      useGameStore.getState().setInteraction(`${definition.shortName} · ${costLabel(cost)}`, 'build');
    }
    this.publishFeedback(reason === 'valid' && affordable);
  }

  private updateReinforcementPreview(): void {
    const coordinate = this.raft.localToGrid(this.localHit);
    const tile = this.raft.getTile(coordinate);
    const inventory = useGameStore.getState().inventory;
    const affordable = hasItems(inventory, REINFORCEMENT_COST);
    const healthy = Boolean(tile && tile.health >= 100);
    const valid = healthy && this.raft.canReinforceTile(coordinate);

    this.targetCoordinate = tile ? coordinate : null;
    this.hoveredTileCoordinate = tile ? coordinate : null;
    this.targetStructure = null;
    this.mode = valid ? 'build' : 'invalid';
    this.foundationPreview.visible = false;
    this.structurePreview.visible = false;
    this.reinforcementPreview.visible = Boolean(tile);
    this.reinforcementPreview.position.set(coordinate.x * RAFT_TILE_X, 0, coordinate.z * RAFT_TILE_Z);
    this.applyPreviewColor(
      valid && affordable ? this.validColor : this.invalidColor,
      valid && affordable ? 0.58 : 0.36,
    );

    if (!tile) {
      useGameStore.getState().setInteraction('筏缘护甲需要加装在基础筏格上', 'build');
    } else if (tile.reinforced) {
      useGameStore.getState().setInteraction('此筏格已有护甲 · 右键拆卸', 'build');
    } else if (!healthy) {
      useGameStore.getState().setInteraction('先修补受损筏格，再加装护甲', 'build');
    } else if (!this.raft.canReinforceTile(coordinate)) {
      useGameStore.getState().setInteraction('护甲只能初装在当前外围筏格', 'build');
    } else if (!affordable) {
      useGameStore.getState().setInteraction(`缺少 ${missingCostLabel(REINFORCEMENT_COST, inventory)}`, 'build');
    } else {
      useGameStore.getState().setInteraction(`潮铸筏缘护甲 · ${costLabel(REINFORCEMENT_COST)}`, 'build');
    }
    this.publishFeedback(valid && affordable);
  }

  private setFoundationPreview(coordinate: GridCoordinate, mode: PreviewMode, affordable: boolean): void {
    const changedTarget = !coordinateEquals(this.targetCoordinate, coordinate) || this.mode !== mode;
    this.targetCoordinate = coordinate;
    this.mode = mode;
    this.foundationPreview.visible = true;
    this.structurePreview.visible = false;
    this.reinforcementPreview.visible = false;
    this.foundationPreview.position.set(
      coordinate.x * RAFT_TILE_X,
      mode === 'repair' ? 0.045 : 0.015,
      coordinate.z * RAFT_TILE_Z,
    );
    this.foundationPreview.scale.setScalar(mode === 'repair' ? 1.018 : 1);
    const color = mode === 'invalid' || !affordable ? this.invalidColor : mode === 'repair' ? this.repairColor : this.validColor;
    this.foundationPreviewMaterials.forEach((material) => {
      material.color.copy(color);
      material.opacity = mode === 'invalid' || !affordable ? 0.34 : 0.54;
    });
    this.publishFeedback(mode !== 'invalid' && affordable);
    if (!changedTarget) return;
    if (mode === 'repair') {
      useGameStore.getState().setInteraction(affordable ? '修补受损筏格 · 1 漂木' : '缺少修补材料', 'build');
    } else if (mode === 'build') {
      useGameStore.getState().setInteraction(
        affordable ? `基础筏格 · ${costLabel(FOUNDATION_COST)}` : `缺少 ${missingCostLabel(FOUNDATION_COST, useGameStore.getState().inventory)}`,
        'build',
      );
    } else {
      const missing = missingCostLabel(FOUNDATION_COST, useGameStore.getState().inventory);
      useGameStore.getState().setInteraction(
        missing ? `缺少 ${missing}` : this.foundationBlocked ? '先拆除占用这段外缘的收集网' : '此处无法连接基础筏格',
        'build',
      );
    }
  }

  private setStructureRepairPreview(structure: SavedRaftStructure): void {
    const definition = RAFT_STRUCTURE_DEFINITIONS[structure.type];
    const inventory = useGameStore.getState().inventory;
    const affordable = hasItems(inventory, definition.repairCost);
    this.targetCoordinate = { x: structure.x, z: structure.z };
    this.hoveredTileCoordinate = this.raft.hasTile(structure) ? { x: structure.x, z: structure.z } : null;
    this.targetStructure = null;
    this.mode = 'repair';
    this.foundationPreview.visible = false;
    this.structurePreview.visible = false;
    this.reinforcementPreview.visible = false;
    useGameStore.getState().setInteraction(
      affordable
        ? `修补${definition.shortName} ${structure.health}/${definition.maxHealth} · ${costLabel(definition.repairCost)}`
        : `修补${definition.shortName} · 缺少 ${missingCostLabel(definition.repairCost, inventory)}`,
      'build',
    );
    this.publishFeedback(affordable);
  }

  private hidePlacementOnly(): void {
    this.foundationPreview.visible = false;
    this.structurePreview.visible = false;
    this.reinforcementPreview.visible = false;
    this.mode = 'hidden';
    this.targetCoordinate = null;
    this.hoveredTileCoordinate = null;
    this.targetStructure = null;
    this.replacementSettlement = null;
    this.publishFeedback();
  }

  private hidePreview(): void {
    this.hidePlacementOnly();
    this.hoveredStructure = null;
    useGameStore.getState().setInteraction(null, 'build');
  }

  private publishDismantlePrompt(): void {
    if (!this.hoveredStructure) {
      useGameStore.getState().setInteraction(null, 'build');
      return;
    }
    const definition = RAFT_STRUCTURE_DEFINITIONS[this.hoveredStructure.type];
    useGameStore.getState().setInteraction(`${definition.shortName} · 返还 ${costLabel(definition.refund)}`, 'build');
  }

  private performBuild(): void {
    if (!this.targetCoordinate || this.mode === 'invalid' || this.mode === 'hidden') {
      this.audio.playDenied();
      return;
    }
    if (
      this.mode === 'repair'
      && this.hoveredStructure
      && this.hoveredStructure.health < RAFT_STRUCTURE_DEFINITIONS[this.hoveredStructure.type].maxHealth
    ) {
      this.performStructureRepair();
      return;
    }
    if (this.mode === 'replace') {
      this.performStructureReplacement();
      return;
    }
    if (this.selectedPiece === 'reinforcement') {
      this.performReinforcementBuild();
      return;
    }
    if (this.selectedPiece !== 'foundation') {
      this.performStructureBuild();
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
      this.audio.playRepair(this.worldHit);
      this.showNotice('结构已修补');
    } else {
      action = 'build';
      if (this.blocksFoundationAt(coordinate) || !this.raft.canAddTile(coordinate) || !store.spendItems(FOUNDATION_COST)) {
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

  private performReinforcementBuild(): void {
    if (!this.targetCoordinate || !this.raft.canReinforceTile(this.targetCoordinate)) {
      this.audio.playDenied();
      return;
    }
    const store = useGameStore.getState();
    if (!store.spendItems(REINFORCEMENT_COST)) {
      this.audio.playDenied();
      return;
    }
    const coordinate = { ...this.targetCoordinate };
    const result = this.raft.reinforceTile(coordinate);
    if (!result.changed) {
      store.addItemBundle(REINFORCEMENT_COST);
      this.audio.playDenied();
      return;
    }
    this.raft.gridToLocal(coordinate, this.worldHit);
    this.raft.localPointToWorld(this.worldHit, this.worldHit);
    this.splashes.spawnImpact(this.worldHit, 0x8fa7a4, 24);
    this.audio.playBuild();
    this.swing = 0.34;
    this.showNotice('潮铸筏缘护甲已铆固 · 鲨鱼撕咬减伤 55%');
    this.updatePreview();
    this.onHammerUsed('build');
  }

  private performStructureRepair(): void {
    if (!this.hoveredStructure) return;
    const target = this.structures.getStructure(this.hoveredStructure.id);
    if (!target) {
      this.audio.playDenied();
      return;
    }
    const definition = RAFT_STRUCTURE_DEFINITIONS[target.type];
    const store = useGameStore.getState();
    if (target.health >= definition.maxHealth || !store.spendItems(definition.repairCost)) {
      this.audio.playDenied();
      return;
    }
    const result = this.structures.repair(target.id, definition.repairAmount);
    if (!result.changed || !result.structure) {
      store.addItemBundle(definition.repairCost);
      this.audio.playDenied();
      return;
    }
    this.structures.getLocalImpactPosition(result.structure, this.worldHit);
    this.raft.localPointToWorld(this.worldHit, this.worldHit);
    this.splashes.spawnRepair(this.worldHit, target.type === 'roof');
    this.audio.playRepair(this.worldHit, target.type === 'roof');
    this.swing = 0.34;
    const complete = result.structure.health >= definition.maxHealth;
    this.showNotice(
      complete
        ? `${definition.shortName}已完全修复`
        : `${definition.shortName}已修补 · ${result.structure.health}/${definition.maxHealth}`,
    );
    this.hoveredStructure = { ...result.structure };
    this.updatePreview();
    this.onHammerUsed('repair');
  }

  private performStructureReplacement(): void {
    if (!this.hoveredStructure || !this.targetStructure) return;
    const target = this.structures.getStructure(this.hoveredStructure.id);
    const candidate = { ...this.targetStructure };
    if (!target) {
      this.audio.playDenied();
      return;
    }
    const reason = ((occupiesDeviceCell(candidate) && this.hasOccupant(candidate)) || this.blocksStructure(candidate))
      ? 'occupied'
      : this.structures.canReplace(target.id, candidate);
    if (reason !== 'valid') {
      this.audio.playDenied();
      this.showNotice(replacementReasonLabel(reason));
      return;
    }
    const settlement = raftStructureReplacementSettlement(target.type, candidate.type);
    const store = useGameStore.getState();
    const exchange = store.exchangeItemBundles(settlement.cost, settlement.refund);
    if (!exchange.ok) {
      this.audio.playDenied();
      this.showNotice(
        exchange.reason === 'target-full'
          ? '背包没有空间收回替换余料'
          : `缺少 ${missingCostLabel(settlement.cost, store.inventory)}`,
      );
      return;
    }
    const result = this.structures.replace(target.id, candidate);
    if (!result.replaced || !result.previous) {
      store.exchangeItemBundles(settlement.refund, settlement.cost);
      this.audio.playDenied();
      this.showNotice('替换目标已变化，材料已退回');
      return;
    }
    this.structures.getLocalImpactPosition(result.replaced, this.worldHit);
    this.raft.localPointToWorld(this.worldHit, this.worldHit);
    const fibrous = result.previous.type === 'roof' || result.replaced.type === 'roof';
    this.splashes.spawnReplacement(this.worldHit, fibrous);
    this.audio.playReplace(this.worldHit, fibrous);
    this.swing = 0.34;
    this.showNotice(
      `${RAFT_STRUCTURE_DEFINITIONS[result.previous.type].shortName}已替换为${RAFT_STRUCTURE_DEFINITIONS[result.replaced.type].shortName}`,
    );
    this.hoveredStructure = { ...result.replaced };
    this.updatePreview();
    this.onHammerUsed('replace');
  }

  private performStructureBuild(): void {
    if (!this.targetStructure) return;
    const candidate = { ...this.targetStructure };
    const definition = RAFT_STRUCTURE_DEFINITIONS[candidate.type];
    const store = useGameStore.getState();
    if (
      ((occupiesDeviceCell(candidate) && this.hasOccupant(candidate)) || this.blocksStructure(candidate))
      || this.structures.canPlace(candidate) !== 'valid'
      || !store.spendItems(definition.cost)
    ) {
      this.audio.playDenied();
      return;
    }
    const placed = this.structures.place(candidate);
    if (!placed) {
      store.addItemBundle(definition.cost);
      this.audio.playDenied();
      return;
    }
    this.structures.getLocalImpactPosition(placed, this.worldHit);
    this.raft.localPointToWorld(this.worldHit, this.worldHit);
    this.splashes.spawnImpact(this.worldHit, candidate.type === 'roof' ? 0x8ca56b : 0xd8ae70, 20);
    this.audio.playBuild();
    this.swing = 0.34;
    this.showNotice(`${definition.shortName}已固定`);
    this.updatePreview();
    this.onHammerUsed('build');
  }

  private performDismantle(): void {
    if (this.selectedPiece === 'reinforcement') {
      this.performReinforcementDismantle();
      return;
    }
    if (this.hoveredStructure) {
      const definition = RAFT_STRUCTURE_DEFINITIONS[this.hoveredStructure.type];
      const store = useGameStore.getState();
      if (Object.keys(addItems(store.inventory, definition.refund, INVENTORY_SLOT_CAPACITY).rejected).length > 0) {
        this.audio.playDenied();
        this.showNotice('背包没有空间收回结构材料');
        return;
      }
      const result = this.structures.remove(this.hoveredStructure.id);
      if (result.blocked) {
        this.audio.playDenied();
        this.showNotice('上层结构仍依赖这个承重点');
        return;
      }
      if (!result.removed) {
        this.audio.playDenied();
        return;
      }
      store.addItemBundle(definition.refund);
      this.structures.getLocalImpactPosition(result.removed, this.worldHit);
      this.raft.localPointToWorld(this.worldHit, this.worldHit);
      this.splashes.spawnImpact(this.worldHit, 0x9b6650, 22);
      this.audio.playBuild();
      this.swing = 0.34;
      this.showNotice(`拆除${definition.shortName} · ${costLabel(definition.refund)}`);
      this.hoveredStructure = null;
      this.updatePreview();
      this.onHammerUsed('dismantle');
      return;
    }
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
    if (this.hoveredTileCoordinate && this.raft.getTile(this.hoveredTileCoordinate)?.reinforced) {
      this.audio.playDenied();
      this.showNotice('先切换至筏缘护甲并拆下金属件');
      return;
    }
    if (this.hoveredTileCoordinate && !this.structures.canRemoveFoundation(this.hoveredTileCoordinate)) {
      this.audio.playDenied();
      this.showNotice('先拆除依赖该筏格的承重结构');
      return;
    }
    if (!this.hoveredTileCoordinate || !this.raft.canRemoveTile(this.hoveredTileCoordinate)) {
      this.audio.playDenied();
      this.showNotice('拆除会破坏结构连通');
      return;
    }
    const store = useGameStore.getState();
    if (Object.keys(addItems(store.inventory, FOUNDATION_REFUND, INVENTORY_SLOT_CAPACITY).rejected).length > 0) {
      this.audio.playDenied();
      this.showNotice('背包没有空间收回筏格材料');
      return;
    }
    const coordinate = { ...this.hoveredTileCoordinate };
    if (!this.raft.removeTile(coordinate)) {
      this.audio.playDenied();
      return;
    }
    store.addItemBundle(FOUNDATION_REFUND);
    this.raft.gridToLocal(coordinate, this.worldHit);
    this.raft.localPointToWorld(this.worldHit, this.worldHit);
    this.splashes.spawnImpact(this.worldHit, 0xa87150, 24);
    this.audio.playBuild();
    this.swing = 0.34;
    store.setRaft(this.raft.getIntegrityStats());
    this.showNotice('拆除返还 +1 漂木');
    this.updatePreview();
    this.onHammerUsed('dismantle');
  }

  private performReinforcementDismantle(): void {
    const coordinate = this.hoveredTileCoordinate;
    const tile = coordinate ? this.raft.getTile(coordinate) : null;
    if (!coordinate || !tile?.reinforced) {
      this.audio.playDenied();
      this.showNotice('准星下没有可拆卸的筏缘护甲');
      return;
    }
    const store = useGameStore.getState();
    if (Object.keys(addItems(store.inventory, REINFORCEMENT_REFUND, INVENTORY_SLOT_CAPACITY).rejected).length > 0) {
      this.audio.playDenied();
      this.showNotice('背包没有空间收回护甲材料');
      return;
    }
    const result = this.raft.removeReinforcement(coordinate);
    if (!result.changed) {
      this.audio.playDenied();
      return;
    }
    store.addItemBundle(REINFORCEMENT_REFUND);
    this.raft.gridToLocal(coordinate, this.worldHit);
    this.raft.localPointToWorld(this.worldHit, this.worldHit);
    this.splashes.spawnImpact(this.worldHit, 0x8f5742, 22);
    this.audio.playBuild();
    this.swing = 0.34;
    this.showNotice(`筏缘护甲已拆卸 · ${costLabel(REINFORCEMENT_REFUND)}`);
    this.updatePreview();
    this.onHammerUsed('dismantle');
  }

  private rebuildStructurePreview(): void {
    this.structurePreview.clear();
    if (this.selectedPiece === 'foundation' || this.selectedPiece === 'reinforcement') return;
    const structureType = this.selectedPiece;
    for (const part of createRaftStructureParts(structureType, false)) {
      const geometry = part.geometry === 'box' ? this.previewBoxGeometry : this.previewCylinderGeometry;
      const mesh = new Mesh(geometry, this.structurePreviewMaterial);
      mesh.position.fromArray(part.position);
      mesh.scale.fromArray(part.scale);
      mesh.rotation.set(part.rotation?.[0] ?? 0, part.rotation?.[1] ?? 0, part.rotation?.[2] ?? 0);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      this.structurePreview.add(mesh);
    }
  }

  private rebuildReinforcementPreview(): void {
    this.reinforcementPreview.clear();
    const addPart = (x: number, y: number, z: number, scaleX: number, scaleY: number, scaleZ: number): void => {
      const mesh = new Mesh(this.previewBoxGeometry, this.structurePreviewMaterial);
      mesh.position.set(x, y, z);
      mesh.scale.set(scaleX, scaleY, scaleZ);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      this.reinforcementPreview.add(mesh);
    };
    for (const z of [-0.61, 0.61]) addPart(0, 0.16, z, 1.3, 0.11, 0.09);
    for (const x of [-0.65, 0.65]) addPart(x, 0.16, 0, 0.09, 0.11, 1.24);
    for (const x of [-0.61, 0.61]) {
      for (const z of [-0.58, 0.58]) addPart(x, 0.21, z, 0.22, 0.08, 0.22);
    }
  }

  private applyPreviewColor(color: Color, opacity: number): void {
    this.structurePreviewMaterial.color.copy(color);
    this.structurePreviewMaterial.opacity = opacity;
  }

  private selectPiece(indexDelta: number): void {
    const current = RAFT_BUILD_PIECES.indexOf(this.selectedPiece);
    this.applySelectedPiece(
      RAFT_BUILD_PIECES[(current + indexDelta + RAFT_BUILD_PIECES.length) % RAFT_BUILD_PIECES.length],
    );
  }

  private selectCategory(indexDelta: number): void {
    const current = raftBuildCategoryForPiece(this.selectedPiece);
    this.applySelectedPiece(this.selectedByCategory[nextRaftBuildCategory(current, indexDelta)]);
  }

  private applySelectedPiece(piece: RaftBuildPiece): boolean {
    if (piece === this.selectedPiece) {
      this.publishFeedback();
      return true;
    }
    this.selectedPiece = piece;
    this.selectedByCategory[raftBuildCategoryForPiece(piece)] = piece;
    this.selectedLevel = pieceLevel(this.selectedPiece);
    this.rebuildStructurePreview();
    this.audio.playUi();
    this.updatePreview();
    this.publishFeedback();
    return true;
  }

  private publishFeedback(valid = this.mode !== 'invalid' && this.mode !== 'hidden'): void {
    const repairTarget = this.mode === 'repair'
      && this.hoveredStructure
      && this.hoveredStructure.health < RAFT_STRUCTURE_DEFINITIONS[this.hoveredStructure.type].maxHealth
      ? {
          id: this.hoveredStructure.id,
          type: this.hoveredStructure.type,
          health: this.hoveredStructure.health,
          maxHealth: RAFT_STRUCTURE_DEFINITIONS[this.hoveredStructure.type].maxHealth,
        }
      : null;
    const replacementSettlement = this.mode === 'replace' ? this.replacementSettlement : null;
    const replaceTarget = this.mode === 'replace'
      && this.hoveredStructure
      && this.targetStructure
      && replacementSettlement
      ? {
          id: this.hoveredStructure.id,
          from: this.hoveredStructure.type,
          to: this.targetStructure.type,
          rotation: this.targetStructure.rotation,
          level: this.targetStructure.level,
          cost: replacementSettlement.cost,
          refund: replacementSettlement.refund,
        }
      : null;
    useGameStore.getState().setBuild({
      piece: this.selectedPiece,
      category: raftBuildCategoryForPiece(this.selectedPiece),
      rotation: this.selectedRotation,
      level: this.selectedLevel,
      mode: this.equipped ? this.mode : 'hidden',
      valid,
      structures: this.structures.count,
      repairTarget,
      replaceTarget,
    });
  }

  private showNotice(message: string): void {
    useGameStore.getState().showNotice(message);
    if (this.noticeTimer !== null) window.clearTimeout(this.noticeTimer);
    this.noticeTimer = window.setTimeout(() => {
      if (useGameStore.getState().notice === message) useGameStore.getState().showNotice(null);
    }, 1450);
  }

  private readonly onPointerDown = (event: MouseEvent): void => {
    if (!this.equipped || !this.inputEnabled || this.swing > 0) return;
    if (event.button === 0) this.performBuild();
    else if (event.button === 2) this.performDismantle();
  };

  private readonly onContextMenu = (event: MouseEvent): void => {
    if (this.equipped && this.inputEnabled) event.preventDefault();
  };

  private readonly onWheel = (event: WheelEvent): void => {
    if (!this.equipped || !this.inputEnabled || event.deltaY === 0) return;
    event.preventDefault();
    this.selectPiece(event.deltaY > 0 ? 1 : -1);
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (
      !this.equipped
      || !this.inputEnabled
      || event.repeat
      || (event.code !== 'KeyR' && event.code !== 'KeyF' && event.code !== 'KeyQ')
      || (
        event.code === 'KeyF'
        && (this.selectedPiece === 'foundation' || this.selectedPiece === 'reinforcement')
      )
    ) return;
    event.preventDefault();
    if (event.code === 'KeyQ') {
      this.selectCategory(event.shiftKey ? -1 : 1);
      return;
    }
    if (event.code === 'KeyR') {
      this.selectedRotation = normalizeRaftRotation(this.selectedRotation + 1);
    } else {
      const minimum = pieceLevel(this.selectedPiece);
      const maximum = minimum + 1;
      this.selectedLevel = this.selectedLevel >= maximum ? minimum : this.selectedLevel + 1;
    }
    this.audio.playUi();
    this.updatePreview();
    this.publishFeedback();
  };
}
