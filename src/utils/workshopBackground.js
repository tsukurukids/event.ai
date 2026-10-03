/** 体験ワークショップ — ポップなふわふわ背景 */
export function workshopBackgroundHtml() {
  const blobs = [
    { class: 'ws-blob ws-blob--1', emoji: '⭐' },
    { class: 'ws-blob ws-blob--2', emoji: '✨' },
    { class: 'ws-blob ws-blob--3', emoji: '🎈' },
    { class: 'ws-blob ws-blob--4', emoji: '💫' },
    { class: 'ws-blob ws-blob--5', emoji: '🌟' },
    { class: 'ws-blob ws-blob--6', emoji: '🎮' },
  ];
  return `
    <div class="ws-bg" aria-hidden="true">
      <div class="ws-bg-shapes">
        <span class="ws-shape ws-shape--circle ws-shape--a"></span>
        <span class="ws-shape ws-shape--circle ws-shape--b"></span>
        <span class="ws-shape ws-shape--circle ws-shape--c"></span>
        <span class="ws-shape ws-shape--ring ws-shape--d"></span>
        <span class="ws-shape ws-shape--ring ws-shape--e"></span>
      </div>
      <div class="ws-bg-floats">
        ${blobs.map(b => `<span class="${b.class}" aria-hidden="true">${b.emoji}</span>`).join('')}
      </div>
    </div>
  `;
}
