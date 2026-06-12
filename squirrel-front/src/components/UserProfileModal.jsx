import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { getUrl } from "../config/settings";

export default function UserProfileModal({ targetId, targetName, targetAvatar, extraActions, onClose }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const token = localStorage.getItem("access_token");

  useEffect(() => {
    if (!targetId) return;

    if (targetId < 0) {
      // Mock bot profile
      setData({
        user: { username: targetName || "Bot", photo_url: targetAvatar, rating: 500, xp: 0 },
        stats: { matches: 999, winrate: "50%", rank_place: 0 },
        history: [], achievements: []
      });
      setLoading(false);
      return;
    }

    axios.get(getUrl(`/v1/profile/${targetId}`), {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => {
        setData(res.data);
        setLoading(false);
      })
      .catch((e) => {
        console.error(e);
        setLoading(false);
      });
  }, [targetId, token]);

  if (!targetId) return null;

  return ReactDOM.createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="bg-gray-900 border border-purple-500/50 rounded-4xl p-6 w-full max-w-md max-h-[95vh] overflow-y-auto no-scrollbar shadow-2xl relative"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white"
          >
            ✕
          </button>

          {loading ? (
            <div className="text-center text-purple-400 py-10 animate-pulse">Загрузка профиля...</div>
          ) : !data ? (
            <div className="text-center text-red-400 py-10">Профиль не найден</div>
          ) : (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-col items-center">
                <img
                  src={data.user?.photo_url || targetAvatar || `https://api.dicebear.com/7.x/thumbs/svg?seed=${data.user?.username || targetName || targetId}`}
                  className="w-24 h-24 rounded-full border-4 border-purple-500 mb-3 object-cover shadow-[0_0_15px_rgba(168,85,247,0.5)]"
                  alt="avatar"
                />
                <h2 className="text-2xl font-black text-white flex items-center gap-2">
                  {data.clan && <span className="text-amber-400">[{data.clan.tag}]</span>}
                  <span>{data.user?.username || targetName || "Squirrel"}</span>
                  <span className="text-xs ml-2 bg-pink-500 text-white rounded-full px-2 py-0.5 font-black border border-pink-600/50 shadow-[0_0_10px_rgba(236,72,153,0.5)]">Lv. {Math.floor(Math.sqrt((data.user?.xp || 0) / 100)) + 1}</span>
                </h2>
                <div className="text-gray-400 font-semibold mt-1 text-sm">
                  Рейтинг: {parseInt(data.user?.rating || 0)} ⭐
                </div>
                {data.stats?.rank_place > 0 && (
                  <div className="mt-2 px-3 py-1 bg-amber-500/20 border border-amber-500/50 rounded-full text-amber-400 text-xs font-bold uppercase tracking-widest">
                    Топ {data.stats.rank_place} в мире
                  </div>
                )}
              </div>

              {extraActions && (
                <div className="flex flex-col gap-2 w-full mt-4">
                  {extraActions}
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-black/40 p-4 rounded-2xl border border-white/5 flex flex-col items-center">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-gray-500 mb-1">Матчей</span>
                  <span className="text-xl font-black text-white">{data.stats.matches}</span>
                </div>
                <div className="bg-black/40 p-4 rounded-2xl border border-white/5 flex flex-col items-center">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-gray-500 mb-1">Винрейт</span>
                  <span className="text-xl font-black text-green-400">{data.stats.winrate}</span>
                </div>
              </div>

              {/* Achievements */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest text-center">Достижения</h3>
                {data.achievements && data.achievements.length > 0 ? (
                  <div className="grid grid-cols-3 gap-3">
                    {data.achievements.map((ach) => (
                      <div key={ach.key} className="flex flex-col items-center p-2 bg-black/30 rounded-xl border border-purple-500/20 group relative">
                        <img src={ach.icon_url} className="w-12 h-12 mb-1" alt={ach.title} />
                        <span className="text-[10px] font-bold text-center text-white line-clamp-1">{ach.title}</span>
                        {/* Tooltip */}
                        <div className="absolute bottom-full mb-2 hidden group-hover:block w-max max-w-[150px] bg-gray-800 text-white text-[10px] p-2 rounded shadow-xl z-10 text-center">
                          {ach.description}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-500 text-sm py-4 bg-black/20 rounded-xl">Пока нет достижений</div>
                )}
              </div>

              {/* Latest Matches */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest text-center">Последние игры</h3>
                <div className="space-y-2">
                  {data.history && data.history.slice(0, 3).map((h) => (
                    <div key={h.id} className="flex justify-between items-center p-3 bg-black/30 rounded-xl border border-white/5">
                      <div className="flex flex-col">
                        <span className={`text-xs font-bold uppercase ${h.result === 'win' ? 'text-green-400' : 'text-red-400'}`}>
                          {h.result === 'win' ? 'Победа' : 'Поражение'}
                        </span>
                        <span className="text-[10px] text-gray-500">{h.mode}</span>
                      </div>
                      <span className="text-sm font-bold text-white">{h.score}</span>
                    </div>
                  ))}
                  {(!data.history || data.history.length === 0) && (
                    <div className="text-center text-gray-500 text-sm py-2">Нет истории игр</div>
                  )}
                </div>
              </div>

            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
