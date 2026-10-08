export class ChromaToggle extends HTMLElement {
  connectedCallback() {
    const label = this.getAttribute('label') || 'Alternar opção'
    const tactileFeedback = label === 'Feedback tátil'
    const savedPreference = tactileFeedback ? window.chromaHaptic?.getPreference?.() : null
    const checked = typeof savedPreference === 'boolean' ? savedPreference : this.hasAttribute('checked')
    if (tactileFeedback && typeof savedPreference !== 'boolean') window.chromaHaptic?.useDefault?.(checked)
    this.innerHTML = `<button class="chroma-toggle ${checked ? 'checked' : ''}" type="button" role="switch" aria-checked="${checked}" aria-label="${label}"><span></span></button>`
    this.querySelector('button').addEventListener('click', (event) => {
      const button = event.currentTarget
      const next = button.getAttribute('aria-checked') !== 'true'
      button.setAttribute('aria-checked', String(next))
      button.classList.toggle('checked', next)
      if (tactileFeedback) window.chromaHaptic?.setEnabled?.(next)
      this.dispatchEvent(new CustomEvent('toggle-change', { bubbles: true, detail: next }))
    })
  }
}
customElements.define('chroma-toggle', ChromaToggle)
