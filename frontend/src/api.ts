export async function simulate(body: any) {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/simulate`, {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error('Simulation failed');
  return res.json();
}

export async function neoSearch(pha=false, limit=20) {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/neo/search`, {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ pha, limit })
  });
  if (!res.ok) throw new Error('Search failed');
  return res.json();
}
