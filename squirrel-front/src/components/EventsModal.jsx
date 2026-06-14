import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import axios from "axios";
import { getUrl } from "../config/settings";
import { toast } from "react-hot-toast";
import { DeckPreview } from "../SearchGame";
import { renderTauntGraphic } from "../Game";
import { useGameStore } from "../store";

export const eventThemes = {
  spring_festival: {
    bannerBg: "from-pink-500 via-rose-500 to-orange-400",
    shadowColor: "shadow-pink-500/20",
    emoji: "🌸",
    textColor: "text-pink-100",
    cardBorder: "border-pink-500/30 shadow-[0_0_40px_rgba(236,72,153,0.15)]",
    headerBg: "from-pink-600 via-rose-500 to-orange-400",
    questBorder: "border-pink-500/20 shadow-pink-900/10",
    questProgressBar: "from-pink-500 to-rose-400",
    tabColor: "text-pink-400 border-pink-400",
    buyBtn: "from-pink-600 to-orange-500 shadow-[0_0_15px_rgba(236,72,153,0.3)]",
  },
  halloween: {
    bannerBg: "from-orange-600 via-purple-700 to-slate-900",
    shadowColor: "shadow-orange-500/20",
    emoji: "🎃",
    textColor: "text-orange-200",
    cardBorder: "border-orange-500/30 shadow-[0_0_40px_rgba(249,115,22,0.15)]",
    headerBg: "from-orange-600 via-purple-700 to-slate-900",
    questBorder: "border-orange-500/20 shadow-orange-900/10",
    questProgressBar: "from-orange-500 to-purple-600",
    tabColor: "text-orange-400 border-orange-400",
    buyBtn: "from-orange-600 to-purple-700 shadow-[0_0_15px_rgba(249,115,22,0.3)]",
  },
  winter_wonderland: {
    bannerBg: "from-blue-500 via-sky-400 to-indigo-600",
    shadowColor: "shadow-blue-500/20",
    emoji: "❄️",
    textColor: "text-blue-100",
    cardBorder: "border-blue-500/30 shadow-[0_0_40px_rgba(59,130,246,0.15)]",
    headerBg: "from-blue-600 via-sky-400 to-indigo-700",
    questBorder: "border-blue-500/20 shadow-blue-900/10",
    questProgressBar: "from-blue-400 to-indigo-500",
    tabColor: "text-blue-400 border-blue-400",
    buyBtn: "from-blue-600 to-indigo-600 shadow-[0_0_15px_rgba(59,130,246,0.3)]",
  },
  default: {
    bannerBg: "from-purple-600 via-indigo-600 to-blue-500",
    shadowColor: "shadow-purple-500/20",
    emoji: "✨",
    textColor: "text-purple-100",
    cardBorder: "border-purple-500/30 shadow-[0_0_40px_rgba(168,85,247,0.15)]",
    headerBg: "from-purple-600 via-indigo-600 to-blue-500",
    questBorder: "border-purple-500/20 shadow-purple-900/10",
    questProgressBar: "from-purple-500 to-indigo-400",
    tabColor: "text-purple-400 border-purple-400",
    buyBtn: "from-purple-600 to-indigo-600 shadow-[0_0_15px_rgba(168,85,247,0.3)]",
  }
};

export function getEventTheme(eventKey) {
  return eventThemes[eventKey] || eventThemes.default;
}

// Progress bar component for quests
function QuestProgressBar({ current, target, theme }) {
  const progress = Math.min(100, Math.max(0, (current / target) * 100));
  return (
    <div className="w-full mt-2">
      <div className="flex justify-between text-[10px] mb-1 font-bold">
        <span className="text-gray-400">ПРОГРЕСС</span>
        <span className="text-white">{current} / {target}</span>
      </div>
      <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
        <div 
          className={`h-full bg-gradient-to-r ${theme.questProgressBar} rounded-full transition-all duration-500`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export default function EventsModal({ isOpen, onClose }) {
  const [eventData, setEventData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('quests'); // 'quests' | 'shop'
  const [buyingId, setBuyingId] = useState(null);

  const theme = getEventTheme(eventData?.event_key);

  const fetchEvent = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const res = await axios.get(getUrl("/v1/events"), {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEventData(res.data.event);
    } catch (e) {
      console.error(e);
      toast.error("Не удалось загрузить события");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetchEvent();
    }
  }, [isOpen]);

  const claimQuest = async (questId) => {
    try {
      const token = localStorage.getItem("access_token");
      await axios.post(getUrl("/v1/events/claim"), { quest_id: questId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Награда получена!");
      fetchEvent(); // Refresh state
      try {
         const ures = await axios.get(getUrl("/auth/me"), { headers: { Authorization: `Bearer ${token}` } });
         useGameStore.getState().setUser(ures.data);
      } catch(e) {}
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data || "Ошибка получения награды");
    }
  };


const renderItemPreview = (item) => {
  if (item.item_type === 'chest') {
    return <img src={`/chests/${item.item_id}.png`} alt={item.title} className="w-12 h-12 object-contain drop-shadow-[0_0_10px_rgba(255,165,0,0.5)] transform group-hover:scale-110 transition-transform" />;
  }
  if (item.item_type === 'background') {
    return <div className={`w-12 h-12 rounded-xl border border-white/20 bg-gradient-to-br from-indigo-500 to-purple-800 shadow-inner group-hover:scale-105 transition-transform flex items-center justify-center`}><span className="text-xl">🌌</span></div>;
  }
  if (item.item_type === 'deck') {
    return (
      <div className="w-16 h-16 rounded-xl border border-purple-500/50 bg-black/40 overflow-hidden relative group-hover:scale-110 transition-transform flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent" />
        <div className="scale-[0.4] origin-center -ml-2">
          <DeckPreview theme={item.item_id} />
        </div>
      </div>
    );
  }
  if (item.item_type === 'taunt') {
    return <div className="text-3xl drop-shadow-lg group-hover:scale-125 transition-transform flex items-center justify-center pt-2 pb-2 pl-2 pr-2">{renderTauntGraphic(item.item_id)}</div>;
  }
  
  // Default/Booster
  return <div className="text-3xl bg-black/30 w-12 h-12 flex items-center justify-center rounded-xl border border-white/5 drop-shadow-md group-hover:scale-110 transition-transform">{item.icon}</div>;
};

  const buyItem = async (itemId) => {
    try {
      setBuyingId(itemId);
      const token = localStorage.getItem("access_token");
      await axios.post(getUrl("/v1/events/buy"), { shop_item_id: itemId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Товар успешно приобретен!");
      fetchEvent(); // Refresh state for balance
      try {
         const ures = await axios.get(getUrl("/auth/me"), { headers: { Authorization: `Bearer ${token}` } });
         useGameStore.getState().setUser(ures.data);
      } catch(e) {}
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data || "Недостаточно валюты или ошибка покупки");
    } finally {
      setBuyingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className={`relative w-full max-w-md overflow-hidden rounded-3xl bg-[#131320] border ${theme.cardBorder} flex flex-col h-[85vh] max-h-[700px]`}
        >
          {/* Header Banner */}
          <div className={`relative h-40 shrink-0 w-full overflow-hidden bg-gradient-to-br ${theme.headerBg} p-6 flex flex-col justify-end`}>
            {/* Abstract background shapes */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-black/20 rounded-full blur-2xl translate-y-1/4 -translate-x-1/4"></div>
            
            <button
              onClick={onClose}
              className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-black/20 text-white backdrop-blur-md transition hover:bg-black/40"
            >
              ✕
            </button>

            {loading ? (
               <div className="animate-pulse h-8 w-48 bg-white/20 rounded-lg"></div>
            ) : eventData ? (
               <div className="relative z-10 flex justify-between items-end">
                 <div>
                    <h2 className="text-2xl font-extrabold text-white drop-shadow-md leading-tight">{eventData.title}</h2>
                    <p className="text-white/80 text-xs font-medium mt-1 uppercase tracking-wider bg-black/20 inline-block px-2 py-0.5 rounded-full backdrop-blur-md border border-white/10">Активное событие</p>
                 </div>
                 <div className="flex flex-col items-end">
                    <span className="text-3xl drop-shadow-lg">{eventData.currency_icon}</span>
                    <span className="text-sm font-bold text-white mt-1 bg-black/30 px-2 py-1 rounded-lg backdrop-blur-sm shadow-inner">{eventData.currency_balance}</span>
                 </div>
               </div>
            ) : (
                <h2 className="text-2xl font-extrabold text-white drop-shadow-md">Нет активных событий</h2>
            )}
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {loading ? (
              <div className="flex justify-center items-center h-40">
                 <div className="w-8 h-8 rounded-full border-4 border-pink-500 border-t-transparent animate-spin"></div>
              </div>
            ) : !eventData ? (
              <div className="text-center text-gray-500 mt-10">
                Следите за обновлениями, скоро появятся новые события!
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-300 leading-relaxed bg-[#1a1a2e] p-4 rounded-2xl border border-white/5">
                  {eventData.description}
                </p>

                <div className="flex gap-4 px-1 border-b border-white/10">
                  <button 
                    onClick={() => setActiveTab('quests')}
                    className={`pb-2 text-sm font-bold tracking-wide transition-all ${activeTab === 'quests' ? `${theme.tabColor} border-b-2` : 'text-gray-500 hover:text-gray-300'}`}
                  >
                    📝 Задания
                  </button>
                  <button 
                    onClick={() => setActiveTab('shop')}
                    className={`pb-2 text-sm font-bold tracking-wide transition-all ${activeTab === 'shop' ? `${theme.tabColor} border-b-2` : 'text-gray-500 hover:text-gray-300'}`}
                  >
                    🛍️ Магазин
                  </button>
                </div>

                <div className="space-y-3 pb-8">
                  {activeTab === 'quests' && eventData.quests.map((quest) => (
                    <div key={quest.id} className={`relative overflow-hidden p-4 rounded-2xl border transition-all ${quest.is_claimed ? 'bg-black/40 border-white/5 opacity-60' : `bg-[#1a1a2e] ${theme.questBorder}`}`}>
                       <div className="flex justify-between items-start gap-4">
                         <div className="flex-1 min-w-0">
                           <h4 className="font-bold text-white text-sm break-words leading-tight">{quest.title}</h4>
                           
                           <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/40 border border-white/5">
                             <span className="text-[11px] text-gray-400 font-medium">Награда:</span>
                             <span className={`text-xs font-bold ${theme.tabColor.split(' ')[0]}`}>
                               +{quest.reward_amount} {quest.reward_type === 'event_currency' ? eventData.currency_icon : quest.reward_type === 'xp' ? 'XP' : quest.reward_type === 'nuts' ? '🥜' : '📦'}
                             </span>
                           </div>

                           {!quest.is_claimed && (
                             <QuestProgressBar current={quest.current_amount} target={quest.target_amount} theme={theme} />
                           )}
                         </div>

                         <div className="shrink-0 flex items-center justify-center pt-1">
                           {quest.is_claimed ? (
                             <div className="h-8 w-8 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center">
                               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                             </div>
                           ) : quest.is_completed ? (
                             <button
                               onClick={() => claimQuest(quest.id)}
                               className={`relative overflow-hidden bg-gradient-to-r ${theme.buyBtn.split(' ')[0]} text-white font-bold text-xs px-4 py-2 rounded-xl shadow-[0_0_15px_rgba(236,72,153,0.4)] hover:scale-105 active:scale-95 transition-all`}
                             >
                               <span className="relative z-10 uppercase tracking-widest">Забрать</span>
                             </button>
                           ) : (
                             <div className="text-[10px] font-bold text-gray-500 border border-gray-600/50 bg-black/20 px-3 py-1.5 rounded-lg uppercase">
                               В процессе
                             </div>
                           )}
                         </div>
                       </div>
                    </div>
                  ))}

                  {activeTab === 'shop' && eventData.shop_items?.length > 0 && eventData.shop_items.map((item) => (
                    <div key={item.id} className={`group relative overflow-hidden p-4 rounded-2xl border bg-[#1a1a2e] ${theme.questBorder} flex justify-between items-center gap-4 transition-all hover:bg-[#1f1f33] hover:border-white/10`}>
                       <div className="flex items-center gap-3">
                         <div className="flex-shrink-0 flex items-center justify-center p-1 w-16 h-16 bg-black/30 rounded-2xl border border-white/10 shadow-inner">
                           {renderItemPreview(item)}
                         </div>
                         <div>
                           <h4 className="font-extrabold text-white text-sm leading-tight drop-shadow-sm">{item.title}</h4>
                           <div className="mt-1 flex items-center gap-1">
                             <span className="text-xs text-orange-400 font-bold bg-orange-400/10 px-2 py-0.5 rounded-md border border-orange-400/20">
                               {item.cost} {eventData.currency_icon}
                             </span>
                           </div>
                         </div>
                       </div>
                       
                       <div className="shrink-0 flex flex-col items-end gap-1">
                         {item.max_purchases !== null && (
                            <span className="text-[10px] text-gray-400 font-bold">
                              {item.purchase_count >= item.max_purchases ? 'Раскуплено' : `Осталось: ${item.max_purchases - item.purchase_count}/${item.max_purchases}`}
                            </span>
                         )}
                         <button
                           onClick={() => buyItem(item.id)}
                           disabled={buyingId === item.id || eventData.currency_balance < item.cost || (item.max_purchases !== null && item.purchase_count >= item.max_purchases)}
                           className={`shrink-0 overflow-hidden text-white font-bold text-[10px] px-3 py-1.5 rounded-xl uppercase tracking-wider transition-all
                             ${(item.max_purchases !== null && item.purchase_count >= item.max_purchases)
                               ? 'bg-red-500/20 text-red-400 cursor-not-allowed border border-red-500/20'
                               : eventData.currency_balance >= item.cost 
                                 ? `bg-gradient-to-tr ${theme.buyBtn} hover:scale-105 active:scale-95` 
                                 : 'bg-gray-800 text-gray-500 cursor-not-allowed opacity-70'}
                           `}
                         >
                           {buyingId === item.id ? '...' : 
                             (item.max_purchases !== null && item.purchase_count >= item.max_purchases) ? 'Распродано' : 
                             (eventData.currency_balance >= item.cost ? 'Купить' : 'Не хватает')}
                         </button>
                       </div>
                    </div>
                  ))}

                  {activeTab === 'shop' && (!eventData.shop_items || eventData.shop_items.length === 0) && (
                    <div className="text-center text-gray-500 mt-10 text-sm font-semibold">
                      В магазине пока нет товаров 🎁
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
