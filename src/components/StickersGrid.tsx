/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Plus, Minus, Check, Heart, Trophy, Flame } from "lucide-react";
import { Sticker } from "../types";
import { motion } from "motion/react";

interface StickersGridProps {
  stickers: Sticker[];
  glued: Record<string, boolean>;
  repeated: Record<string, number>;
  onToggleGlued: (id: string) => void;
  onIncrementRepeated: (id: string, amount: number) => void;
  activeSection: string; // The selected section (e.g. Capa, Fls. 1, Brasil, etc.)
  completedPages: Record<number, boolean>;
}

export function StickersGrid({
  stickers,
  glued,
  repeated,
  onToggleGlued,
  onIncrementRepeated,
  activeSection,
  completedPages
}: StickersGridProps) {
  // Filter stickers for the active section
  const sectionStickers = stickers.filter((s) => s.section === activeSection);
  if (sectionStickers.length === 0) return null;

  // Let's identify the distinct pages of this section
  const pages = Array.from(new Set(sectionStickers.map((s) => s.page))).sort((a, b) => a - b);

  // Helper to check if a sticker is gold (logo, fwc or coca cola)
  const isSpecial = (id: string) => {
    return id === "00" || id.startsWith("FWC") || id.startsWith("CC");
  };

  // Helper to render a sticker cell
  const renderStickerCell = (sticker: Sticker) => {
    const isGlued = glued[sticker.id] || false;
    const repCount = repeated[sticker.id] || 0;
    const special = isSpecial(sticker.id);

    return (
      <div
        key={sticker.id}
        id={`sticker-card-${sticker.id}`}
        className={`relative group rounded-xl p-3 border transition-all flex flex-col justify-between min-h-[105px] md:min-h-[115px] select-none ${
          isGlued
            ? "bg-emerald-500/10 border-2 border-emerald-500 text-emerald-400 shadow-sm"
            : special
            ? "bg-yellow-500/10 border border-yellow-500/40 hover:bg-yellow-500/20"
            : "bg-[#0f172a] border border-slate-800 hover:border-slate-700"
        }`}
      >
        {/* Glow behind special stickers */}
        {special && !isGlued && (
          <div className="absolute inset-0 bg-yellow-500/5 rounded-xl blur pointer-events-none" />
        )}

        {/* Top bar of sticker box */}
        <div className="flex items-center justify-between">
          <span
            className={`font-mono text-[10px] md:text-xs font-bold tracking-wider ${
              isGlued
                ? "text-emerald-400"
                : special
                ? "text-yellow-500 font-black animate-pulse"
                : "text-slate-400"
            }`}
          >
            {sticker.label}
          </span>

          {special && (
            <span className="text-[10px] text-yellow-500">
              {sticker.id.startsWith("CC") ? (
                <Flame className="w-3.5 h-3.5 fill-yellow-500/20" />
              ) : (
                <Trophy className="w-3.5 h-3.5 fill-yellow-500/20" />
              )}
            </span>
          )}
        </div>

        {/* Sticker status display / Action trigger */}
        <div
          onClick={() => onToggleGlued(sticker.id)}
          className="flex-1 flex flex-col items-center justify-center cursor-pointer my-1.5"
          title="Toque para colar no álbum"
        >
          {isGlued ? (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center justify-center"
            >
              <div className="bg-emerald-500 text-slate-950 rounded-full p-1 shadow-md">
                <Check className="w-3.5 h-3.5 stroke-[3] text-white" />
              </div>
              <span className="text-[10px] text-emerald-400 font-semibold mt-1">Colada!</span>
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-500 group-hover:text-slate-300 transition-colors">
              <span className="text-[11px] font-medium uppercase font-sans tracking-wide">Faltando</span>
              <span className="text-[9px] text-slate-600 group-hover:text-slate-400 mt-0.5">Clique para colar</span>
            </div>
          )}
        </div>

        {/* Bottom bar: Repeated counters (Repetidas) */}
        <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-slate-850/60">
          <div className="flex items-center gap-1">
            <button
              onClick={() => onIncrementRepeated(sticker.id, -1)}
              disabled={repCount === 0}
              className={`p-1 rounded-md border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all ${
                repCount === 0 ? "opacity-30 cursor-not-allowed" : "cursor-pointer"
              }`}
              title="Remover repetida"
            >
              <Minus className="w-3 h-3" />
            </button>

            <span
              className={`text-xs font-mono font-bold w-5 text-center ${
                repCount > 0 ? "text-blue-400" : "text-slate-600"
              }`}
            >
              {repCount}
            </span>

            <button
              onClick={() => onIncrementRepeated(sticker.id, 1)}
              className="p-1 rounded-md border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all cursor-pointer"
              title="Adicionar repetida"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          <span className="text-[9px] text-slate-500 font-medium">Repetida</span>
        </div>
      </div>
    );
  };

  // Helper to render a page of grid slots (Left or Right country page)
  const renderCountryPageGrid = (pageNumber: number, isLeft: boolean) => {
    const pageStickers = sectionStickers.filter((s) => s.page === pageNumber);
    const isCompleted = completedPages[pageNumber] || false;

    // We have a 3 rows x 4 cols grid
    const gridRows = 3;
    const gridCols = 4;

    return (
      <div className="bg-[#1e293b] rounded-2xl border border-slate-700 shadow-2xl p-4 md:p-5 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4 border-b border-slate-700 pb-2">
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest font-mono">
                {isLeft ? "Página Esquerda" : "Página Direita"}
              </span>
              <h3 className="text-sm font-bold text-slate-200">Pág. {pageNumber}</h3>
            </div>

            {isCompleted && (
              <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-2.5 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1">
                <Check className="w-3 h-3 stroke-[3]" /> COMPLETA
              </span>
            )}
          </div>

          {/* Grid Layout conforming with user instructions */}
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: gridRows }).map((_, r) => {
              return Array.from({ length: gridCols }).map((_, col) => {
                // Determine if this coordinates contain nothing (X) as described by user:
                // Left page XXOO (row 0, col 0 & 1 are empty)
                // Right page OOOX (row 0, col 3 is empty), XOOO (row 2, col 0 is empty)
                let isEmpty = false;
                if (isLeft) {
                  if (r === 0 && (col === 0 || col === 1)) {
                    isEmpty = true;
                  }
                } else {
                  if (r === 0 && col === 3) {
                    isEmpty = true;
                  }
                  if (r === 2 && col === 0) {
                    isEmpty = true;
                  }
                }

                if (isEmpty) {
                  return (
                    <div
                      key={`empty-${r}-${col}`}
                      className="rounded-xl border border-slate-800/60 bg-[#0f172a]/55 min-h-[105px] md:min-h-[115px] flex items-center justify-center p-3 select-none"
                    >
                      <span className="text-slate-700 font-mono text-[11px]">—</span>
                    </div>
                  );
                }

                // Find matching sticker based on its designated position
                const sticker = pageStickers.find((s) => s.row === r && s.col === col);
                if (sticker) {
                  return renderStickerCell(sticker);
                }

                return (
                  <div
                    key={`missing-pos-${r}-${col}`}
                    className="rounded-xl border border-dashed border-slate-800 bg-slate-900/10"
                  />
                );
              });
            })}
          </div>
        </div>
      </div>
    );
  };

  // If we are looking at country pages (it on double-pages structure)
  const isCountryType = sectionStickers.length === 20 && pages.length === 2;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-yellow-500 tracking-tight">{activeSection}</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Preencha os dados de figurinhas coladas e repetidas para esta seção do álbum.
          </p>
        </div>
      </div>

      {isCountryType ? (
        // Double-page display
        <div className="flex flex-col xl:flex-row gap-6">
          {renderCountryPageGrid(pages[0], true)}
          {renderCountryPageGrid(pages[1], false)}
        </div>
      ) : (
        // Standard grid display (Capa, Fls 1, Coca Cola)
        <div className="bg-[#1e293b] rounded-2xl border border-slate-700 shadow-xl p-5 md:p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {sectionStickers.map((sticker) => renderStickerCell(sticker))}
          </div>
        </div>
      )}
    </div>
  );
}
