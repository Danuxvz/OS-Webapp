import { pushLocalChanges } from "./Sync";



let syncTimer: ReturnType<typeof setTimeout> | null = null;
let isSyncing = false;

const SYNC_DELAY = 15000;

export function triggerAutoSync() {
  if (syncTimer) {
	clearTimeout(syncTimer);
  }

  syncTimer = setTimeout(async () => {
	if (isSyncing) return;

	isSyncing = true;

	try {
	  console.log("Auto-sync triggered");
	  await pushLocalChanges();
	} catch (err) {
	  console.error("Auto-sync failed:", err);
	} finally {
	  isSyncing = false;
	  syncTimer = null;
	}
  }, SYNC_DELAY);
}