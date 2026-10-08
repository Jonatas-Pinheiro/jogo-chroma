export class ChromaAvatar extends HTMLElement {
  connectedCallback() {
    const name = this.getAttribute('name') || 'Nina'
    const size = this.getAttribute('size') || '44'
    this.innerHTML = `<span class="chroma-avatar" style="--avatar-size:${size}px" aria-label="Perfil de ${name}"><span class="avatar-hair"></span><span class="avatar-face"><i></i></span><span class="avatar-shirt"></span></span>`
  }
}
customElements.define('chroma-avatar', ChromaAvatar)
