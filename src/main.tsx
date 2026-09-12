import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import './index.scss';
import { App } from './App';
import Login from './services/LogIn.tsx';
import { initSupabaseAuth } from './services/SupaBase.ts';
import { syncAllWithProgress } from "./services/Sync.tsx";
import Loading from './Components/Loading';
import type { LoadingStep } from './Components/Loading';

const TOTAL_STEPS = 8; // 1 for auth + 7 for syncAllWithProgress

function Main() {
  const [discordId, setDiscordId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<LoadingStep>({
    label: "Connecting to Discord…",
    index: 0,
    total: TOTAL_STEPS,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function bootstrap() {
      try {
        const user = await initSupabaseAuth();

        if (user) {
          const id = user.user_metadata?.provider_id || user.id;
          setDiscordId(id);

          // Sync progress reports 0..N of its own steps; shift by 1 so the
          // auth step we just finished counts as step 1 of TOTAL_STEPS.
          await syncAllWithProgress((label, index, total) => {
            setStep({
              label,
              index: index + 1,
              total: total + 1,
            });
          });
        }
      } catch (err) {
        console.error("Bootstrap failed:", err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
  }, []);

  if (loading) return <Loading step={step} />;

  if (error) return <Loading error={error} />;

  if (!discordId) return <Login />;

  return <App discordId={discordId} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Main />
  </StrictMode>
);