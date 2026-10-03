import { pushLocalChanges, pushTabs, flushPendingSyncs } from "./Sync";

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

let visibilityRecoveryInFlight = false;
let lastVisibilityRecovery = 0;
const VISIBILITY_DEBOUNCE_MS = 1000;

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;

    const now = Date.now();
    if (visibilityRecoveryInFlight) return;
    if (now - lastVisibilityRecovery < VISIBILITY_DEBOUNCE_MS) return;

    visibilityRecoveryInFlight = true;
    lastVisibilityRecovery = now;

    console.log("[sync] tab became visible — recovering sync");

    setTimeout(() => {
      void flushPendingSyncs().finally(() => {
        visibilityRecoveryInFlight = false;
      });
    }, 250);
  });
}