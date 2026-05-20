import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { preconnectSocket, startServerKeepAlive, warmGameServer } from './net/socket';
import { useAuthStore } from './store/authStore';

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

  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
