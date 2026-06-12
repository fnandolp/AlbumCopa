/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CheckCircle2, TrendingUp, HelpCircle, Copy, AlertCircle, BookOpen } from "lucide-react";

interface StatsPanelProps {
  total: number;
  gluedCount: number;
  missingCount: number;
  repeatedCount: number;
  completedCountries: number;
  totalCountries: number;
}

export function StatsPanel({
  total,
  gluedCount,
  missingCount,
  repeatedCount,
  completedCountries,
  totalCountries
}: StatsPanelProps) {
  const percentage = total > 0 ? ((gluedCount / total) * 100).toFixed(1) : "0.0";
  const completedPercent = totalCountries > 0 ? ((completedCountries / totalCountries) * 100).toFixed(0) : "0";

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      {/* Percentage Circular / Large Counter */}
      <div className="bg-[#1e293b] border border-slate-700 text-slate-100 rounded-2xl p-5 md:p-6 shadow-xl flex flex-col justify-between relative overflow-hidden md:col-span-2">
        <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-yellow-500/5 rounded-full blur-2xl pointer-events-none" />
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-yellow-500 flex items-center gap-2">
            📊 Progresso Geral
          </span>
          <span className="bg-slate-800 text-slate-300 text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full border border-slate-700">
            Copa do Mundo 2026
          </span>
        </div>
        
        <div className="flex items-end justify-between mt-4">
          <div>
            <span className="text-4xl md:text-5xl font-black tracking-tight text-white">{percentage}%</span>
            <div className="text-xs text-slate-300 mt-1.5 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{gluedCount} coladas de <strong className="text-white">{total}</strong> figurinhas</span>
            </div>
          </div>
          
          <div className="w-20 h-20 md:w-24 md:h-24 relative flex items-center justify-center">
            {/* SVG Progress Circle */}
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="50%"
                cy="50%"
                r="34"
                className="stroke-slate-800 fill-none"
                strokeWidth="7"
              />
              <circle
                cx="50%"
                cy="50%"
                r="34"
                className="stroke-emerald-500 fill-none transition-all duration-1000 ease-out"
                strokeWidth="7"
                strokeDasharray={`${2 * Math.PI * 34}`}
                strokeDashoffset={`${2 * Math.PI * 34 * (1 - gluedCount / total)}`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute text-[11px] font-mono font-bold text-slate-200">
              {gluedCount}/{total}
            </span>
          </div>
        </div>

        {/* Minimal Progress Bar */}
        <div className="w-full bg-[#0a0f1d] h-2 rounded-full mt-4 overflow-hidden border border-slate-800">
          <div 
            className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-1000"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-1 md:col-span-2 gap-4">
        {/* Missing Stickers */}
        <div className="bg-[#1e293b] rounded-2xl p-4 border border-slate-700 shadow-xl flex items-center gap-4 hover:border-slate-600 transition-all">
          <div className="bg-red-500/10 text-red-400 p-2.5 rounded-xl border border-red-500/20">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-400 block font-medium">Figurinhas Faltantes</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold text-red-400">{missingCount}</span>
              <span className="text-[10px] text-slate-500">falta preencher</span>
            </div>
          </div>
        </div>

        {/* Repeated Stickers */}
        <div className="bg-[#1e293b] rounded-2xl p-4 border border-slate-700 shadow-xl flex items-center gap-4 hover:border-slate-600 transition-all">
          <div className="bg-blue-500/10 text-blue-400 p-2.5 rounded-xl border border-blue-500/20">
            <Copy className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-400 block font-medium">Repetidas para Troca</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold text-blue-400">{repeatedCount}</span>
              <span className="text-[10px] text-slate-500">no monte de troca</span>
            </div>
          </div>
        </div>

        {/* Completed Sections */}
        <div className="bg-[#1e293b] rounded-2xl p-4 border border-slate-700 shadow-xl flex items-center gap-4 hover:border-slate-600 transition-all">
          <div className="bg-emerald-500/10 text-emerald-400 p-2.5 rounded-xl border border-emerald-500/20">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-400 block font-medium">Países Completados</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold text-emerald-400">{completedCountries}</span>
              <span className="text-xs text-slate-500">/ {totalCountries} países ({completedPercent}%)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
