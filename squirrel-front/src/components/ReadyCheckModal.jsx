import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "../store";
import { sendReady } from "../ws/client";

export default function ReadyCheckModal() {
  const readyCheckActive = useGameStore((s) => s.readyCheckActive);
  const readyPlayers = useGameStore((s) => s.readyPlayers) || [];
  const readyExpiresAt = useGameStore((s) => s.readyExpiresAt);
  const readyCheckPlayers = useGameStore((s) => s.readyCheckPlayers) || [];
  const user = useGameStore((s) => s.user);

  const [timeLeft, setTimeLeft] = useState(20);
  const [accepted, setAccepted] = useState(false);

  // Сброс `accepted` при новом показе
  useEffect(() => {
    if (readyCheckActive) {
      setAccepted(false);
    }
  }, [readyCheckActive]);

  useEffect(() => {
    if (!readyCheckActive || !readyExpiresAt) return;

    const interval = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = Math.max(0, readyExpiresAt - now);
      setTimeLeft(remaining);
      if (remaining === 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [readyCheckActive, readyExpiresAt]);

  if (!readyCheckActive) return null;

  const handleAccept = () => {
    if (accepted) return;
    setAccepted(true);
    const readyRoomId = useGameStore.getState().readyRoomId;
    if (readyRoomId) {
      sendReady(readyRoomId);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="bg-gray-900 border border-gray-700/50 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 h-1 bg-gray-800 w-full">
            <motion.div 
              className="h-full bg-emerald-500"
              initial={{ width: "100%" }}
              animate={{ width: `${(timeLeft / 20) * 100}%` }}
              transition={{ duration: 1, ease: "linear" }}
            />
          </div>

          <div className="text-center mt-2 mb-6">
            <h2 className="text-2xl font-black text-white mb-2">Игра найдена!</h2>
            <p className="text-gray-400 text-sm">
              Подтвердите готовность начать матч
            </p>
          </div>

          <div className="flex justify-center mb-8">
            <div className="text-5xl font-black text-emerald-400 font-mono tracking-tighter drop-shadow-[0_0_15px_rgba(52,211,153,0.5)]">
              {timeLeft}
            </div>
            <span className="text-xl text-gray-500 ml-1 mt-auto mb-1">сек</span>
          </div>

          <div className="flex justify-between mb-8 px-4">
            {[0, 1, 2, 3].map((i) => {
              const player = readyCheckPlayers[i];
              // Fallback to checking length if `player` is missing for some reason
              const isReady = player ? readyPlayers.includes(player.id) : (i < readyPlayers.length);
              
              return (
                <div key={i} className="flex flex-col items-center gap-2">
                  <div className={`relative w-14 h-14 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${isReady ? 'border-emerald-500 shadow-[0_0_15px_rgba(52,211,153,0.6)]' : 'border-gray-700 bg-gray-800'}`}>
                    {player ? (
                      <img 
                        src={player.photo_url || player.avatar || `https://api.dicebear.com/7.x/thumbs/svg?seed=${player.username || player.id}`}
                        alt={player.username || "avatar"}
                        className={`w-full h-full rounded-full object-cover transition-all ${isReady ? "" : "opacity-40 grayscale"}`}
                      />
                    ) : (
                      isReady ? <span className="text-2xl text-emerald-400">✓</span> : <span className="text-gray-600 text-sm animate-pulse">Wait</span>
                    )}
                    {isReady && player && (
                      <div className="absolute -bottom-1 -right-1 bg-emerald-500 rounded-full w-5 h-5 flex items-center justify-center shadow-lg border border-gray-900">
                        <span className="text-xs text-white">✓</span>
                      </div>
                    )}
                  </div>
                  {player && (
                    <span className="text-[10px] text-gray-400 font-medium w-16 truncate text-center">
                      {player.username || `Player ${i+1}`}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <button
            onClick={handleAccept}
            disabled={accepted}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
              accepted 
                ? "bg-gray-800 text-emerald-500 border border-emerald-900/50" 
                : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_20px_rgba(52,211,153,0.3)] active:scale-[0.98]"
            }`}
          >
            {accepted ? "Ожидание других..." : "ГОТОВ"}
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
