import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register Service Worker
// @ts-ignore
import { registerSW } from 'virtual:pwa-register';

if ('serviceWorker' in navigator) {
  registerSW({
    onNeedRefresh() {
      if (confirm('Nova versão disponível. Atualizar agora?')) {
        window.location.reload();
      }
    },
    onOfflineReady() {
      console.log('App pronto para funcionar offline');
    },
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
