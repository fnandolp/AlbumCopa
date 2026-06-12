/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useRef } from "react";
import { 
  Search, 
  Menu, 
  BookOpen, 
  Sparkles, 
  Globe, 
  RefreshCw, 
  Award, 
  Trash2, 
  X, 
  CheckCircle2, 
  Smartphone, 
  TrendingUp,
  Sliders,
  Filter
} from "lucide-react";
import { COUNTRIES, getStickersList, getCountryDisplaySection, FLAG_MAP } from "./albumData";
import { AlbumState, Sticker } from "./types";
import { StatsPanel } from "./components/StatsPanel";
import { CloudSyncManager } from "./components/CloudSyncManager";
import { StickersGrid } from "./components/StickersGrid";
import { ClipboardExporter } from "./components/ClipboardExporter";
import { 
  loadLocalAlbum, 
  saveLocalAlbum, 
  syncAlbumToCloud, 
  subscribeToAlbum 
} from "./firebaseService";

export default function App() {
  // Load static stickers list (994 total!)
  const ALL_STICKERS = useMemo(() => getStickersList(), []);

  // Album state (glued & repeated)
  const [albumState, setAlbumState] = useState<AlbumState>(() => loadLocalAlbum());
  
  // Navigation & Search UI states
  const [activeSection, setActiveSection] = useState<string>("MEX MÉXICO 🇲🇽");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "glued" | "missing" | "repeated">("all");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Keep an active unsubscribed hook ref to dispose of listeners
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // On mount, load local state and if an albumCode is stored, connect to live Sync!
  useEffect(() => {
    if (albumState.albumCode) {
      handleJoinSync(albumState.albumCode, "download");
    }
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  // Save changes locally whenever state shifts
  useEffect(() => {
    saveLocalAlbum(albumState);
  }, [albumState]);

  // Connect to the shared cloud database
  const handleJoinSync = (code: string, mode: "merge" | "override" | "download") => {
    if (!code) return;
    setIsSyncing(true);
    setSyncError(null);

    // Cancel existing subscriber
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    const unsub = subscribeToAlbum(
      code,
      async (remoteData) => {
        // Handle sync resolution mode when first linking
        setAlbumState((prevLocal) => {
          let mergedGlued = { ...prevLocal.glued };
          let mergedRepeated = { ...prevLocal.repeated };

          if (mode === "merge") {
            // Combine local and remote elements
            const remoteGlued = remoteData.glued || {};
            const remoteRepeated = remoteData.repeated || {};

            // Merge Glue boolean
            ALL_STICKERS.forEach((st) => {
              if (remoteGlued[st.id] || prevLocal.glued[st.id]) {
                mergedGlued[st.id] = true;
              }
              // Merge repeated: take maximum or sum
              const lRep = prevLocal.repeated[st.id] || 0;
              const rRep = remoteRepeated[st.id] || 0;
              const maxRep = Math.max(lRep, rRep);
              if (maxRep > 0) {
                mergedRepeated[st.id] = maxRep;
              }
            });

            // Push the merged representation back to cloud!
            syncAlbumToCloud(code, mergedGlued, mergedRepeated);
          } else if (mode === "override") {
            // Upload current local state directly to cloud
            syncAlbumToCloud(code, prevLocal.glued, prevLocal.repeated);
            mergedGlued = prevLocal.glued;
            mergedRepeated = prevLocal.repeated;
          } else {
            // Download mode: take remote contents
            mergedGlued = remoteData.glued || {};
            mergedRepeated = remoteData.repeated || {};
          }

          setIsSyncing(false);
          return {
            albumCode: code,
            glued: mergedGlued,
            repeated: mergedRepeated,
            updatedAt: remoteData.updatedAt || new Date().toISOString()
          };
        });
      },
      (err) => {
        setSyncError(err.message || "Não foi possível conectar ao Firestore.");
        setIsSyncing(false);
      }
    );

    unsubscribeRef.current = unsub;
  };

  const handleDisconnectSync = () => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    setAlbumState((prev) => ({
      ...prev,
      albumCode: null,
      updatedAt: null
    }));
    setSyncError(null);
  };

  // Mutators for glued (coladas) and repeated (repetidas)
  const handleToggleGlued = async (stickerId: string) => {
    const isCurrentlyGlued = albumState.glued[stickerId] || false;
    const nextGlued = { ...albumState.glued, [stickerId]: !isCurrentlyGlued };
    
    // Optimistic state change
    setAlbumState((prev) => ({
      ...prev,
      glued: nextGlued
    }));

    // If connected to cloud, sync immediately
    if (albumState.albumCode) {
      await syncAlbumToCloud(albumState.albumCode, nextGlued, albumState.repeated);
    }
  };

  const handleIncrementRepeated = async (stickerId: string, amount: number) => {
    const currentCount = albumState.repeated[stickerId] || 0;
    const nextCount = Math.max(0, currentCount + amount);

    const nextRepeated = { ...albumState.repeated };
    if (nextCount === 0) {
      delete nextRepeated[stickerId];
    } else {
      nextRepeated[stickerId] = nextCount;
    }

    setAlbumState((prev) => ({
      ...prev,
      repeated: nextRepeated
    }));

    if (albumState.albumCode) {
      await syncAlbumToCloud(albumState.albumCode, albumState.glued, nextRepeated);
    }
  };

  const handleWipeData = () => {
    if (window.confirm("Atenção: Isso irá resetar localmente TODAS as figurinhas anotadas neste celular. Deseja continuar?")) {
      const resetState: AlbumState = {
        albumCode: null,
        glued: {},
        repeated: {},
        updatedAt: null
      };
      handleDisconnectSync();
      setAlbumState(resetState);
      saveLocalAlbum(resetState);
    }
  };

  // Filtered lists computation (Search & Filters)
  const filteredStickers = useMemo(() => {
    let result = ALL_STICKERS;

    // Apply text search Matcher
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (s) => s.id.toLowerCase().includes(q) || s.section.toLowerCase().includes(q)
      );
    }

    // Apply Filter Criteria
    if (filterMode === "glued") {
      result = result.filter((s) => albumState.glued[s.id]);
    } else if (filterMode === "missing") {
      result = result.filter((s) => !albumState.glued[s.id]);
    } else if (filterMode === "repeated") {
      result = result.filter((s) => (albumState.repeated[s.id] || 0) > 0);
    }

    return result;
  }, [ALL_STICKERS, searchQuery, filterMode, albumState]);

  // Aggregate stats
  const totalStickersCount = ALL_STICKERS.length;
  const gluedCount = borderStatsCount(albumState.glued);
  const missingCount = totalStickersCount - gluedCount;
  const repeatedTotalCount = borderRepeatedSum(albumState.repeated);

  function borderStatsCount(map: Record<string, boolean>) {
    return Object.values(map).filter(Boolean).length;
  }

  function borderRepeatedSum(map: Record<string, number>) {
    return Object.values(map).reduce((sum, val) => sum + (val || 0), 0);
  }

  // Calculate section progress
  const sectionProgress = useMemo(() => {
    const progress: Record<string, { glued: number; total: number; isComplete: boolean }> = {};

    ALL_STICKERS.forEach((s) => {
      if (!progress[s.section]) {
        progress[s.section] = { glued: 0, total: 0, isComplete: false };
      }
      progress[s.section].total++;
      if (albumState.glued[s.id]) {
        progress[s.section].glued++;
      }
    });

    Object.keys(progress).forEach((sec) => {
      progress[sec].isComplete = progress[sec].glued === progress[sec].total;
    });

    return progress;
  }, [ALL_STICKERS, albumState.glued]);

  // Total completed countries
  const completedCountriesCount = useMemo(() => {
    let completeCount = 0;
    COUNTRIES.forEach((c) => {
      if (sectionProgress[c.name]?.isComplete) {
        completeCount++;
      }
    });
    return completeCount;
  }, [sectionProgress]);

  // Generate list of completed page numbers
  const completedPages = useMemo(() => {
    const pagesMap: Record<number, boolean> = {};
    const pageGrouping: Record<number, { glued: number; total: number }> = {};

    ALL_STICKERS.forEach((s) => {
      if (!pageGrouping[s.page]) {
        pageGrouping[s.page] = { glued: 0, total: 0 };
      }
      pageGrouping[s.page].total++;
      if (albumState.glued[s.id]) {
        pageGrouping[s.page].glued++;
      }
    });

    Object.entries(pageGrouping).forEach(([pageStr, countObj]) => {
      const pageNum = Number(pageStr);
      pagesMap[pageNum] = countObj.glued === countObj.total;
    });

    return pagesMap;
  }, [ALL_STICKERS, albumState.glued]);

  // Navigation sections list sorted beautifully
  const sectionsNavigation = useMemo(() => {
    const list: { name: string; type: "special" | "country"; page: number; emoji?: string }[] = [];
    
    list.push({ name: "Capa", type: "special", page: 4 });
    list.push({ name: "Fls. 1", type: "special", page: 5 });
    list.push({ name: "Fls. 2-3", type: "special", page: 6 });

    COUNTRIES.forEach((c) => {
      list.push({
        name: getCountryDisplaySection(c.code, c.name),
        type: "country",
        page: c.page
      });
    });

    list.push({ name: "História FWC", type: "special", page: 106 });
    list.push({ name: "Coca-Cola", type: "special", page: 110 });

    return list;
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0f1d] text-slate-100 font-sans">
      {/* Header Banner */}
      <header className="sticky top-0 z-40 bg-[#111827] border-b border-slate-800/80 py-3 md:py-4 px-4 shadow-2xl backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="xl:hidden p-2 bg-[#1e293b] hover:bg-[#2e3e56] text-slate-200 border border-slate-700/50 rounded-xl transition-all"
              title="Abrir navegação por países"
            >
              <Menu className="w-5 h-5 text-yellow-500" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-2xl pt-1">🏆</span>
              <div>
                <h1 className="text-base md:text-lg font-black text-yellow-500 uppercase tracking-tight flex items-center gap-1.5 leading-none">
                  Fifa 2026 <span className="text-slate-100 font-serif lowercase italic font-semibold">Sticker Collector</span>
                </h1>
                <p className="text-[10px] text-slate-450 font-bold tracking-widest uppercase mt-1">
                  Controle do Álbum • Casal Copa Compartilhado
                </p>
              </div>
            </div>
          </div>

          {/* Quick Search and Status */}
          <div className="flex items-center gap-4 flex-1 max-w-md justify-end md:justify-start">
            <div className="relative w-full hidden sm:block">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar figurinha (Ex: BRA, 00, Coca-Cola)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#0a0f1d] border border-slate-700 text-slate-100 rounded-full pl-9 pr-4 py-1.5 text-xs focus:ring-2 focus:ring-yellow-500 focus:bg-[#111827] focus:outline-none transition-all placeholder:text-slate-550 font-medium"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-full transition-all"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Sync Badge Indicator */}
            {albumState.albumCode ? (
              <span className="hidden md:flex items-center gap-1.5 text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                Sincronizado: {albumState.albumCode}
              </span>
            ) : (
              <span className="hidden md:flex items-center gap-1.5 text-[10px] bg-slate-800 text-slate-400 border border-slate-700 font-medium px-2.5 py-1 rounded-full">
                MODO LOCAL (OFFLINE)
              </span>
            )}

            <button
              onClick={handleWipeData}
              className="p-2 hover:bg-red-500/10 text-slate-500 hover:text-red-400 border border-transparent hover:border-red-500/20 rounded-xl transition-all cursor-pointer"
              title="Limpar todos os dados locais"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Body Grid */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        
        {/* Device Sync Alert Banner for spouse layout consistency */}
        {!albumState.albumCode && (
          <div className="bg-[#111827] border border-yellow-500/20 rounded-2xl p-4 mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📱</span>
              <div>
                <h4 className="text-xs font-bold text-yellow-500 uppercase tracking-widest">Dica de Álbum Sincronizado</h4>
                <p className="text-xs text-slate-300 mt-0.5">
                  Colecionando em dupla com amigos, mãe/filho, parceiro ou parceira? Clique no botão "Sincronizar Celulares" abaixo para compartilhar a mesma lista em tempo real!
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                // Focus sync panel or open scroll
                const syncButton = document.querySelector("button[class*='bg-yellow-550'], button[class*='bg-yellow-500']");
                if (syncButton) {
                  syncButton.scrollIntoView({ behavior: "smooth" });
                } else {
                  window.scrollTo({ top: 300, behavior: "smooth" });
                }
              }}
              className="text-xs text-yellow-500 hover:text-yellow-400 font-bold hover:underline shrink-0"
            >
              Configurar Sincronização &rarr;
            </button>
          </div>
        )}

        {/* Bento Board Statistics Panel */}
        <StatsPanel
          total={totalStickersCount}
          gluedCount={gluedCount}
          missingCount={missingCount}
          repeatedCount={repeatedTotalCount}
          completedCountries={completedCountriesCount}
          totalCountries={COUNTRIES.length}
        />

        {/* Text/TXT clipboard exporter */}
        <ClipboardExporter
          stickers={ALL_STICKERS}
          glued={albumState.glued}
          repeated={albumState.repeated}
        />

        {/* Google Cloud Sync Module */}
        <CloudSyncManager
          albumCode={albumState.albumCode}
          onConnect={handleJoinSync}
          onDisconnect={handleDisconnectSync}
          isSyncing={isSyncing}
          syncError={syncError}
        />

        {/* Navigation & Grid Bento Layout */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
          
          {/* LEFT INDEX FOR DESKTOP */}
          <aside className="hidden xl:block bg-[#111827] rounded-2xl border border-slate-800/90 shadow-2xl p-4 sticky top-24 max-h-[calc(100vh-12rem)] overflow-y-auto">
            <div className="flex items-center gap-2 mb-3 px-1">
              <BookOpen className="w-4 h-4 text-slate-500" />
              <h3 className="text-xs font-bold text-yellow-500 uppercase tracking-widest">Navegação do Álbum</h3>
            </div>

            <div className="space-y-1.5">
              {sectionsNavigation.map((sec) => {
                const prog = sectionProgress[sec.name] || { glued: 0, total: 0, isComplete: false };
                const pct = prog.total > 0 ? Math.round((prog.glued / prog.total) * 100) : 0;
                const active = activeSection === sec.name;

                return (
                  <button
                    key={sec.name}
                    onClick={() => {
                      setActiveSection(sec.name);
                      setSearchQuery(""); // Clear search to show section
                    }}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs transition-all cursor-pointer ${
                      active
                        ? "bg-yellow-500/10 text-yellow-500 border-l-2 border-yellow-500 font-bold shadow-lg"
                        : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {sec.emoji ? (
                        <span className="text-base leading-none shrink-0">{sec.emoji}</span>
                      ) : sec.type === "country" ? null : (
                        <span className="w-3.5 h-3.5 flex items-center justify-center font-bold text-[8px] bg-slate-800 text-slate-400 rounded shrink-0 border border-slate-700">
                          ★
                        </span>
                      )}
                      <span className="truncate">{sec.name}</span>
                    </div>

                    <div className="flex items-center gap-1.5 ml-2">
                      <span className={`font-mono text-[10px] shrink-0 font-bold ${active ? "text-yellow-400" : "text-slate-550"}`}>
                        {prog.glued}/{prog.total}
                      </span>
                      
                      {prog.isComplete ? (
                        <span className={`p-0.5 rounded-full ${active ? "text-yellow-500 animate-pulse" : "text-emerald-400"}`}>
                          <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* MAIN CONTENT AREA */}
          <div className="xl:col-span-3 space-y-6">
            
            {/* MOBILE QUICK DROPDOWN FOR SECTION CHOICE */}
            <div className="xl:hidden bg-[#1e293b] rounded-2xl border border-slate-750 p-4 shadow-sm">
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-yellow-550 uppercase tracking-widest block">
                    Seção do Álbum
                  </label>
                  <div className="relative mt-1">
                    <select
                      value={activeSection}
                      onChange={(e) => {
                        setActiveSection(e.target.value);
                        setSearchQuery("");
                      }}
                      className="w-full sm:w-64 bg-[#0a0f1d] border border-slate-750 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 font-semibold text-slate-100"
                    >
                      {sectionsNavigation.map((sec) => (
                        <option className="bg-[#1e293b] text-slate-100" key={sec.name} value={sec.name}>
                          {sec.emoji ? `${sec.emoji} ` : ""} {sec.name} ({sectionProgress[sec.name]?.glued}/{sectionProgress[sec.name]?.total})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Mobile Search input */}
                <div className="relative sm:max-w-xs w-full">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Buscar figurinhas..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#0a0f1d] border border-slate-700 text-slate-100 rounded-xl pl-9 pr-8 py-2 text-sm focus:ring-2 focus:ring-yellow-500 focus:bg-[#111827] focus:outline-none transition-all placeholder:text-slate-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 bg-slate-750 hover:bg-slate-650 text-slate-200 rounded-full transition-all"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Quick FILTER modes tools */}
            <div className="bg-[#1e293b] rounded-2xl border border-slate-700 p-3 shadow-xl flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400 flex items-center gap-1 px-2 font-medium">
                <Filter className="w-3 h-3" /> Filtrar Lista:
              </span>

              <button
                onClick={() => { setFilterMode("all"); }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all ${
                  filterMode === "all" ? "bg-yellow-500 text-slate-950 font-black" : "bg-[#0a0f1d] hover:bg-slate-800 text-slate-400 border border-slate-800"
                }`}
              >
                Todas ({ALL_STICKERS.length})
              </button>

              <button
                onClick={() => { setFilterMode("glued"); }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all ${
                  filterMode === "glued" ? "bg-emerald-600 text-white" : "bg-emerald-500/10 hover:bg-[#0a0f1d] text-emerald-400 border border-emerald-500/20"
                }`}
              >
                Coladas ({gluedCount})
              </button>

              <button
                onClick={() => { setFilterMode("missing"); }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all ${
                  filterMode === "missing" ? "bg-red-600 text-white" : "bg-red-500/10 hover:bg-[#0a0f1d] text-red-400 border border-red-500/20"
                }`}
              >
                Faltantes ({missingCount})
              </button>

              <button
                onClick={() => { setFilterMode("repeated"); }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all ${
                  filterMode === "repeated" ? "bg-blue-600 text-white" : "bg-blue-500/10 hover:bg-[#0a0f1d] text-blue-400 border border-blue-500/20"
                }`}
              >
                Repetidas ({repeatedTotalCount})
              </button>
            </div>

            {/* MAIN LIST DISPLAY */}
            {searchQuery || filterMode !== "all" ? (
              // Search or Filter mode is active: render search layout
              <div className="bg-[#1e293b] rounded-2xl border border-slate-800 shadow-2xl p-4 md:p-6">
                <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="font-bold text-slate-100">
                      {searchQuery ? `Resultados para "${searchQuery}"` : "Filtro Ativo"}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Mostrando {filteredStickers.length} figurinhas encontradas.
                    </p>
                  </div>
                  {filteredStickers.length > 0 && (
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setFilterMode("all");
                      }}
                      className="text-xs font-bold text-yellow-550 hover:text-yellow-400 hover:underline"
                    >
                      Limpar Filtros e voltar
                    </button>
                  )}
                </div>

                {filteredStickers.length === 0 ? (
                  <div className="py-12 text-center text-slate-400">
                    <span className="text-4xl">🔍</span>
                    <h4 className="text-sm font-bold text-slate-200 mt-3">Nenhuma figurinha coincide</h4>
                    <p className="text-xs text-slate-450 mt-1 max-w-sm mx-auto">
                      Verifique se digitou o código corretamente (Ex: "BRA14", "MEX", "CC4") ou mude sua combinação de filtros.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-3">
                    {/* Render matching cells */}
                    {filteredStickers.map((sticker) => {
                      const isGlued = albumState.glued[sticker.id] || false;
                      const repCount = albumState.repeated[sticker.id] || 0;
                      const special = sticker.id === "00" || sticker.id.startsWith("FWC") || sticker.id.startsWith("CC");

                      return (
                        <div
                          key={sticker.id}
                          className={`relative rounded-xl p-3 border transition-all flex flex-col justify-between min-h-[110px] ${
                            isGlued
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                              : special
                              ? "bg-yellow-550/10 border-yellow-500/20 text-slate-100"
                              : "bg-[#0f172a] border-slate-800/80 text-slate-200"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-bold text-slate-100">{sticker.label}</span>
                            <span className="text-[9px] font-semibold text-slate-400 tracking-wider truncate max-w-[65px]">
                              {sticker.section}
                            </span>
                          </div>

                          <div
                            onClick={() => handleToggleGlued(sticker.id)}
                            className="flex-1 flex flex-col items-center justify-center cursor-pointer my-1 text-center"
                          >
                            {isGlued ? (
                              <div className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-full p-1 shadow-md">
                                <CheckCircle2 className="w-4 h-4" />
                              </div>
                            ) : (
                              <span className="text-[10px] text-red-400 uppercase font-bold tracking-widest">Faltando</span>
                            )}
                          </div>

                          <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-slate-800">
                            <div className="flex items-center gap-1 bg-[#0a0f1d] px-1.5 py-0.5 rounded border border-slate-750">
                              <button
                                onClick={() => handleIncrementRepeated(sticker.id, -1)}
                                disabled={repCount === 0}
                                className="p-0.5 disabled:opacity-30 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3 text-slate-450 hover:text-red-400" />
                              </button>
                              <span className="text-xs font-bold font-mono px-1 text-slate-100">{repCount}</span>
                              <button
                                onClick={() => handleIncrementRepeated(sticker.id, 1)}
                                className="p-0.5 cursor-pointer"
                              >
                                <Sparkles className="w-3 h-3 text-yellow-500 hover:text-yellow-400" />
                              </button>
                            </div>
                            <span className="text-[9px] text-slate-400">Repetidas</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              // Standard country layout double page view
              <StickersGrid
                stickers={ALL_STICKERS}
                glued={albumState.glued}
                repeated={albumState.repeated}
                onToggleGlued={handleToggleGlued}
                onIncrementRepeated={handleIncrementRepeated}
                activeSection={activeSection}
                completedPages={completedPages}
              />
            )}
          </div>
        </div>
      </main>

      {/* MOBILE FULL DRAWER NAVIGATION */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex xl:hidden select-none">
          {/* Backdrop screen */}
          <div
            onClick={() => setIsMobileMenuOpen(false)}
            className="absolute inset-0 bg-[#0a0f1d]/75 backdrop-blur-sm transition-opacity"
          />

          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-[#111827] border-l border-slate-800 shadow-2xl h-full">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-[#1e293b]">
              <h3 className="font-bold text-yellow-500 flex items-center gap-1.5 text-sm uppercase tracking-wider">
                <span>📖</span> Navegar Seções
              </h3>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700/50 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1.5 bg-[#111827]">
              {sectionsNavigation.map((sec) => {
                const prog = sectionProgress[sec.name] || { glued: 0, total: 0, isComplete: false };
                const pct = prog.total > 0 ? Math.round((prog.glued / prog.total) * 100) : 0;
                const active = activeSection === sec.name;

                return (
                  <button
                    key={sec.name}
                    onClick={() => {
                      setActiveSection(sec.name);
                      setSearchQuery("");
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-xl text-left text-xs transition-all cursor-pointer ${
                      active
                        ? "bg-yellow-500/10 text-yellow-500 border-l-2 border-yellow-500 font-bold"
                        : "text-slate-400 hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {sec.emoji ? (
                        <span className="text-base shrink-0">{sec.emoji}</span>
                      ) : sec.type === "country" ? null : (
                        <span className="w-3.5 h-3.5 flex items-center justify-center font-bold text-[8px] bg-[#0a0f1d] text-slate-400 rounded shrink-0 border border-slate-850">
                          ★
                        </span>
                      )}
                      <span>{sec.name}</span>
                    </div>

                    <div className="flex items-center gap-1 md:gap-2 shrink-0">
                      <span className={`font-mono text-[10px] ${active ? "text-yellow-400 font-bold" : "text-slate-500"}`}>
                        {prog.glued}/{prog.total}
                      </span>
                      {prog.isComplete ? (
                        <span className={active ? "text-yellow-500" : "text-emerald-400"}>
                          <CheckCircle2 className="w-4 h-4" />
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
