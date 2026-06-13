/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { Copy, Check, FileText, ClipboardCopy, Sparkles, ChevronDown } from "lucide-react";
import { FLAG_MAP } from "../albumData";
import { Sticker } from "../types";

interface ClipboardExporterProps {
  stickers: Sticker[];
  glued: Record<string, boolean>;
  repeated: Record<string, number>;
  isMobileOnly?: boolean; // When rendered inside the mobile general tab
}

type CopyType = "all" | "missing" | "glued" | "repeated";

export function ClipboardExporter({
  stickers,
  glued,
  repeated,
  isMobileOnly = false
}: ClipboardExporterProps) {
  const [copiedType, setCopiedType] = useState<CopyType | null>(null);
  const [dropdownSelection, setDropdownSelection] = useState<CopyType>("all");

  const getCategorizedListsGrouped = () => {
    const gluedIds: string[] = [];
    const missingIds: string[] = [];
    const repeatedIds: string[] = [];

    stickers.forEach((s) => {
      if (glued[s.id]) {
        gluedIds.push(s.id);
      } else {
        missingIds.push(s.id);
      }

      if ((repeated[s.id] || 0) > 0) {
        repeatedIds.push(s.id);
      }
    });

    // Custom order: Capa first, FWC, then Countries, then CC
    const prefixOrder = [
      "Capa", "FWC", "CC", "MEX", "RSA", "KOR", "CZE", "CAN", "BIH", "QAT", "SUI", "BRA",
      "MAR", "HAI", "SCO", "USA", "PAR", "AUS", "TUR", "GER", "CUW", "CIV", "ECU", "NED",
      "JPN", "SWE", "TUN", "BEL", "EGY", "IRN", "NZL", "ESP", "CPV", "KSA", "URU", "FRA",
      "SEN", "IRQ", "NOR", "ARG", "ALG", "AUT", "JOR", "POR", "COD", "UZB", "COL", "ENG",
      "CRO", "GHA", "PAN"
    ];

    const formatList = (ids: string[], isRepeated = false) => {
      const groups: Record<string, { prefix: string; numbers: { num: number; fullText: string }[] }> = {};

      ids.forEach((id) => {
        let prefix = "";
        let numVal = 0;
        let numText = "";

        if (id === "00") {
          prefix = "Capa";
          numVal = 0;
          numText = "00";
        } else {
          const match = id.match(/^([A-Z]+)(\d+)$/);
          if (match) {
            prefix = match[1];
            numVal = parseInt(match[2], 10);
            numText = match[2];
          } else {
            prefix = "Outros";
            numVal = 999;
            numText = id;
          }
        }

        if (!groups[prefix]) {
          groups[prefix] = { prefix, numbers: [] };
        }

        let itemText = numText;
        if (isRepeated) {
          const count = repeated[id] || 0;
          itemText = count > 1 ? `${numText} (${count}x)` : numText;
        }

        groups[prefix].numbers.push({
          num: numVal,
          fullText: itemText
        });
      });

      // Sort numbers within each group ascending
      Object.keys(groups).forEach((p) => {
        groups[p].numbers.sort((a, b) => a.num - b.num);
      });

      // Sort prefixes according to standard order
      const sortedPrefixes = Object.keys(groups).sort((a, b) => {
        let idxA = prefixOrder.indexOf(a);
        let idxB = prefixOrder.indexOf(b);
        if (idxA === -1) idxA = 999;
        if (idxB === -1) idxB = 999;
        return idxA - idxB;
      });

      if (sortedPrefixes.length === 0) {
        return "(Nenhuma figurinha)";
      }

      return sortedPrefixes
        .map((prefix) => {
          const listStr = groups[prefix].numbers.map((n) => n.fullText).join(", ");
          const flag = FLAG_MAP[prefix] || "";
          const tricodeName = flag ? `${prefix} ${flag}` : prefix;
          return `${tricodeName} - ${listStr}`;
        })
        .join("\n");
    };

    const resGlued = formatList(gluedIds);
    const resMissing = formatList(missingIds);
    const resRepeated = formatList(repeatedIds, true);

    return {
      gluedText: resGlued,
      missingText: resMissing,
      repeatedText: resRepeated,
      totals: {
        gluedCount: gluedIds.length,
        missingCount: missingIds.length,
        repeatedCount: repeatedIds.length
      }
    };
  };

  const handleCopy = (type: CopyType) => {
    const { gluedText, missingText, repeatedText, totals } = getCategorizedListsGrouped();
    let textToCopy = "";
    
    const timestampHeader = `Atualizado em: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}\n`;

    switch (type) {
      case "all": {
        const divider = "========================================\n";
        const header = "ÁLBUM DE FIGURINHAS DA COPA DO MUNDO 2026\n";
        const stats = `Progresso do Álbum:\n- Coladas: ${totals.gluedCount} de ${stickers.length} (${((totals.gluedCount / stickers.length) * 100).toFixed(1)}%)\n- Faltantes: ${totals.missingCount}\n- Repetidas: ${totals.repeatedCount}\n`;
        
        const repeatedSection = `🔄 FIGURINHAS REPETIDAS:\n${repeatedText}\n\n`;
        const missingSection = `❌ FIGURINHAS FALTANTES:\n${missingText}\n\n`;
        const gluedSection = `📊 FIGURINHAS COLADAS NO ÁLBUM:\n${gluedText}\n\n`;

        textToCopy = `${divider}${header}${divider}${stats}${timestampHeader}${divider}${repeatedSection}${divider}${missingSection}${divider}${gluedSection}${divider}Gerado pelo Verificador do Álbum de Figurinha Copa 2026`;
        break;
      }
      case "missing": {
        textToCopy = `❌ FIGURINHAS FALTANTES (Copa 2026) - Total: ${totals.missingCount}\n${timestampHeader}\n${missingText}\n\nGerado pelo Copa 2026 Sticker Collector`;
        break;
      }
      case "glued": {
        textToCopy = `📊 FIGURINHAS COLADAS (Copa 2026) - Total: ${totals.gluedCount} de ${stickers.length}\n${timestampHeader}\n${gluedText}\n\nGerado pelo Copa 2026 Sticker Collector`;
        break;
      }
      case "repeated": {
        textToCopy = `🔄 FIGURINHAS REPETIDAS (Copa 2026) - Total: ${totals.repeatedCount}\n${timestampHeader}\n${repeatedText}\n\nGerado pelo Copa 2026 Sticker Collector`;
        break;
      }
    }

    navigator.clipboard.writeText(textToCopy).then(
      () => {
        setCopiedType(type);
        setTimeout(() => setCopiedType(null), 2500);
      },
      (err) => {
        console.error("Falha ao copiar para o clipboard: ", err);
      }
    );
  };

  const { totals } = getCategorizedListsGrouped();

  const renderDropdownExporter = () => {
    const optionLabels: Record<CopyType, string> = {
      all: "Relatório Geral (Coladas, Faltantes e Repetidas)",
      missing: `Apenas Faltantes (${totals.missingCount} itens)`,
      glued: `Apenas Coladas (${totals.gluedCount} itens)`,
      repeated: `Apenas Repetidas (${totals.repeatedCount} itens)`
    };

    return (
      <div className="bg-[#1e293b] rounded-2xl border border-slate-705 p-4 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-yellow-500/10 text-yellow-500 p-2 rounded-xl border border-yellow-500/10">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wider">Exportar Lista organizada</h4>
            <p className="text-[10px] text-slate-400 mt-0.5">Selecione qual lista deseja gerar e copiar</p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="relative">
            <select
              value={dropdownSelection}
              onChange={(e) => setDropdownSelection(e.target.value as CopyType)}
              className="w-full bg-[#0a0f1d] border border-slate-700 rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-yellow-500 focus:outline-none font-semibold text-slate-200 appearance-none pr-10 cursor-pointer"
            >
              <option value="all">{optionLabels.all}</option>
              <option value="missing">{optionLabels.missing}</option>
              <option value="glued">{optionLabels.glued}</option>
              <option value="repeated">{optionLabels.repeated}</option>
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <button
            onClick={() => handleCopy(dropdownSelection)}
            className={`w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all border ${
              copiedType === dropdownSelection
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                : "bg-yellow-500 text-slate-950 hover:bg-yellow-400 border-transparent shadow-lg text-sm"
            }`}
          >
            {copiedType === dropdownSelection ? (
              <>
                <Check className="w-4 h-4 text-emerald-400 animate-pulse stroke-[3]" />
                <span>Lista Copiada com Sucesso 🎉</span>
              </>
            ) : (
              <>
                <ClipboardCopy className="w-4.5 h-4.5 text-slate-900 shrink-0" />
                <span>Gerar e Copiar para WhatsApp</span>
              </>
            )}
          </button>
        </div>

        {copiedType === dropdownSelection && (
          <div className="mt-3 p-2 bg-emerald-550/10 border border-emerald-500/20 rounded-lg text-center text-[10px] text-emerald-400 font-medium animate-pulse">
            📋 Texto formatado pronto para colar em conversas ou bloco de notas!
          </div>
        )}
      </div>
    );
  };

  const renderBentoButtonsExporter = () => {
    return (
      <div className="bg-[#1e293b] rounded-2xl border border-slate-700/80 p-5 shadow-2xl mb-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="bg-yellow-500/10 text-yellow-500 p-2.5 rounded-xl border border-yellow-500/20">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Exportar Listas</h3>
            <p className="text-xs text-slate-400 mt-1">
              Selecione qual lista deseja copiar para enviar por WhatsApp para amigos ou grupos de troca!
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Full Album Exporter */}
          <button
            onClick={() => handleCopy("all")}
            className={`px-4 py-3 rounded-xl border transition-all text-left flex flex-col justify-between cursor-pointer ${
              copiedType === "all"
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                : "bg-[#0f172a] hover:bg-[#151f38] border-slate-700 text-slate-100 hover:border-yellow-500/40"
            }`}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Relatório Geral</span>
              {copiedType === "all" ? (
                <Check className="w-4 h-4 text-emerald-400 animate-pulse" />
              ) : (
                <ClipboardCopy className="w-4 h-4 text-slate-500 hover:text-yellow-500" />
              )}
            </div>
            <div>
              <span className="block text-xs font-bold text-yellow-500">Tudo Completo</span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Resumo + Listas</span>
            </div>
          </button>

          {/* Missing Exporter */}
          <button
            onClick={() => handleCopy("missing")}
            className={`px-4 py-3 rounded-xl border transition-all text-left flex flex-col justify-between cursor-pointer ${
              copiedType === "missing"
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                : "bg-[#0f172a] hover:bg-[#151f38] border-slate-700 text-slate-100 hover:border-red-500/40"
            }`}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Apenas Faltantes</span>
              {copiedType === "missing" ? (
                <Check className="w-4 h-4 text-emerald-400 animate-pulse" />
              ) : (
                <Copy className="w-4 h-4 text-slate-500 hover:text-red-400" />
              )}
            </div>
            <div>
              <span className="block text-xs font-bold text-red-400">Figurinhas Faltantes</span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">{totals.missingCount} itens faltantes</span>
            </div>
          </button>

          {/* Glued Exporter */}
          <button
            onClick={() => handleCopy("glued")}
            className={`px-4 py-3 rounded-xl border transition-all text-left flex flex-col justify-between cursor-pointer ${
              copiedType === "glued"
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                : "bg-[#0f172a] hover:bg-[#151f38] border-slate-700 text-slate-100 hover:border-emerald-500/40"
            }`}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Apenas Coladas</span>
              {copiedType === "glued" ? (
                <Check className="w-4 h-4 text-emerald-400 animate-pulse" />
              ) : (
                <Copy className="w-4 h-4 text-slate-500 hover:text-emerald-400" />
              )}
            </div>
            <div>
              <span className="block text-xs font-bold text-emerald-400">Figurinhas Coladas</span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">{totals.gluedCount} itens colados</span>
            </div>
          </button>

          {/* Repeated Exporter */}
          <button
            onClick={() => handleCopy("repeated")}
            className={`px-4 py-3 rounded-xl border transition-all text-left flex flex-col justify-between cursor-pointer ${
              copiedType === "repeated"
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                : "bg-[#0f172a] hover:bg-[#151f38] border-slate-700 text-slate-100 hover:border-blue-500/40"
            }`}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Apenas Repetidas</span>
              {copiedType === "repeated" ? (
                <Check className="w-4 h-4 text-emerald-400 animate-pulse" />
              ) : (
                <Copy className="w-4 h-4 text-slate-500 hover:text-blue-400" />
              )}
            </div>
            <div>
              <span className="block text-xs font-bold text-blue-400">Figurinhas Repetidas</span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">{totals.repeatedCount} repetidas</span>
            </div>
          </button>
        </div>

        {copiedType && (
          <div className="mt-4 p-2 bg-emerald-500/10 border border-emerald-500/25 rounded-xl flex items-center gap-2 justify-center text-xs text-emerald-300 font-semibold animate-pulse">
            <Sparkles className="w-4 h-4 text-yellow-500 shrink-0" />
            <span>Lista copiada com sucesso para sua área de transferência!</span>
          </div>
        )}
      </div>
    );
  };

  return isMobileOnly ? renderDropdownExporter() : (
    <>
      {/* Desktop view (bento layout) */}
      <div className="hidden xl:block">
        {renderBentoButtonsExporter()}
      </div>
      {/* Mobile view (optimized dropdown chooser) */}
      <div className="block xl:hidden mb-6">
        {renderDropdownExporter()}
      </div>
    </>
  );
}
