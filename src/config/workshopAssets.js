/**
 * イベント用スターター素材カタログ
 * 実ファイル: public/workshop-starters/{genre}/assets/
 * UI表示用サムネ: public/workshop-ui/thumbs/{genre}/assets/
 */

const ASSET_VER = '20261004b';

/** ZIP・ゲーム用の本番素材URL */
export function workshopAssetUrl(genreId, file) {
  return `/workshop-starters/${genreId}/assets/${file}?v=${ASSET_VER}`;
}

/** 画面表示用の軽いサムネURL（128px） */
export function workshopThumbUrl(genreId, file) {
  return `/workshop-ui/thumbs/${genreId}/assets/${file}?v=${ASSET_VER}`;
}

export function workshopTitleArtUrl() {
  return `/workshop-ui/event-title.png?v=${ASSET_VER}`;
}

/** 入口で先読みする画像（サムネ＋タイトル） */
export function getEntryPreloadUrls() {
  return [
    workshopTitleArtUrl(),
    workshopThumbUrl('athletic', 'player_boy.png'),
    workshopThumbUrl('athletic', 'player_girl.png'),
    workshopThumbUrl('athletic', 'coin.png'),
    workshopThumbUrl('athletic', 'ground.png'),
    workshopThumbUrl('shooting', 'ship_blue.png'),
    workshopThumbUrl('shooting', 'enemy_green.png'),
    workshopThumbUrl('shooting', 'enemy_purple.png'),
    workshopThumbUrl('puzzle', 'puyo_red.png'),
    workshopThumbUrl('puzzle', 'puyo_blue.png'),
    workshopThumbUrl('puzzle', 'puyo_yellow.png'),
    workshopThumbUrl('puzzle', 'puyo_green.png'),
  ];
}

let preloadPromise = null;

export function preloadWorkshopEntryAssets() {
  if (preloadPromise) return preloadPromise;
  const urls = getEntryPreloadUrls();
  preloadPromise = Promise.all(
    urls.map(
      (src) =>
        new Promise((resolve) => {
          const img = new Image();
          img.decoding = 'async';
          img.onload = () => resolve(src);
          img.onerror = () => resolve(src);
          img.src = src;
        })
    )
  );
  return preloadPromise;
}

export const WORKSHOP_ASSET_CATALOG = {
  shooting: {
    files: [
      'ship_blue.png',
      'ship_pink.png',
      'ship_green.png',
      'enemy_green.png',
      'enemy_purple.png',
      'enemy_orange.png',
    ],
  },
  athletic: {
    files: [
      'player_boy.png',
      'player_girl.png',
      'player_robot.png',
      'ground.png',
      'block.png',
      'goal.png',
      'coin.png',
    ],
  },
  puzzle: {
    files: [
      'puyo_red.png',
      'puyo_blue.png',
      'puyo_green.png',
      'puyo_yellow.png',
      'puyo_purple.png',
      'puyo_hard.png',
    ],
  },
};

export function getAssetCatalog(genreId) {
  return WORKSHOP_ASSET_CATALOG[genreId] || null;
}

export function listStarterAssetFiles(genreId) {
  return getAssetCatalog(genreId)?.files || [];
}
