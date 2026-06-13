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
  Filter,
  ChevronUp,
  ChevronDown,
  Plus,
  Check,
  Camera
} from "lucide-react";
import { COUNTRIES, getStickersList, getCountryDisplaySection, FLAG_MAP } from "./albumData";
import { AlbumState, Sticker } from "./types";
import { StatsPanel } from "./components/StatsPanel";
import { CloudSyncManager } from "./components/CloudSyncManager";
import { StickersGrid } from "./components/StickersGrid";
import { ClipboardExporter } from "./components/ClipboardExporter";
import { ZeroCreditScanner } from "./components/ZeroCreditScanner";
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
  const [mobileTab, setMobileTab] = useState<"general" | "stickers" | "scanner">("general");
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

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

    let initialResolved = false;

    const unsub = subscribeToAlbum(
      code,
      async (remoteData) => {
        if (!initialResolved) {
          initialResolved = true;

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
                // Merge repeated: take maximum
                const lRep = prevLocal.repeated[st.id] || 0;
                const rRep = remoteRepeated[st.id] || 0;
                const maxRep = Math.max(lRep, rRep);
                if (maxRep > 0) {
                  mergedRepeated[st.id] = maxRep;
                }
              });

              // Push the merged representation back to cloud ONCE
              syncAlbumToCloud(code, mergedGlued, mergedRepeated);
            } else if (mode === "override") {
              // Upload current local state directly to cloud ONCE
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
        } else {
          // Continuous sync: subsequent events MUST only download changes, NEVER write back!
          setAlbumState((prevLocal) => {
            const remoteGlued = remoteData.glued || {};
            const remoteRepeated = remoteData.repeated || {};

            return {
              ...prevLocal,
              glued: remoteGlued,
              repeated: remoteRepeated,
              updatedAt: remoteData.updatedAt || new Date().toISOString()
            };
          });
        }
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
        
        {/* =========================================================================
            DESKTOP VIEWPORT (ONLY RENDERED ON LARGE SCREENS)
            ========================================================================= */}
        <div className="hidden xl:block space-y-6">
          {/* Device Sync Alert Banner */}
          {!albumState.albumCode && (
            <div className="bg-[#111827] border border-yellow-500/20 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📱</span>
                <div>
                  <h4 className="text-xs font-bold text-yellow-500 uppercase tracking-widest">Dica de Álbum Sincronizado</h4>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Colecionando em dupla com amigos, parceiro ou parceira? Clique no botão "Sincronizar Celulares" abaixo para compartilhar a mesma lista em tempo real!
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
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

          {/* Zero Credit Scanner (Local offline OCR) */}
          <ZeroCreditScanner
            stickers={ALL_STICKERS}
            glued={albumState.glued}
            repeated={albumState.repeated}
            onToggleGlued={handleToggleGlued}
            onIncrementRepeated={handleIncrementRepeated}
          />

          {/* Navigation & Grid Bento Layout */}
          <div className="grid grid-cols-4 gap-6 items-start">
            {/* LEFT INDEX */}
            <aside className="bg-[#111827] rounded-2xl border border-slate-800/90 shadow-2xl p-4 sticky top-24 max-h-[calc(100vh-12rem)] overflow-y-auto">
              <div className="flex items-center gap-2 mb-3 px-1">
                <BookOpen className="w-4 h-4 text-slate-500" />
                <h3 className="text-xs font-bold text-yellow-500 uppercase tracking-widest">Navegação do Álbum</h3>
              </div>

              <div className="space-y-1.5">
                {sectionsNavigation.map((sec) => {
                  const prog = sectionProgress[sec.name] || { glued: 0, total: 0, isComplete: false };
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

            {/* RIGHT MAIN DETAILS GRID */}
            <div className="col-span-3 space-y-6">
              {/* Quick FILTER modes tools */}
              <div className="bg-[#1e293b] rounded-2xl border border-slate-700 p-3 shadow-xl flex items-center gap-2">
                <span className="text-xs text-slate-400 flex items-center gap-1 px-2 font-medium">
                  <Filter className="w-3 h-3" /> Filtrar Lista:
                </span>

                <button
                  onClick={() => setFilterMode("all")}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all ${
                    filterMode === "all" ? "bg-yellow-500 text-slate-950 font-black" : "bg-[#0a0f1d] hover:bg-slate-800 text-slate-400 border border-slate-800"
                  }`}
                >
                  Todas ({ALL_STICKERS.length})
                </button>

                <button
                  onClick={() => setFilterMode("glued")}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all ${
                    filterMode === "glued" ? "bg-emerald-600 text-white" : "bg-emerald-500/10 hover:bg-[#0a0f1d] text-emerald-400 border border-emerald-500/20"
                  }`}
                >
                  Coladas ({gluedCount})
                </button>

                <button
                  onClick={() => setFilterMode("missing")}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all ${
                    filterMode === "missing" ? "bg-red-600 text-white" : "bg-red-500/10 hover:bg-[#0a0f1d] text-red-400 border border-red-500/20"
                  }`}
                >
                  Faltantes ({missingCount})
                </button>

                <button
                  onClick={() => setFilterMode("repeated")}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all ${
                    filterMode === "repeated" ? "bg-blue-600 text-white" : "bg-blue-500/10 hover:bg-[#0a0f1d] text-blue-400 border border-blue-500/20"
                  }`}
                >
                  Repetidas ({repeatedTotalCount})
                </button>
              </div>

              {/* LIST VIEWS */}
              {searchQuery || filterMode !== "all" ? (
                <div className="bg-[#1e293b] rounded-2xl border border-slate-800 shadow-2xl p-6">
                  <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                    <div>
                      <h3 className="font-bold text-slate-100">
                        {searchQuery ? `Resultados para "${searchQuery}"` : "Filtro Ativo"}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Mostrando {filteredStickers.length} figurinhas encontradas.
                      </p>
                    </div>
                    {(searchQuery || filterMode !== "all") && (
                      <button
                        onClick={() => {
                          setSearchQuery("");
                          setFilterMode("all");
                        }}
                        className="text-xs font-bold text-yellow-500 hover:text-yellow-400 hover:underline"
                      >
                        Limpar Filtros e voltar
                      </button>
                    )}
                  </div>

                  {filteredStickers.length === 0 ? (
                    <div className="py-12 text-center text-slate-400">
                      <span className="text-4xl">🔍</span>
                      <h4 className="text-sm font-bold text-slate-200 mt-3">Nenhuma figurinha coincide</h4>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                        Verifique se digitou o código corretamente (Ex: "BRA14", "MEX", "CC4") ou mude sua combinação de filtros.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-5 gap-3">
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
                                  <Check className="w-4 h-4" />
                                </div>
                              ) : (
                                <span className="text-[10px] text-red-400 uppercase font-bold tracking-widest">Faltando</span>
                              )}
                            </div>

                            <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-slate-800">
                              <div className="flex items-center gap-1 bg-[#0a0f1d] px-1.5 py-0.5 rounded border border-slate-750">
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleIncrementRepeated(sticker.id, -1); }}
                                  disabled={repCount === 0}
                                  className="p-0.5 disabled:opacity-30 cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3 text-slate-450 hover:text-red-400" />
                                </button>
                                <span className="text-xs font-bold font-mono px-1 text-slate-100">{repCount}</span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleIncrementRepeated(sticker.id, 1); }}
                                  className="p-0.5 cursor-pointer"
                                >
                                  <Sparkles className="w-3 h-3 text-yellow-500 hover:text-yellow-400" />
                                </button>
                              </div>
                              <span className="text-[9px] text-slate-450">Repetidas</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
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
        </div>

        {/* =========================================================================
            MOBILE VIEWPORT (ONLY RENDERED ON PORTABLE SCREENS)
            ========================================================================= */}
        <div className="xl:hidden pb-24 space-y-6">
          
          {/* TAB 1: INFORMAÇÕES GERAIS */}
          {mobileTab === "general" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              
              {/* Device Sync Alert Banner (Mobile Specific) */}
              {!albumState.albumCode && (
                <div className="bg-[#111827] border border-yellow-500/10 rounded-2xl p-4 flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">📱</span>
                    <div>
                      <h4 className="text-xs font-bold text-yellow-500 uppercase tracking-widest leading-none">Coleção em Dupla</h4>
                      <p className="text-[11px] text-slate-300 mt-1.5 leading-relaxed">
                        Colecionando com amigos ou cônjuge? Sincronize seus aparelhos na aba abaixo para trabalhar no mesmo álbum simultaneamente!
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Stats Panel (Progress, missing, repeated, countries) */}
              <StatsPanel
                total={totalStickersCount}
                gluedCount={gluedCount}
                missingCount={missingCount}
                repeatedCount={repeatedTotalCount}
                completedCountries={completedCountriesCount}
                totalCountries={COUNTRIES.length}
              />

              {/* Responsive Dropdown Exporter List */}
              <ClipboardExporter
                stickers={ALL_STICKERS}
                glued={albumState.glued}
                repeated={albumState.repeated}
                isMobileOnly={true}
              />

              {/* Firebase Cloud Sync Manager */}
              <CloudSyncManager
                albumCode={albumState.albumCode}
                onConnect={handleJoinSync}
                onDisconnect={handleDisconnectSync}
                isSyncing={isSyncing}
                syncError={syncError}
              />
            </div>
          )}

          {/* TAB 3: SCANNER DIGITALIZADOR */}
          {mobileTab === "scanner" && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <ZeroCreditScanner
                stickers={ALL_STICKERS}
                glued={albumState.glued}
                repeated={albumState.repeated}
                onToggleGlued={handleToggleGlued}
                onIncrementRepeated={handleIncrementRepeated}
              />
            </div>
          )}

          {/* TAB 2: COLAR FIGURINHAS (STICKERS ORGANIZED BY COLLAPSIBLE SECTIONS) */}
          {mobileTab === "stickers" && (
            <div className="space-y-4 animate-in fade-in duration-300">
              
              {/* Quick Search & Filters for Sticker Pasting section */}
              <div className="bg-[#111827] rounded-2xl border border-slate-800 p-4 shadow-xl space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest mb-1.5 block">
                    Pesquisar no Álbum
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Ex: BRA15, MEX, 00, Coca-Cola..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-[#0a0f1d] border border-slate-700 text-slate-100 rounded-xl pl-9 pr-9 py-2.5 text-xs font-semibold focus:ring-2 focus:ring-yellow-500 focus:outline-none placeholder:text-slate-500 transition-all"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-full"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Filter buttons */}
                <div className="flex flex-wrap gap-1 pt-1">
                  <button
                    onClick={() => setFilterMode("all")}
                    className={`px-2.5 py-1.5 rounded-xl text-[10px] h-7 font-bold transition-all cursor-pointer ${
                      filterMode === "all" ? "bg-yellow-500 text-slate-950 font-black" : "bg-[#0a0f1d] text-slate-400 border border-slate-800"
                    }`}
                  >
                    Todas ({ALL_STICKERS.length})
                  </button>
                  <button
                    onClick={() => setFilterMode("glued")}
                    className={`px-2.5 py-1.5 rounded-xl text-[10px] h-7 font-bold transition-all cursor-pointer ${
                      filterMode === "glued" ? "bg-emerald-600 text-white" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/10"
                    }`}
                  >
                    Coladas ({gluedCount})
                  </button>
                  <button
                    onClick={() => setFilterMode("missing")}
                    className={`px-2.5 py-1.5 rounded-xl text-[10px] h-7 font-bold transition-all cursor-pointer ${
                      filterMode === "missing" ? "bg-red-650 bg-red-600 text-white" : "bg-red-500/10 text-red-400 border border-red-500/10"
                    }`}
                  >
                    Faltando ({missingCount})
                  </button>
                  <button
                    onClick={() => setFilterMode("repeated")}
                    className={`px-2.5 py-1.5 rounded-xl text-[10px] h-7 font-bold transition-all cursor-pointer ${
                      filterMode === "repeated" ? "bg-blue-600 text-white" : "bg-blue-500/10 text-blue-400 border border-blue-500/10"
                    }`}
                  >
                    Reps ({repeatedTotalCount})
                  </button>
                </div>
              </div>

              {/* Sticker results listing */}
              {searchQuery || filterMode !== "all" ? (
                <div className="bg-[#111827] rounded-2xl border border-slate-800 p-4 shadow-xl">
                  <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                    <div>
                      <h3 className="font-bold text-xs text-slate-100 uppercase tracking-wide">
                        {searchQuery ? `Resultado: "${searchQuery}"` : "Filtro Ativado"}
                      </h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {filteredStickers.length} figurinhas localizadas
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setFilterMode("all");
                      }}
                      className="text-[10px] font-bold text-yellow-500 hover:underline"
                    >
                      Limpar Filtro
                    </button>
                  </div>

                  {filteredStickers.length === 0 ? (
                    <div className="py-8 text-center text-slate-450 text-xs">
                      Nenhuma figurinha coincide com os filtros.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {filteredStickers.map((sticker) => {
                        const isGlued = albumState.glued[sticker.id] || false;
                        const repCount = albumState.repeated[sticker.id] || 0;
                        const special = sticker.id === "00" || sticker.id.startsWith("FWC") || sticker.id.startsWith("CC");

                        return (
                          <div
                            key={sticker.id}
                            className={`rounded-xl p-2.5 border transition-all flex flex-col justify-between min-h-[102px] ${
                              isGlued
                                ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
                                : special
                                ? "bg-yellow-550/10 border-yellow-500/20 text-slate-100"
                                : "bg-[#0f172a] border-slate-800/80 text-slate-200"
                            }`}
                          >
                            <div className="flex items-center justify-between leading-none mb-1">
                              <span className="font-mono text-xs font-bold text-slate-105">{sticker.label}</span>
                              <span className="text-[8px] font-bold text-slate-450 truncate max-w-[55px]">
                                {sticker.section}
                              </span>
                            </div>

                            <div
                              onClick={() => handleToggleGlued(sticker.id)}
                              className="flex-1 flex flex-col items-center justify-center cursor-pointer my-1 text-center"
                            >
                              {isGlued ? (
                                <div className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/35 rounded-full p-0.5 shadow-sm">
                                  <Check className="w-3.5 h-3.5" />
                                </div>
                              ) : (
                                <span className="text-[9px] text-red-400 uppercase font-bold tracking-widest leading-none">Falta</span>
                              )}
                            </div>

                            <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-slate-850">
                              <div className="flex items-center gap-1 bg-[#0a0f1d] px-1 py-0.5 rounded border border-slate-800 leading-none">
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleIncrementRepeated(sticker.id, -1); }}
                                  disabled={repCount === 0}
                                  className="p-0.5 disabled:opacity-30 cursor-pointer"
                                    title="Diminuir repetida"
                                >
                                  <Trash2 className="w-2.5 h-2.5 text-slate-500" />
                                </button>
                                <span className="text-[10px] font-bold font-mono px-0.5 text-slate-200 leading-none">{repCount}</span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleIncrementRepeated(sticker.id, 1); }}
                                  className="p-0.5 cursor-pointer"
                                    title="Aumentar repetida"
                                >
                                  <Plus className="w-2.5 h-2.5 text-yellow-500" />
                                </button>
                              </div>
                              <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Reps</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                /* COLLAPSIBLE ACCORDION CONTAINER LIST */
                <div className="space-y-2.5">
                  {sectionsNavigation.map((sec) => {
                    const prog = sectionProgress[sec.name] || { glued: 0, total: 0, isComplete: false };
                    const isExpanded = expandedSection === sec.name;

                    return (
                      <div
                        key={sec.name}
                        className={`rounded-2xl border transition-all ${
                          isExpanded
                            ? "bg-[#111827] border-yellow-500/25 shadow-xl"
                            : "bg-[#1e293b] border-slate-800 hover:border-slate-750 shadow-md"
                        }`}
                      >
                        {/* Section Header Row */}
                        <button
                          onClick={() => {
                            setExpandedSection(prev => prev === sec.name ? null : sec.name);
                          }}
                          className="w-full flex items-center justify-between p-3.5 cursor-pointer text-left focus:outline-none"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {sec.emoji ? (
                              <span className="text-xl shrink-0 leading-none">{sec.emoji}</span>
                            ) : (
                              <span className="w-5 h-5 flex items-center justify-center font-bold text-[9px] bg-[#0a0f1d] text-slate-400 rounded-lg border border-slate-800 shrink-0">
                                ★
                              </span>
                            )}
                            <div className="min-w-0">
                              <h4 className={`text-xs font-bold truncate ${isExpanded ? "text-yellow-500 font-extrabold" : "text-slate-200"}`}>
                                {sec.name}
                              </h4>
                              <span className="text-[9px] text-slate-400 mt-0.5 block font-bold leading-none">
                                {prog.glued} de {prog.total} coladas • {prog.total - prog.glued} faltantes
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {prog.isComplete ? (
                              <span className="text-emerald-400 shrink-0">
                                <CheckCircle2 className="w-5 h-5 stroke-[3] animate-pulse" />
                              </span>
                            ) : (
                              <span className="text-[9px] font-mono font-bold text-slate-400 bg-[#0a0f1d] px-2 py-0.5 rounded-full border border-slate-800 shrink-0">
                                {Math.round((prog.glued / prog.total) * 100)}%
                              </span>
                            )}
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                            )}
                          </div>
                        </button>

                        {/* Collateral Stickers visualizer */}
                        {isExpanded && (
                          <div className="px-3 pb-3 border-t border-slate-800/40 pt-3 bg-[#0a0f1d]/40 rounded-b-2xl">
                            <StickersGrid
                              stickers={ALL_STICKERS}
                              glued={albumState.glued}
                              repeated={albumState.repeated}
                              onToggleGlued={handleToggleGlued}
                              onIncrementRepeated={handleIncrementRepeated}
                              activeSection={sec.name}
                              completedPages={completedPages}
                              hideHeader={true}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* =========================================================================
          STICKY BOTTOM NAVIGATION (MOBILE ONLY)
          ========================================================================= */}
      <div className="fixed bottom-0 left-0 right-0 z-50 xl:hidden bg-[#111827] border-t border-slate-850 p-2 pb-safe shadow-[0_-8px_30px_rgba(0,0,0,0.55)] flex justify-around select-none">
        <button
          onClick={() => setMobileTab("general")}
          className={`flex flex-col items-center justify-center py-1.5 px-3.5 rounded-2xl gap-1 transition-all text-[10px] font-bold cursor-pointer ${
            mobileTab === "general"
              ? "text-yellow-500 bg-yellow-500/10 font-bold"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <TrendingUp className="w-4.5 h-4.5" />
          <span>Painel</span>
        </button>

        <button
          onClick={() => setMobileTab("scanner")}
          className={`flex flex-col items-center justify-center py-1.5 px-3.5 rounded-2xl gap-1 transition-all text-[10px] font-bold cursor-pointer ${
            mobileTab === "scanner"
              ? "text-yellow-500 bg-yellow-500/10 font-bold"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Camera className="w-4.5 h-4.5 animate-pulse" />
          <span>Scanner</span>
        </button>

        <button
          onClick={() => setMobileTab("stickers")}
          className={`flex flex-col items-center justify-center py-1.5 px-3.5 rounded-2xl gap-1 transition-all text-[10px] font-bold cursor-pointer ${
            mobileTab === "stickers"
              ? "text-yellow-500 bg-yellow-500/10 font-bold"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <BookOpen className="w-4.5 h-4.5" />
          <span>Figurinhas</span>
        </button>
      </div>
    </div>
  );
}
