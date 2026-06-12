import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "../store";

export default function VsScreenModal() {
  const vsScreenData = useGameStore((s) => s.vsScreenData);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (vsScreenData) {
      setShow(true);
    } else {
      setShow(false);
    }
  }, [vsScreenData]);

  if (!show || !vsScreenData) return null;

  const kaskyrPlayers = vsScreenData.filter((p) => p.team === "Kaskyr" || p.team === "kaskyr");
  const uziPlayers = vsScreenData.filter((p) => p.team === "Uzi" || p.team === "uzi");

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black overflow-hidden flex items-center justify-center font-sans tracking-wide"
      >
        {/* Фоновые эффекты */}
        <div className="absolute inset-0 flex flex-col md:flex-row">
          <motion.div 
            initial={{ x: "-100%", y: "-100%" }}
            animate={{ x: 0, y: 0 }}
            transition={{ duration: 0.6, type: "spring", bounce: 0.3 }}
            className="w-full h-1/2 md:w-1/2 md:h-full bg-amber-900/40 border-b-4 md:border-b-0 md:border-r-4 border-amber-500 shadow-[0_20px_100px_rgba(251,191,36,0.3)] md:shadow-[20px_0_100px_rgba(251,191,36,0.3)] relative overflow-hidden flex-shrink-0"
          >
             <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/diagonal-stripes.png')] opacity-20 mix-blend-overlay"></div>
             <div className="absolute bottom-0 md:top-0 right-0 w-full h-full bg-gradient-to-t md:bg-gradient-to-r from-transparent to-amber-500/30"></div>
          </motion.div>
          
          <motion.div 
            initial={{ x: "100%", y: "100%" }}
            animate={{ x: 0, y: 0 }}
            transition={{ duration: 0.6, type: "spring", bounce: 0.3, delay: 0.1 }}
            className="w-full h-1/2 md:w-1/2 md:h-full bg-purple-900/40 border-t-4 md:border-t-0 md:border-l-4 border-purple-500 shadow-[0_-20px_100px_rgba(168,85,247,0.3)] md:shadow-[-20px_0_100px_rgba(168,85,247,0.3)] relative overflow-hidden flex-shrink-0 flex-grow-1"
          >
             <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/diagonal-stripes.png')] opacity-20 mix-blend-overlay"></div>
             <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b md:bg-gradient-to-l from-transparent to-purple-500/30"></div>
          </motion.div>
        </div>

        {/* Молния / Стычка в центре */}
        <motion.div 
          initial={{ scaleY: 0, opacity: 0 }}
          animate={{ scaleY: 1, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.4 }}
          className="absolute hidden md:block left-1/2 top-0 bottom-0 w-3 -translate-x-1/2 bg-white shadow-[0_0_40px_20px_rgba(255,255,255,0.8)] z-10 skew-x-[15deg]"
        />
        <motion.div 
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.4 }}
          className="absolute md:hidden top-1/2 left-0 right-0 h-3 -translate-y-1/2 bg-white shadow-[0_0_40px_20px_rgba(255,255,255,0.8)] z-10 skew-y-[5deg]"
        />

        {/* Текст MATCH FOUND */}
        <motion.div 
          initial={{ scale: 3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, type: "spring", bounce: 0.5, delay: 0.2 }}
          className="absolute top-[8%] left-0 right-0 z-20 flex justify-center w-full"
        >
          <div className="text-3xl sm:text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400 drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)] uppercase tracking-widest text-center whitespace-normal md:whitespace-nowrap leading-tight">
            Match Found
          </div>
        </motion.div>

        {/* КОМАНДЫ */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex flex-col md:flex-row justify-between items-center px-4 md:px-32 z-20 gap-8 md:gap-0">
          
          {/* Левая команда Kaskyr */}
          <motion.div 
            initial={{ x: -200, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5, type: "spring" }}
            className="flex flex-col items-center gap-3 md:gap-6 w-full md:w-auto"
          >
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-amber-400 drop-shadow-[0_5px_15px_rgba(251,191,36,0.6)] uppercase italic">
              🐺 {teamMeta.kaskyr.name}
            </h2>
            <div className="flex flex-wrap justify-center gap-2 md:gap-4">
              {kaskyrPlayers.map((p, i) => (
                <div key={p.meta.id} className="flex flex-col items-center gap-1 md:gap-2">
                  <div className="w-16 h-16 sm:w-24 sm:h-24 md:w-32 md:h-32 rounded-full border-4 border-amber-400 overflow-hidden shadow-[0_0_20px_rgba(251,191,36,0.5)]">
                    <img 
                      src={p.meta.photo_url || p.meta.avatar || `https://api.dicebear.com/7.x/thumbs/svg?seed=${p.meta.username}`}
                      className="w-full h-full object-cover" 
                      alt="avatar" 
                    />
                  </div>
                  <span className="text-xs sm:text-lg md:text-xl font-bold bg-black/60 px-2 md:px-3 py-1 rounded-lg text-white truncate max-w-[80px] md:max-w-[120px]">
                    {p.meta.username}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* VS */}
          <motion.div 
            initial={{ scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 0.5, delay: 0.8, type: "spring", bounce: 0.6 }}
            className="md:absolute left-1/2 top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 w-16 h-16 sm:w-24 sm:h-24 md:w-32 md:h-32 rounded-full border-4 border-white bg-black flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.5)] z-30 flex-shrink-0 my-4 md:my-0"
          >
            <span className="text-2xl sm:text-4xl md:text-6xl font-black text-white italic">VS</span>
          </motion.div>

          {/* Правая команда Uzi */}
          <motion.div 
            initial={{ x: 200, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6, type: "spring" }}
            className="flex flex-col items-center gap-3 md:gap-6 w-full md:w-auto"
          >
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-purple-400 drop-shadow-[0_5px_15px_rgba(168,85,247,0.6)] uppercase italic">
              ⚡ {teamMeta.uzi.name}
            </h2>
            <div className="flex flex-wrap justify-center gap-2 md:gap-4">
              {uziPlayers.map((p, i) => (
                <div key={p.meta.id} className="flex flex-col items-center gap-1 md:gap-2">
                  <div className="w-16 h-16 sm:w-24 sm:h-24 md:w-32 md:h-32 rounded-full border-4 border-purple-500 overflow-hidden shadow-[0_0_30px_rgba(168,85,247,0.5)]">
                    <img 
                      src={p.meta.photo_url || p.meta.avatar || `https://api.dicebear.com/7.x/thumbs/svg?seed=${p.meta.username}`}
                      className="w-full h-full object-cover" 
                      alt="avatar" 
                    />
                  </div>
                  <span className="text-xs sm:text-lg md:text-xl font-bold bg-black/60 px-2 md:px-3 py-1 rounded-lg text-white truncate max-w-[80px] md:max-w-[120px]">
                    {p.meta.username}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

        </div>
      </motion.div>
    </AnimatePresence>
  );
}

const teamMeta = {
  kaskyr: { name: "Каскыр", color: "text-amber-400" },
  uzi: { name: "Узи", color: "text-purple-400" }
};
