import { History, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Modal, PageHeader, Topbar } from "../components/ui";
import { useStore } from "../lib/store";
import { eventMaterialsCost, formatEUR, round2, uid } from "../lib/utils";
import type { EventMaterialUsed, Material } from "../types";

export function MaterialsPage() {
  const { eventId } = useParams();
  const { data, updateEvent } = useStore();
  const event = data.events.find((e) => e.id === eventId);
  const [draftMaterials, setDraftMaterials] = useState<EventMaterialUsed[]>([]);
  const [editingUsedId, setEditingUsedId] = useState<string | null>(null);
  const [addingUsed, setAddingUsed] = useState(false);
  const materialsSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!event) return;
    setDraftMaterials(event.materialsUsed || []);
    setEditingUsedId(null);
    setAddingUsed(false);
  }, [event?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (materialsSaveTimer.current) clearTimeout(materialsSaveTimer.current);
    };
  }, []);

  const materialsTotal = event
    ? eventMaterialsCost({ ...event, materialsUsed: draftMaterials })
    : 0;

  const sortedDraftMaterials = useMemo(
    () =>
      [...draftMaterials].sort((a, b) => {
        const totalA = (Number(a.quantity) || 0) * (Number(a.unitPrice) || 0);
        const totalB = (Number(b.quantity) || 0) * (Number(b.unitPrice) || 0);
        return totalB - totalA;
      }),
    [draftMaterials],
  );

  if (!event) return <Navigate to="/" replace />;

  function flushMaterials(next: EventMaterialUsed[]) {
    if (!event) return;
    if (materialsSaveTimer.current) clearTimeout(materialsSaveTimer.current);
    materialsSaveTimer.current = setTimeout(() => {
      updateEvent(event.id, { materialsUsed: next });
    }, 450);
  }

  function openAddMaterial() {
    setEditingUsedId(null);
    setAddingUsed(true);
  }

  function openEditMaterial(id: string) {
    setAddingUsed(false);
    setEditingUsedId(id);
  }

  function closeMaterialEditor() {
    setEditingUsedId(null);
    setAddingUsed(false);
  }

  function saveMaterialUsed(row: EventMaterialUsed, isNew: boolean) {
    const next = isNew
      ? [...draftMaterials, row]
      : draftMaterials.map((m) => (m.id === row.id ? row : m));
    setDraftMaterials(next);
    flushMaterials(next);
    closeMaterialEditor();
  }

  function removeMaterialRow(id: string) {
    const next = draftMaterials.filter((m) => m.id !== id);
    setDraftMaterials(next);
    flushMaterials(next);
    closeMaterialEditor();
  }

  const editingMaterial =
    editingUsedId != null
      ? draftMaterials.find((m) => m.id === editingUsedId) || null
      : null;

  return (
    <div className="app-shell">
      <Topbar
        right={
          <Link
            className="btn btn-ghost btn-sm"
            to={`/evento/${event.id}/historico`}
          >
            <History size={16} /> Histórico
          </Link>
        }
      />

      <main className="page">
        <PageHeader
          backTo={`/evento/${event.id}`}
          backLabel="Atrás"
          title="Materia prima gastada"
          description={`Total registrado · ${formatEUR(materialsTotal)}`}
          actions={
            <button
              type="button"
              className="btn btn-primary"
              onClick={openAddMaterial}
            >
              <Plus size={16} /> Añadir
            </button>
          }
        />

        <section className="panel">
          <div className="panel-header">
            <h2>Consumo del evento</h2>
          </div>

          {draftMaterials.length === 0 ? (
            <div className="empty">
              <strong>Sin consumo registrado</strong>
              Añade ingredientes del catálogo y ajusta cantidad y precio.
            </div>
          ) : (
            <div className="materials-used-list">
              {sortedDraftMaterials.map((m) => {
                const total = round2(
                  (Number(m.quantity) || 0) * (Number(m.unitPrice) || 0),
                );
                return (
                  <button
                    key={m.id}
                    type="button"
                    className="materials-used-row"
                    onClick={() => openEditMaterial(m.id)}
                  >
                    <span>
                      <span className="materials-used-name">{m.name}</span>
                      <span className="materials-used-meta">
                        {m.quantity} {m.unit || "ud"} ·{" "}
                        {formatEUR(m.unitPrice)}/{m.unit || "ud"}
                      </span>
                    </span>
                    <span>
                      <span className="materials-used-total">
                        {formatEUR(total)}
                      </span>
                      <span className="materials-used-edit-hint">Editar</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {(addingUsed || editingMaterial) && (
        <MaterialUsedEditor
          initial={editingMaterial}
          catalog={data.materials}
          onClose={closeMaterialEditor}
          onSave={saveMaterialUsed}
          onDelete={
            editingMaterial
              ? () => removeMaterialRow(editingMaterial.id)
              : undefined
          }
        />
      )}
    </div>
  );
}

function MaterialUsedEditor({
  initial,
  catalog,
  onClose,
  onSave,
  onDelete,
}: {
  initial: EventMaterialUsed | null;
  catalog: Material[];
  onClose: () => void;
  onSave: (row: EventMaterialUsed, isNew: boolean) => void;
  onDelete?: () => void;
}) {
  const isNew = !initial;
  const [catalogId, setCatalogId] = useState(initial?.materialId || "");
  const [name, setName] = useState(initial?.name || "");
  const [quantity, setQuantity] = useState(String(initial?.quantity ?? "1"));
  const [unit, setUnit] = useState(initial?.unit || "kg");
  const [unitPrice, setUnitPrice] = useState(
    String(initial?.unitPrice ?? ""),
  );

  const lineTotal = round2(
    (Number(quantity) || 0) * (Number(unitPrice) || 0),
  );

  function applyCatalog(materialId: string) {
    setCatalogId(materialId);
    const mat = catalog.find((m) => m.id === materialId);
    if (!mat) return;
    setName(mat.name);
    setUnit(mat.unit || "kg");
    setUnitPrice(String(mat.price));
    if (!quantity) setQuantity("1");
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(
      {
        id: initial?.id || uid("emu"),
        materialId: catalogId || initial?.materialId,
        name: trimmed,
        quantity: Number(quantity) || 0,
        unit: unit.trim() || "ud",
        unitPrice: Number(unitPrice) || 0,
      },
      isNew,
    );
  }

  return (
    <Modal
      title={isNew ? "Añadir materia prima" : "Editar materia prima"}
      subtitle={`Total línea · ${formatEUR(lineTotal)}`}
      onClose={onClose}
      footer={
        <div className="modal-actions modal-actions-spread">
          {onDelete ? (
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                if (confirm(`¿Eliminar “${initial?.name || "este ítem"}”?`)) {
                  onDelete();
                }
              }}
            >
              <Trash2 size={16} /> Eliminar
            </button>
          ) : (
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancelar
            </button>
          )}
          <button
            type="submit"
            form="material-used-form"
            className="btn btn-primary"
            disabled={!name.trim()}
          >
            Guardar
          </button>
        </div>
      }
    >
      <form id="material-used-form" onSubmit={handleSubmit}>
        {isNew && (
          <div className="field">
            <label>Del catálogo</label>
            <select
              value={catalogId}
              onChange={(e) => {
                if (e.target.value) applyCatalog(e.target.value);
              }}
            >
              <option value="">Selecciona un ingrediente…</option>
              {catalog.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({formatEUR(m.price)}/{m.unit || "ud"})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="field">
          <label>Ingrediente</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre"
            required
          />
        </div>

        <div className="grid grid-2">
          <div className="field">
            <label>Cantidad</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Unidad</label>
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="kg"
            />
          </div>
        </div>

        <div className="field">
          <label>Precio / ud. (€)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
          />
        </div>
      </form>
    </Modal>
  );
}
