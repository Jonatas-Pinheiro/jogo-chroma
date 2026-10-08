export class ChromaButton extends HTMLElement {
  connectedCallback() {
    const label = this.getAttribute('label') || this.textContent.trim()
    const variant = this.getAttribute('variant') || 'primary'
    const icon = this.getAttribute('icon') || ''
    this.innerHTML = `<button class="chroma-button ${variant}" type="button">${icon ? `<span class="button-icon">${icon}</span>` : ''}<span>${label}</span></button>`
  }
}
customElements.define('chroma-button', ChromaButton)
