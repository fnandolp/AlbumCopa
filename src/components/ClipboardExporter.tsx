/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { Copy, Check, FileText, ClipboardCopy, Sparkles, XCircle } from "lucide-react";
import { Sticker } from "../types";

interface ClipboardExporterProps {
  stickers: Sticker[];
  glued: Record<string, boolean>;
  repeated: Record<string, number>;
}

type CopyType = "all" | "missing" | "glued" | "repeated";

export function ClipboardExporter({
  stickers,
  glued,
  repeated
}: ClipboardExporterProps) {
  const [copiedType, setCopiedType] = useState<CopyType | null>(null);

  const getCategorizedLists = () => {
    const gluedList: string[] = [];
    const missingList: string[] = [];
    const repeatedList: string[] = [];

    stickers.forEach((s) => {
      if (glued[s.id]) {
        gluedList.push(s.label);
      } else {
        missingList.push(s.label);
      }

      const repCount = repeated[s.id] || 0;
      if (repCount > 0) {
        repeatedList.push(`${s.label} (${repCount}x)`);
      }
    });

    return { gluedList, missingList, repeatedList };
  };

  const handleCopy = (type: CopyType) => {
    const { gluedList, missingList, repeatedList } = getCategorizedLists();
    let textToCopy = "";
    
    const timestampHeader = `Atualizado em: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}\n`;

    switch (type) {
      case "all": {
        const divider = "========================================\n";
        const header = "ÁLBUM DE FIGURINHAS DA COPA DO MUNDO 2026\n";
        const stats = `Progresso do Álbum:\n- Coladas: ${gluedList.length} de ${stickers.length} (${((gluedList.length / stickers.length) * 100).toFixed(1)}%)\n- Faltantes: ${missingList.length}\n- Repetidas: ${repeatedList.length}\n`;
        
        const gluedSection = `📊 FIGURINHAS COLADAS NO ÁLBUM:\n${
          gluedList.length > 0 ? gluedList.join(", ") : "(Nenhuma figurinha colada ainda)"
        }\n\n`;

        const missingSection = `❌ FIGURINHAS FALTANTES:\n${
          missingList.length > 0 ? missingList.join(", ") : "(Parabéns! Nenhuma figurinha faltando, álbum completo!)"
        }\n\n`;

        const repeatedSection = `🔄 FIGURINHAS REPETIDAS:\n${
          repeatedList.length > 0 ? repeatedList.join(", ") : "(Nenhuma figurinha repetida anotada)"
        }\n\n`;

        textToCopy = `${divider}${header}${divider}${stats}${timestampHeader}${divider}${repeatedSection}${divider}${missingSection}${divider}${gluedSection}${divider}Gerado pelo Verificador do Álbum de Figurinha Copa 2026`;
        break;
      }
      case "missing": {
        textToCopy = `❌ FIGURINHAS FALTANTES (Copa 2026) - Total: ${missingList.length}\n${timestampHeader}\n${
          missingList.length > 0 ? missingList.join(", ") : "Nenhuma! Álbum completo 🎉"
        }\n\nGerado pelo Copa 2026 Sticker Collector`;
        break;
      }
      case "glued": {
        textToCopy = `📊 FIGURINHAS COLADAS (Copa 2026) - Total: ${gluedList.length} de ${stickers.length}\n${timestampHeader}\n${
          gluedList.length > 0 ? gluedList.join(", ") : "Nenhuma figurinha colada ainda."
        }\n\nGerado pelo Copa 2026 Sticker Collector`;
        break;
      }
      case "repeated": {
        textToCopy = `🔄 FIGURINHAS REPETIDAS (Copa 2026) - Total: ${repeatedList.length}\n${timestampHeader}\n${
          repeatedList.length > 0 ? repeatedList.join(", ") : "Nenhuma figurinha repetida anotada."
        }\n\nGerado pelo Copa 2026 Sticker Collector`;
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

  const { gluedList, missingList, repeatedList } = getCategorizedLists();

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
            <span className="text-[10px] text-slate-400 mt-0.5 block">{missingList.length} itens faltantes</span>
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
            <span className="block text-xs font-bold text-emerald-400 font-bold">Figurinhas Coladas</span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">{gluedList.length} itens colados</span>
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
            <span className="text-[10px] text-slate-400 mt-0.5 block">{repeatedList.length} repetidas</span>
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
}
