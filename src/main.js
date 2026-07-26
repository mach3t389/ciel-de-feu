import { Menu } from './Menu.js';
import { Game } from './Game.js';
import { LoadingScreen } from './LoadingScreen.js';
import { t } from './i18n.js';
import { initAnalytics } from './Analytics.js';

initAnalytics();

let replayConfig     = null;  // si défini : relance la même partie sans repasser par le menu
let rejoinLobbyConfig = null; // si défini : reconnecte direct au même salon (retour au lobby)

while (true) {
  let config;
  if (replayConfig) {
    config = replayConfig;
    replayConfig = null;
  } else {
    const menu = new Menu();
    config = await menu.show(rejoinLobbyConfig);
    rejoinLobbyConfig = null;
  }

  // Nom affiché = label court du bouton menu (mapShort_X) ; sinon nom complet
  const loading = new LoadingScreen(t(`mapShort_${config.map}`) || t(`mapName_${config.map}`) || t('loading'));

  const game = new Game(document.getElementById('app'), config);
  await game.preload(p => loading.setProgress(p));

  if (config.networkManager) {
    await config.networkManager.waitForPeerReady();
    config.networkManager.send('player_loaded', {});
    const hasRemotePlayers = config.remotePlayers?.length > 0;
    if (hasRemotePlayers) {
      loading.setStatus(t('waitingForPlayers'));
      await new Promise(resolve => {
        let done = false;
        const finish = () => { if (!done) { done = true; resolve(); } };

        config.networkManager.once('all_players_loaded', finish);

        const onProgress = ({ loaded, total }) => {
          if (loaded >= total) {
            config.networkManager.off('player_load_progress', onProgress);
            finish();
          }
        };
        config.networkManager.on('player_load_progress', onProgress);

        setTimeout(() => {
          config.networkManager.off('player_load_progress', onProgress);
          finish();
        }, 12000);
      });
    }
  }

  loading.hide();

  const result = await game.start();
  game.destroy();

  // « Rejouer » : on réutilise la config telle quelle (mêmes paramètres)
  if (result && result.action === 'replay') replayConfig = config;
  // « Retour au lobby » : reconnecte tout le monde au même salon (même code)
  if (result && result.action === 'lobby') {
    rejoinLobbyConfig = {
      isHost: config.isHost, roomCode: config.roomCode,
      mode: config.mode, map: config.map,
      pilotName: config.pilotName, team: config.team, playerTeam: config.playerTeam,
      difficulty: config.difficulty, totalEnemies: config.totalEnemies,
      tdmAiCount: config.tdmAiCount, ffaBotCount: config.ffaBotCount, ffaBotDiff: config.ffaBotDiff,
      friendlyFire: config.friendlyFire, ffaTimeLimit: config.ffaTimeLimit,
      maxPlayers: config.maxPlayers,
    };
  }
}
