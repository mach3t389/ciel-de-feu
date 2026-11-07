// Rapports de bug — Function Vercel
// Relaie le formulaire du jeu vers Discord. L'URL du webhook reste côté serveur :
// tout ce qui est dans src/ (y compris les variables VITE_*) finit dans le bundle
// public. Le message est reconstruit ici à partir d'un schéma fixe, pour que ce
// point d'entrée ne serve pas de relais générique vers le webhook.
//
// Variable d'environnement requise : DISCORD_BUG_WEBHOOK_URL (sans préfixe VITE_).

import { createHash } from 'crypto';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

const IP_LIMIT = 5;
const IP_WINDOW = 10 * 60; // secondes
const GLOBAL_LIMIT = 30;
const GLOBAL_WINDOW = 60 * 60; // secondes

const text = (value, max) => (typeof value === 'string' ? value.trim().substring(0, max) : '');

function isSameOrigin(req) {
  try {
    return new URL(req.headers.origin).host === req.headers.host;
  } catch {
    return false;
  }
}

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  return (typeof forwarded === 'string' && forwarded.split(',')[0].trim())
    || req.socket?.remoteAddress
    || 'unknown';
}

async function withinLimit(key, limit, windowSeconds) {
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, windowSeconds);
  return count <= limit;
}

// Les deux compteurs sont toujours incrémentés : une IP bloquée consomme aussi le
// quota global, ce qui plafonne le volume total même en cas d'abus.
async function isAllowed(req) {
  const ipHash = createHash('sha256').update(clientIp(req)).digest('hex');
  const [ipOk, globalOk] = await Promise.all([
    withinLimit(`bugreport:ip:${ipHash}`, IP_LIMIT, IP_WINDOW),
    withinLimit('bugreport:global', GLOBAL_LIMIT, GLOBAL_WINDOW),
  ]);
  return ipOk && globalOk;
}

function buildEmbed(body) {
  const fields = [{ name: '📋 Description', value: text(body.description, 1024), inline: false }];
  const optional = [
    ['🔁 Reproduction', text(body.steps, 1024), false],
    ['🎮 Mode', text(body.mode, 40), true],
    ['🗺️ Carte', text(body.map, 60), true],
    ['🌊 Vague', text(body.wave, 10), true],
    ['🖥️ Écran', text(body.screen, 80), false],
    ['🌐 Navigateur', text(body.userAgent, 100), false],
  ];
  for (const [name, value, inline] of optional) {
    if (value) fields.push({ name, value, inline });
  }
  return {
    title: '🐛 Bug Report — Ciel de Feu',
    color: 0xcc3300,
    fields,
    timestamp: new Date().toISOString(),
    footer: { text: 'Ciel de Feu Bug Reporter' },
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!isSameOrigin(req)) return res.status(403).json({ error: 'forbidden' });

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  if (!text(body.description, 1024)) return res.status(400).json({ error: 'description_required' });

  const webhookUrl = process.env.DISCORD_BUG_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error('[bug-report] DISCORD_BUG_WEBHOOK_URL manquante');
    return res.status(503).json({ error: 'unavailable' });
  }

  try {
    if (!(await isAllowed(req))) return res.status(429).json({ error: 'rate_limited' });

    const discordRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [buildEmbed(body)], allowed_mentions: { parse: [] } }),
      signal: AbortSignal.timeout(8000),
    });
    if (!discordRes.ok) {
      console.error('[bug-report] Discord a répondu', discordRes.status);
      return res.status(502).json({ error: 'upstream_failed' });
    }
    return res.status(204).end();
  } catch (err) {
    // Pas de limite vérifiable (Redis indisponible) = pas d'envoi : un rapport perdu
    // vaut mieux qu'un webhook ouvert au spam.
    console.error('[bug-report] échec :', err.name);
    return res.status(503).json({ error: 'unavailable' });
  }
}
