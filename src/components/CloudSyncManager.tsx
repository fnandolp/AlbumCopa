/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, FormEvent } from "react";
import { Link2, Unlink, RefreshCw, AlertTriangle, Cloud, CloudOff, Info } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface CloudSyncManagerProps {
  albumCode: string | null;
  onConnect: (code: string, mode: "merge" | "override" | "download") => void;
  onDisconnect: () => void;
  isSyncing: boolean;
  syncError: string | null;
}

export function CloudSyncManager({
  albumCode,
  onConnect,
  onDisconnect,
  isSyncing,
  syncError
}: CloudSyncManagerProps) {
  const [inputCode, setInputCode] = useState("");
  const [showConfig, setShowConfig] = useState(false);
  const [joinStep, setJoinStep] = useState<"input" | "resolve">("input");

  const cleanInput = inputCode.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");

  const handleSubmitCode = (e: FormEvent) => {
    e.preventDefault();
    if (!cleanInput || cleanInput.length < 3) return;
    setJoinStep("resolve");
  };

  const handleAction = (mode: "merge" | "override" | "download") => {
    onConnect(cleanInput, mode);
    setInputCode("");
    setJoinStep("input");
    setShowConfig(false);
  };

  return (
    <div className="bg-[#1e293b] rounded-2xl border border-slate-700 shadow-xl p-4 md:p-6 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            {albumCode ? (
              <span className="flex items-center gap-2 text-emerald-400">
                <Cloud className="w-5 h-5 animate-pulse" />
                Sincronização Ativa
              </span>
            ) : (
              <span className="flex items-center gap-2 text-slate-400">
                <CloudOff className="w-5 h-5 text-slate-500" />
                Modo Offline (Apenas Este Aparelho)
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            {albumCode
              ? `Conectado ao Álbum Compartilhado: "${albumCode}". Todas as mudanças de figurinhas serão sincronizadas instantaneamente entre todos os aparelhos conectados.`
              : "Suas figurinhas estão salvas apenas neste aparelho. Ative a sincronização para atualizar a coleção simultaneamente com mais celulares!"}
          </p>
        </div>

        <button
          onClick={() => setShowConfig(!showConfig)}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            albumCode
              ? "bg-[#111827] text-yellow-500 border border-slate-700 hover:bg-slate-800"
              : "bg-yellow-500 text-slate-950 hover:bg-yellow-400 shadow-lg font-bold"
          }`}
        >
          {albumCode ? "Ver Código / Desconectar" : "Sincronizar Celulares"}
        </button>
      </div>

      <AnimatePresence>
        {showConfig && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mt-4 pt-4 border-t border-slate-800"
          >
            {albumCode ? (
              <div className="bg-[#111827] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-slate-800">
                <div className="flex items-start gap-3">
                  <div className="bg-yellow-500/10 text-yellow-500 p-2 rounded-lg mt-0.5 border border-yellow-500/20">
                    <Link2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-200">
                      Código do seu Álbum: <span className="font-mono text-yellow-400 bg-slate-800 px-2.5 py-1 rounded border border-slate-700 ml-1">{albumCode}</span>
                    </h4>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                      Compartilhe este código com amigos, familiares ou parceiros que colecionam com você. Ao digitarem o mesmo código nos aparelhos deles, todos verão e atualizarão a mesma lista em tempo real!
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={onDisconnect}
                    className="flex items-center gap-1.5 px-4 py-2 bg-red-950 hover:bg-red-900 border border-red-500/30 text-red-400 rounded-xl text-xs font-medium transition-all"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                    Desconectar Nuvem
                  </button>
                </div>
              </div>
            ) : (
              <div>
                {joinStep === "input" ? (
                  <form onSubmit={handleSubmitCode} className="max-w-md">
                    <h3 className="text-sm font-semibold text-slate-200">Criar ou Entrar em um Álbum</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Defina um código curto (ex: <span className="font-mono bg-[#111827] border border-slate-800 px-1.5 py-0.5 rounded text-yellow-400">nando-e-fla-2026</span>) para parear com o outro celular.
                    </p>
                    <div className="flex gap-2 mt-3">
                      <input
                        type="text"
                        placeholder="Ex: casal-copa-2026"
                        value={inputCode}
                        onChange={(e) => setInputCode(e.target.value)}
                        className="flex-1 px-4 py-2 bg-[#0a0f1d] border border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:bg-[#111827] transition-all text-slate-100"
                      />
                      <button
                        type="submit"
                        disabled={cleanInput.length < 3}
                        className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 disabled:bg-slate-700 text-slate-950 font-black rounded-xl text-xs disabled:opacity-50 transition-all flex items-center gap-1.5"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-slate-950" : "text-slate-950"}`} />
                        Prosseguir
                      </button>
                    </div>
                    {inputCode.length > 0 && cleanInput.length < 3 && (
                      <p className="text-[10px] text-yellow-500 mt-1.5 flex items-center gap-1">
                        <Info className="w-3 h-3" /> O código deve conter mais de 2 caracteres alfanuméricos.
                      </p>
                    )}
                  </form>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-[#111827] border border-slate-700 rounded-xl p-4 max-w-2xl"
                  >
                    <div className="flex items-start gap-3">
                      <div className="bg-yellow-500/10 text-yellow-400 p-2 rounded-lg mt-0.5 border border-yellow-500/20">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-slate-200">
                          Opções de Sincronização para "{cleanInput}"
                        </h4>
                        <p className="text-xs text-slate-400 mt-1">
                          Como você deseja sincronizar as figurinhas que já anotou neste celular com as figurinhas na nuvem?
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                          <button
                            onClick={() => handleAction("merge")}
                            className="p-3 bg-slate-800 border border-slate-700 hover:border-yellow-500 rounded-xl text-left transition-all hover:shadow-sm"
                          >
                            <span className="font-semibold text-xs text-yellow-500 block">1. Mesclar Dados</span>
                            <span className="text-[10px] text-slate-400 block mt-1 leading-relaxed">
                              Soma as figurinhas coladas deste celular com as da nuvem. Nada é perdido! (Recomendado)
                            </span>
                          </button>

                          <button
                            onClick={() => handleAction("override")}
                            className="p-3 bg-slate-800 border border-slate-700 hover:border-yellow-500 rounded-xl text-left transition-all hover:shadow-sm"
                          >
                            <span className="font-semibold text-xs text-yellow-500 block">2. Sobrescrever Nuvem</span>
                            <span className="text-[10px] text-slate-400 block mt-1 leading-relaxed">
                              Envia apenas os dados deste celular para a nuvem. Apaga o que estava na nuvem antes.
                            </span>
                          </button>

                          <button
                            onClick={() => handleAction("download")}
                            className="p-3 bg-slate-800 border border-slate-700 hover:border-yellow-500 rounded-xl text-left transition-all hover:shadow-sm"
                          >
                            <span className="font-semibold text-xs text-slate-500 block">3. Baixar da Nuvem</span>
                            <span className="text-[10px] text-slate-400 block mt-1 leading-relaxed">
                              Apaga as figurinhas anotadas neste celular e baixa exatamente o que está guardado na nuvem.
                            </span>
                          </button>
                        </div>

                        <div className="flex justify-end gap-2 mt-4">
                          <button
                            onClick={() => setJoinStep("input")}
                            className="text-xs text-slate-400 hover:text-slate-200 font-medium px-3 py-1.5 rounded-lg"
                          >
                            Voltar
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            )}

            {syncError && (
              <div className="mt-4">
                {syncError.includes("Quota exceeded") || syncError.toLowerCase().includes("quota") ? (
                  <div className="p-4 bg-yellow-950/40 border border-yellow-500/30 rounded-xl text-xs text-yellow-200">
                    <div className="flex items-center gap-2 mb-2 font-bold text-yellow-400">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-yellow-500" />
                      <span>Limite Diário de Uso Temporariamente Excedido (Firebase)</span>
                    </div>
                    <p className="leading-relaxed text-slate-300">
                      O servidor de banco de dados gratuito atingiu o limite de consultas diárias. 
                      Isso ocorreu porque a versão anterior possuía um loop automático de sincronização instantânea em segundo plano que acabou consumindo todas as requisições permitidas.
                    </p>
                    <p className="leading-relaxed text-slate-300 mt-2 font-semibold text-yellow-400">
                      ✨ A boa notícia: Acabamos de subir uma correção definitiva para eliminar esse loop de consumo!
                    </p>
                    <p className="leading-relaxed text-slate-300 mt-2">
                      O Firebase redefine esse limite gratuito automaticamente nas próximas horas (no dia seguinte). 
                      Enquanto isso, <strong>não se preocupe: você pode continuar marcando suas figurinhas normalmente!</strong> 
                      Seu progresso será salvo offline no seu próprio celular, e a nuvem voltará a sincronizar quando a cota expirar e reiniciar.
                    </p>
                  </div>
                ) : (
                  <div className="p-3 bg-red-950 border border-red-900 text-red-300 rounded-xl text-xs flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Ocorreu um erro de sincronização: {syncError}</span>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
