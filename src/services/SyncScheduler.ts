import { pushLocalChanges, pushTabs } from "./Sync";

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let isSyncing = false;
let pendingSync = false;

const SYNC_DELAY = 15000;

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

    // If another sync was requested while we were running, run it now.
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
    pendingSync = true;
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