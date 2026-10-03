/**
 * イベント用スターター素材カタログ
 * 実ファイル: public/workshop-starters/{genre}/assets/
 */

export function workshopAssetUrl(genreId, file) {
  return `/workshop-starters/${genreId}/assets/${file}?v=20261003`;
}

function opt(genreId, id, label, file, extra = {}) {
  return {
    id,
    label,
    file,
    path: `./assets/${file}`,
    preview: workshopAssetUrl(genreId, file),
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
      enemy: {
        stepId: 'step2',
        label: 'どのてきにする？',
        slot: 'enemy',
        options: [
          opt('shooting', 'enemy_green', 'みどりエイリアン', 'enemy_green.png'),
          opt('shooting', 'enemy_purple', 'むらさきエイリアン', 'enemy_purple.png'),
          opt('shooting', 'enemy_orange', 'オレンジエイリアン', 'enemy_orange.png'),
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
      'puyo_red.png',
      'puyo_blue.png',
      'puyo_green.png',
      'puyo_yellow.png',
      'puyo_purple.png',
      'puyo_hard.png',
    ],
    choices: {
      favorite: {
        stepId: 'step1',
        label: 'すきなぷよの色は？',
        slot: 'favorite',
        options: [
          opt('puzzle', 'fav_red', 'あか', 'puyo_red.png', {
            promptExtra: '赤いぷよを少し多めに出してかわいくして',
          }),
          opt('puzzle', 'fav_blue', 'あお', 'puyo_blue.png', {
            promptExtra: '青いぷよを少し多めに出してかわいくして',
          }),
          opt('puzzle', 'fav_green', 'みどり', 'puyo_green.png', {
            promptExtra: '緑のぷよを少し多めに出してかわいくして',
          }),
          opt('puzzle', 'fav_yellow', 'きいろ', 'puyo_yellow.png', {
            promptExtra: '黄色いぷよを少し多めに出してかわいくして',
          }),
          opt('puzzle', 'fav_purple', 'むらさき', 'puyo_purple.png', {
            promptExtra: 'むらさきのぷよを少し多めに出してかわいくして',
          }),
        ],
      },
    },
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
