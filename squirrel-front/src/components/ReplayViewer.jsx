import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CardFace, PlayerBadge, GameHeader, getBackground } from '../Game';

export default function ReplayViewer({ replayData, onClose }) {
  const { events, players } = replayData;
  const [currentEventIdx, setCurrentEventIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Auto-play interval
  React.useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setCurrentEventIdx((prev) => {
        if (prev >= events.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1500); // 1.5s per step
    return () => clearInterval(timer);
  }, [isPlaying, events.length]);

  // Compute state incrementally up to currentEventIdx
  const gameState = useMemo(() => {
    const state = {
      hands: { North: [], East: [], South: [], West: [] },
      trick: [],
      lastTrick: [],
      scores: { kaskyr: 0, uzi: 0 },
      eyes: { kaskyr: 0, uzi: 0 },
      lastWinner: null,
      message: "Игра началась",
      trump: "Spades", // Default fallback if not found
    };

    const getCardPoints = (rank) => {
        if (rank === "A" || rank === "Ace") return 11;
        if (rank === "10" || rank === "Ten") return 10;
        if (rank === "K" || rank === "King") return 4;
        if (rank === "Q" || rank === "Queen") return 3;
        if (rank === "J" || rank === "Jack") return 2;
        return 0;
    };

    const posMap = { North: 0, East: 1, South: 2, West: 3 };
    const getTeam = (pos) => (players[posMap[pos]]?.team?.toLowerCase() === 'uzi' ? 'uzi' : 'kaskyr');

    for (let i = 0; i <= currentEventIdx; i++) {
        const ev = events[i];
        if (!ev) continue;
        
        switch (ev.type) {
            case "RoundStart":
                state.hands = JSON.parse(JSON.stringify(ev.hands));
                state.trick = [];
                state.lastTrick = [];
                state.scores = { kaskyr: 0, uzi: 0 };
                state.lastWinner = null;
                state.message = "Начало раунда";
                state.trump = ev.trump || state.trump;
                break;
            case "PlayCard":
                // remove card from hand
                if (state.hands[ev.position]) {
                    state.hands[ev.position] = state.hands[ev.position].filter(
                        c => !(c.rank === ev.card.rank && c.suit === ev.card.suit)
                    );
                }
                state.trick.push({ position: ev.position, card: ev.card });
                state.message = `${ev.position} сыграл карту`;
                break;
            case "TrickWon":
                state.message = `${ev.position} забрал взятку!`;
                state.lastWinner = ev.position;

                // Calculate points for the trick
                let pts = 0;
                state.trick.forEach(t => pts += getCardPoints(t.card.rank));
                
                // Assign to team
                const team = getTeam(ev.position);
                state.scores[team] += pts;

                // GameHeader expects array of [pos, card]
                state.lastTrick = state.trick.map(t => [t.position, t.card]);
                state.trick = []; 
                break;
            case "RoundEnd":
                state.message = "Раунд завершен";
                if (ev.scores) {
                  state.scores = { kaskyr: ev.scores.Kaskyr || 0, uzi: ev.scores.Uzi || 0 };
                }
                if (ev.eyes) {
                  state.eyes = { kaskyr: ev.eyes.Kaskyr || 0, uzi: ev.eyes.Uzi || 0 };
                }
                break;
            default: break;
        }
    }
    return state;
  }, [events, currentEventIdx]);

  const mapPosToPlayer = (pos) => {
      // In a real replay, if you saved positions, you'd match by 'pos'
      const posMap = { North: 0, East: 1, South: 2, West: 3 };
      const fallbackPlayer = players[posMap[pos]] || { username: pos, team: "kaskyr" };
      return {
          position: pos,
          team: fallbackPlayer.team?.toLowerCase() === 'uzi' ? 'uzi' : 'kaskyr',
          meta: {
              id: fallbackPlayer.telegram_id,
              username: fallbackPlayer.username || "Игрок",
              photo_url: fallbackPlayer.avatar || `https://api.dicebear.com/7.x/thumbs/svg?seed=${fallbackPlayer.telegram_id}`
          }
      };
  };

  const handleNext = () => {
    if (currentEventIdx < events.length - 1) setCurrentEventIdx(prev => prev + 1);
  };

  const handlePrev = () => {
    if (currentEventIdx > 0) setCurrentEventIdx(prev => prev - 1);
  };

  const togglePlay = () => setIsPlaying(!isPlaying);

  const bgTheme = getBackground("neon_table");
  const deck = "neon";

  const getHandGap = (count) => {
    if (count <= 3) return "-20px";
    if (count <= 5) return "-25px";
    if (count <= 8) return "-35px";
    return "-45px";
  };

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[100] flex justify-center bg-[#0a0a0a] overflow-hidden">
       {bgTheme.type === "image" && (
         <>
           <img src={bgTheme.image} alt="bg" className="pointer-events-none absolute inset-0 opacity-70 blur-[2px] scale-105 z-0 h-full w-full object-cover" />
           <div className={`pointer-events-none absolute inset-0 z-0 ${bgTheme.overlayClass || "bg-black/60"}`} />
         </>
       )}
       {bgTheme.type !== "image" && (
         <div className={`absolute inset-0 z-0 ${bgTheme.base} ${bgTheme.glow}`}></div>
       )}

       <button 
           onClick={onClose} 
           className="absolute top-safe-8 right-4 sm:top-6 sm:right-6 z-[60] text-white bg-black/50 hover:bg-black/70 rounded-full w-10 h-10 flex items-center justify-center backdrop-blur-md border border-white/10 transition shadow-xl active:scale-95"
       >
           ✕
       </button>

       {/* Main Playing Area Container */}
       <div className="relative isolate w-full sm:max-w-md h-full flex flex-col justify-start pb-48 z-10 overflow-y-auto no-scrollbar pt-safe-4">

          <GameHeader
            scores={gameState.scores}
            eyes={gameState.eyes}
            lastTrick={gameState.lastTrick}
            deck={deck}
          />

          <h2 className="text-center text-sm font-bold text-fuchsia-400 mb-1 truncate mt-2">
              Ход {currentEventIdx + 1} из {events.length} — {gameState.message}
          </h2>

          <div className="flex-1 flex flex-col justify-center">
             <div className="flex justify-center shrink-0">
                <PlayerBadge player={mapPosToPlayer("North")} seat="top" />
             </div>
             <div className="flex justify-center scale-[0.55] sm:scale-75 origin-top mt-1 mb-2 items-center pointer-events-none h-16">
                 {gameState.hands["North"]?.map((card, i) => (
                    <div key={i} style={{ marginLeft: i === 0 ? "0px" : "-35px" }}>
                        <CardFace card={card} compact theme={deck} />
                    </div>
                 ))}
             </div>

          <div className="flex-1 flex justify-between items-center my-4 min-h-[160px]">
             
             {/* Left Player */}
             <div className="flex flex-col items-center">
                 <PlayerBadge player={mapPosToPlayer("West")} seat="left" />
                 <div className="flex flex-col mt-2 scale-[0.6] origin-top pointer-events-none">
                     {gameState.hands["West"]?.map((card, i) => (
                        <div key={i} style={{ marginTop: i === 0 ? "0px" : "-45px" }}>
                            <CardFace card={card} compact theme={deck} />
                        </div>
                     ))}
                 </div>
             </div>

             {/* Center Table Trick */}
             <div className="relative w-40 h-48 flex items-center justify-center">
                 {gameState.trick.map((t, idx) => {
                     const isTop = t.position === "North";
                     const isBot = t.position === "South";
                     const isLeft = t.position === "West";
                     const isRight = t.position === "East";

                     const y = isTop ? -30 : isBot ? 30 : 0;
                     const x = isLeft ? -30 : isRight ? 30 : 0;
                     
                     return (
                         <motion.div
                           key={`${idx}-${t.card.suit}-${t.card.rank}`}
                           initial={{ opacity: 0, scale: 0.5 }}
                           animate={{ opacity: 1, scale: 1, x, y }}
                           className="absolute shadow-2xl z-10"
                         >
                            <CardFace card={t.card} theme={deck} className="w-14 h-20 text-md" />
                         </motion.div>
                     );
                 })}
             </div>

             {/* Right Player */}
             <div className="flex flex-col items-center">
                 <PlayerBadge player={mapPosToPlayer("East")} seat="right" />
                 <div className="flex flex-col mt-2 scale-[0.6] origin-top pointer-events-none">
                     {gameState.hands["East"]?.map((card, i) => (
                        <div key={i} style={{ marginTop: i === 0 ? "0px" : "-45px" }}>
                            <CardFace card={card} compact theme={deck} />
                        </div>
                     ))}
                 </div>
             </div>
          </div>

          {/* Bottom Player */}
          <div className="mt-auto flex flex-col items-center shrink-0 pt-4 h-[120px] sm:h-[150px]">
             <PlayerBadge player={mapPosToPlayer("South")} seat="bottom" />
             <div className="flex justify-center items-center mt-3 scale-75 origin-top sm:scale-100 pointer-events-none">
                {gameState.hands["South"]?.map((card, i) => {
                    const rotate = (i - (gameState.hands["South"].length - 1) / 2) * 5;
                    const marginLeft = i === 0 ? "0px" : getHandGap(gameState.hands["South"].length);
                    return (
                        <motion.div
                            key={i}
                            style={{ transform: `rotate(${rotate}deg)`, marginLeft }}
                        >
                            <CardFace card={card} compact theme={deck} />
                        </motion.div>
                    );
                })}
             </div>
          </div>
          </div>
       </div>

       {/* Floating Playback Controls (Glassmorphism Bottom Bar) */}
       <div className="absolute bottom-0 inset-x-0 w-full flex flex-col justify-end items-center z-[80] pointer-events-none">
          <div className="w-full sm:max-w-xl px-4 flex flex-col gap-2 pointer-events-auto backdrop-blur-md bg-black/50 pt-3 pb-safe-6 rounded-t-3xl border-t border-white/10 shadow-[0_-20px_40px_rgba(0,0,0,0.6)]">
              
              <div className="flex flex-col items-center">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-fuchsia-400 mb-1">Таймлайн</span>
                  <div className="flex items-center gap-3 w-full">
                      <span className="text-xs text-white font-bold w-4 text-right">{currentEventIdx}</span>
                      <input 
                          type="range" 
                          min="0" 
                          max={events.length > 0 ? events.length - 1 : 0} 
                          value={currentEventIdx} 
                          onChange={(e) => setCurrentEventIdx(parseInt(e.target.value))}
                          className="flex-1 accent-fuchsia-500 h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer"
                      />
                      <span className="text-xs text-gray-400 font-bold w-4">{events.length > 0 ? events.length - 1 : 0}</span>
                  </div>
              </div>

              <div className="flex justify-center items-center gap-6">
                <button 
                    onClick={handlePrev} disabled={currentEventIdx === 0}
                    className="w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 disabled:opacity-30 rounded-full text-white transition active:scale-90"
                >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z"/></svg>
                </button>

                <button 
                    onClick={togglePlay} 
                    className="w-14 h-14 bg-gradient-to-br from-fuchsia-500 to-purple-600 hover:scale-105 rounded-full text-white font-black transition shadow-[0_0_15px_rgba(168,85,247,0.4)] active:scale-95 flex items-center justify-center"
                >
                    {isPlaying ? (
                        <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                    ) : (
                        <svg className="w-7 h-7 translate-x-[2px]" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    )}
                </button>

                <button 
                    onClick={handleNext} disabled={currentEventIdx === events.length - 1}
                    className="w-12 h-12 flex items-center justify-center bg-white/10 hover:bg-white/20 disabled:opacity-30 rounded-full text-white transition active:scale-90"
                >
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg>
                </button>
              </div>
          </div>
       </div>

    </div>,
    document.body
  );
}
