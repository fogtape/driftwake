export const INPUT_ACTIONS = [
  'moveForward',
  'moveBackward',
  'moveLeft',
  'moveRight',
  'jump',
  'dive',
  'interact',
  'inventory',
  'crafting',
  'alternate',
  'buildCycle',
  'buildCategory',
  'slot1',
  'slot2',
  'slot3',
  'slot4',
  'slot5',
  'slot6',
] as const;

export type InputAction = (typeof INPUT_ACTIONS)[number];
export type InputBindingGroup = 'movement' | 'interaction' | 'building' | 'hotbar';
export type InputBindings = Record<InputAction, string>;

export const HOTBAR_INPUT_ACTIONS = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6'] as const;

export interface InputActionDefinition {
  label: string;
  group: InputBindingGroup;
}

export const INPUT_ACTION_DEFINITIONS: Readonly<Record<InputAction, InputActionDefinition>> = {
  moveForward: { label: '前进', group: 'movement' },
  moveBackward: { label: '后退', group: 'movement' },
  moveLeft: { label: '左移', group: 'movement' },
  moveRight: { label: '右移', group: 'movement' },
  jump: { label: '跳跃 / 上浮', group: 'movement' },
  dive: { label: '下潜', group: 'movement' },
  interact: { label: '交互 / 收取', group: 'interaction' },
  inventory: { label: '背包', group: 'interaction' },
  crafting: { label: '制作', group: 'interaction' },
  alternate: { label: '替代操作', group: 'interaction' },
  buildCycle: { label: '建造件型', group: 'building' },
  buildCategory: { label: '建造分类', group: 'building' },
  slot1: { label: '工具栏 1', group: 'hotbar' },
  slot2: { label: '工具栏 2', group: 'hotbar' },
  slot3: { label: '工具栏 3', group: 'hotbar' },
  slot4: { label: '工具栏 4', group: 'hotbar' },
  slot5: { label: '工具栏 5', group: 'hotbar' },
  slot6: { label: '工具栏 6', group: 'hotbar' },
};

export const INPUT_BINDING_GROUPS: readonly { id: InputBindingGroup; label: string }[] = [
  { id: 'movement', label: '移动' },
  { id: 'interaction', label: '交互' },
  { id: 'building', label: '建造' },
  { id: 'hotbar', label: '工具栏' },
];

export const DEFAULT_INPUT_BINDINGS: Readonly<InputBindings> = {
  moveForward: 'KeyW',
  moveBackward: 'KeyS',
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  jump: 'Space',
  dive: 'ControlLeft',
  interact: 'KeyE',
  inventory: 'Tab',
  crafting: 'KeyC',
  alternate: 'KeyR',
  buildCycle: 'KeyF',
  buildCategory: 'KeyQ',
  slot1: 'Digit1',
  slot2: 'Digit2',
  slot3: 'Digit3',
  slot4: 'Digit4',
  slot5: 'Digit5',
  slot6: 'Digit6',
};

export type InputBindingChange =
  | { ok: true; bindings: InputBindings }
  | { ok: false; reason: 'invalid' | 'conflict'; conflict?: InputAction };

const DISPLAY_NAMES: Readonly<Record<string, string>> = {
  Space: '空格',
  Tab: 'Tab',
  Enter: '回车',
  Escape: 'Esc',
  ControlLeft: '左 Ctrl',
  ControlRight: '右 Ctrl',
  ShiftLeft: '左 Shift',
  ShiftRight: '右 Shift',
  AltLeft: '左 Alt',
  AltRight: '右 Alt',
  ArrowUp: '上箭头',
  ArrowDown: '下箭头',
  ArrowLeft: '左箭头',
  ArrowRight: '右箭头',
};

let runtimeBindings: InputBindings = { ...DEFAULT_INPUT_BINDINGS };

export function isInputAction(value: unknown): value is InputAction {
  return typeof value === 'string' && (INPUT_ACTIONS as readonly string[]).includes(value);
}

export function isBindableCode(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value !== 'Unidentified'
    && value !== 'Escape'
    && !/^(MetaLeft|MetaRight)$/u.test(value);
}

export function cloneInputBindings(bindings: InputBindings = runtimeBindings): InputBindings {
  return { ...bindings };
}

export function findBindingConflict(bindings: InputBindings, code: string, except?: InputAction): InputAction | null {
  return INPUT_ACTIONS.find((action) => action !== except && bindings[action] === code) ?? null;
}

export function sanitizeInputBindings(value: unknown): InputBindings {
  if (!value || typeof value !== 'object') return { ...DEFAULT_INPUT_BINDINGS };
  const candidate = value as Partial<Record<InputAction, unknown>>;
  const bindings = { ...DEFAULT_INPUT_BINDINGS } as InputBindings;
  for (const action of INPUT_ACTIONS) {
    const code = candidate[action];
    if (code === undefined) continue;
    if (!isBindableCode(code)) return { ...DEFAULT_INPUT_BINDINGS };
    bindings[action] = code;
  }
  const occupied = new Set<string>();
  for (const action of INPUT_ACTIONS) {
    if (occupied.has(bindings[action])) return { ...DEFAULT_INPUT_BINDINGS };
    occupied.add(bindings[action]);
  }
  return bindings;
}

export function assignInputBinding(bindings: InputBindings, action: InputAction, code: unknown): InputBindingChange {
  if (!isBindableCode(code)) return { ok: false, reason: 'invalid' };
  const conflict = findBindingConflict(bindings, code, action);
  if (conflict) return { ok: false, reason: 'conflict', conflict };
  return { ok: true, bindings: { ...bindings, [action]: code } };
}

export function setRuntimeInputBindings(bindings: InputBindings): void {
  runtimeBindings = sanitizeInputBindings(bindings);
}

export function getRuntimeInputBindings(): InputBindings {
  return cloneInputBindings();
}

export function matchesInputAction(action: InputAction, code: string, bindings: InputBindings = runtimeBindings): boolean {
  if (bindings[action] === code) return true;
  // Preserve the original two-handed defaults until the player explicitly remaps them.
  if (action === 'dive' && bindings.dive === DEFAULT_INPUT_BINDINGS.dive && code === 'ControlRight') return true;
  if (action === 'inventory' && bindings.inventory === DEFAULT_INPUT_BINDINGS.inventory && code === 'KeyI') return true;
  return false;
}

export function formatInputCode(code: string): string {
  if (DISPLAY_NAMES[code]) return DISPLAY_NAMES[code];
  const letter = /^Key([A-Z])$/u.exec(code);
  if (letter) return letter[1];
  const digit = /^Digit(\d)$/u.exec(code);
  if (digit) return digit[1];
  const numpad = /^Numpad(\d)$/u.exec(code);
  if (numpad) return `小键盘 ${numpad[1]}`;
  return code.replace(/([a-z])([A-Z])/gu, '$1 $2');
}
