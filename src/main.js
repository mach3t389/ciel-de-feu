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
    await new Promise(resolve => {
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };

      config.networkManager.once('all_players_loaded', finish);

      // Secondary trigger: progress message shows all ready
      const onProgress = ({ loaded, total }) => {
        if (loaded >= total) {
          config.networkManager.off('player_load_progress', onProgress);
          finish();
        }
      };
      config.networkManager.on('player_load_progress', onProgress);

      // Safety fallback: never block forever
      setTimeout(() => {
        config.networkManager.off('player_load_progress', onProgress);
        finish();
      }, 12000);

      config.networkManager.send('player_loaded', {});
    });
  }

  loading.hide();

  const result = await game.start();
  game.destroy();

  // « Rejouer » : on réutilise la config telle quelle (mêmes paramètres)
  if (result && result.action === 'replay') replayConfig = config;
}
