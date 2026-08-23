import { useState, useEffect, useMemo, useRef } from "react";
import type { Ente } from "../../../types";
import { getAllEnteMetadata } from "../../../services/enteMetadataService";
import type { EnteMetadata } from "../../../services/enteMetadataService";
import { characterManager } from "../CharacterManager";
import EnteSkills from "./EnteSkills";
import { addEnteDraft } from "./AddEnteState";

import "../characterSheetStyles/EntesSection.scss";
import "../characterSheetStyles/AddEntePopup.scss";

interface Props {
  characterId: number;
  existingEntes: Ente[];
  onClose: () => void;
  onAdded: () => void;
}

const CLASE_OPTIONS: { name: string; image: string }[] = [
  { name: "Arts", image: "https://cdn.discordapp.com/emojis/1286813041475977331.webp?size=300" },
  { name: "Divination", image: "https://cdn.discordapp.com/emojis/1286819709844590673.webp?size=300" },
  { name: "Justice", image: "https://cdn.discordapp.com/emojis/1286816300584271872.webp?size=300" },
  { name: "Cleansing", image: "https://cdn.discordapp.com/emojis/1286819744741068922.webp?size=300" },
  { name: "Technique", image: "https://cdn.discordapp.com/emojis/1286765517297684630.webp?size=300" },
];

const ELEMENTO_OPTIONS: { name: string; image: string }[] = [
  { name: "Fuego", image: "https://cdn.discordapp.com/emojis/1286738978120138784.webp?size=300" },
  { name: "Tierra", image: "https://cdn.discordapp.com/emojis/1286820850900926475.webp?size=300" },
  { name: "Luz", image: "https://cdn.discordapp.com/emojis/1286823490917236806.webp?size=300" },
  { name: "Agua", image: "https://cdn.discordapp.com/emojis/1286823534697385985.webp?size=300" },
  { name: "Viento", image: "https://cdn.discordapp.com/emojis/1286825070253051945.webp?size=300" },
  { name: "Vacio", image: "https://cdn.discordapp.com/emojis/1286739970811498590.webp?size=300" },
  { name: "Antiguo", image: "https://cdn.discordapp.com/emojis/1286830303414845603.webp?size=300" },
  { name: "Foraneo", image: "https://cdn.discordapp.com/emojis/1286830324743012414.webp?size=300" },
  { name: "Nous", image: "https://cdn.discordapp.com/emojis/1286830358402302002.webp?size=300" },
  { name: "Tejne", image: "https://cdn.discordapp.com/emojis/1286830467718316062.webp?size=300" },
];

const RANK_ORDER: Record<string, number> = { E: 0, D: 1, C: 2 };

function parseSortKey(id: string) {
  const m = id.match(/^([A-Za-z]+)(\d+)([A-Za-z]*)$/);
  if (!m) return { rankOrder: 99, num: 0, suffix: id.toUpperCase() };
  const [, letter, numStr, suffix] = m;
  return {
    rankOrder: RANK_ORDER[letter.toUpperCase()] ?? 99,
    num: parseInt(numStr, 10),
    suffix: suffix.toUpperCase(),
  };
}

function compareEnteIds(a: string, b: string) {
  const ka = parseSortKey(a);
  const kb = parseSortKey(b);
  if (ka.rankOrder !== kb.rankOrder) return ka.rankOrder - kb.rankOrder;
  if (ka.num !== kb.num) return ka.num - kb.num;
  return ka.suffix.localeCompare(kb.suffix);
}

function computeUnlockLevel(amount: number) {
  if (amount >= 5) return 4;
  if (amount === 4) return 3;
  if (amount === 3) return 2;
  if (amount === 2) return 1;
  return 0;
}

const PAGE_SIZE = 60;

function AddEntePopup({ characterId, existingEntes, onClose, onAdded }: Props) {
  const [catalog, setCatalog] = useState<EnteMetadata[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  const [filterText, setFilterText] = useState(addEnteDraft.filterText);
  const [selectedElementos, setSelectedElementos] = useState<string[]>(addEnteDraft.selectedElementos);
  const [selectedClases, setSelectedClases] = useState<string[]>(addEnteDraft.selectedClases);
  const [selectedRanks, setSelectedRanks] = useState<string[]>(addEnteDraft.selectedRanks);
  const [cart, setCart] = useState<Record<string, number>>(addEnteDraft.cart);
  const [loadedCount, setLoadedCount] = useState(addEnteDraft.loadedCount);

  const [committing, setCommitting] = useState(false);
  const [committedMessage, setCommittedMessage] = useState("");

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;
    getAllEnteMetadata().then((all) => {
      if (!mounted) return;
      const list = Object.values(all).filter((m) => m.inRanksSheet);
      list.sort((a, b) => compareEnteIds(a.id, b.id));
      setCatalog(list);
      setCatalogLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => { addEnteDraft.filterText = filterText; }, [filterText]);
  useEffect(() => { addEnteDraft.selectedElementos = selectedElementos; }, [selectedElementos]);
  useEffect(() => { addEnteDraft.selectedClases = selectedClases; }, [selectedClases]);
  useEffect(() => { addEnteDraft.selectedRanks = selectedRanks; }, [selectedRanks]);
  useEffect(() => { addEnteDraft.cart = cart; }, [cart]);
  useEffect(() => { addEnteDraft.loadedCount = loadedCount; }, [loadedCount]);

  const existingAmountById = useMemo(() => {
    const map: Record<string, number> = {};
    existingEntes.forEach((e) => {
      map[e.id] = e.amount || 0;
    });
    return map;
  }, [existingEntes]);

  const availableRanks = useMemo(() => {
    const ranks = new Set<string>();
    catalog.forEach((m) => {
      if (m.rank) ranks.add(m.rank.toUpperCase());
    });
    return Array.from(ranks).sort((a, b) => (RANK_ORDER[a] ?? 99) - (RANK_ORDER[b] ?? 99));
  }, [catalog]);

  const filtered = useMemo(() => {
    let list = catalog;

    if (filterText.trim()) {
      const f = filterText.trim().toLowerCase();
      list = list.filter(
        (m) =>
          m.id.toLowerCase().includes(f) ||
          m.name?.toLowerCase().includes(f) ||
          m.clase?.toLowerCase().includes(f) ||
          m.elemento?.toLowerCase().includes(f) ||
          m.AE?.toLowerCase().includes(f) ||
          m.SB?.toLowerCase().includes(f) ||
          m.HE?.toLowerCase().includes(f) ||
          m.AC?.toLowerCase().includes(f)
      );
    }

    if (selectedRanks.length) {
      list = list.filter((m) => selectedRanks.includes(m.rank?.toUpperCase()));
    }

    if (selectedClases.length) {
      list = list.filter((m) => selectedClases.includes(m.clase));
    }

    if (selectedElementos.length) {
      list = list.filter((m) => selectedElementos.includes(m.elemento));
    }

    return list;
  }, [catalog, filterText, selectedRanks, selectedClases, selectedElementos]);

  const skipFirstResetRef = useRef(true);
  useEffect(() => {
    if (skipFirstResetRef.current) {
      skipFirstResetRef.current = false;
      return;
    }
    setLoadedCount(PAGE_SIZE);
  }, [filterText, selectedClases, selectedElementos, selectedRanks]);

  const visible = filtered.slice(0, loadedCount);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setLoadedCount((prev) => Math.min(prev + PAGE_SIZE, filtered.length || prev + PAGE_SIZE));
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [filtered.length]);

  function toggleFilterValue(list: string[], value: string, setter: (v: string[]) => void) {
    if (list.includes(value)) setter(list.filter((v) => v !== value));
    else setter([...list, value]);
  }

  function addToCart(enteId: string) {
    setCart((prev) => ({ ...prev, [enteId]: (prev[enteId] ?? 0) + 1 }));
  }

  function setCartAmount(enteId: string, amount: number) {
    setCart((prev) => {
      const next = { ...prev };
      if (amount <= 0) delete next[enteId];
      else next[enteId] = amount;
      return next;
    });
  }

  function removeFromCart(enteId: string) {
    setCart((prev) => {
      const next = { ...prev };
      delete next[enteId];
      return next;
    });
  }

  const cartEntries = useMemo(() => {
    return Object.entries(cart)
      .map(([id, amount]) => {
        const meta = catalog.find((m) => m.id === id);
        if (!meta) return null;
        const currentAmount = existingAmountById[id] ?? 0;
        const previewUnlock = computeUnlockLevel(currentAmount + amount);
        return { meta, amount, currentAmount, previewUnlock };
      })
      .filter(Boolean) as { meta: EnteMetadata; amount: number; currentAmount: number; previewUnlock: number }[];
  }, [cart, catalog, existingAmountById]);

  async function handleCommit() {
    if (cartEntries.length === 0) return;
    setCommitting(true);
    try {
      for (const entry of cartEntries) {
        await characterManager.addEnte(characterId, entry.meta.id, entry.amount);
      }
      setCommittedMessage(`Se añadieron ${cartEntries.length} ente(s).`);
      setCart({});
      onAdded();
      window.setTimeout(() => setCommittedMessage(""), 2500);
    } catch (err) {
      console.warn("Failed to add entes", err);
    } finally {
      setCommitting(false);
    }
  }

  return (
    <div className="loadout-popup-backdrop add-ente-popup-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="loadout-popup add-ente-popup card shadow-lg border-0" onClick={(e) => e.stopPropagation()}>
        <div className="card-body add-ente-popup-body">
          {/* TOP: staged cart */}
          <div className="add-ente-cart-section">
            <div className="add-ente-cart-header">
              <h3 className="h6 mb-0">Entes a añadir ({cartEntries.length})</h3>
              <button
                className="btn btn-primary btn-sm"
                disabled={cartEntries.length === 0 || committing}
                onClick={handleCommit}
              >
                {committing ? "Añadiendo…" : "Añadir seleccionados"}
              </button>
            </div>

            {committedMessage && <div className="add-ente-committed-msg">{committedMessage}</div>}

            {cartEntries.length === 0 ? (
              <div className="add-ente-cart-empty">
                Elige entes de la lista de abajo para añadirlos aquí.
              </div>
            ) : (
              <ul className="ente-list add-ente-cart-list">
                {cartEntries.map(({ meta, amount, currentAmount, previewUnlock }) => (
                  <li key={meta.id} className="ente-item add-ente-cart-item">
                    <div className="ente-top-row">
                      <div className="ente-actions">
                        <button className="delete-ente-btn" onClick={() => removeFromCart(meta.id)}>
                          🗑️
                        </button>
                        <input
                          className="ente-amount-input"
                          type="text"
                          value={amount}
                          onChange={(e) => {
                            const v = Math.max(0, Number(e.target.value || 0));
                            setCartAmount(meta.id, v);
                          }}
                        />
                      </div>

                      <div className="ente-left">
                        <div className="ente-thumb-wrap">
                          {meta.image ? (
                            <img className="ente-thumb" src={meta.image} alt={meta.id} />
                          ) : (
                            <div className="ente-thumbnail-placeholder">no image</div>
                          )}
                        </div>
                        <div className="add-ente-cart-unlock">
                          {currentAmount} + {amount} → nivel {previewUnlock}
                        </div>
                      </div>

                      <div className="ente-right">
                        <EnteSkills
                          ente={
                            {
                              ...meta,
                              amount: currentAmount + amount,
                              unlockLevel: previewUnlock,
                              favorite: false,
                              order: 0,
                            } as Ente
                          }
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* BOTTOM: browsable catalog with filters */}
          <div className="add-ente-browse-section">
            {/* Row 1: Search + Rank */}
            <div className="add-ente-filter-row">
              <input
                className="enteFilter add-ente-text-filter"
                type="text"
                placeholder="Filtrar..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
              />

              {availableRanks.length > 0 && (
                <div className="add-ente-filter-group add-ente-filter-group-right">
                  <span className="add-ente-filter-label">Rank:</span>
                  {availableRanks.map((rank) => (
                    <button
                      key={rank}
                      className={`add-ente-filter-btn add-ente-filter-btn-text ${
                        selectedRanks.includes(rank) ? "active" : ""
                      }`}
                      onClick={() => toggleFilterValue(selectedRanks, rank, setSelectedRanks)}
                    >
                      {rank}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Row 2: Clase + Elemento */}
            <div className="add-ente-filter-row">
              <div className="add-ente-filter-group">
                <span className="add-ente-filter-label">Clase:</span>
                {CLASE_OPTIONS.map((opt) => (
                  <button
                    key={opt.name}
                    className={`add-ente-filter-btn ${selectedClases.includes(opt.name) ? "active" : ""}`}
                    title={opt.name}
                    onClick={() => toggleFilterValue(selectedClases, opt.name, setSelectedClases)}
                  >
                    <img src={opt.image} alt={opt.name} />
                  </button>
                ))}
              </div>

              <div className="add-ente-filter-group add-ente-filter-group-right">
                <span className="add-ente-filter-label">Elemento:</span>
                {ELEMENTO_OPTIONS.map((opt) => (
                  <button
                    key={opt.name}
                    className={`add-ente-filter-btn ${selectedElementos.includes(opt.name) ? "active" : ""}`}
                    title={opt.name}
                    onClick={() => toggleFilterValue(selectedElementos, opt.name, setSelectedElementos)}
                  >
                    <img src={opt.image} alt={opt.name} />
                  </button>
                ))}
              </div>
            </div>

            <div className="add-ente-browse-scroll">
              {catalogLoading ? (
                <div className="add-ente-loading">Cargando catálogo…</div>
              ) : (
                <div className="gallery-grid add-ente-gallery">
                  {visible.map((meta) => {
                    const inCartAmount = cart[meta.id] ?? 0;
                    return (
                      <div
                        key={meta.id}
                        className={`gallery-card add-ente-gallery-card ${inCartAmount > 0 ? "in-cart" : ""}`}
                        onClick={() => addToCart(meta.id)}
                        title={meta.name || meta.id}
                      >
                        <div className="gallery-thumb">
                          {meta.image ? (
                            <img src={meta.image} alt={meta.id} />
                          ) : (
                            <div className="no-image">?</div>
                          )}
                        </div>
                        <div className="add-ente-gallery-id">{meta.id}</div>
                        {inCartAmount > 0 && <div className="add-ente-in-cart-badge">+{inCartAmount}</div>}
                      </div>
                    );
                  })}

                  {visible.length === 0 && (
                    <div className="no-entes" style={{ width: "100%" }}>
                      Ningún ente coincide con el filtro.
                    </div>
                  )}

                  <div ref={sentinelRef} className="add-ente-sentinel" />
                </div>
              )}
            </div>
          </div>

          <div className="d-flex justify-content-end gap-2">
            <button className="btn btn-outline-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AddEntePopup;