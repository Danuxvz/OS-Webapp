import { pushLocalChanges, pushTabs, flushPendingSyncs } from "./Sync";
import { supabase } from "./SupaBase";

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let isSyncing = false;
let pendingSync = false;

// Short debounce so nothing sits around long.
const SYNC_DELAY = 3000;

async function performSync() {
  if (isSyncing) {
    pendingSync = true;
    return;
  }

  isSyncing = true;

  try {
    await pushTabs();
    await pushLocalChanges();
  } catch (err) {
    console.error("Auto-sync failed:", err);
  } finally {
    isSyncing = false;

    if (pendingSync) {
      pendingSync = false;
      setTimeout(() => {
        void performSync();
      }, 0);
    }
  }
}

export function triggerAutoSync(immediate = false) {
  if (immediate) {
    if (isSyncing) {
      pendingSync = true;
      return;
    }
    void performSync();
    return;
  }

  if (syncTimer) {
    clearTimeout(syncTimer);
  }

  syncTimer = setTimeout(() => {
    syncTimer = null;
    void performSync();
  }, SYNC_DELAY);
}

/* =========================
   SAFETY NETS
========================= */

if (typeof window !== "undefined") {
  // Periodic safety net. If the user leaves the tab open for a long time, we want to make sure
  // that any pending changes get pushed eventually, even if they never trigger a direct sync.
  window.setInterval(() => {
    void performSync();
  }, 30000);

  window.addEventListener("online", () => {
    void performSync();
  });
}

/* =========================
   VISIBILITY HANDLER
========================= */

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;

    console.log("[sync] tab became visible — recovering sync");

    void (async () => {
      try {
        // Best-effort token refresh. If this fails, the next write will
        // trigger its own refresh via the serialized auth lock.
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          await supabase.auth.refreshSession().catch((err) => {
            console.warn("[sync] visibility refresh failed (non-fatal):", err?.message ?? err);
          });
        }
      } catch (err: any) {
        console.warn("[sync] visibility refresh threw (non-fatal):", err?.message ?? err);
      }

      // Give the browser a tick to finish waking up, then flush.
      setTimeout(() => {
        void flushPendingSyncs();
      }, 250);
    })();
  });
}