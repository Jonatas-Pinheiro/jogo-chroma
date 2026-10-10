export class ChromaCard extends HTMLElement {
  connectedCallback() {
    const tone = this.getAttribute('tone') || 'coral'
    const value = this.getAttribute('value') || 'Q'
    const label = this.getAttribute('label') || '02'
    this.innerHTML = `<div class="chroma-card card-${tone}" aria-label="Carta ${value}"><small>${label}</small><strong>${value}</strong><span>CH</span></div>`
  }
}
customElements.define('chroma-card', ChromaCard)
