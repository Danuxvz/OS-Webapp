import { pushLocalChanges, pushTabs } from "./Sync";

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let isSyncing = false;
let pendingSync = false;

// Short debounce so nothing sits around long. The direct per-character
// sync (syncCharacter) handles loadout edits and other immediate pushes
// anyway, so this is mostly a safety net for mutations that only call
// triggerAutoSync().
const SYNC_DELAY = 3000;

async function performSync() {
  if (isSyncing) {
    pendingSync = true;
    return;
  }

  isSyncing = true;

  try {
    console.log("Auto-sync triggered");
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