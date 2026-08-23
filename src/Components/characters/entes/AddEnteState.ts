// AddEnteState.ts
//
// Plain module-level object (not React state, not persisted to disk) that
// holds whatever the user was doing in the Add Ente popup — filter text,
// active filter buttons, and the staged "cart" of entes to add. Since it's
// just a JS module, it naturally survives the popup unmounting when closed
// and remounting when reopened, but resets on an actual page reload.

export interface AddEnteDraft {
  filterText: string;
  selectedElementos: string[];
  selectedClases: string[];
  selectedRanks: string[];
  // enteId -> amount the user wants to add
  cart: Record<string, number>;
  // how many gallery cards have been lazy-loaded so far
  loadedCount: number;
}

export const addEnteDraft: AddEnteDraft = {
  filterText: "",
  selectedElementos: [],
  selectedClases: [],
  selectedRanks: [],
  cart: {},
  loadedCount: 60,
};

export function resetAddEnteDraft() {
  addEnteDraft.filterText = "";
  addEnteDraft.selectedElementos = [];
  addEnteDraft.selectedClases = [];
  addEnteDraft.selectedRanks = [];
  addEnteDraft.cart = {};
  addEnteDraft.loadedCount = 60;
}
