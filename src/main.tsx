import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { SiteBackground } from './components/SiteBackground';
import { onPopState } from './lib/routes';
import { preconnectSocket, startServerKeepAlive, warmGameServer } from './net/socket';
import { useAuthStore } from './store/authStore';
import { useGameStore } from './store/gameStore';

function Root() {
  const init = useAuthStore((s) => s.init);
  const session = useAuthStore((s) => s.session);

  useEffect(() => {
    void init();
    return startServerKeepAlive();
  }, [init]);

  useEffect(() => {
    void warmGameServer();
    if (session) void preconnectSocket();
  }, [session]);

  useEffect(() => {
    if (!session) return;
    void useGameStore.getState().hydrateFromUrl();
  }, [session]);

  useEffect(() => {
    return onPopState(() => {
      void useGameStore.getState().hydrateFromUrl();
    });
  }, []);

  return (
    <>
      <SiteBackground />
      <App />
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
