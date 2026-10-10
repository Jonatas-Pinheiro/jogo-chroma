import './current/chroma-current-bridge.js'
import './styles/tokens.css'
import './styles/components.css'
import './styles/screens.css'
import './styles/chroma-toast.css'
import './components/chroma-haptics.js'
import './components/chroma-toast.js'
import './components/chroma-button.js'
import './components/chroma-card.js'
import './components/chroma-avatar.js'
import './components/chroma-dock.js'
import './components/chroma-toggle.js'
import { renderHome } from './screens/home.js'
import { renderShop } from './screens/shop.js'
import { renderSettings } from './screens/settings.js'

const app = document.querySelector('#app')
let currentScreen = 'home'

const screens = { home: renderHome, shop: renderShop, settings: renderSettings }
window.chromaHaptic?.useDefault(true)

function showScreen(screen) {
  const nextScreen = screens[screen] ? screen : 'home'
  if (nextScreen !== currentScreen) window.chromaHaptic?.('navigation')
  currentScreen = nextScreen
  app.innerHTML = screens[currentScreen]({ onPlay: () => showNotice('Sala rápida pronta — esta é uma prévia de UI.', 'success'), onNotice: showNotice })
  app.querySelector('chroma-dock')?.addEventListener('screen-change', (event) => showScreen(event.detail))
  app.querySelectorAll('[data-screen]').forEach((button) => button.addEventListener('click', () => showScreen(button.dataset.screen)))
  app.querySelectorAll('[data-action="notice"]').forEach((button) => button.addEventListener('click', () => showNotice(button.dataset.message || 'Ação disponível em breve.', button.dataset.noticeType)))
}

function showNotice(message, type) {
  return window.chromaToast?.(message, type)
}

showScreen(currentScreen)
