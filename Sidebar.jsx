import React from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, Building2, DoorOpen, LayoutDashboard } from "lucide-react";
import { WILAYAS } from "../../data/algeria_climate.js";

const PROJECT_SUMMARY_ID = "__project_summary__";

export default function Sidebar({
  project,
  onProjectChange,
  activeId,
  onActiveChange,
  onAddLocal,
  onAddRoom,
  onDeleteLocal,
  onDeleteRoom,
}) {
  const [expandedLocals, setExpandedLocals] = React.useState(new Set());

  const toggleLocal = (localId) => {
    setExpandedLocals((prev) => {
      const next = new Set(prev);
      if (next.has(localId)) next.delete(localId);
      else next.add(localId);
      return next;
    });
  };

  // Derive the commune list for the currently selected wilaya.
  // Falls back to a single catch-all entry if the wilaya isn't found.
  const selectedWilaya = WILAYAS.find((w) => w.id === (project.info?.wilayaId ?? 16));
  const communeList = selectedWilaya?.communes ?? [{ name: "Toutes les autres communes", zone: selectedWilaya?.defaultZone ?? "B" }];

  // When the wilaya changes we also reset the commune to the first option.
  const handleWilayaChange = (e) => {
    const newWilayaId = Number(e.target.value);
    const newWilaya = WILAYAS.find((w) => w.id === newWilayaId);
    const firstCommune = newWilaya?.communes?.[0] ?? { name: "Toutes les autres communes", zone: newWilaya?.defaultZone ?? "B" };
    onProjectChange({
      ...project,
      info: {
        ...project.info,
        wilayaId: newWilayaId,
        commune: firstCommune.name,
        climateZone: firstCommune.zone,
      },
    });
  };

  const handleCommuneChange = (e) => {
    const communeName = e.target.value;
    const matched = communeList.find((c) => c.name === communeName);
    onProjectChange({
      ...project,
      info: {
        ...project.info,
        commune: communeName,
        climateZone: matched?.zone ?? selectedWilaya?.defaultZone ?? "B",
      },
    });
  };

  const isProjectSummaryActive = activeId === PROJECT_SUMMARY_ID;

  return (
    <aside
      className="w-64 flex flex-col shrink-0 glass-panel"
      style={{ borderRadius: 0, borderTop: "none", borderBottom: "none", borderLeft: "none" }}
    >
      <div className="p-4 border-b" style={{ borderColor: "var(--glass-border)" }}>
        <h2 className="text-sm font-bold text-[var(--glass-primary)] uppercase tracking-wider mb-3">Project Settings</h2>
        <div className="space-y-2">
          <label className="text-xs opacity-60">Project Name</label>
          <input
            type="text"
            value={project.info?.name ?? ""}
            onChange={(e) => onProjectChange({ ...project, info: { ...project.info, name: e.target.value } })}
            className="glass-input rounded-md px-2 py-1.5 text-sm w-full"
            placeholder="My Project"
          />

          {/* ── Wilaya ─────────────────────────────────────────────── */}
          <label className="text-xs opacity-60">Wilaya</label>
          <select
            value={project.info?.wilayaId ?? 16}
            onChange={handleWilayaChange}
            className="glass-input rounded-md px-2 py-1.5 text-sm w-full"
          >
            {WILAYAS.map((w) => (
              <option key={w.id} value={w.id} style={{ background: "var(--app-bg-color)", color: "var(--glass-text)" }}>
                {w.id > 0 ? `${w.id} – ${w.name}` : w.name}
              </option>
            ))}
          </select>

          {/* ── Commune ────────────────────────────────────────────── */}
          <label className="text-xs opacity-60">
            Commune{" "}
            {project.info?.climateZone && (
              <span className="font-semibold text-[var(--glass-primary)]">
                · Zone {project.info.climateZone}
              </span>
            )}
          </label>
          <select
            value={project.info?.commune ?? communeList[0]?.name ?? ""}
            onChange={handleCommuneChange}
            className="glass-input rounded-md px-2 py-1.5 text-sm w-full"
          >
            {communeList.map((c) => (
              <option key={c.name} value={c.name} style={{ background: "var(--app-bg-color)", color: "var(--glass-text)" }}>
                {c.name}
                {c.name !== "Toutes les autres communes" ? ` (Zone ${c.zone})` : ` (Zone ${c.zone})`}
              </option>
            ))}
          </select>

          <label className="text-xs opacity-60">Indoor Setpoint (°C)</label>
          <input
            type="number" step="0.5"
            value={project.info?.indoorSetpoint ?? 20}
            onChange={(e) => onProjectChange({ ...project, info: { ...project.info, indoorSetpoint: Number(e.target.value) } })}
            className="glass-input rounded-md px-2 py-1.5 text-sm w-full"
          />
          <label className="text-xs opacity-60">Ground Temp (°C)</label>
          <input
            type="number" step="0.5"
            value={project.info?.groundTemp ?? 10}
            onChange={(e) => onProjectChange({ ...project, info: { ...project.info, groundTemp: Number(e.target.value) } })}
            className="glass-input rounded-md px-2 py-1.5 text-sm w-full"
          />

          <div className="pt-2 border-t" style={{ borderColor: "var(--glass-border)" }}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--glass-primary)] opacity-80 mb-2">Pièces humides · §7.1</p>
            <div className="flex flex-col gap-2">
              {[
                { label: "Pièces principales", key: "nb_pieces", min: 1 },
                { label: "Salles de bain",     key: "nb_sdb",    min: 0 },
                { label: "Autres pièces d'eau",key: "nb_autre_eau", min: 0 },
                { label: "WC séparés",          key: "nb_wc",     min: 0 },
              ].map(({ label, key, min }) => (
                <div key={key} className="flex items-center justify-between gap-2">
                  <label className="text-xs opacity-60 leading-tight flex-1">{label}</label>
                  <input
                    type="number" min={min} max={10}
                    value={project.info?.[key] ?? min}
                    onChange={(e) => onProjectChange({ ...project, info: { ...project.info, [key]: Math.max(min, parseInt(e.target.value, 10) || 0) } })}
                    className="glass-input w-14 rounded-md text-center px-1 py-1 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t" style={{ borderColor: "var(--glass-border)" }}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--glass-primary)] opacity-80 mb-2">Système de chauffage · §5.2</p>
            <div className="flex flex-col gap-2">
              <label className="text-xs opacity-60">Type de réseau (cr)</label>
              <select
                value={project.info?.type_chauf ?? "central_partiel"}
                onChange={(e) => onProjectChange({ ...project, info: { ...project.info, type_chauf: e.target.value } })}
                className="glass-input rounded-md px-2 py-1.5 text-sm w-full"
              >
                <option value="individuel"          style={{ background: "var(--app-bg-color)" }}>Individuel (cr=0)</option>
                <option value="central_tout_isole"  style={{ background: "var(--app-bg-color)" }}>Central isolé (cr=0.05)</option>
                <option value="central_partiel"     style={{ background: "var(--app-bg-color)" }}>Central partiel (cr=0.10)</option>
                <option value="central_non_isole"   style={{ background: "var(--app-bg-color)" }}>Central non isolé (cr=0.20)</option>
              </select>

              <label className="text-xs opacity-60">Mode de fonctionnement</label>
              <select
                value={project.info?.mode_chauf ?? "continu"}
                onChange={(e) => onProjectChange({ ...project, info: { ...project.info, mode_chauf: e.target.value } })}
                className="glass-input rounded-md px-2 py-1.5 text-sm w-full"
              >
                <option value="continu"    style={{ background: "var(--app-bg-color)" }}>Continu</option>
                <option value="discontinu" style={{ background: "var(--app-bg-color)" }}>Discontinu</option>
              </select>

              <label className="text-xs opacity-60">Inertie du Bâtiment</label>
              <select
                value={project.info?.inertie ?? "forte"}
                onChange={(e) => onProjectChange({ ...project, info: { ...project.info, inertie: e.target.value } })}
                className="glass-input rounded-md px-2 py-1.5 text-sm w-full"
              >
                <option value="faible"  style={{ background: "var(--app-bg-color)" }}>Faible</option>
                <option value="moyenne" style={{ background: "var(--app-bg-color)" }}>Moyenne</option>
                <option value="forte"   style={{ background: "var(--app-bg-color)" }}>Forte</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <h2 className="text-sm font-bold text-[var(--glass-primary)] uppercase tracking-wider mb-2 px-2">Structure</h2>

        <button
          onClick={() => onActiveChange(PROJECT_SUMMARY_ID)}
          className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition mb-1 ${
            isProjectSummaryActive
              ? "bg-[var(--glass-accent-bg)] text-[var(--glass-primary)]"
              : "hover:bg-[var(--input-bg)] opacity-80 hover:opacity-100"
          }`}
        >
          <LayoutDashboard className="h-4 w-4 shrink-0" />
          <span className="font-medium truncate">Project Summary</span>
        </button>

        {(project.locals ?? []).map((local) => {
          const isExpanded = expandedLocals.has(local.id);
          const rooms = local.rooms ?? [];

          return (
            <div key={local.id} className="mb-1">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => toggleLocal(local.id)}
                  className="p-1 rounded hover:bg-[var(--input-bg)] opacity-50 hover:opacity-100"
                >
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => onActiveChange({ type: "local", id: local.id })}
                  className={`flex-1 flex items-center gap-2 px-2 py-2 rounded-lg text-left transition ${
                    activeId?.type === "local" && activeId?.id === local.id
                      ? "bg-[var(--glass-accent-bg)] text-[var(--glass-primary)]"
                      : "hover:bg-[var(--input-bg)] opacity-80 hover:opacity-100"
                  }`}
                >
                  <Building2 className="h-4 w-4 shrink-0" />
                  <span className="font-medium truncate">{local.name}</span>
                </button>
                <button
                  onClick={() => onDeleteLocal(local.id)}
                  disabled={(project.locals ?? []).length <= 1}
                  className="p-1 rounded hover:bg-[var(--danger-bg)] opacity-40 hover:text-[var(--danger-text)] disabled:opacity-20 transition"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {isExpanded &&
                rooms.map((room) => (
                  <div key={room.id} className="flex items-center gap-1 pl-6 pr-2 py-1">
                    <button
                      onClick={() => onActiveChange({ type: "room", localId: local.id, roomId: room.id })}
                      className={`flex-1 flex items-center gap-2 px-2 py-2 rounded-lg text-left transition ${
                        activeId?.type === "room" &&
                        activeId?.localId === local.id &&
                        activeId?.roomId === room.id
                          ? "bg-[var(--glass-accent-bg)] text-[var(--glass-primary)]"
                          : "hover:bg-[var(--input-bg)] opacity-80 hover:opacity-100"
                      }`}
                    >
                      <DoorOpen className="h-4 w-4 shrink-0" />
                      <span className="font-medium truncate">{room.name}</span>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteRoom?.(local.id, room.id); }}
                      disabled={rooms.length <= 1}
                      className="p-1 rounded hover:bg-[var(--danger-bg)] opacity-40 hover:text-[var(--danger-text)] disabled:opacity-20 transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
            </div>
          );
        })}
      </div>

      <div className="p-2 border-t space-y-2" style={{ borderColor: "var(--glass-border)" }}>
        <button
          onClick={onAddLocal}
          className="glass-button-primary w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold transition"
        >
          <Plus className="h-4 w-4" /> Add Local
        </button>
        <button
          onClick={onAddRoom}
          className="glass-button w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition"
        >
          <Plus className="h-4 w-4" /> Add Room
        </button>
      </div>
    </aside>
  );
}

export { PROJECT_SUMMARY_ID };
