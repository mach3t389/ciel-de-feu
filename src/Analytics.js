import { inject } from '@vercel/analytics';

// Clé localStorage à poser dans la console du navigateur pour s'exclure
// soi-même du comptage Vercel Web Analytics (voir commande fournie).
const DEV_VISITOR_KEY = 'dev_visitor';

export function initAnalytics() {
  if (localStorage.getItem(DEV_VISITOR_KEY)) return;
  inject();
}
