// EntesSection.tsx
import { useState, useEffect, useMemo, useRef } from "react";
import type { Ente } from "../../../types";
import EnteCard from "./EnteCard";
import { characterManager } from "../CharacterManager";
import { getEnteMetadata } from "../../../services/enteMetadataService";
import { db } from "../database/db";

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

	const [loading, setLoading] = useState(false);
	const loadIdRef = useRef(0);
	const pendingLoadingTimerRef = useRef<number | null>(null);
	const suppressReloadRef = useRef(0);
	const mountedRef = useRef(true);

	/* =========================
		 COMPUTE UNLOCK LEVEL
	========================= */
	function computeUnlockLevel(amount: number) {
		if (amount >= 5) return 4;
		if (amount === 4) return 3;
		if (amount === 3) return 2;
		if (amount === 2) return 1;
		return 0;
	}

	/* =========================
		 SPECIAL VARIANTS
	========================= */
	const SPECIAL_VARIANT_BASES: Record<string, string> = {
		E005: "E005A",
		E060: "E060A",
		E052: "E052A"
	};

	function getSpecialBase(id: string): string | null {
		for (const base of Object.keys(SPECIAL_VARIANT_BASES)) {
			if (id.startsWith(base)) {
				return base;
			}
		}
		return null;
	}

	/* =========================
		 LOAD ENTES
	========================= */
	async function loadEntes() {
		if (!characterId) {
			setEntes([]);
			return;
		}
		const thisLoadId = ++loadIdRef.current;

		if (pendingLoadingTimerRef.current) {
			window.clearTimeout(pendingLoadingTimerRef.current);
			pendingLoadingTimerRef.current = null;
		}
		pendingLoadingTimerRef.current = window.setTimeout(() => {
			if (thisLoadId === loadIdRef.current) setLoading(true);
		}, 100);

		try {
			// fetch raw stored entes
			const storedRaw = await characterManager.getEntes(characterId);

			// if a newer load started meanwhile, abort
			if (thisLoadId !== loadIdRef.current || !mountedRef.current) return;

			if (!storedRaw || storedRaw.length === 0) {
				if (thisLoadId === loadIdRef.current) setEntes([]);
				return;
			}

			// Normalize DB shape
			const stored = storedRaw.map((e: any) =>
				typeof e === "string" ? JSON.parse(e) : e
			);

			const enriched = await Promise.all(
				stored.map(async (e: any) => {
					const enteId = e.enteID ?? e.id;
					if (!enteId) return null;
					console.log("Stored ente ID:", enteId);
					const meta = await getEnteMetadata(enteId.toString());
					if (!meta) return null;	

					try {
						await db.enteMetadata.put({
							...meta,
							metadataVersion: 1,
							updatedAt: Date.now(),
							isDirty: false
						});
					} catch (err) {
					}

					return {
						...meta,
						amount: e.amount ?? 1,
						unlockLevel: computeUnlockLevel(e.amount ?? 1),
						favorite: e.favorite ?? false,
						notes: e.notes ?? "",
						customImage: e.customImage ?? "",
						order: typeof e.order === "number"
							? e.order
							: Number.MAX_SAFE_INTEGER
					} as Ente;
				})
			);

			// if a newer load started meanwhile, abort without mutating state
			if (thisLoadId !== loadIdRef.current || !mountedRef.current) return;

			const validEntes = (enriched.filter(Boolean) as Ente[]);

			// share unlock levels across variants
			const specialGroups: Record<string, Ente[]> = {};
			validEntes.forEach((ente) => {
				const base = getSpecialBase(ente.id);
				if (!base) return;
				if (!specialGroups[base]) specialGroups[base] = [];
				specialGroups[base].push(ente);
			});


			Object.values(specialGroups).forEach(group => {
				const maxAmount = Math.max(...group.map(e => e.amount));
				const sharedUnlock = computeUnlockLevel(maxAmount);
				group.forEach(e => { e.unlockLevel = sharedUnlock; });
			});

			if (thisLoadId === loadIdRef.current && mountedRef.current) {
				setEntes(validEntes);
			}
		} catch (err) {
			console.warn("loadEntes error", err);
		} finally {
			if (pendingLoadingTimerRef.current) {
				window.clearTimeout(pendingLoadingTimerRef.current);
				pendingLoadingTimerRef.current = null;
			}
			if (thisLoadId === loadIdRef.current && mountedRef.current) {
				setLoading(false);
			}
		}
	}

	//Load when characterId changes
	useEffect(() => {
		mountedRef.current = true;

		if (!characterId) {
			setEntes([]);
			return;
		}

		loadEntes();

		// subscribe to manager events to react to updates (but respect suppressReloadRef)
		const handler = (payload: any) => {
			// if reloads are suppressed (e.g. during reorder), ignore
			if (suppressReloadRef.current > 0) return;

			if (!payload) return;
			const relates =
				payload.characterId === characterId ||
				payload.id && false;

			if (relates) {
				loadEntes();
			}
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
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [characterId]);

	/* =========================
		 UPDATE ENTE (single update)
		 - optimistic local update, then persist
	========================= */
	async function updateEnte(updated: Ente) {
		if (!characterId) return;

		// optimistic update to keep UI snappy
		setEntes((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));

		try {
			await characterManager.updateEnte(characterId, updated.id, {
				amount: updated.amount,
				unlockLevel: updated.unlockLevel,
				notes: updated.notes,
				customImage: updated.customImage,
				favorite: updated.favorite
			});
		} catch (err) {
			// on failure, reload to sync
			loadEntes();
		}
	}

	/* =========================
		 ADD ENTE FORM
	========================= */
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
				<input className="enteFilter"
					placeholder="Enter Ente ID..."
					value={id}
					onChange={(e) => setId(e.target.value)}
				/>
				<button className="modal-btn" onClick={() => onAdd(id)}>✔</button>
				<button className="modal-btn" onClick={onCancel}>✖</button>
			</div>
		);
	}

	/* =========================
		 FILTER & SORT
	========================= */
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
			// Favorites always first
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

			// ---- CUSTOM ORDER (DEFAULT) ----
			const orderA = typeof a.order === "number" ? a.order : Number.MAX_SAFE_INTEGER;
			const orderB = typeof b.order === "number" ? b.order : Number.MAX_SAFE_INTEGER;

			const orderDiff = orderA - orderB;
			if (orderDiff !== 0) return orderDiff;

			// Stable tiebreaker
			return a.id.localeCompare(b.id);
		});

		return list;
	}, [entes, sortBy, filter]);

	/* =========================
		 REORDER (drag/drop)
		 - optimistic reorder locally, persist batch, suppress reloads while saving
	========================= */
	
	async function reorderEntes(dragId: string, dropId: string) {
		if (!characterId) return;

		const updated = [...entes];

		const dragIndex = updated.findIndex(e => e.id === dragId);
		const dropIndex = updated.findIndex(e => e.id === dropId);
		if (dragIndex === -1 || dropIndex === -1) return;

		const [removed] = updated.splice(dragIndex, 1);
		updated.splice(dropIndex, 0, removed);

		const reordered = updated.map((e, i) => ({
			...e,
			order: i
		}));
		console.log("drag", dragIndex)
		console.log("drop", dropIndex)
		console.log("pre-reorder", entes)
		console.log("reordered entes", reordered)

		// Optimistic update
		setEntes(reordered);

		suppressReloadRef.current++;

		

	try {
		await characterManager.updateEntesOrder(
			characterId,
			reordered.map(e => ({ id: e.id, order: e.order }))
		);
		} catch {
		await loadEntes();
		} finally {
			suppressReloadRef.current--;
		}
	}




	/* =========================
		 RENDER
	========================= */

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
					<label>
						Sort:
						<select className="enteSort"
							value={sortBy}
							onChange={(e) => setSortBy(e.target.value)}
						>
							<option value="order">Custom</option>
							<option value="id">ID</option>
							<option value="amount">Amount</option>
							<option value="unlockLevel">Unlock priority</option>
						</select>
					</label>

					<input className="enteFilter"
						type="text"
						placeholder="Filter (ID / Name / Clase / Elemento)..."
						value={filter}
						onChange={(e) => setFilter(e.target.value)}
					/>
				</div>
			</div>
			<div className="ente-scroll">
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
										await characterManager.removeEnte(characterId, id);
										await loadEntes();
									}}
									computeUnlockLevel={computeUnlockLevel}
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
			</div>
		</div>
	);
}

export default EntesSection;