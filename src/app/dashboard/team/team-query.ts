export function updateTeamQuery(values: Record<string, string | null>, resetCount = true) {
  const params = new URLSearchParams(window.location.search);
  for (const [key, value] of Object.entries(values)) {
    if (value) params.set(key, value); else params.delete(key);
  }
  if (resetCount) params.delete('shown');
  const query = params.toString();
  window.history.replaceState(null, '', window.location.pathname + (query ? `?${query}` : ''));
}
