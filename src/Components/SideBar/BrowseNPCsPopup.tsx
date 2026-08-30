import { useState, useEffect, useMemo } from "react";
import type { MouseEvent } from "react";
import {
  fetchPublishedCharacters,
  fetchPublishedCharacterDetail,
} from "../../services/Sync.tsx";
import type { PublishedNpcSummary } from "../../services/Sync.tsx";
import { characterManager } from "../characters/CharacterManager";
import "../ComponentStyles/BrowseNPCsPopup.scss";

interface Props {
  discordId: string;
  onClose: () => void;
  onImported: (newLocalCharId: number) => void;
}

interface DetailState {
  entes: { enteID: string; amount: number; unlockLevel: number; notes?: string; customImage?: string; image: string; order: number }[];
  loadouts: { name: string; data: any }[];
}

function computeTotalStats(npc: PublishedNpcSummary) {
  const sum = (stat: "hp" | "atk" | "slots") =>
    Object.values(npc.bonusLog?.[stat] || {}).reduce((a, b) => a + b, 0);
  return {
    hp: (npc.baseStats?.hp ?? 0) + sum("hp") + (npc.tempStatBonus?.hp ?? 0),
    atk: (npc.baseStats?.atk ?? 0) + sum("atk") + (npc.tempStatBonus?.atk ?? 0),
    slots: (npc.baseStats?.slots ?? 0) + sum("slots") + (npc.tempStatBonus?.slots ?? 0),
  };
}

function BrowseNpcsPopup({ discordId, onClose, onImported }: Props) {
  const [npcs, setNpcs] = useState<PublishedNpcSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState("");

  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [showBookmarkedOnly, setShowBookmarkedOnly] = useState(false);

  const [selectedNpc, setSelectedNpc] = useState<PublishedNpcSummary | null>(null);
  const [detail, setDetail] = useState<DetailState | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [importingId, setImportingId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchPublishedCharacters().then((list) => {
      if (!mounted) return;
      setNpcs(list);
      setLoading(false);
    });
    characterManager.getBookmarks().then((rows) => {
      if (!mounted) return;
      setBookmarkedIds(new Set(rows.map((r) => r.remoteCharacterId)));
    });
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    let list = npcs;
    if (showBookmarkedOnly) {
      list = list.filter((n) => bookmarkedIds.has(n.remoteId));
    }
    if (filterText.trim()) {
      const f = filterText.trim().toLowerCase();
      list = list.filter((n) => n.searchText.includes(f));
    }
    return list;
  }, [npcs, filterText, showBookmarkedOnly, bookmarkedIds]);

  async function selectNpc(npc: PublishedNpcSummary) {
    setSelectedNpc(npc);
    setDetail(null);
    setDetailLoading(true);
    const d = await fetchPublishedCharacterDetail(npc.remoteId);
    setDetail(d);
    setDetailLoading(false);
  }

  async function toggleBookmark(npc: PublishedNpcSummary, e?: MouseEvent) {
    e?.stopPropagation();
    if (bookmarkedIds.has(npc.remoteId)) {
      await characterManager.removeBookmark(npc.remoteId);
      setBookmarkedIds((prev) => {
        const next = new Set(prev);
        next.delete(npc.remoteId);
        return next;
      });
    } else {
      await characterManager.addBookmark(npc.remoteId);
      setBookmarkedIds((prev) => new Set(prev).add(npc.remoteId));
    }
  }

  async function handleImport(npc: PublishedNpcSummary) {
    setImportingId(npc.remoteId);
    try {
      const d =
        detail && selectedNpc?.remoteId === npc.remoteId
          ? detail
          : await fetchPublishedCharacterDetail(npc.remoteId);

      const newId = await characterManager.importSharedCharacter(discordId, {
        charName: npc.charName,
        baseStats: npc.baseStats,
        bonusLog: npc.bonusLog,
        tempStatBonus: npc.tempStatBonus,
        charImage: npc.charImage,
        historySum: npc.historySum,
        schemaVersion: npc.schemaVersion,
        entes: d.entes,
        loadouts: d.loadouts,
      });

      onImported(newId);
      onClose();
    } catch (err) {
      console.warn("Failed to import NPC", err);
    } finally {
      setImportingId(null);
    }
  }

  const primaryLoadout = detail?.loadouts?.[0] ?? null;
  const primaryData = primaryLoadout?.data;

  return (
    <div className="loadout-popup-backdrop browse-npcs-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="browse-npcs-popup card shadow-lg border-0" onClick={(e) => e.stopPropagation()}>
        <div className="card-body browse-npcs-body">
          <div className="browse-npcs-header">
            <h3 className="h6 mb-0">Browse NPCs</h3>
            <button className="btn btn-outline-secondary btn-sm" onClick={onClose}>
              Close
            </button>
          </div>

          <div className="browse-npcs-filter-row">
            <input
              className="enteFilter browse-npcs-search"
              type="text"
              placeholder="Search by name, creator, tab, loadout, entes..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
            />
            <button
              className={`browse-npcs-bookmark-filter ${showBookmarkedOnly ? "active" : ""}`}
              onClick={() => setShowBookmarkedOnly((v) => !v)}
              title="Show only bookmarked"
            >
              {showBookmarkedOnly ? "★ Bookmarked" : "☆ Bookmarked"}
            </button>
          </div>

          <div className="browse-npcs-content">
            {/* ---------------- LIST ---------------- */}
            <div className="browse-npcs-list">
              {loading ? (
                <div className="add-ente-loading">Cargando…</div>
              ) : filtered.length === 0 ? (
                <div className="add-ente-cart-empty">No published NPCs match.</div>
              ) : (
                filtered.map((npc) => (
                  <div
                    key={npc.remoteId}
                    className={`npc-card ${selectedNpc?.remoteId === npc.remoteId ? "active" : ""}`}
                    onClick={() => selectNpc(npc)}
                  >
                    <div className="npc-card-thumb">
                      {npc.charImage ? (
                        <img src={npc.charImage} alt={npc.charName} />
                      ) : (
                        <div className="no-image">?</div>
                      )}
                    </div>
                    <div className="npc-card-info">
                      <div className="npc-card-name">{npc.charName}</div>
                      <div className="npc-card-creator">
                        {npc.creatorAvatar && <img src={npc.creatorAvatar} alt={npc.creatorUsername} />}
                        <span>{npc.creatorUsername}</span>
                      </div>
                      <div className="npc-card-tab">from {npc.originTabName}</div>
                    </div>
                    <button
                      className={`npc-card-bookmark ${bookmarkedIds.has(npc.remoteId) ? "active" : ""}`}
                      onClick={(e) => toggleBookmark(npc, e)}
                      title="Bookmark"
                    >
                      {bookmarkedIds.has(npc.remoteId) ? "★" : "☆"}
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* ---------------- DETAIL ---------------- */}
            <div className="browse-npcs-detail">
              {!selectedNpc ? (
                <div className="add-ente-cart-empty">Select an NPC to preview it here.</div>
              ) : (
                <>
                  <div className="npc-detail-header">
                    <div className="npc-detail-thumb">
                      {selectedNpc.charImage ? (
                        <img src={selectedNpc.charImage} alt={selectedNpc.charName} />
                      ) : (
                        <div className="no-image">?</div>
                      )}
                    </div>
                    <div className="npc-detail-meta">
                      <div className="npc-detail-name">{selectedNpc.charName}</div>
                      <div className="npc-card-creator">
                        {selectedNpc.creatorAvatar && (
                          <img src={selectedNpc.creatorAvatar} alt={selectedNpc.creatorUsername} />
                        )}
                        <span>{selectedNpc.creatorUsername}</span>
                      </div>
                      {(() => {
                        const stats = computeTotalStats(selectedNpc);
                        return (
                          <div className="npc-detail-stats">
                            <span>HP {stats.hp}</span>
                            <span>ATK {stats.atk}</span>
                            <span>Slots {stats.slots}</span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="npc-detail-actions">
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={importingId === selectedNpc.remoteId}
                      onClick={() => handleImport(selectedNpc)}
                    >
                      {importingId === selectedNpc.remoteId ? "Importing…" : "Import"}
                    </button>
                    <button
                      className={`btn btn-sm ${bookmarkedIds.has(selectedNpc.remoteId) ? "btn-warning" : "btn-outline-secondary"}`}
                      onClick={(e) => toggleBookmark(selectedNpc, e)}
                    >
                      {bookmarkedIds.has(selectedNpc.remoteId) ? "★ Bookmarked" : "☆ Bookmark"}
                    </button>
                  </div>

                  {detailLoading ? (
                    <div className="add-ente-loading">Loading loadout & entes…</div>
                  ) : (
                    <>
                      {primaryLoadout && primaryData && (
                        <div className="npc-detail-loadout">
                          <h4 className="h6">Loadout: {primaryLoadout.name}</h4>
                          <div className="npc-loadout-summary">
                            {(() => {
                              const weapon = primaryData.weapon ?? {};
                              const armor = primaryData.armorClass ?? {};
                              const hp = primaryData.hp ?? {};
                              const atk = primaryData.atk ?? {};
                              const slots = primaryData.slots ?? {};
                              const hpBonus = (hp.sources ?? []).filter((s: any) => s.enabled).reduce((sum: number, s: any) => sum + (s.bonus || 0), 0);
                              const atkBonus = (atk.sources ?? []).filter((s: any) => s.enabled).reduce((sum: number, s: any) => sum + (s.bonus || 0), 0);
                              const slotBonus = (slots.sources ?? []).filter((s: any) => s.enabled).reduce((sum: number, s: any) => sum + (s.bonus || 0), 0);
                              const totalHp = (hp.baseMax ?? 0) + (hp.characterTempBonus ?? 0) + (hp.tempBonus ?? 0) + hpBonus;
                              const totalAtk = (atk.base ?? 0) + (atk.characterTempBonus ?? 0) + (atk.tempBonus ?? 0) + atkBonus;
                              const totalSlots = (slots.base ?? 0) + (slots.characterTempBonus ?? 0) + (slots.tempBonus ?? 0) + slotBonus;

                              return (
                                <>
                                  <div className="npc-loadout-stats-row">
                                    <span><b>HP:</b> {totalHp}</span>
                                    <span><b>ATK:</b> {totalAtk}</span>
                                    <span><b>Slots:</b> {totalSlots}</span>
                                  </div>
                                  {weapon.name && (
                                    <div><b>Weapon:</b> {weapon.name} ({weapon.element || 'No element'}) +{weapon.damageBonus || 0}</div>
                                  )}
                                  {armor.name && (
                                    <div><b>AC:</b> {armor.type} {armor.name} +{armor.bonus || 0}</div>
                                  )}
                                  {armor.text && (
                                    <div className="small text-muted">{armor.text}</div>
                                  )}
                                </>
                              );
                            })()}
                          </div>

                          {Array.isArray(primaryData.customHE) && primaryData.customHE.length > 0 && (
                            <div className="mt-2">
                              <h5 className="h6">Habilidades Pasivas (Custom)</h5>
                              {primaryData.customHE.map((he: any, idx: number) => (
                                <div key={idx} className="mb-2">
                                  <b>{he.name}</b>
                                  {he.text && <div className="small text-muted">{he.text}</div>}
                                </div>
                              ))}
                            </div>
                          )}

                          {Array.isArray(primaryData.habilidadesActivas) && primaryData.habilidadesActivas.length > 0 && (
                            <div className="mt-2">
                              <h5 className="h6">Habilidades Activas</h5>
                              {primaryData.habilidadesActivas.map((ha: any, idx: number) => (
                                <div key={idx} className="mb-2">
                                  <b>{ha.name}</b>
                                  {ha.text && <div className="small text-muted">{ha.text}</div>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="npc-detail-entes">
                        <h4 className="h6">Entes</h4>
                        <div className="npc-ente-grid">
                          {(detail?.entes ?? []).map((e) => (
                            <div key={e.enteID} className="npc-ente-card">
                              {e.image ? (
                                <img src={e.image} alt={e.enteID} />
                              ) : (
                                <div className="npc-ente-id">{e.enteID}</div>
                              )}
                              <div className="npc-ente-amount">x{e.amount}</div>
                            </div>
                          ))}
                          {(detail?.entes ?? []).length === 0 && (
                            <div className="small text-muted">No entes.</div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BrowseNpcsPopup;