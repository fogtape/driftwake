export function selectActiveDebris(
  latched: readonly boolean[],
  requestedCount: number,
): boolean[] {
  const targetCount = Number.isFinite(requestedCount)
    ? Math.min(latched.length, Math.max(0, Math.floor(requestedCount)))
    : latched.length;
  const active = latched.map(Boolean);
  let activeCount = active.filter(Boolean).length;

  for (let index = 0; index < active.length && activeCount < targetCount; index += 1) {
    if (active[index]) continue;
    active[index] = true;
    activeCount += 1;
  }

  return active;
}
