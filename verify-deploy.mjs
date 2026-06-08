import { WebSocket } from 'ws';

const URL = 'wss://ciel-de-feu-production.up.railway.app';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function mkClient() {
  return new Promise((resolve) => {
    const ws = new WebSocket(URL);
    const c = { ws, id: null, recv: [] };
    ws.on('message', (raw) => {
      const m = JSON.parse(raw);
      c.recv.push(m.type);
      if (m.type === 'welcome') c.id = m.payload.id;
    });
    ws.on('error', () => {});
    setTimeout(() => resolve(c), 700);
  });
}
const send = (c, type, payload) => c.ws.send(JSON.stringify({ type, payload }));

async function trial() {
  const code = 'V' + Math.floor(Math.random() * 9000 + 1000);
  const host = await mkClient();
  send(host, 'create_room', { config: { code, mode: 'coop', name: 'H', team: 'jaune' }, _reqId: 'c' });
  await sleep(800);
  const guest = await mkClient();
  send(guest, 'join_room', { code, playerInfo: { name: 'G', team: 'bleu' }, _reqId: 'j' });
  await sleep(1000);
  send(host, 'config_update', { mode: 'survival' });
  send(host, 'player_plane', { plane: 'rouge' });
  await sleep(1500);
  const ok = guest.recv.includes('config_update') && guest.recv.includes('player_plane');
  host.ws.close(); guest.ws.close();
  return ok;
}

(async () => {
  const MAX = 14; // ~14 essais × 20s ≈ 4-5 min
  for (let i = 1; i <= MAX; i++) {
    process.stdout.write(`Essai ${i}/${MAX}... `);
    let ok = false;
    try { ok = await trial(); } catch (e) { /* serveur en redémarrage */ }
    if (ok) {
      console.log('✅ NOUVELLE VERSION DÉPLOYÉE — config_update + player_plane RELAYÉS');
      process.exit(0);
    }
    console.log('pas encore (ancienne version ou redémarrage)');
    if (i < MAX) await sleep(20000);
  }
  console.log('❌ Toujours pas relayé après ~5 min — Railway n\'a pas redéployé. Action manuelle requise.');
  process.exit(1);
})();
