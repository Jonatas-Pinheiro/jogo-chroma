const links = [
  ['home', '⌂', 'Início'],
  ['shop', '▣', 'Loja'],
  ['settings', '⚙', 'Ajustes'],
]

export class ChromaDock extends HTMLElement {
  connectedCallback() {
    const active = this.getAttribute('active') || 'home'
    this.innerHTML = `<nav class="chroma-dock" aria-label="Navegação principal">${links.map(([id, icon, label]) => `<button class="dock-link ${id === active ? 'active' : ''}" data-screen="${id}" aria-current="${id === active ? 'page' : 'false'}"><span>${icon}</span><small>${label}</small></button>`).join('')}<span class="dock-season"><b></b><small>SEASON 02</small></span></nav>`
    this.querySelectorAll('[data-screen]').forEach((button) => button.addEventListener('click', () => this.dispatchEvent(new CustomEvent('screen-change', { bubbles: true, detail: button.dataset.screen }))))
  }
}
customElements.define('chroma-dock', ChromaDock)
