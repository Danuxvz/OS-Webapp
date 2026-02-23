import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import './index.scss';
import { App } from './App';
import Login from './services/LogIn.tsx';
import { initSupabaseAuth } from './services/SupaBase.ts';
import { syncAll } from "./services/Sync.tsx";

function Main() {
  const [discordId, setDiscordId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function bootstrap() {
      const user = await initSupabaseAuth();

      if (user) {
        console
        const id = user.user_metadata?.provider_id || user.id;
        setDiscordId(id);
        await syncAll();
      }

      setLoading(false);
    }

    bootstrap();
  }, []);

  if (loading) return <div>Loading...</div>;

  // If no user session, show login page
  if (!discordId) return <Login />;

  return <App discordId={discordId} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Main />
  </StrictMode>
);