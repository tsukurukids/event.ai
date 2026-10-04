/**
 * イベント用スターター素材カタログ
 * 実ファイル: public/workshop-starters/{genre}/assets/
 * UI表示用サムネ: public/workshop-ui/thumbs/{genre}/assets/
 */

const ASSET_VER = '20261004c';

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
    workshopThumbUrl('puzzle', 'block_red.png'),
    workshopThumbUrl('puzzle', 'block_blue.png'),
    workshopThumbUrl('puzzle', 'block_yellow.png'),
    workshopThumbUrl('puzzle', 'block_green.png'),
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

function opt(genreId, id, label, file, extra = {}) {
  return {
    id,
    label,
    file,
    path: `./assets/${file}`,
    preview: workshopThumbUrl(genreId, file),
    ...extra,
  };
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
    choices: {
      ship: {
        stepId: 'step1',
        label: 'どの宇宙船にする？',
        slot: 'ship',
        options: [
          opt('shooting', 'ship_blue', 'あおのロケット', 'ship_blue.png'),
          opt('shooting', 'ship_pink', 'ピンクのロケット', 'ship_pink.png'),
          opt('shooting', 'ship_green', 'みどりのロケット', 'ship_green.png'),
        ],
      },
    },
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
    choices: {
      player: {
        stepId: 'step1',
        label: 'どのキャラにする？',
        slot: 'player',
        options: [
          opt('athletic', 'player_boy', 'ぼうや', 'player_boy.png'),
          opt('athletic', 'player_girl', 'おんなのこ', 'player_girl.png'),
          opt('athletic', 'player_robot', 'ロボット', 'player_robot.png'),
        ],
      },
    },
  },
  puzzle: {
    files: [
      'block_red.png',
      'block_blue.png',
      'block_green.png',
      'block_yellow.png',
      'block_purple.png',
      'block_gray.png',
    ],
    choices: {},
  },
};

export function getAssetCatalog(genreId) {
  return WORKSHOP_ASSET_CATALOG[genreId] || null;
}

export function getChoicesForStep(genreId, stepId) {
  const catalog = getAssetCatalog(genreId);
  if (!catalog?.choices) return [];
  return Object.values(catalog.choices).filter((c) => c.stepId === stepId);
}

export function defaultAssetSelections(genreId) {
  const catalog = getAssetCatalog(genreId);
  const out = {};
  if (!catalog?.choices) return out;
  for (const choice of Object.values(catalog.choices)) {
    out[choice.slot] = choice.options[0]?.id || null;
  }
  return out;
}

export function resolveChoiceOption(genreId, slot, optionId) {
  const catalog = getAssetCatalog(genreId);
  const choice = catalog?.choices?.[slot];
  if (!choice) return null;
  return choice.options.find((o) => o.id === optionId) || choice.options[0] || null;
}

/** プロンプト内の {{ship}} 等を選択結果で置換 */
export function applyAssetPlaceholders(prompt, genreId, selections) {
  let text = String(prompt || '');
  const catalog = getAssetCatalog(genreId);
  if (!catalog?.choices) return text;

  for (const choice of Object.values(catalog.choices)) {
    const selected = resolveChoiceOption(genreId, choice.slot, selections?.[choice.slot]);
    if (!selected) continue;
    text = text.split(`{{${choice.slot}}}`).join(selected.path);
    text = text.split(`{{${choice.slot}Label}}`).join(selected.label);
    const extra = selected.promptExtra || '';
    text = text.split(`{{${choice.slot}Extra}}`).join(extra ? `・${extra}` : '');
  }

  return text
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .filter((line) => line.trim() !== '')
    .join('\n')
    .trim();
}

export function listStarterAssetFiles(genreId) {
  return getAssetCatalog(genreId)?.files || [];
}
