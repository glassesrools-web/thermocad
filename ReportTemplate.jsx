import React from "react";
import BilanChart from "./BilanChart.jsx";
import DPELabel from "./DPELabel.jsx";

export default function ReportTemplate({
  project,
  results,
  chartData,
  wattsPerCube,
  reportRows,
}) {
  const date = new Date().toLocaleDateString();

  return (
    <div className="bg-white text-slate-900 p-8 w-[1000px] min-h-[1400px]">
      <header className="border-b border-slate-300 pb-4 mb-6">
        <h1 className="text-3xl font-extrabold">Rapport d'Étude Thermique - DTR C3.2</h1>
        <p className="text-sm text-slate-600 mt-1">Date: {date}</p>
      </header>

      <section className="mb-8">
        <h2 className="text-lg font-bold mb-3">1. Paramètres du Projet</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border border-slate-200 p-3">
            <span className="text-slate-500">Projet:</span> {project.info?.name}
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <span className="text-slate-500">Wilaya ID:</span> {project.info?.wilayaId}
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <span className="text-slate-500">Temp. Intérieure:</span> {project.info?.indoorSetpoint} °C
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <span className="text-slate-500">Temp. Sol:</span> {project.info?.groundTemp} °C
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <span className="text-slate-500">Volume Total:</span>{" "}
            {reportRows.reduce((s, r) => s + (r.roomVolume ?? 0), 0).toFixed(2)} m³
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <span className="text-slate-500">Puissance Totale:</span> {results?.Q_design_W?.toFixed(0)} W
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-bold mb-3">2. Visualisation Thermique</h2>
        <div className="grid grid-cols-2 gap-4">
          <BilanChart data={chartData} />
          <DPELabel wattsPerCube={wattsPerCube} />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-3">3. Détail des Parois et Déperditions</h2>
        <table className="w-full text-xs border border-slate-300">
          <thead className="bg-slate-100">
            <tr>
              <th className="border border-slate-300 p-2 text-left">Pièce</th>
              <th className="border border-slate-300 p-2 text-left">Élément</th>
              <th className="border border-slate-300 p-2 text-center">Ori.</th>
              <th className="border border-slate-300 p-2 text-right">A (m²)</th>
              <th className="border border-slate-300 p-2 text-right">U / Ks</th>
              <th className="border border-slate-300 p-2 text-right">Perte (W)</th>
            </tr>
          </thead>
          <tbody>
            {reportRows.map((row, idx) => (
              <tr key={`${row.roomId}-${row.surfaceId}-${idx}`}>
                <td className="border border-slate-300 p-2">
                  <span className="font-bold">{row.localName}</span><br/><span className="text-slate-500">{row.roomName}</span>
                </td>
                <td className="border border-slate-300 p-2">{row.elementType}</td>
                <td className="border border-slate-300 p-2 text-center font-mono">{row.orientation || "-"}</td>
                <td className="border border-slate-300 p-2 text-right">{row.area.toFixed(2)}</td>
                <td className="border border-slate-300 p-2 text-right">{row.uValue.toFixed(2)}</td>
                <td className="border border-slate-300 p-2 text-right font-bold">{row.loss.toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <footer className="mt-12 pt-4 border-t border-slate-300 text-sm text-slate-600 flex justify-between">
        <span>Généré par ThermoCalc Pro</span>
        <span>Signature: _____________________</span>
      </footer>
    </div>
  );
}