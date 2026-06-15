import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import axios from "axios";
import { getUrl } from "../config/settings";
import { useGameStore } from "../store";
import { DeckPreview, BackgroundPreview } from "../SearchGame";
import ChestGraphic from "./ChestGraphic";

const chestColors = {
  common: "from-gray-400 to-gray-600 shadow-gray-500",
  rare: "from-blue-400 to-blue-600 shadow-blue-500",
  epic: "from-purple-400 to-purple-600 shadow-purple-500",
  legendary: "from-amber-300 to-red-500 shadow-amber-500",
};

const chestNames = {
  common: "Обычный Сундук",
  rare: "Редкий Сундук",
  epic: "Эпический Сундук",
  legendary: "Легендарный Сундук",
};

export default function ChestOpeningModal({ isOpen, onClose, chestType = "common", onSuccess }) {
  const [phase, setPhase] = useState("idle"); // idle -> shaking -> opening -> reward
  const [rewardData, setRewardData] = useState(null);
  const [isOpening, setIsOpening] = useState(false);
  const [storeData, setStoreData] = useState(null);
  const token = useGameStore((s) => s.token) || localStorage.getItem("access_token");

  useEffect(() => {
    if (isOpen) {
      setPhase("idle");
      setRewardData(null);
      setIsOpening(false);
      
      const token = localStorage.getItem("access_token");
      if (token) {
        axios.get(getUrl("/v1/store"), { headers: { Authorization: `Bearer ${token}` } })
            .then(res => setStoreData(res.data))
            .catch(e => console.error(e));
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOpen = async () => {
    if (phase !== "idle") return;
    setPhase("shaking");

    try {
      // delay for dramatic effect
      setTimeout(async () => {
        const res = await axios.post(
          getUrl("/v1/chests/open"),
          { chest_type: chestType },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setRewardData(res.data);
        setPhase("opening");

        setTimeout(async () => {
          setPhase("reward");
          if (onSuccess) onSuccess(res.data);
          try {
             const ures = await axios.get(getUrl("/auth/me"), { headers: { Authorization: `Bearer ${token}` } });
             useGameStore.getState().setUser(ures.data);
          } catch(e) {}
        }, 1500); // 1.5s the light burst happens
      }, 2000); // 2s shaking
    } catch (e) {
      console.error("Failed to open chest", e);
      setPhase("idle");
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      >
        {phase !== "reward" && (
          <div className="relative flex flex-col items-center">
            {/* Background Glow */}
            <motion.div
              animate={{
                scale: phase === "shaking" ? [1, 1.2, 1] : 1,
                opacity: phase === "opening" ? [1, 2, 0] : 0.4,
              }}
              transition={{ repeat: phase === "shaking" ? Infinity : 0, duration: 0.5 }}
              className={`absolute inset-0 w-64 h-64 mx-auto rounded-full blur-3xl bg-gradient-to-r ${chestColors[chestType]}`}
            />

            {/* Chest Graphic */}
            <motion.div
              onClick={handleOpen}
              animate={
                phase === "shaking"
                  ? { x: [-10, 10, -10, 10, -5, 5, 0], y: [-5, 5, -5, 0], rotate: [-5, 5, -2, 2, 0] }
                  : phase === "opening"
                  ? { scale: [1, 1.5, 0], opacity: [1, 1, 0] }
                  : { y: [0, -10, 0] }
              }
              transition={
                phase === "shaking"
                  ? { repeat: Infinity, duration: 0.4 }
                  : phase === "idle"
                  ? { repeat: Infinity, duration: 2, ease: "easeInOut" }
                  : { duration: 1 }
              }
              className={`relative z-10 w-48 h-48 sm:w-64 sm:h-64 cursor-pointer drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]`}
            >
              {/* Chest Graphic */}
              <ChestGraphic chestType={chestType} className="w-full h-full drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]" />
            </motion.div>

            {phase === "idle" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8 text-center"
              >
                <h3 className="text-2xl font-bold text-white mb-2">{chestNames[chestType]}</h3>
                <p className="text-gray-300">Нажмите, чтобы открыть</p>
              </motion.div>
            )}
          </div>
        )}

        {/* Explosion overlay */}
        {phase === "opening" && (
          <motion.div
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 50, opacity: 0 }}
            transition={{ duration: 1.5 }}
            className="absolute z-20 w-10 h-10 bg-white rounded-full pointer-events-none"
          />
        )}

        {/* Reward Screen */}
        {phase === "reward" && rewardData && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0, y: 100 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: "spring", bounce: 0.5 }}
            className="relative z-30 flex flex-col items-center p-8 bg-gradient-to-br from-indigo-900/80 to-[#131325]/90 border-2 border-indigo-400/30 rounded-3xl shadow-[0_0_80px_rgba(99,102,241,0.6)]"
          >
             {/* Dynamic background rays */}
             <div className="absolute top-1/2 left-1/2 w-[200%] h-[200%] -translate-x-1/2 -translate-y-1/2 opacity-20 pointer-events-none">
                <div className="absolute inset-0 bg-[conic-gradient(from_0deg,transparent_0_340deg,white_360deg)] animate-spin" style={{ animationDuration: '8s' }}/>
                <div className="absolute inset-0 bg-[conic-gradient(from_180deg,transparent_0_340deg,white_360deg)] animate-spin" style={{ animationDuration: '8s', animationDirection: 'reverse' }}/>
             </div>

            <h2 className="text-3xl font-black text-amber-300 mb-6 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]">
              Награда!
            </h2>

            <motion.div 
               initial={{ rotateY: 180 }}
               animate={{ rotateY: 0 }}
               transition={{ duration: 0.8, type: "spring" }}
               className="w-40 h-40 flex items-center justify-center bg-black/40 rounded-2xl border-2 border-amber-400/50 mb-6 relative overflow-hidden"
            >
              {rewardData.reward_type === "nuts" ? (
                <div className="flex flex-col items-center">
                  <span className="text-6xl mb-2">🥜</span>
                  <span className="text-2xl font-bold text-white">+{rewardData.amount}</span>
                </div>
              ) : (
                <div className="w-full h-full p-2 relative flex flex-col items-center justify-center">
                    {(() => {
                        const isDeck = rewardData.item_id.startsWith("deck_");
                        const isBg = rewardData.item_id.startsWith("bg_");
                        const isTaunt = rewardData.item_id.startsWith("taunt_");
                        
                        let itemKey = rewardData.item_id.replace(/^(deck_|bg_|taunt_)/, '');
                        let title = "Экипировка";

                        if (storeData) {
                            if (isDeck) {
                                const match = storeData.decks?.find(d => d.id === rewardData.item_id);
                                if (match) { itemKey = match.item_key; title = match.title; }
                            } else if (isBg) {
                                const match = storeData.backgrounds?.find(b => b.id === rewardData.item_id);
                                if (match) { itemKey = match.item_key; title = match.title; }
                            } else if (isTaunt) {
                                const match = storeData.taunts?.find(t => t.id === rewardData.item_id);
                                if (match) { itemKey = match.item_key; title = match.title; }
                            }
                        }

                        return (
                            <div className="flex flex-col items-center justify-center w-full h-full text-center">
                                <div className="h-[88px] w-full mb-1 relative flex items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/20">
                                    {isDeck ? (
                                        <DeckPreview theme={itemKey} />
                                    ) : isBg ? (
                                        <BackgroundPreview theme={itemKey} />
                                    ) : isTaunt ? (
                                        <div className="text-6xl drop-shadow-md">{itemKey}</div>
                                    ) : (
                                        <span className="text-5xl">✨</span>
                                    )}
                                </div>
                                <span className="text-sm font-bold text-white leading-tight truncate w-full px-1">{title}</span>
                                <span className="text-[10px] text-purple-300 mt-0.5 uppercase tracking-wider">{isDeck ? 'Колода' : isBg ? 'Фон' : isTaunt ? 'Эмодзи' : 'Косметика'}</span>
                            </div>
                        )
                    })()}
                </div>
              )}
              {rewardData.is_duplicate && (
                <div className="absolute top-2 right-2 bg-rose-500 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">
                  Повтор
                </div>
              )}
            </motion.div>

            <button
              onClick={() => onClose()}
              className="px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full font-bold text-white hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(245,158,11,0.4)]"
            >
              Забрать
            </button>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
