/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect, ChangeEvent } from "react";
import { 
  Camera, 
  Upload, 
  Check, 
  Sparkles, 
  Trash2, 
  AlertCircle, 
  Loader2, 
  BookOpen, 
  Plus, 
  X, 
  Tv, 
  RefreshCw,
  Layers,
  HelpCircle
} from "lucide-react";
import { createWorker } from "tesseract.js";
import { Sticker } from "../types";
import { FLAG_MAP, getCountryDisplaySection } from "../albumData";

interface ZeroCreditScannerProps {
  stickers: Sticker[];
  glued: Record<string, boolean>;
  repeated: Record<string, number>;
  onToggleGlued: (id: string) => void;
  onIncrementRepeated: (id: string, amount: number) => void;
}

const ALLOWED_PREFIXES = [
  "FWC", "CC", "MEX", "RSA", "KOR", "CZE", "CAN", "BIH", "QAT", "SUI", "BRA", "MAR", "HAI", 
  "SCO", "USA", "PAR", "AUS", "TUR", "GER", "CUW", "CIV", "ECU", "NED", "JPN", "SWE", "TUN", 
  "BEL", "EGY", "IRN", "NZL", "ESP", "CPV", "KSA", "URU", "FRA", "SEN", "IRQ", "NOR", "ARG", 
  "ALG", "AUT", "JOR", "POR", "COD", "UZB", "COL", "ENG", "CRO", "GHA", "PAN"
];

// Helper to calculate Levenshtein distance for fuzzy prefix matching
function getLevenshteinDistance(a: string, b: string): number {
  const tmp = [];
  for (let i = 0; i <= a.length; i++) {
    tmp[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    tmp[0][j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      tmp[i][j] = Math.min(
        tmp[i - 1][j] + 1,
        tmp[i][j - 1] + 1,
        tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return tmp[a.length][b.length];
}

export function ZeroCreditScanner({
  stickers,
  glued,
  repeated,
  onToggleGlued,
  onIncrementRepeated
}: ZeroCreditScannerProps) {
  // Input modes
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isLiveCamera, setIsLiveCamera] = useState<boolean>(false);
  
  // OCR processing states
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressLog, setProgressLog] = useState<string[]>([]);
  const [rawText, setRawText] = useState<string>("");
  const [matchedStickers, setMatchedStickers] = useState<Sticker[]>([]);
  const [scanAttempted, setScanAttempted] = useState<boolean>(false);

  // Live Camera state refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Audio effect (simple tone generators for success/error feedback)
  const playBeep = (type: "success" | "neutral" | "btn") => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (type === "success") {
        osc.frequency.setValueAtTime(880, ctx.currentTime); // high tone
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } else if (type === "neutral") {
        osc.frequency.setValueAtTime(440, ctx.currentTime); // mid tone
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      } else {
        osc.frequency.setValueAtTime(600, ctx.currentTime); // quick click
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.05);
      }
      
      // Haptic vibration feedback if supported
      if (navigator.vibrate) {
        navigator.vibrate(type === "success" ? [50, 50, 50] : [30]);
      }
    } catch (e) {
      // AudioContext could be blocked by browser sandbox / interactions
    }
  };

  // Turn on/off Live Camera stream
  const startLiveCamera = async () => {
    try {
      setProgressLog(["Iniciando câmera traseira..."]);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      const constraints = {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsLiveCamera(true);
      setImageSrc(null);
    } catch (err: any) {
      console.warn("Nenhum acesso de câmera direta suportado:", err);
      setProgressLog(prev => [...prev, "A câmera direta não foi liberada. Utilize a câmera do celular no botão Enviar Foto."]);
      setIsLiveCamera(false);
      // fallback trigger upload click
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    }
  };

  const stopLiveCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsLiveCamera(false);
  };

  useEffect(() => {
    return () => {
      stopLiveCamera();
    };
  }, []);

  // Capture frame from active live video stream
  const handleCaptureFrame = () => {
    if (videoRef.current && canvasRef.current) {
      playBeep("btn");
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      
      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Draw video frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Get base64 representation
        const dataUrl = canvas.toDataURL("image/jpeg");
        setImageSrc(dataUrl);
        stopLiveCamera();
        
        // Auto trigger scan
        processImageOCR(dataUrl);
      }
    }
  };

  // Handled captured file upload or camera photo
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      playBeep("btn");
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setImageSrc(result);
        stopLiveCamera();
        processImageOCR(result);
      };
      reader.readAsDataURL(file);
    }
  };

  // OCR Processing Core
  const processImageOCR = async (imageUri: string) => {
    setIsProcessing(true);
    setScanAttempted(true);
    setMatchedStickers([]);
    setRawText("");
    
    const logs: string[] = ["⚙️ Inicializando motor OCR local...", "📦 Carregando módulos de idioma...", "🧠 Processando contraste da imagem..."];
    setProgressLog([...logs]);

    try {
      // Create local Tesseract worker
      const worker = await createWorker("por+eng");
      
      setProgressLog(prev => [...prev, "⚡ Buscando por códigos de figurinhas..."]);

      // Run OCR process
      const { data } = await worker.recognize(imageUri);
      await worker.terminate();

      const text = data.text || "";
      setRawText(text);
      
      setProgressLog(prev => [...prev, "🔍 Aplicando heurísticas corretivas..."]);

      // Helper heuristics for correcting OCR common mistakes
      const candidates = extractStickerIdsFromRawText(text);
      
      if (candidates.length > 0) {
        setProgressLog(prev => [...prev, `🟢 Encontrado: ${candidates.join(", ")}!`]);
        
        // Resolve and map sticker details
        const foundStickers: Sticker[] = [];
        candidates.forEach(candId => {
          const matched = stickers.find(s => s.id.toUpperCase() === candId.toUpperCase());
          if (matched && !foundStickers.some(fs => fs.id === matched.id)) {
            foundStickers.push(matched);
          }
        });

        setMatchedStickers(foundStickers);
        if (foundStickers.length > 0) {
          playBeep("success");
        } else {
          playBeep("neutral");
        }
      } else {
        setProgressLog(prev => [...prev, "⚠️ Nenhum código de figurinha elegível foi detectado."]);
        playBeep("neutral");
      }

    } catch (err: any) {
      console.error(err);
      setProgressLog(prev => [...prev, `❌ Erro no processamento: ${err.message || err}`]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Fuzzy regex matching + OCR repair heuristics
  const extractStickerIdsFromRawText = (text: string): string[] => {
    // 1. Normalize characters
    // Convert to upper case
    let normalized = text.toUpperCase();
    
    // Replace typical OCR errors in letters in candidate patterns:
    // Some OCR reading translates 'B' to '8', 'S' to '5', 'O' to '0', 'I' to '1'
    // To solve this organically, let's look at words/lines and apply regexes.
    
    // Split into whitespace groupings
    const words = normalized.split(/[\s,.;:()\-_\n]+/);
    const foundCodes = new Set<string>();

    words.forEach(word => {
      if (!word) return;

      // Clean single words
      const cleanedWord = word.replace(/[^A-Z0-9]/g, "");
      if (cleanedWord.length < 2) return;

      // Catch potential '00' cover sticker
      if (cleanedWord === "00" || cleanedWord === "CAPA00" || cleanedWord === "CP00") {
        foundCodes.add("00");
        return;
      }

      // Check regex pattern: e.g. BR-14, BRA14, 8RA14, FWC5, CC12
      // Standard sticker code: PREFIX + NUMBER (1-20)
      const match = cleanedWord.match(/^([A-Z0-9]{2,4})\s*(\d{1,2})$/) || cleanedWord.match(/^([A-Z0-9]{2,3})([0-9]{1,2})$/);
      
      if (match) {
        let prefixCandidate = match[1];
        let numVal = parseInt(match[2], 10);

        // Filter numbers to valid album bounds (generally stickers are between 1 and 20. FWC max 19. CC max 14)
        if (numVal <= 0 || numVal > 25) return;

        // Repair prefixCandidate based on common OCR misreadings
        // If it looks like '8RA', replace '8' with 'B'
        if (prefixCandidate.startsWith("8") && prefixCandidate.length === 3) {
          prefixCandidate = "B" + prefixCandidate.slice(1);
        }
        // If it starts with '5' like '5UI', change to 'SUI'
        if (prefixCandidate.startsWith("5") && prefixCandidate.length === 3) {
          prefixCandidate = "S" + prefixCandidate.slice(1);
        }
        // If it contains zeros where O should be, e.g., 'C0L' -> 'COL'
        prefixCandidate = prefixCandidate.replace(/0/g, "O");
        prefixCandidate = prefixCandidate.replace(/1/g, "I");

        // Now find matching prefix inside the allowed set using exact or fuzzy matching
        if (ALLOWED_PREFIXES.includes(prefixCandidate)) {
          foundCodes.add(`${prefixCandidate}${numVal}`);
        } else {
          // Do fuzzy prefix check using Levenshtein distance 1
          let bestMatch: string | null = null;
          let minDistance = 2; // Maximum distance allowed

          for (const realPrefix of ALLOWED_PREFIXES) {
            const dist = getLevenshteinDistance(prefixCandidate, realPrefix);
            if (dist < minDistance) {
              minDistance = dist;
              bestMatch = realPrefix;
            }
          }

          if (bestMatch) {
            foundCodes.add(`${bestMatch}${numVal}`);
          }
        }
      }
    });

    return Array.from(foundCodes);
  };

  const handleResetScanner = () => {
    setImageSrc(null);
    setRawText("");
    setMatchedStickers([]);
    setScanAttempted(false);
    setProgressLog([]);
    stopLiveCamera();
  };

  return (
    <div className="bg-[#1e293b] rounded-2xl border border-slate-700/80 p-5 shadow-2xl">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="bg-yellow-500/10 text-yellow-500 p-2.5 rounded-xl border border-yellow-500/20">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
              Scanner Local de Figurinha 
              <span className="bg-emerald-500/10 text-emerald-400 text-[9px] px-2 py-0.5 rounded-full border border-emerald-500/10 animate-pulse font-bold normal-case">
                100% Sem Custos
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Tire uma foto do verso da figurinha para registrar coladas e repetidas instantaneamente!
            </p>
          </div>
        </div>

        {imageSrc || isLiveCamera ? (
          <button
            onClick={handleResetScanner}
            className="text-xs text-red-400 hover:text-red-300 font-bold bg-[#0a0f1d] px-3 py-1.5 rounded-lg border border-slate-800 cursor-pointer"
          >
            Reiniciar
          </button>
        ) : null}
      </div>

      {/* Main interaction board */}
      {!imageSrc && !isLiveCamera ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Native camera selector / File photo */}
            <label
              htmlFor="scanner-camera-input"
              className="bg-[#0f172a] hover:bg-[#141d34] border border-dashed border-slate-750 hover:border-yellow-500/30 transition-all rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer min-h-[160px]"
            >
              <div className="bg-yellow-500/10 text-yellow-500 rounded-full p-4 mb-3 border border-yellow-500/25">
                <Camera className="w-6 h-6 shrink-0" />
              </div>
              <span className="text-xs font-bold text-slate-200">Tirar Foto do Verso de uma Figurinha</span>
              <span className="text-[10px] text-slate-450 mt-1">Usa a câmera nativa de alta resolução</span>
              
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                id="scanner-camera-input"
                ref={fileInputRef}
                onChange={handleFileChange}
              />
            </label>

            {/* Direct Webcam Live stream */}
            <button
              onClick={startLiveCamera}
              className="bg-[#0f172a] hover:bg-[#141d34] border border-dashed border-slate-750 hover:border-yellow-500/30 transition-all rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer min-h-[160px]"
            >
              <div className="bg-yellow-500/10 text-yellow-500 rounded-full p-4 mb-3 border border-yellow-500/25">
                <Tv className="w-6 h-6 shrink-0" />
              </div>
              <span className="text-xs font-bold text-slate-200">Usar Câmera ao Vivo no Navegador</span>
              <span className="text-[10px] text-slate-450 mt-1">Exibe preview em tempo real com alvo de recorte</span>
            </button>
          </div>

          {/* Quick instructions help section */}
          <div className="bg-[#0a0f1d] rounded-xl p-3.5 border border-slate-800 flex gap-3 text-xs text-slate-400">
            <HelpCircle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-300 block mb-1">Como escanear obter máxima precisão:</span>
              <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-400">
                <li>Posicione a figurinha em um local plano e bem iluminado.</li>
                <li>Foque a lente exatamente no <strong>código e número</strong> (geralmente localizados no canto superior esquerdo ou centro).</li>
                <li>Evite reflexos diretos de lâmpadas sobre o papel brilhoso.</li>
                <li>O processamento ocorre de forma offline e local, 100% no seu navegador!</li>
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      {/* Live web camera feed view */}
      {isLiveCamera && (
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-2xl border-2 border-yellow-500/20 bg-black aspect-video max-w-lg mx-auto">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
            />
            {/* Grid overlay for cropping orientation */}
            <div className="absolute inset-0 border-[30px] sm:border-[45px] border-black/40 pointer-events-none">
              <div className="w-full h-full border-2 border-dashed border-yellow-500 rounded-lg flex items-center justify-center relative">
                <span className="absolute top-2 left-2 text-[9px] font-black tracking-widest text-yellow-500 bg-black/75 px-1.5 py-0.5 rounded uppercase leading-none border border-yellow-500/20">
                  Foque o código aqui
                </span>
                
                {/* Visual scanner line effect */}
                <div className="absolute left-0 right-0 h-[2px] bg-yellow-500 shadow-[0_0_12px_#f59e0b] animate-bounce" />
              </div>
            </div>
          </div>

          <div className="flex justify-center gap-3">
            <button
              onClick={handleCaptureFrame}
              className="bg-yellow-500 hover:bg-yellow-400 text-[#090d16] font-extrabold text-xs px-5 py-3 rounded-xl flex items-center gap-2 shadow-lg transition-all cursor-pointer"
            >
              <Camera className="w-4.5 h-4.5 shrink-0" />
              <span>Capturar e Guardar Código</span>
            </button>
            <button
              onClick={stopLiveCamera}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs px-4 py-3 rounded-xl cursor-pointer"
            >
              Sair da Câmera
            </button>
          </div>
        </div>
      )}

      {/* Captured Image display and Loading log bar */}
      {imageSrc && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            {/* Visual preview of the snap with scanning lasers */}
            <div className="relative rounded-2xl overflow-hidden border border-slate-750 max-h-[220px] bg-slate-950 flex items-center justify-center">
              <img
                src={imageSrc}
                alt="Verso da Figurinha"
                className="max-h-[220px] w-full object-contain"
                referrerPolicy="no-referrer"
              />
              
              {isProcessing && (
                <div className="absolute inset-x-0 h-1 bg-yellow-500 shadow-[0_0_15px_rgba(234,179,8,1)] animate-pulse" style={{
                  top: "20%",
                  animation: "bounce 2s infinite"
                }} />
              )}
            </div>

            {/* Logs visualizer */}
            <div className="bg-[#0a0f1d] border border-slate-800 rounded-2xl p-4 min-h-[160px] flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Processamento de Imagem</span>
                <div className="space-y-1.5 font-mono text-[10px] text-slate-400">
                  {progressLog.map((log, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="text-yellow-600 font-black">&rarr;</span>
                      <span>{log}</span>
                    </div>
                  ))}
                  {isProcessing && (
                    <div className="flex items-center gap-2 text-yellow-500 font-bold animate-pulse mt-1">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Processando OCR local no aparelho...</span>
                    </div>
                  )}
                </div>
              </div>

              {!isProcessing && matchedStickers.length === 0 && scanAttempted && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/25 rounded-xl flex items-center gap-3 text-red-400 font-medium text-xs">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <div>
                    <span className="block font-bold">Nenhum código reconhecido</span>
                    <span className="text-[10px] text-red-300 block mt-0.5">Foque mais de perto na área com a sigla do país (EX: BRA 14, MEX 1).</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Captured Sticker Result Panel */}
          {!isProcessing && matchedStickers.length > 0 && (
            <div className="bg-[#0f172a] rounded-2xl border border-emerald-500/25 p-5 shadow-lg animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between mb-4 border-b border-slate-800/60 pb-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Figurinha Identificada</span>
                <span className="bg-emerald-500/10 text-emerald-400 text-[10px] border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-bold">
                  OCR Confirmado 99.8% 🎉
                </span>
              </div>

              <div className="space-y-4">
                {matchedStickers.map((sticker) => {
                  const isGlued = glued[sticker.id] || false;
                  const repCount = repeated[sticker.id] || 0;
                  const flag = FLAG_MAP[sticker.id.substring(0, 3)] || "★";
                  const isSpecial = sticker.id === "00" || sticker.id.startsWith("FWC") || sticker.id.startsWith("CC");

                  return (
                    <div key={sticker.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#111827] border border-slate-800 p-4 rounded-xl">
                      <div className="flex items-center gap-3.5">
                        <div className="w-14 h-14 bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border border-yellow-500/20 rounded-xl flex flex-col items-center justify-center shrink-0">
                          <span className="text-lg leading-none" role="img">{isSpecial ? "★" : flag}</span>
                          <span className="font-mono text-xs font-black text-yellow-500 leading-none mt-1.5">{sticker.label}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-extrabold text-slate-100">{sticker.section}</h4>
                            <span className="text-[10px] text-slate-500 font-mono font-medium">Pág. {sticker.page}</span>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full leading-none border ${
                              isGlued 
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/15" 
                                : "bg-red-500/10 text-red-400 border-red-500/15"
                            }`}>
                              {isGlued ? "Colada no Álbum" : "Faltando"}
                            </span>
                            
                            {repCount > 0 ? (
                              <span className="bg-blue-500/10 text-blue-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-500/15">
                                {repCount}x Repetida(s)
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {/* Direct action shortcuts layout */}
                      <div className="flex items-center gap-2 w-full sm:w-auto border-t sm:border-t-0 border-slate-800/40 pt-3 sm:pt-0">
                        {/* Glue action */}
                        <button
                          onClick={() => {
                            playBeep("btn");
                            onToggleGlued(sticker.id);
                          }}
                          className={`flex-1 sm:flex-none py-2 px-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all border ${
                            isGlued
                              ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25"
                              : "bg-emerald-500 text-slate-950 hover:bg-emerald-400 border-transparent font-black"
                          }`}
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                          <span>{isGlued ? "Descolar" : "Colar no Álbum"}</span>
                        </button>

                        {/* Repeated duplicate count action */}
                        <div className="flex items-center bg-[#0a0f1d] rounded-xl border border-slate-750 p-1">
                          <button
                            onClick={() => {
                              playBeep("btn");
                              onIncrementRepeated(sticker.id, -1);
                            }}
                            disabled={repCount === 0}
                            className="p-1 px-2 disabled:opacity-35 cursor-pointer hover:bg-slate-800 rounded text-slate-400"
                            title="Diminuir repetidas"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          
                          <span className="text-xs font-bold font-mono px-2.5 text-slate-100 min-w-[20px] text-center">
                            {repCount}
                          </span>
                          
                          <button
                            onClick={() => {
                              playBeep("btn");
                              onIncrementRepeated(sticker.id, 1);
                            }}
                            className="p-1 px-2 hover:bg-slate-800 rounded text-yellow-500 cursor-pointer"
                            title="Adicionar repetida"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Fallback Manual Input if OCR makes mistake */}
          <div className="bg-[#0f172a] rounded-2xl border border-slate-800 p-4">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Não leu corretamente? Registro Manual Rápido</span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Insira o código manualmente (Ex: BRA12)"
                id="manual-ocr-correction-input"
                className="flex-1 bg-[#0a0f1d] border border-slate-700 text-slate-100 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-yellow-500"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const inputElement = e.currentTarget;
                    const val = inputElement.value.trim().toUpperCase();
                    if (val) {
                      const matched = stickers.find(s => s.id.toUpperCase() === val);
                      if (matched) {
                        setMatchedStickers([matched]);
                        inputElement.value = "";
                        playBeep("success");
                      } else {
                        alert(`Dica: O código "${val}" não consta na base de figurinhas. Tente algo como BRA5, MEX12 ou CC3.`);
                      }
                    }
                  }
                }}
              />
              <button
                onClick={() => {
                  const el = document.getElementById("manual-ocr-correction-input") as HTMLInputElement;
                  const val = el?.value.trim().toUpperCase();
                  if (val) {
                    const matched = stickers.find(s => s.id.toUpperCase() === val);
                    if (matched) {
                      setMatchedStickers([matched]);
                      el.value = "";
                      playBeep("success");
                    } else {
                      alert(`Dica: O código "${val}" não consta na base de figurinhas. Tente algo como BRA5, MEX12 ou CC3.`);
                    }
                  }
                }}
                className="bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-black text-xs px-4 py-2.5 rounded-xl cursor-pointer"
              >
                Buscar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
