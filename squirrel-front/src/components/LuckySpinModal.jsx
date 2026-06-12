import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { X, Play } from "lucide-react";
import axios from "axios";
import { getUrl } from "../config/settings";
import { toast } from "react-toastify";
import { useGameStore } from "../store";
import { DeckPreview, BackgroundPreview } from "../SearchGame";

export default function LuckySpinModal({ isOpen, onClose }) {
  const [items, setItems] = useState([]);
  const [nextFreeSpinInSeconds, setNextFreeSpinInSeconds] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [reward, setReward] = useState(null);
  const user = useGameStore((state) => state.user);

  useEffect(() => {
    if (isOpen) {
      fetchSpinInfo();
    } else {
      setTimeout(() => {
        setReward(null);
        setRotation(0);
      }, 300);
    }
  }, [isOpen]);

  // Handle countdown
  useEffect(() => {
    let interval;
    if (nextFreeSpinInSeconds > 0) {
      interval = setInterval(() => {
        setNextFreeSpinInSeconds((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [nextFreeSpinInSeconds]);

  const fetchSpinInfo = async () => {
    try {
      const res = await axios.get(getUrl("/v1/spin"), {
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
      });
      setItems(res.data.items);
      setNextFreeSpinInSeconds(res.data.next_free_spin_in_seconds);
    } catch (err) {
      console.error(err);
    }
  };

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSpin = async (useFree) => {
    if (isSpinning) return;
    if (!useFree && user?.nuts < 500) {
      toast.error("Недостаточно орехов!");
      return;
    }

    try {
      setIsSpinning(true);
      const res = await axios.post(
        getUrl("/v1/spin/draw"),
        { use_free: useFree },
        { headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` } }
      );

      // Fast sync local nuts if paid
      if (!useFree && user) {
        useGameStore.setState({ user: { ...user, nuts: user.nuts - 500 } });
      }

      // Sync the countdown server-side
      setNextFreeSpinInSeconds(res.data.is_free ? 86400 : nextFreeSpinInSeconds);

      // Calculate where to stop
      const rewardId = res.data.reward_id;
      const targetIndex = items.findIndex((i) => i.id === rewardId);
      
      if (targetIndex !== -1) {
        const sectorAngle = 360 / items.length;
        // The absolute position inside a single 360 circle
        const absoluteTargetAngle = 360 - (sectorAngle * targetIndex) - (sectorAngle / 2);
        
        setRotation(prev => {
           const currentMod = prev % 360;
           const nextZero = prev + (360 - currentMod);
           // Add 5 full extra rotations (1800 deg) + the targeted position
           return nextZero + 1800 + absoluteTargetAngle;
        });

        setTimeout(() => {
          setReward(items[targetIndex]);
          setIsSpinning(false);
          // Refresh user after reward
          axios.get(getUrl("/auth/me"), { headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` } })
            .then(res => {
              useGameStore.setState({ user: res.data });
            }).catch(e => console.error(e));
        }, 5000); // 5 seconds spin animation
      } else {
        setIsSpinning(false);
      }

    } catch (err) {
      setIsSpinning(false);
      toast.error(err.response?.data || "Ошибка рулетки");
    }
  };

  if (!isOpen) return null;

  const canSpinFree = nextFreeSpinInSeconds === 0;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md overflow-hidden">
      
      {/* Рулетка */}
      <div className="w-full max-w-sm flex flex-col items-center">
        <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-amber-500 mb-8 uppercase tracking-widest animate-pulse drop-shadow-[0_0_15px_rgba(251,191,36,0.6)]">
          Счастливая Рулетка
        </h2>

        {/* Колесо */}
        <div className="relative w-80 h-80 mb-10 mt-4 rounded-full shadow-[0_0_100px_rgba(245,158,11,0.3)]">
          {/* Arrow Pointer - Golden and detailed */}
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-16 z-30 drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)] flex flex-col items-center">
             <div className="w-8 h-8 bg-gradient-to-b from-yellow-200 to-amber-600 rounded-full border-4 border-white shadow-xl rotate-45 transform translate-y-4 z-0"></div>
             <svg viewBox="0 0 24 24" className="w-10 h-10 rotate-180 z-10 relative"><path d="M12 2L2 22h20L12 2z" fill="url(#goldGradient)" stroke="#78350f" strokeWidth="1" strokeLinejoin="round"/>
               <defs>
                 <linearGradient id="goldGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                   <stop offset="0%" stopColor="#fef08a" />
                   <stop offset="50%" stopColor="#f59e0b" />
                   <stop offset="100%" stopColor="#b45309" />
                 </linearGradient>
               </defs>
             </svg>
          </div>

          <div 
            className="w-full h-full rounded-full border-[12px] border-[#292524] shadow-[inset_0_0_40px_rgba(0,0,0,0.9),0_0_30px_rgba(0,0,0,0.8)] overflow-hidden relative box-border bg-[#1c1917]"
            style={{
              transition: "transform 6s cubic-bezier(0.1, 0.9, 0.2, 1)",
              transform: `rotate(${rotation}deg)`
            }}
          >
            {/* Draw logic with SVG circles since there are N dynamic items */}
            {items.length > 0 && items.map((item, index) => {
              const angle = 360 / items.length;
              const rotationAngle = angle * index;
              return (
                <div 
                  key={index}
                  className="absolute w-full h-full"
                  style={{
                    clipPath: `polygon(50% 50%, 50% 0, 100% 0, 100% 50%)`, // generic approximation, but for proper N pieces we use conic-gradient
                    transform: `rotate(${rotationAngle}deg)`,
                    transformOrigin: '50% 50%'
                  }}
                >
                  <div className="absolute top-0 right-0 bottom-0 left-0" style={{ backgroundColor: item.hex_color }}></div>
                </div>
              );
            })}
            
            {/* Using a precise CSS conic-gradient based on dynamic items */}
            <div 
              className="absolute inset-0 z-0"
              style={{
                background: `conic-gradient(${items.map((item, index) => 
                  `${item.hex_color} ${(360 / items.length) * index}deg ${(360 / items.length) * (index + 1)}deg`
                ).join(', ')})`
              }}
            ></div>

            {/* Separators and Content */}
            {items.length > 0 && items.map((item, index) => {
              const angle = 360 / items.length;
              const rotationAngle = angle * index + angle / 2;
              return (
                <div 
                  key={index}
                  className="absolute inset-0 flex flex-col items-center justify-start z-10 pt-5"
                  style={{ transform: `rotate(${rotationAngle}deg)` }}
                >
                  {item.reward_type === 'cosmetic' && item.item_id && item.item_id.includes('deck') ? (
                     <div className="mt-4 mb-2 opacity-90 transform scale-[0.4] pointer-events-none drop-shadow-[0_5px_10px_rgba(0,0,0,1)]">
                         <DeckPreview theme={item.item_id} />
                     </div>
                  ) : item.reward_type === 'cosmetic' && item.item_id && (item.item_id.includes('background') || item.item_id.includes('table')) ? (
                     <div className="mt-4 mb-2 w-10 h-10 rounded-full border-2 border-white/50 overflow-hidden drop-shadow-lg shadow-inner pointer-events-none">
                         <BackgroundPreview theme={item.item_id} />
                     </div>
                  ) : (
                     <span className="text-[28px] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] highlight-white/10">{item.icon_emoji}</span>
                  )}
                  <span className="text-white font-black text-[8px] px-8 text-center drop-shadow-[0_2px_2px_rgba(0,0,0,1)] leading-[10px]" style={{ maxWidth: '140px' }}>
                    {item.name}
                  </span>
                </div>
              );
            })}
            
            {/* Inner Ring Glow */}
            <div className="absolute inset-0 rounded-full shadow-[inset_0_0_50px_rgba(0,0,0,0.8)] z-10 pointer-events-none"></div>

            {/* Separator lines with golden studs */}
            {items.length > 0 && items.map((_, index) => {
               const angle = 360 / items.length;
               return (
                  <div 
                     key={`line-${index}`}
                     className="absolute inset-0 z-10 flex justify-center"
                     style={{
                        transform: `rotate(${angle * index}deg)`,
                     }}
                  >
                     <div className="w-[3px] h-1/2 bg-gradient-to-b from-amber-200 via-yellow-600 to-transparent shadow-[0_0_5px_rgba(0,0,0,0.8)] relative">
                         <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-gradient-to-br from-yellow-200 to-amber-700 rounded-full border border-black shadow-md"></div>
                     </div>
                  </div>
               );
            })}

            {/* Center Hub */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-yellow-200 via-amber-600 to-yellow-900 rounded-full border-[4px] border-[#292524] z-20 flex items-center justify-center shadow-[0_10px_20px_rgba(0,0,0,0.6),inset_0_-2px_10px_rgba(0,0,0,0.5)]">
              <div className="w-12 h-12 rounded-full border-2 border-yellow-300/30 flex items-center justify-center bg-black/20 backdrop-blur-sm">
                <span className="text-2xl drop-shadow-[0_0_10px_rgba(253,224,71,0.8)]">🌟</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="w-full px-6 flex flex-col gap-4">
          <button
            disabled={!canSpinFree || isSpinning}
            onClick={() => handleSpin(true)}
            className={`w-full py-4 rounded-xl font-black uppercase tracking-wide text-white transition-all transform flex items-center justify-center gap-2 ${canSpinFree && !isSpinning ? 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-[0_0_20px_rgba(16,185,129,0.5)] active:scale-95' : 'bg-gray-700 opacity-50 cursor-not-allowed'}`}
          >
            {canSpinFree ? (
              <>
                Бесплатная крутка <Play size={18} fill="white" />
              </>
            ) : (
              `Бесплатно через: ${formatTime(nextFreeSpinInSeconds)}`
            )}
          </button>

          <button
            disabled={isSpinning || user?.nuts < 500}
            onClick={() => handleSpin(false)}
            className={`w-full py-3 rounded-xl font-black uppercase text-sm tracking-wide transition-all transform flex flex-col items-center justify-center gap-1 border-2 border-amber-500/50 ${!isSpinning && user?.nuts >= 500 ? 'bg-gradient-to-r from-amber-600/30 to-yellow-600/30 text-amber-300 hover:bg-amber-600/50 active:scale-95 shadow-[0_0_15px_rgba(245,158,11,0.2)]' : 'bg-gray-800 border-gray-600 text-gray-500 cursor-not-allowed'}`}
          >
            <span>Крутить за 500 🥜</span>
            <span className="text-[10px] opacity-70">Баланс: {user?.nuts || 0}</span>
          </button>
        </div>
      </div>

      <button
        onClick={onClose}
        disabled={isSpinning}
        className={`absolute top-6 right-6 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white backdrop-blur-md transition-colors ${isSpinning ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      >
        <X size={24} />
      </button>

      {/* Reward Popup */}
      {reward && (
        <div className="absolute inset-0 bg-black/90 z-50 flex items-center justify-center animate-in fade-in zoom-in duration-300 backdrop-blur-md">
           <div className="w-full max-w-sm flex flex-col items-center transform scale-110">
              <div className="absolute -inset-20 bg-gradient-to-r from-purple-600/30 to-pink-600/30 rounded-full blur-[100px] animate-pulse pointer-events-none"></div>
              
              <h3 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-amber-500 mb-2 tracking-widest uppercase drop-shadow-[0_0_20px_rgba(245,158,11,0.5)]">ВЫИГРЫШ!</h3>
              
              <div className="w-48 h-48 my-8 relative flex items-center justify-center">
                 {/* Shiny particles */}
                 <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] animate-[spin_20s_linear_infinite] opacity-50 mix-blend-screen rounded-full"></div>
                 <div className="absolute inset-0 bg-gradient-to-tr from-purple-600 to-fuchsia-600 rounded-full opacity-20 blur-xl animate-pulse"></div>
                 
                 {reward.reward_type === 'cosmetic' && reward.item_id && reward.item_id.includes('deck') ? (
                     <div className="absolute z-20 scale-[0.9] drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)]">
                         <DeckPreview theme={reward.item_id} />
                     </div>
                 ) : reward.reward_type === 'cosmetic' && reward.item_id && (reward.item_id.includes('background') || reward.item_id.includes('table')) ? (
                     <div className="absolute z-20 w-32 h-32 rounded-3xl border-4 border-white/30 overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.8)]">
                         <BackgroundPreview theme={reward.item_id} />
                     </div>
                 ) : (
                     <span className="text-[100px] drop-shadow-[0_0_30px_rgba(255,255,255,0.4)] relative z-10 hover:scale-110 transition-transform cursor-pointer">{reward.icon_emoji}</span>
                 )}
              </div>
              
              <p className="text-2xl font-black text-white mb-8 px-4 text-center drop-shadow-md">
                 {reward.name}
              </p>
              
              <button 
                  onClick={() => setReward(null)}
                  className="w-3/4 py-4 bg-gradient-to-r from-amber-400 to-yellow-600 rounded-2xl text-[#1a1a2e] font-black uppercase tracking-widest text-lg shadow-[0_0_30px_rgba(245,158,11,0.4)] hover:shadow-[0_0_50px_rgba(245,158,11,0.6)] active:scale-95 transition-all outline-none border-2 border-yellow-200/50"
              >
                 Забрать
              </button>
           </div>
        </div>
      )}

    </div>,
    document.body
  );
}
