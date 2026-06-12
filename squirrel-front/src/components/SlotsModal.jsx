import React, { useState } from "react";
import ReactDOM from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { getUrl } from "../config/settings";
import { useGameStore } from "../store";

const SYMBOLS = ["🍒", "💎", "🃏", "💰", "🍋", "🔔", "🐿️", "🧨"];
const SPIN_DURATION = 3500; // max 3.5 seconds for dramatic multi-reel stops
const EXTRA_SPIN_SYMBOLS = 30; // Number of dummy symbols to create the blur effect

export default function SlotsModal({ onClose }) {
  const [betAmount, setBetAmount] = useState(5);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [spinKey, setSpinKey] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  const user = useGameStore(state => state.user);
  const setUser = useGameStore(state => state.setUser);

  const [freeSpins, setFreeSpins] = useState(0);
  const [displayWin, setDisplayWin] = useState(0); // For CountUp effect
  const [shake, setShake] = useState(false);
  const [autoSpin, setAutoSpin] = useState(false);
  const autoSpinRef = React.useRef(autoSpin);
  autoSpinRef.current = autoSpin;
  const [jackpot, setJackpot] = useState(100000);

  // Initialize with 3 arrays of 3 symbols (columns)
  const [reels, setReels] = useState(() => {
    return [0, 1, 2].map(() => ["🍒", "🍋", "💰"]);
  });

  const bets = [5, 50, 300];

  // Dynamically update grid size when bet changes
  React.useEffect(() => {
    let cols = 3; let rows = 3;
    if (betAmount === 50) { cols = 5; rows = 3; }
    if (betAmount === 300) { cols = 5; rows = 5; }
    const newReels = [];
    for(let c = 0; c < cols; c++) {
      const col = [];
      for(let r = 0; r < rows; r++) col.push(SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
      newReels.push(col);
    }
    setReels(newReels);
    setResult(null);
  }, [betAmount]);

  const handleSpin = async () => {
    if (spinning) return;
    setErrorMsg("");
    setSpinning(true);
    setResult(null);
    setDisplayWin(0);

    try {
      const token = localStorage.getItem("access_token");
      const res = await axios.post(getUrl("/v1/slots/spin"), { bet_amount: betAmount }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const rows = res.data.symbols.length;
      const cols = res.data.symbols[0].length;
      
      const newReels = [];
      for(let c = 0; c < cols; c++) {
        const currentStrip = reels[c] || [];
        const oldVisible = [];
        for(let r = 0; r < rows; r++) {
          // If we had a smaller grid before, fallback to random
          oldVisible.push(currentStrip[currentStrip.length - rows + r] || SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
        }

        const strip = [...oldVisible];
        for(let i=0; i<EXTRA_SPIN_SYMBOLS; i++) {
          strip.push(SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
        }
        for(let r=0; r<rows; r++) {
          strip.push(res.data.symbols[r][c]);
        }
        newReels.push(strip);
      }

      setReels(newReels);
      setSpinKey(k => k + 1); // Remounts reels at Y=0 (which visually matches old visible)
      
      setTimeout(() => {
        if (user) setUser({ ...user, free_coins: res.data.new_balance });
        setResult(res.data);
        setSpinning(false);
        setFreeSpins(res.data.free_spins_remaining || 0);
        if (res.data.current_jackpot) setJackpot(res.data.current_jackpot);

        if (res.data.win_amount > 0) {
          // CountUp Effect
          let current = 0;
          const step = Math.ceil(res.data.win_amount / 30);
          const interval = setInterval(() => {
            current += step;
            if (current >= res.data.win_amount) {
              current = res.data.win_amount;
              clearInterval(interval);
            }
            setDisplayWin(current);
          }, 30);
        }

        // Screen shake on big events
        if (res.data.win_type === "jackpot" || res.data.win_type === "x10" || res.data.free_spins_awarded > 0 || res.data.win_type === "free_spins") {
          setShake(true);
          setTimeout(() => setShake(false), 800);
        }

        // Auto spin logic (via button click to avoid stale closures)
        const remainingFreeSpins = res.data.free_spins_remaining || 0;
        if (remainingFreeSpins > 0 || autoSpinRef.current) {
          setTimeout(() => {
            document.getElementById("spin-button")?.click();
          }, 1500);
        }

      }, SPIN_DURATION);

    } catch (e) {
      setSpinning(false);
      setErrorMsg(e.response?.data || "Ошибка при прокрутке");
    }
  };

  const renderColumn = (colIndex) => {
    const strip = reels[colIndex];
    if (!strip) return null;
    
    const rows = betAmount === 300 ? 5 : 3;
    const symbolHeight = betAmount === 300 ? 50 : 80;
    const targetY = -(strip.length - rows) * symbolHeight;
    const colHeight = rows * symbolHeight;
    const fontSize = betAmount === 300 ? 'text-4xl sm:text-5xl' : 'text-5xl sm:text-6xl';

    return (
      <div 
        key={colIndex} 
        className={`flex-1 min-w-[50px] max-w-[85px] bg-black/80 rounded-xl overflow-hidden relative border-2 border-[#1c1c2e] shadow-[inset_0_0_30px_rgba(0,0,0,1)] transition-all`} 
        style={{ height: colHeight }}
      >
        <motion.div
          key={spinKey}
          initial={{ y: 0 }}
          animate={{ y: targetY }}
          transition={{
            duration: 1.5 + colIndex * 0.4, // Increased delay for suspense
            ease: [0.15, 0.85, 0.3, 1.05], // custom cubic bezier for overshoot / bounce
          }}
          className={`absolute inset-x-0 flex flex-col items-center ${fontSize}`}
          style={{ lineHeight: `${symbolHeight}px` }}
        >
          {strip.map((symbol, i) => {
            const isFinal = i >= strip.length - rows;
            const rowIndex = i - (strip.length - rows);
            
            let isDimmed = false;
            let isWinningSlot = false;

            if (isFinal && !spinning && result) {
              if (result.win_cells && result.win_cells.length > 0) {
                isWinningSlot = result.win_cells.some(cell => cell[0] === rowIndex && cell[1] === colIndex);
                isDimmed = !isWinningSlot;
              } else {
                isDimmed = true; // dim all if complete loss
              }
            }

            return (
              <motion.div 
                key={i}
                animate={isWinningSlot ? { scale: [1, 1.25, 1], rotate: [0, -5, 5, 0] } : false}
                transition={{ duration: 0.6, repeat: Infinity, repeatType: "reverse" }}
                className={`w-full flex items-center justify-center transition-all duration-500 
                  ${isDimmed ? 'opacity-20 grayscale brightness-50' : 'opacity-100'}
                  ${isWinningSlot ? 'drop-shadow-[0_0_25px_rgba(251,191,36,1)] z-10' : ''}
                `}
                style={{ height: `${symbolHeight}px` }}
              >
                {symbol}
              </motion.div>
            );
          })}
        </motion.div>
        
        {/* Glow effect on top and bottom to simulate round drum */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/90 via-transparent to-black/90 z-20"></div>

        {/* Win cell individual indicator */}
        {!spinning && result?.win_cells && result.win_cells.some(c => c[1] === colIndex) && (
          <>
            {result.win_cells.filter(c => c[1] === colIndex).map(c => (
              <motion.div 
                key={c[0]}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute left-0 right-0 border-[4px] border-emerald-400 shadow-[0_0_30px_rgba(52,211,153,0.9),inset_0_0_20px_rgba(52,211,153,0.4)] pointer-events-none z-30 bg-emerald-400/20 rounded-xl"
                style={{ top: `${c[0] * symbolHeight}px`, height: `${symbolHeight}px` }}
              />
            ))}
          </>
        )}
      </div>
    );
  };

  const getResultText = () => {
    if (!result) return null;
    if (result.win_type === "free_spins") return <span className="text-pink-400 font-black text-2xl drop-shadow-[0_0_15px_rgba(236,72,153,0.8)]">ФРИСПИНЫ! +{result.free_spins_awarded} 🌀</span>;
    if (result.win_type === "jackpot") return <span className="text-amber-400 font-black text-2xl drop-shadow-[0_0_15px_rgba(251,191,36,0.8)]">ДЖЕКПОТ! +{displayWin} 🌰</span>;
    if (result.win_type === "cosmetic" && result.cosmetic_item) return <span className="text-purple-400 font-black text-lg drop-shadow-[0_0_15px_rgba(168,85,247,0.8)]">Вы выиграли: {result.cosmetic_item.title}! +{displayWin} 🌰</span>;
    if (result.win_type === "x10") return <span className="text-cyan-400 font-black text-xl drop-shadow-[0_0_15px_rgba(34,211,238,0.8)]">МЕГА ВЫИГРЫШ! +{displayWin} 🌰</span>;
    if (result.win_type === "x2") return <span className="text-emerald-400 font-black text-xl drop-shadow-[0_0_15px_rgba(52,211,153,0.8)]">КОМБО! +{displayWin} 🌰</span>;
    if (result.free_spins_awarded > 0 && displayWin > 0) return <span className="text-pink-400 font-black text-xl drop-shadow-[0_0_15px_rgba(236,72,153,0.8)]">ВЫИГРЫШ + ФРИСПИНЫ! +{displayWin} 🌰</span>;
    return <span className="text-gray-500 font-bold">Удача где-то рядом...</span>;
  };

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl p-2 sm:p-4">
      <motion.div 
        initial={{ scale: 0.8, opacity: 0, y: 50 }}
        animate={shake ? { x: [-10, 10, -10, 10, 0], y: [-5, 5, -5, 5, 0], scale: 1, opacity: 1 } : { scale: 1, opacity: 1, y: 0, x: 0 }}
        exit={{ scale: 0.8, opacity: 0, y: 50 }}
        transition={{ 
          scale: { type: "spring", damping: 20 },
          opacity: { type: "spring", damping: 20 },
          y: shake ? { duration: 0.4 } : { type: "spring", damping: 20 },
          x: shake ? { duration: 0.4 } : { type: "spring", damping: 20 }
        }}
        className="bg-gradient-to-b from-[#1c1c2e] to-[#0a0a12] w-full max-w-2xl max-h-[95vh] rounded-[30px] sm:rounded-[40px] border-[4px] border-[#2a2a40] shadow-[0_20px_70px_rgba(0,0,0,0.8),inset_0_2px_10px_rgba(255,255,255,0.1)] overflow-y-auto flex flex-col relative transition-all hide-scrollbar"
      >
        <button onClick={onClose} className="absolute top-4 right-4 sm:top-6 sm:right-6 w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all z-20 text-xl font-bold">✕</button>
        
        {/* Machine Header */}
        <div className="pt-8 pb-2 sm:pt-10 sm:pb-4 text-center relative z-10 shrink-0 flex flex-col items-center">
          <h2 className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-500 to-amber-300 mb-1 uppercase tracking-[0.2em] drop-shadow-[0_0_15px_rgba(251,191,36,0.6)]">
            СЛОТЫ
          </h2>
          
          <div className="bg-gradient-to-br from-amber-900/80 to-black/80 border-2 border-amber-500/50 rounded-xl px-5 py-2 mt-2 mb-2 text-center shadow-[0_0_20px_rgba(251,191,36,0.3)] min-w-[220px]">
            <div className="text-[10px] sm:text-xs text-amber-400 font-bold uppercase tracking-wider mb-0.5">Глобальный Джекпот</div>
            <div className="text-xl sm:text-2xl font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{jackpot.toLocaleString('ru-RU')} 🌰</div>
          </div>

          {freeSpins > 0 && (
            <div className="mt-1 bg-pink-500 text-white font-black px-4 py-1 rounded-full text-sm shadow-[0_0_15px_rgba(236,72,153,0.8)] animate-pulse border-2 border-pink-300 inline-block">
              {freeSpins} ФРИСПИНОВ
            </div>
          )}
        </div>

        <div className="px-4 sm:px-6 pb-6 sm:pb-8 relative flex-1 flex flex-col justify-center">
          
          {/* Main Slots Area */}
          <div className="bg-[#050508] p-3 sm:p-5 rounded-[20px] sm:rounded-[30px] border-[4px] sm:border-[6px] border-[#222233] shadow-[inset_0_0_50px_rgba(0,0,0,1),0_10px_30px_rgba(0,0,0,0.5)] mb-4 sm:mb-6 relative shrink-0">
            
            {/* Win overlay effect */}
            <AnimatePresence>
              {!spinning && result && result.win_amount > 0 && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-50 pointer-events-none rounded-[24px] flex items-center justify-center overflow-hidden"
                >
                  <div className="absolute inset-0 bg-amber-500/10"></div>
                  <div className="absolute inset-0 border-[6px] border-amber-400/80 rounded-[24px] animate-pulse shadow-[inset_0_0_40px_rgba(251,191,36,0.4)]"></div>
                  
                  {/* Radial Glow */}
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.4)_0%,transparent_70%)] z-40 pointer-events-none"
                  ></motion.div>
                  
                  {/* Big Win Text Pop */}
                  {(result.win_type === "x10" || result.win_type === "jackpot") && (
                    <motion.div 
                      initial={{ scale: 0, rotate: -10 }}
                      animate={{ scale: [1, 1.1, 1], rotate: [-6, -4, -6] }}
                      transition={{ scale: { type: "spring", damping: 6, mass: 0.8, stiffness: 100 }, rotate: { duration: 2, repeat: Infinity } }}
                      className="absolute z-50 text-5xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-amber-600 drop-shadow-[0_10px_20px_rgba(0,0,0,1)] -rotate-6"
                      style={{ WebkitTextStroke: "2px #b45309" }}
                    >
                      {result.win_type === "jackpot" ? "JACKPOT!" : "MEGA COMBO!"}
                    </motion.div>
                  )}

                  {/* Confetti and Coins particles */}
                  {[...Array(40)].map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ y: -50, x: 0, opacity: 1, scale: 0 }}
                      animate={{ 
                        y: [0, -100 - Math.random() * 200, 400], 
                        x: [0, (Math.random() - 0.5) * 400, (Math.random() - 0.5) * 600],
                        opacity: [1, 1, 0],
                        scale: [0, Math.random() * 1.5 + 0.5, 0.5],
                        rotate: [0, Math.random() * 720]
                      }}
                      transition={{ duration: 2.5 + Math.random(), ease: "easeOut", repeat: Infinity, repeatDelay: Math.random() * 0.5 }}
                      className={`absolute z-50 ${i % 3 === 0 ? 'text-2xl drop-shadow-md' : 'w-4 h-4 rounded-sm shadow-[0_0_15px_#f59e0b]'}`}
                      style={i % 3 === 0 ? {} : { backgroundColor: ['#f59e0b', '#ec4899', '#3b82f6', '#10b981'][Math.floor(Math.random() * 4)] }}
                    >
                      {i % 3 === 0 ? '🌰' : ''}
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex justify-center gap-1 sm:gap-2 transition-all duration-300 w-full overflow-hidden">
              {reels.map((_, i) => renderColumn(i))}
            </div>
            
            <div className="mt-3 sm:mt-5 h-10 sm:h-12 flex items-center justify-center bg-black/60 rounded-xl shadow-inner border border-white/5 shrink-0">
              {getResultText()}
              {errorMsg && <span className="text-red-500 font-bold bg-red-500/10 px-4 py-1 rounded-lg border border-red-500/20">{errorMsg}</span>}
            </div>
          </div>

          <div className="space-y-4 sm:space-y-5 relative z-10 shrink-0 mt-auto">
            <div className="flex justify-center gap-2 sm:gap-4">
              {bets.map(b => (
                <button 
                  key={b}
                  onClick={() => !spinning && setBetAmount(b)}
                  disabled={spinning}
                  className={`px-3 py-2 sm:px-5 sm:py-3 rounded-xl sm:rounded-2xl font-black text-base sm:text-lg transition-all duration-300 flex-1 max-w-[100px] ${betAmount === b ? 'bg-gradient-to-b from-amber-400 to-amber-600 text-black shadow-[0_0_20px_rgba(251,191,36,0.6),inset_0_2px_5px_rgba(255,255,255,0.5)] scale-105 sm:scale-110 -translate-y-1' : 'bg-[#2a2a40] text-white/50 border border-white/5 hover:bg-[#32324a] hover:text-white shadow-inner'}`}
                >
                  {b} 🌰
                </button>
              ))}
            </div>

            <div className="flex gap-2 sm:gap-4">
              <button 
                id="spin-button"
                onClick={handleSpin}
                disabled={spinning}
                className={`flex-1 py-4 sm:py-5 rounded-[20px] sm:rounded-[24px] font-black text-2xl sm:text-3xl uppercase tracking-widest transition-all duration-150 
                  ${spinning 
                    ? 'bg-[#2a2a40] text-white/20 cursor-not-allowed shadow-inner translate-y-2' 
                    : freeSpins > 0
                      ? 'bg-gradient-to-b from-pink-400 to-pink-600 text-white shadow-[0_10px_0_#831843,0_15px_20px_rgba(236,72,153,0.4)] hover:brightness-110 active:translate-y-2 active:shadow-[0_0_0_#831843,0_0_0_rgba(236,72,153,0)]'
                      : 'bg-gradient-to-b from-emerald-400 to-emerald-600 text-white shadow-[0_10px_0_#064e3b,0_15px_20px_rgba(16,185,129,0.4)] hover:brightness-110 active:translate-y-2 active:shadow-[0_0_0_#064e3b,0_0_0_rgba(16,185,129,0)]'
                  }`}
                style={{ textShadow: spinning ? 'none' : '0 2px 4px rgba(0,0,0,0.3)' }}
              >
                {spinning ? 'КРУТИМ...' : freeSpins > 0 ? 'FREE SPIN!' : 'КРУТИТЬ!'}
              </button>

              <button
                onClick={() => setAutoSpin(!autoSpin)}
                className={`w-[80px] sm:w-[100px] flex flex-col items-center justify-center rounded-[20px] sm:rounded-[24px] border-[3px] font-bold text-xs sm:text-sm uppercase transition-all duration-300
                  ${autoSpin 
                    ? 'bg-blue-600/20 border-blue-400 text-blue-400 shadow-[0_0_15px_rgba(96,165,250,0.4),inset_0_0_10px_rgba(96,165,250,0.2)]' 
                    : 'bg-[#2a2a40] border-[#3a3a50] text-white/50 hover:bg-[#32324a]'
                  }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 sm:h-8 sm:w-8 mb-1 ${autoSpin ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Авто
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
