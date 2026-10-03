/** 体験ワークショップ — 固定3ジャンル（要件 v0.3） */
export const WORKSHOP_GENRES = [
  {
    id: 'athletic',
    label: 'アスレチック',
    tagline: '走って、跳んで、ゴールを目指そう！',
    emoji: '🏃',
    color: '#52B788',
    chip: '#A8E6CF',
  },
  {
    id: 'shooting',
    label: 'シューティング',
    tagline: '宇宙を飛んで、敵をよけよう！',
    emoji: '🚀',
    color: '#6CB4DA',
    chip: '#A8D8F0',
  },
  {
    id: 'puzzle',
    label: 'パズル',
    tagline: '並べて、そろえて、クリアしよう！',
    emoji: '🧩',
    color: '#9B6FBD',
    chip: '#C8A2E8',
  },
];

export function getGenreById(id) {
  return WORKSHOP_GENRES.find(g => g.id === id) || null;
}
