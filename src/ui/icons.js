// Minimal line icons, one stroke weight, drawn on a 24-unit grid.
const I = {
  headphones: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="6" rx="1.2"/><rect x="17" y="14" width="4" height="6" rx="1.2"/>',
  watch: '<circle cx="12" cy="13" r="7"/><path d="M12 9.2V13l2.4 1.6"/><path d="M10.4 3.2h3.2M12 3.2V6"/>',
  lantern: '<path d="M9 8h6l1.4 9H7.6z"/><path d="M8.5 20h7M10 8V6a2 2 0 0 1 4 0v2"/><path d="M12 11.5v2.6"/>',
  wrench: '<path d="M14.6 6.2a3.6 3.6 0 0 0-4.8 4.4L4.4 16a1.9 1.9 0 0 0 2.7 2.7l5.4-5.4a3.6 3.6 0 0 0 4.4-4.8l-2.3 2.3-2-2z"/>',
  eye: '<path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
};
export const icon = (name) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${I[name] || ''}</svg>`;
