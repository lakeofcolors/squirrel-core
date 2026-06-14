import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import axios from "axios";
import { getUrl } from "../config/settings";
import { useGameStore } from "../store";

export default function DailyRewardsModal({ isOpen, onClose, onSuccess, onOpenChest, onUseBooster }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState(null);
  const token = useGameStore((s) => s.token) || localStorage.getItem("access_token");

  useEffect(() => {
    if (isOpen) {
      setClaimResult(null);
      fetchStatus();
    }
  }, [isOpen]);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await axios.get(getUrl("/v1/daily_reward"), {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStatus(res.data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleClaim = async () => {
    if (!status?.can_claim || claiming) return;
    setClaiming(true);
    try {
      const res = await axios.post(getUrl("/v1/daily_reward/claim"), {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setClaimResult(res.data);
      if (onSuccess) onSuccess();
    } catch (e) {
      console.error(e);
    }
    setClaiming(false);
  };

  if (!isOpen) return null;

  const days = [
    { day: 1, type: "nuts", amount: 50 },
    { day: 2, type: "nuts", amount: 150 },
    { day: 3, type: "chest", chest_type: "common" },
    { day: 4, type: "nuts", amount: 300 },
    { day: 5, type: "nuts", amount: 500 },
    { day: 6, type: "chest", chest_type: "rare" },
    { day: 7, type: "chest", chest_type: "epic" },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4">
        <motion.div
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           exit={{ opacity: 0 }}
           onClick={() => !claiming && !claimResult && onClose()}
           className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        <motion.div
           initial={{ scale: 0.9, opacity: 0, y: 20 }}
           animate={{ scale: 1, opacity: 1, y: 0 }}
           className="relative w-full max-w-sm rounded-[32px] overflow-hidden bg-[#131325]"
        >
          {/* Header */}
          <div className="relative pt-8 pb-6 px-6 text-center bg-gradient-to-b from-indigo-900/50 flex flex-col items-center">
             <div className="w-16 h-16 rounded-3xl bg-indigo-500/20 flex items-center justify-center mb-4 border border-indigo-500/30">
               <span className="text-3xl">🗓️</span>
             </div>
             <h2 className="text-2xl font-black text-white">Ежедневная награда</h2>
             <p className="text-indigo-200/80 text-sm mt-1">Заходи каждый день и забирай призы!</p>
          </div>

          {claimResult ? (
            <motion.div 
               initial={{ opacity: 0, scale: 0.8 }} 
               animate={{ opacity: 1, scale: 1 }}
               className="p-8 pt-4 flex flex-col items-center"
            >
               <h3 className="text-amber-400 font-bold text-xl mb-4 text-center">Получен ежедневный бонус!</h3>
               <div className="w-32 h-32 rounded-full bg-gradient-to-br from-amber-400/20 to-orange-600/20 border-2 border-amber-500 flex items-center justify-center text-5xl mb-6 shadow-[0_0_30px_rgba(251,191,36,0.5)]">
                 {claimResult.reward_type === "nuts" ? "🥜" : (
                    <img src={`/chests/${claimResult.chest_type || 'common'}.png`} alt="chest" className="w-20 h-20 object-contain drop-shadow-md" />
                 )}
               </div>
               <div className="text-3xl font-black text-white mb-2">
                 {claimResult.reward_type === "nuts" ? `+${claimResult.amount}` : "Новый сундук!"}
               </div>

               {claimResult.reward_type === "chest" ? (
                 <div className="flex flex-col gap-2 w-full mt-6">
                   <button
                     onClick={() => {
                       if (onOpenChest) onOpenChest(claimResult.chest_type || "common");
                       onClose();
                     }}
                     className="w-full py-4 text-lg font-bold bg-gradient-to-r from-amber-400 to-orange-500 text-black rounded-2xl active:scale-95 transition-all shadow-xl shadow-orange-500/20 hover:brightness-110"
                   >
                     Открыть сейчас
                   </button>
                   <button
                     onClick={onClose}
                     className="w-full py-3 text-sm font-semibold text-slate-400 hover:text-white transition-colors"
                   >
                     Открыть позже
                   </button>
                 </div>
               ) : claimResult.reward_type === "booster" ? (
                 <div className="flex flex-col gap-2 w-full mt-6">
                   <button
                     onClick={() => {
                       if (onUseBooster) onUseBooster(claimResult.booster_key || claimResult.item_id);
                       onClose();
                     }}
                     className="w-full py-4 text-lg font-bold bg-gradient-to-r from-pink-500 to-rose-400 text-white rounded-2xl active:scale-95 transition-all shadow-xl shadow-pink-500/20 hover:brightness-110"
                   >
                     Использовать сейчас
                   </button>
                   <button
                     onClick={onClose}
                     className="w-full py-3 text-sm font-semibold text-slate-400 hover:text-white transition-colors"
                   >
                     Использовать позже
                   </button>
                 </div>
               ) : (
                 <button
                   onClick={onClose}
                   className="mt-6 w-full py-4 text-lg font-bold bg-white text-black rounded-2xl active:scale-95 transition-transform"
                 >
                   Отлично!
                 </button>
               )}
            </motion.div>
          ) : (
            <div className="p-6 pt-2">
               {loading ? (
                 <div className="text-center text-gray-400 py-10">Загрузка...</div>
               ) : (
                 <>
                   <div className="grid grid-cols-4 gap-2 mb-2">
                     {days.slice(0, 4).map(d => <DayCard key={d.day} data={d} currentDay={status?.next_day} />)}
                   </div>
                   <div className="grid grid-cols-3 gap-2">
                     {days.slice(4, 7).map(d => <DayCard key={d.day} data={d} currentDay={status?.next_day} big={d.day === 7} />)}
                   </div>

                   <button
                     disabled={!status?.can_claim || claiming}
                     onClick={handleClaim}
                     className={`mt-6 w-full py-4 text-lg font-bold rounded-2xl transition-all shadow-xl active:scale-[0.98]
                       ${status?.can_claim 
                          ? "bg-gradient-to-r from-amber-400 to-orange-500 text-black shadow-orange-500/30 hover:brightness-110" 
                          : "bg-slate-800 text-slate-500 border border-slate-700"}
                     `}
                   >
                     {claiming ? "Забираем..." : status?.can_claim ? "Забрать награду" : `Жди ${status?.hours_until} ч.`}
                   </button>
                 </>
               )}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function DayCard({ data, currentDay, big }) {
    const isPast = data.day < currentDay;
    const isCurrent = data.day === currentDay;

    let bgClass = "bg-slate-800/50 border-slate-700";
    let textClass = "text-slate-400";
    if (isPast) {
      bgClass = "bg-green-500/10 border-green-500/30";
      textClass = "text-green-500";
    } else if (isCurrent) {
      bgClass = "bg-amber-500/20 border-amber-500/50 scale-105 shadow-[0_0_15px_rgba(251,191,36,0.3)] z-10";
      textClass = "text-amber-400";
    }

    return (
        <div className={`relative flex flex-col items-center justify-center rounded-2xl border aspect-square ${bgClass} transition-all ${big ? 'col-span-1' : ''}`}>
           {isPast && (
             <div className="absolute top-1 right-1 text-green-500 text-[10px]">✔️</div>
           )}
           <div className={`text-[10px] font-bold uppercase mb-1 ${textClass}`}>День {data.day}</div>
           
           <div className={`text-2xl flex items-center justify-center h-8 ${isCurrent ? 'animate-bounce' : ''}`}>
              {data.type === 'nuts' ? '🥜' : (
                <img src={`/chests/${data.chest_type}.png`} alt={data.chest_type} className="h-full object-contain" />
              )}
           </div>
           
           <div className={`text-xs font-black mt-1 ${isCurrent ? 'text-white' : 'text-slate-300'} capitalize`}>
              {data.type === 'nuts' ? data.amount : data.chest_type}
           </div>
        </div>
    );
}
