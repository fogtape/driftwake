export function selectActiveDebris(latched: readonly boolean[], requestedCount: number): boolean[] {
  const target = Number.isFinite(requestedCount)
    ? Math.min(latched.length, Math.max(0, Math.floor(requestedCount)))
    : latched.length;
  const active = latched.map(Boolean);
  let remaining = Math.max(0, target - active.filter(Boolean).length);
  for (let index = 0; index < active.length && remaining > 0; index += 1) {
    if (active[index]) continue;
    active[index] = true;
    remaining -= 1;
  }
  return active;
}
