import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense, useEffect } from 'react';
import { createBrowserRouter, RouterProvider, useRouteError } from 'react-router';
import { Toaster } from 'sonner';
import { Spinner, TooltipProvider } from '@/components/ui';
import { configureSounds, preloadSounds } from '@/lib/sounds';
import { useAuth } from '@/stores/auth';
import { applyTheme, useSettings } from '@/stores/settings';
import Home from '@/pages/Home';

const Play = lazy(() => import('@/pages/Play'));
const BotGame = lazy(() => import('@/pages/BotGame'));
const LocalGame = lazy(() => import('@/pages/LocalGame'));
const OnlineGame = lazy(() => import('@/pages/OnlineGame'));
const Rules = lazy(() => import('@/pages/Rules'));
const Leaderboard = lazy(() => import('@/pages/Leaderboard'));
const Profile = lazy(() => import('@/pages/Profile'));
const Login = lazy(() => import('@/pages/Login'));
const SettingsPage = lazy(() => import('@/pages/Settings'));
const NotFound = lazy(() => import('@/pages/NotFound'));

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } } });

function Loading() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <Spinner className="h-8 w-8 text-brand" />
    </div>
  );
}

function ErrorPage() {
  const error = useRouteError() as Error | undefined;
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="card-surface max-w-md p-8">
        <h1 className="font-display text-3xl font-bold">Oops, a card fell off the table</h1>
        <p className="mt-2 text-ink-soft">{error?.message ?? 'Something went wrong.'}</p>
        <a href="/" className="btn-primary mt-6">
          Back home
        </a>
      </div>
    </div>
  );
}

const s = (el: React.ReactNode) => <Suspense fallback={<Loading />}>{el}</Suspense>;

const router = createBrowserRouter([
  {
    errorElement: <ErrorPage />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/play', element: s(<Play />) },
      { path: '/bot', element: s(<BotGame />) },
      { path: '/local', element: s(<LocalGame />) },
      { path: '/game/:id', element: s(<OnlineGame />) },
      { path: '/rules', element: s(<Rules />) },
      { path: '/leaderboard', element: s(<Leaderboard />) },
      { path: '/u/:username', element: s(<Profile />) },
      { path: '/login', element: s(<Login />) },
      { path: '/settings', element: s(<SettingsPage />) },
      { path: '*', element: s(<NotFound />) },
    ],
  },
]);

export default function App() {
  const init = useAuth((st) => st.init);
  const theme = useSettings((st) => st.theme);
  const sound = useSettings((st) => st.sound);
  const volume = useSettings((st) => st.volume);

  useEffect(() => {
    void init();
    preloadSounds();
  }, [init]);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  useEffect(() => configureSounds({ enabled: sound, volume }), [sound, volume]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RouterProvider router={router} />
        <Toaster
          position="top-center"
          toastOptions={{
            className: '!rounded-2xl !border-line !bg-surface !text-ink !font-sans !font-bold !shadow-lg',
          }}
        />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
