import { Menu } from './Menu.js';
import { Game } from './Game.js';
import { LoadingScreen } from './LoadingScreen.js';
import { t } from './i18n.js';

let replayConfig = null;  // si défini : relance la même partie sans repasser par le menu

while (true) {
  let config;
  if (replayConfig) {
    config = replayConfig;
    replayConfig = null;
  } else {
    const menu = new Menu();
    config = await menu.show();
  }

  // Nom affiché = label court du bouton menu (mapShort_X) ; sinon nom complet
  const loading = new LoadingScreen(t(`mapShort_${config.map}`) || t(`mapName_${config.map}`) || t('loading'));

  const game = new Game(document.getElementById('app'), config);
  await game.preload(p => loading.setProgress(p));

  if (config.networkManager) {
    loading.setStatus(t('waitingForPlayers'));
    config.networkManager.send('player_loaded', {});
    await new Promise(resolve => config.networkManager.once('all_players_loaded', resolve));
  }

  loading.hide();

  const result = await game.start();
  game.destroy();

  // « Rejouer » : on réutilise la config telle quelle (mêmes paramètres)
  if (result && result.action === 'replay') replayConfig = config;
}
