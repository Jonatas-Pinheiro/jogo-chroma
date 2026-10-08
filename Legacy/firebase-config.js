export const firebaseConfig = {
  apiKey: "AIzaSyBHedLFfXAiKvnTVw7WKSWO2hCf3A3MPkQ",
  authDomain: "chroma-79384.firebaseapp.com",
  projectId: "chroma-79384",
  storageBucket: "chroma-79384.firebasestorage.app",
  messagingSenderId: "925503292207",
  appId: "1:925503292207:web:3351b4a312fcb79a11d7da",
  measurementId: "G-E5ZFH1V51K",
  // Preencha com a chave pública VAPID do Firebase Cloud Messaging para habilitar PUSH remoto.
  messagingVapidKey: ""
};

if (typeof window !== 'undefined') window.CHROMA_PUSH_VAPID_KEY = firebaseConfig.messagingVapidKey || '';
