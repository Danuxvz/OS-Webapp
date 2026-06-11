// EntesSection.tsx
import { useState, useEffect, useMemo, useRef, Fragment } from "react";
import type { Ente } from "../../../types";
import EnteCard from "./EnteCard";
import { characterManager } from "../CharacterManager";
import { getEnteMetadata } from "../../../services/enteMetadataService";
import { db } from "../database/db";
import { randomizeDarumaForCharacter } from "../../../services/DarumaService";

import "../characterSheetStyles/EntesSection.scss";

interface EntesSectionProps {
  characterId: number | null;
}

function EntesSection({ characterId }: EntesSectionProps) {
  const [entes, setEntes] = useState<Ente[]>([]);
  const [sortBy, setSortBy] = useState("order");
  const [filter, setFilter] = useState("");
  const [adding, setAdding] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "gallery">("list");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const loadIdRef = useRef(0);
  const pendingLoadingTimerRef = useRef<number | null>(null);
  const suppressReloadRef = useRef(0);
  const isLoadingRef = useRef(false);
  const needsReloadRef = useRef(false);
  const mountedRef = useRef(true);

  function computeUnlockLevel(amount: number) {
    if (amount >= 5) return 4;
    if (amount === 4) return 3;
    if (amount === 3) return 2;
    if (amount === 2) return 1;
    return 0;
  }

  const SPECIAL_VARIANT_BASES: Record<string, string> = {
    E005: "E005A",
    E060: "E060A",
    E052: "E052A",
    E123: "E123A",
  };

  function getSpecialBase(id: string): string | null {
    for (const base of Object.keys(SPECIAL_VARIANT_BASES)) {
      if (id.startsWith(base)) {
        return base;
      }
    }
    return null;
  }

  async function loadEntes() {
    if (!characterId) {
      setEntes([]);
      return;
    }

    const thisLoadId = ++loadIdRef.current;

    if (isLoadingRef.current) {
      if (window.innerWidth <= 768) return;
      needsReloadRef.current = true;
      return;
    }

    isLoadingRef.current = true;
    needsReloadRef.current = false;

    if (pendingLoadingTimerRef.current) {
      window.clearTimeout(pendingLoadingTimerRef.current);
      pendingLoadingTimerRef.current = null;
    }
    pendingLoadingTimerRef.current = window.setTimeout(() => {
      if (thisLoadId === loadIdRef.current && mountedRef.current) setLoading(true);
    }, 800);

    try {
      const storedRaw = await characterManager.getEntes(characterId);

      if (thisLoadId !== loadIdRef.current || !mountedRef.current) return;

      if (!storedRaw || storedRaw.length === 0) {
        if (thisLoadId === loadIdRef.current && mountedRef.current) setEntes([]);
        return;
      }

      const stored = storedRaw.map((e: any) =>
        typeof e === "string" ? JSON.parse(e) : e
      );

      const enriched = await Promise.all(
        stored.map(async (e: any) => {
          const enteId = e.enteID ?? e.id;
          if (!enteId) return null;
          const meta = await getEnteMetadata(enteId.toString());
          if (!meta) return null;

          try {
            await db.enteMetadata.put({
              ...meta,
              metadataVersion: 1,
              updatedAt: Date.now(),
              isDirty: false,
            });
          } catch (err) {}

          return {
            ...meta,
            amount: e.amount ?? 1,
            unlockLevel: computeUnlockLevel(e.amount ?? 1),
            favorite: e.favorite ?? false,
            notes: e.notes ?? "",
            customImage: e.customImage ?? "",
            order: typeof e.order === "number"
              ? e.order
              : Number.MAX_SAFE_INTEGER,
          } as Ente;
        })
      );

      if (thisLoadId !== loadIdRef.current || !mountedRef.current) return;

      const validEntes = (enriched.filter(Boolean) as Ente[]);

      const specialGroups: Record<string, Ente[]> = {};
      validEntes.forEach((ente) => {
        const base = getSpecialBase(ente.id);
        if (!base) return;
        if (!specialGroups[base]) specialGroups[base] = [];
        specialGroups[base].push(ente);
      });

      Object.values(specialGroups).forEach((group) => {
        const maxAmount = Math.max(...group.map((e) => e.amount));
        const sharedUnlock = computeUnlockLevel(maxAmount);
        group.forEach((e) => {
          e.unlockLevel = sharedUnlock;
        });
      });

      if (thisLoadId === loadIdRef.current && mountedRef.current) {
        setEntes(validEntes);
      }
    } catch (err) {
      console.warn("loadEntes error", err);
    } finally {
      isLoadingRef.current = false;

      if (window.innerWidth > 768 && needsReloadRef.current && mountedRef.current) {
        needsReloadRef.current = false;
        setTimeout(() => loadEntes(), 50);
      }

      if (pendingLoadingTimerRef.current) {
        window.clearTimeout(pendingLoadingTimerRef.current);
        pendingLoadingTimerRef.current = null;
      }
      if (thisLoadId === loadIdRef.current && mountedRef.current) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    mountedRef.current = true;

    if (!characterId) {
      setEntes([]);
      return;
    }

    loadEntes();

    const handler = (payload: any) => {
      if (suppressReloadRef.current > 0) return;
      if (payload && (payload.characterId !== characterId && payload.id !== characterId)) return;
      loadEntes();
    };

    characterManager.on("characterUpdated", handler);
    characterManager.on("enteUpdated", handler);
    characterManager.on("bonusUpdated", handler);

    return () => {
      mountedRef.current = false;
      characterManager.off("characterUpdated", handler);
      characterManager.off("enteUpdated", handler);
      characterManager.off("bonusUpdated", handler);
    };
  }, [characterId]);

  async function updateEnte(updated: Ente) {
    if (!characterId) return;

    setEntes((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));

    try {
      await characterManager.updateEnte(characterId, updated.id, {
        amount: updated.amount,
        unlockLevel: updated.unlockLevel,
        notes: updated.notes,
        customImage: updated.customImage,
        favorite: updated.favorite,
      });
    } catch (err) {
      loadEntes();
    }
  }

  function AddEnteForm({
    onAdd,
    onCancel,
  }: {
    onAdd: (id: string) => void;
    onCancel: () => void;
  }) {
    const [id, setId] = useState("");

    return (
      <div className="add-ente-modal">
        <input
          className="enteFilter"
          placeholder="Enter Ente ID..."
          value={id}
          onChange={(e) => setId(e.target.value)}
        />
        <button className="modal-btn" onClick={() => onAdd(id)}>
          ✔
        </button>
        <button className="modal-btn" onClick={onCancel}>
          ✖
        </button>
      </div>
    );
  }

  const filteredAndSorted = useMemo(() => {
    let list = [...entes];

    if (filter) {
      const f = filter.toLowerCase();
      list = list.filter(
        (e) =>
          e.id?.toLowerCase().includes(f) ||
          e.name?.toLowerCase().includes(f) ||
          e.clase?.toLowerCase().includes(f) ||
          e.elemento?.toLowerCase().includes(f)
      );
    }

    list.sort((a: Ente, b: Ente) => {
      if (a.favorite !== b.favorite) {
        return a.favorite ? -1 : 1;
      }

      if (sortBy === "unlockLevel") {
        const diff = b.unlockLevel - a.unlockLevel;
        if (diff !== 0) return diff;
      }

      if (sortBy === "amount") {
        const diff = b.amount - a.amount;
        if (diff !== 0) return diff;
      }

      if (sortBy === "id") {
        return a.id.localeCompare(b.id);
      }

      const orderA = typeof a.order === "number" ? a.order : Number.MAX_SAFE_INTEGER;
      const orderB = typeof b.order === "number" ? b.order : Number.MAX_SAFE_INTEGER;

      const orderDiff = orderA - orderB;
      if (orderDiff !== 0) return orderDiff;

      return a.id.localeCompare(b.id);
    });

    return list;
  }, [entes, sortBy, filter]);

  async function reorderEntes(dragId: string, dropId: string) {
    if (!characterId) return;

    const updated = [...entes];

    const dragIndex = updated.findIndex((e) => e.id === dragId);
    const dropIndex = updated.findIndex((e) => e.id === dropId);
    if (dragIndex === -1 || dropIndex === -1) return;

    const [removed] = updated.splice(dragIndex, 1);
    updated.splice(dropIndex, 0, removed);

    const reordered = updated.map((e, i) => ({
      ...e,
      order: i,
    }));

    setEntes(reordered);

    suppressReloadRef.current++;

    try {
      await characterManager.updateEntesOrder(
        characterId,
        reordered.map((e) => ({ id: e.id, order: e.order }))
      );
    } catch {
      await loadEntes();
    } finally {
      suppressReloadRef.current--;
    }
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  function StarRating({ amount }: { amount: number }) {
    const stars = Math.min(amount, 5);
    return (
      <div className="star-rating">
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className={`star ${i < stars ? "filled" : "empty"}`}>
            ★
          </span>
        ))}
      </div>
    );
  }

  // Daruma randomization handler
  async function handleRandomizeDaruma(enteId: string) {
    if (!characterId) return;
    try {
      await randomizeDarumaForCharacter(characterId, enteId);
      await loadEntes();
    } catch (err: any) {
      console.warn("Daruma randomization failed:", err);
      alert(err?.message ?? "Daruma randomization failed.");
      await loadEntes();
    }
  }

  if (!characterId) {
    return (
      <div className="entes-section">
        <h2>Entes</h2>
        <p>No character selected.</p>
      </div>
    );
  }

  return (
    <div className="entes-section">
      <div className="entes-header">
        <h2>Entes</h2>

        <div className="entes-controls">
          {/* View toggle buttons */}
          <button
            className={`view-toggle ${viewMode === "list" ? "active" : ""}`}
            onClick={() => setViewMode("list")}
            aria-label="List view"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="2" y="4" width="16" height="2" rx="1" fill="currentColor" />
              <rect x="2" y="9" width="16" height="2" rx="1" fill="currentColor" />
              <rect x="2" y="14" width="16" height="2" rx="1" fill="currentColor" />
            </svg>
          </button>
          <button
            className={`view-toggle ${viewMode === "gallery" ? "active" : ""}`}
            onClick={() => setViewMode("gallery")}
            aria-label="Gallery view"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="2" y="2" width="7" height="7" rx="1" fill="currentColor" />
              <rect x="11" y="2" width="7" height="7" rx="1" fill="currentColor" />
              <rect x="2" y="11" width="7" height="7" rx="1" fill="currentColor" />
              <rect x="11" y="11" width="7" height="7" rx="1" fill="currentColor" />
            </svg>
          </button>

          <label>
            Sort:
            <select
              className="enteSort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="order">Custom</option>
              <option value="id">ID</option>
              <option value="amount">Amount</option>
              <option value="unlockLevel">Unlock priority</option>
            </select>
          </label>

          <input
            className="enteFilter"
            type="text"
            placeholder="Filter (ID / Name / Clase / Elemento)..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
      </div>
      <div className="ente-scroll">
        {viewMode === "gallery" ? (
          <div className="gallery-grid">
            {filteredAndSorted.map((ente) => (
              <Fragment key={ente.id}>
                <div
                  className={`gallery-card ${expandedId === ente.id ? "expanded" : ""}`}
                  draggable={sortBy === "order"}
                  onDragStart={(e) => {
                    if (sortBy !== "order") return;
                    setDraggedId(ente.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => {
                    if (sortBy !== "order") return;
                    e.preventDefault();
                  }}
                  onDrop={() => {
                    if (sortBy !== "order" || !draggedId) return;
                    reorderEntes(draggedId, ente.id);
                    setDraggedId(null);
                  }}
                  onClick={() => toggleExpand(ente.id)}
                >
                  <div className="gallery-thumb">
                    {ente.image ? (
                      <img src={ente.image} alt={ente.id} />
                    ) : (
                      <div className="no-image">?</div>
                    )}
                  </div>
                  <StarRating amount={ente.amount} />
                </div>

                {expandedId === ente.id && (
                  <div className="gallery-detail">
                    <EnteCard
                      ente={ente}
                      onUpdate={updateEnte}
                      onDelete={async (id) => {
                        try {
                          await characterManager.updateEnte(characterId, id, {
                            isDeleted: true,
                            amount: 0,
                            updatedAt: Date.now(),
                            isDirty: true,
                          });
                          await loadEntes();
                        } catch (err) {
                          console.warn("Failed to delete ente", id, err);
                          await loadEntes();
                        }
                      }}
                      computeUnlockLevel={computeUnlockLevel}
                      hideThumbnail
                      onRandomizeDaruma={handleRandomizeDaruma}
                    />
                  </div>
                )}
              </Fragment>
            ))}

            {filteredAndSorted.length === 0 && entes.length > 0 && !loading && (
              <div className="no-entes" style={{ width: "100%" }}>
                Ningun ente coincide con el filtro "{filter}".
              </div>
            )}
          </div>
        ) : (
          /* Original list mode */
          <ul className="ente-list">
            <li className="ente-add-static" onClick={() => setAdding(true)}>
              + Add Ente
            </li>
            {adding && (
              <AddEnteForm
                onAdd={async (id) => {
                  if (!id) return;
                  await characterManager.addEnte(characterId, id, 1);
                  await loadEntes();
                  setAdding(false);
                }}
                onCancel={() => setAdding(false)}
              />
            )}

            {loading ? (
              <li className="ente-loading">Loading entes…</li>
            ) : (
              filteredAndSorted.map((ente) => (
                <li
                  key={ente.id}
                  draggable={sortBy === "order"}
                  onDragStart={(e) => {
                    if (sortBy !== "order") return;
                    setDraggedId(ente.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => {
                    if (sortBy !== "order") return;
                    e.preventDefault();
                  }}
                  onDrop={() => {
                    if (sortBy !== "order" || !draggedId) return;
                    reorderEntes(draggedId, ente.id);
                    setDraggedId(null);
                  }}
                >
                  <EnteCard
                    ente={ente}
                    onUpdate={updateEnte}
                    onDelete={async (id) => {
                      try {
                        await characterManager.updateEnte(characterId, id, {
                          isDeleted: true,
                          amount: 0,
                          updatedAt: Date.now(),
                          isDirty: true,
                        });
                        await loadEntes();
                      } catch (err) {
                        console.warn("Failed to delete ente", id, err);
                        await loadEntes();
                      }
                    }}
                    computeUnlockLevel={computeUnlockLevel}
                    onRandomizeDaruma={handleRandomizeDaruma}
                  />
                </li>
              ))
            )}

            {filteredAndSorted.length === 0 && entes.length > 0 && !loading && (
              <li className="no-entes">
                Ningun ente coincide con el filtro "{filter}".
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

export default EntesSection;