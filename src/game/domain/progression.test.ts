import { describe, expect, it } from 'vitest';
import type { ProgressionKnowledge } from './progression';
import {
  BRICK_DRY_SECONDS,
  RESEARCH_PROJECTS,
  RESEARCH_STAGE_ORDER,
  RESEARCH_STAGE_PROJECTS,
  SMELT_SECONDS,
  addResearchSample,
  addWetBrick,
  advanceProgressionDevice,
  canLearnProject,
  collectDryBricks,
  collectSmelter,
  createDefaultProgressionState,
  createProgressionDevice,
  learnProject,
  missingProjectPrerequisites,
  researchProjectStage,
  researchStageProgress,
  sanitizeProgressionState,
  startSmelter,
} from './progression';

describe('research progression', () => {
  it('consumes knowledge once and only learns projects after every sample', () => {
    let knowledge = createDefaultProgressionState();
    knowledge = { ...knowledge, ...addResearchSample(knowledge, 'timber') };
    knowledge = { ...knowledge, ...addResearchSample(knowledge, 'scrap') };
    expect(canLearnProject(knowledge, 'smelterKit')).toBe(false);
    expect(learnProject(knowledge, 'smelterKit').learned).toEqual([]);
    knowledge = { ...knowledge, ...addResearchSample(knowledge, 'dryBrick') };
    expect(canLearnProject(knowledge, 'smelterKit')).toBe(true);
    expect(learnProject(knowledge, 'smelterKit').learned).toEqual(['smelterKit']);
    expect(addResearchSample(knowledge, 'timber')).toBe(knowledge);
  });

  it('chains signal electronics through a crafted board sample before receiver equipment', () => {
    let knowledge = createDefaultProgressionState();
    for (const sample of ['timber', 'rope', 'scrap', 'dryBrick', 'metalIngot', 'glassPane'] as const) {
      knowledge = { ...knowledge, ...addResearchSample(knowledge, sample) };
    }
    expect(canLearnProject(knowledge, 'signalBoard')).toBe(false);
    expect(missingProjectPrerequisites(knowledge, 'signalBoard')).toEqual(['hinge']);
    knowledge = { ...knowledge, ...learnProject(knowledge, 'smelterKit') };
    knowledge = { ...knowledge, ...learnProject(knowledge, 'hinge') };
    expect(canLearnProject(knowledge, 'signalBoard')).toBe(true);
    knowledge = { ...knowledge, ...learnProject(knowledge, 'signalBoard') };
    expect(canLearnProject(knowledge, 'receiverKit')).toBe(false);
    knowledge = { ...knowledge, ...addResearchSample(knowledge, 'signalBoard') };
    expect(canLearnProject(knowledge, 'brineCell')).toBe(true);
    expect(canLearnProject(knowledge, 'receiverKit')).toBe(false);
    knowledge = { ...knowledge, ...addResearchSample(knowledge, 'hinge') };
    knowledge = { ...knowledge, ...learnProject(knowledge, 'brineCell') };
    expect(canLearnProject(knowledge, 'receiverKit')).toBe(true);
    expect(canLearnProject(knowledge, 'resonanceFork')).toBe(true);
    expect(canLearnProject(knowledge, 'antennaKit')).toBe(false);
    knowledge = { ...knowledge, ...learnProject(knowledge, 'receiverKit') };
    expect(canLearnProject(knowledge, 'antennaKit')).toBe(true);
  });

  it('partitions every project into one staged dependency view', () => {
    const staged = RESEARCH_STAGE_ORDER.flatMap((stage) => RESEARCH_STAGE_PROJECTS[stage]);
    expect(new Set(staged).size).toBe(Object.keys(RESEARCH_PROJECTS).length);
    expect(staged).toHaveLength(Object.keys(RESEARCH_PROJECTS).length);
    expect(researchProjectStage('smelterKit')).toBe('forge');
    expect(researchProjectStage('helmKit')).toBe('raft');
    expect(researchProjectStage('receiverKit')).toBe('signal');

    const knowledge: ProgressionKnowledge = {
      researched: ['timber', 'scrap', 'dryBrick'],
      learned: [],
    };
    expect(researchStageProgress(knowledge, 'forge')).toEqual({ learned: 0, available: 1, total: 4 });
  });

  it('dries separately timed bricks without advancing newly added bricks', () => {
    let rack = createProgressionDevice('dryingBricks', 0, 0, 0, 'rack');
    rack = advanceProgressionDevice(rack, BRICK_DRY_SECONDS - 2).device;
    rack = addWetBrick(rack);
    const result = advanceProgressionDevice(rack, 3);
    expect(result.event).toBe('brick-dry');
    expect(result.device.brickElapsed).toEqual([BRICK_DRY_SECONDS, 3]);
    const collected = collectDryBricks(result.device);
    expect(collected.count).toBe(1);
    expect(collected.device.brickElapsed).toEqual([3]);
  });

  it('runs one smelter charge through working, ready and collection', () => {
    const smelter = createProgressionDevice('smelter', 1, 0, Math.PI / 2, 'forge');
    const working = startSmelter(smelter);
    expect(working.phase).toBe('working');
    const ready = advanceProgressionDevice(working, SMELT_SECONDS + 4);
    expect(ready.event).toBe('smelter-ready');
    expect(ready.device.phase).toBe('ready');
    expect(collectSmelter(ready.device)).toMatchObject({ phase: 'idle', elapsed: 0 });
    const glass = startSmelter(smelter, 'sand');
    expect(glass).toMatchObject({ phase: 'working', smeltInput: 'sand' });
    expect(collectSmelter(advanceProgressionDevice(glass, SMELT_SECONDS).device)).toMatchObject({ smeltInput: null });
  });

  it('sanitizes device limits, timers and forged knowledge claims', () => {
    const state = sanitizeProgressionState({
      researched: ['timber', 'scrap', 'dryBrick', 'not-real', 'timber'],
      learned: ['smelterKit', 'metalSpear', 'receiverKit'],
      devices: [
        { id: 'table', type: 'researchBench', x: 99, z: -99, rotation: 1.4 },
        { id: 'table-2', type: 'researchBench', x: 0, z: 0 },
        { id: 'rack', type: 'dryingBricks', x: 1, z: 0, brickElapsed: [-2, 999, 4, 8, 12] },
        { id: 'forge', type: 'smelter', x: 2, z: 0, phase: 'working', elapsed: 999 },
      ],
    });
    expect(state.researched).toEqual(['timber', 'scrap', 'dryBrick']);
    expect(state.learned).toEqual(['smelterKit']);
    expect(state.devices).toHaveLength(3);
    expect(state.devices[0]).toMatchObject({ id: 'table', x: 12, z: -12, rotation: Math.PI / 2 });
    expect(state.devices[1]?.brickElapsed).toEqual([0, BRICK_DRY_SECONDS, 4, 8]);
    expect(state.devices[2]).toMatchObject({ phase: 'ready', elapsed: SMELT_SECONDS });
  });
});
