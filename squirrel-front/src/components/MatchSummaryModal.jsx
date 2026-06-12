import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { useGameStore } from "../store";
import { getUrl } from "../config/settings";
import UserProfileModal from "./UserProfileModal";

export default function MatchSummaryModal({ match, currentUserId, onClose, onWatchReplay }) {
  const matchId = match?.id;
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [friendsRequested, setFriendsRequested] = useState({});
  const [myFriends, setMyFriends] = useState({});
  const [selectedProfileId, setSelectedProfileId] = useState(null);
  const [selectedProfileName, setSelectedProfileName] = useState(null);
  const [selectedProfileAvatar, setSelectedProfileAvatar] = useState(null);
  const user = useGameStore((s) => s.user);
  const token = localStorage.getItem("access_token");

  useEffect(() => {
    if (!matchId) return;

    axios.get(getUrl(`/v1/history/${matchId}/replay`), {
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

    axios.get(getUrl("/v1/friends"), {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => {
        const friendsMap = {};
        res.data.forEach(f => friendsMap[f.id] = true);
        setMyFriends(friendsMap);
      })
      .catch(e => console.error(e));
  }, [matchId, token]);

  const handleAddFriend = (playerId) => {
    axios.post(getUrl("/v1/friends/requests"), { target_id: playerId }, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(() => {
      setFriendsRequested(prev => ({ ...prev, [playerId]: true }));
    }).catch(e => console.error(e));
  };

  const analytics = React.useMemo(() => {
    if (!data?.events || !data?.players) return null;
    const stats = {};
    data.players.forEach(p => {
        stats[p.telegram_id] = { tricks: 0, points: 0, cards_played: 0, name: p.username, avatar: p.avatar };
    });

    const posMap = { North: 0, East: 1, South: 2, West: 3 };
    const getPid = (pos) => data.players[posMap[pos]]?.telegram_id;

    let currentTrickCards = [];
    data.events.forEach(ev => {
       if (ev.type === 'PlayCard') {
           currentTrickCards.push(ev.card);
           const pid = getPid(ev.position);
           if (pid && stats[pid]) stats[pid].cards_played += 1;
       }
       if (ev.type === 'TrickWon') {
           const pid = getPid(ev.position);
           if (pid && stats[pid]) {
               stats[pid].tricks += 1;
               const pointsArr = currentTrickCards.map(c => {
                  if (c.rank === 'Jack') return 2;
                  if (c.rank === 'Queen') return 3;
                  if (c.rank === 'King') return 4;
                  if (c.rank === 'Ten') return 10;
                  if (c.rank === 'Ace') return 11;
                  return 0;
               });
               stats[pid].points += pointsArr.reduce((a,b)=>a+b, 0);
           }
           currentTrickCards = [];
       }
       if (ev.type === 'RoundStart') { currentTrickCards = []; }
    });

    return Object.entries(stats).map(([id, s]) => ({ id, ...s })).sort((a,b) => b.points - a.points);
  }, [data]);

  if (!matchId) return null;

  return ReactDOM.createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="bg-gray-900 border border-purple-500/50 rounded-4xl p-4 sm:p-6 max-w-2xl w-full max-h-[95vh] overflow-y-auto no-scrollbar shadow-2xl relative"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white"
          >
            ✕
          </button>

          <h2 className="text-2xl font-black text-white mb-6 text-center">Итоги матча</h2>

          {loading ? (
            <div className="text-center text-purple-400 py-10 animate-pulse">Загрузка...</div>
          ) : !data ? (
            <div className="text-center text-red-400 py-10">Ошибка загрузки</div>
          ) : (
            <div className="space-y-6">
              {/* MATCH DETAILS */}
              <div className="flex justify-between items-center bg-black/40 p-4 rounded-2xl border border-white/5">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-gray-500 mb-1">Режим</span>
                  <span className="text-sm font-bold text-white">{match.mode}</span>
                </div>
                
                <div className="flex flex-col items-center">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-gray-500 mb-1">Результат</span>
                  <span className={`text-sm tracking-wide font-extrabold uppercase px-2 py-0.5 rounded-full ${
                    match.result === 'win' ? 'text-green-400 bg-green-500/10' : 
                    match.result === 'lose' ? 'text-red-400 bg-red-500/10' : 
                    'text-orange-400 bg-orange-500/10'
                  }`}>
                    {match.result === 'win' ? 'Победа' : match.result === 'lose' ? 'Поражение' : 'Покинуто'}
                  </span>
                </div>

                <div className="flex flex-col items-end">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-gray-500 mb-1">Счет</span>
                  <span className="text-sm font-bold text-white">{match.score || "—"}</span>
                </div>
              </div>

              {/* PLAYERS */}
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-bold text-gray-400 text-center">Игроки</h3>
                <div className="grid grid-cols-2 gap-4">
                  {data.players.map((p) => {
                    const isMe = p.telegram_id.toString() === currentUserId?.toString();

                    return (
                      <div key={p.telegram_id} className="flex flex-col items-center p-3 rounded-2xl bg-black/30 border border-purple-500/20">
                        <img
                          src={p.avatar || `https://api.dicebear.com/7.x/thumbs/svg?seed=${p.username || p.telegram_id}`}
                          className="w-14 h-14 rounded-full border-2 border-purple-500 mb-2 object-cover cursor-pointer hover:scale-105 transition-transform"
                          alt="avatar"
                          onClick={() => {
                            if (p.telegram_id > 0) {
                              setSelectedProfileId(p.telegram_id);
                              setSelectedProfileName(p.username);
                              setSelectedProfileAvatar(p.avatar);
                            }
                          }}
                        />
                        <span 
                          className="text-sm font-bold text-white truncate max-w-full cursor-pointer hover:underline"
                          onClick={() => {
                            if (p.telegram_id > 0) {
                              setSelectedProfileId(p.telegram_id);
                              setSelectedProfileName(p.username);
                              setSelectedProfileAvatar(p.avatar);
                            }
                          }}
                        >
                          {p.username || "Squirrel"}
                        </span>
                        {!isMe && p.telegram_id > 0 && (
                          myFriends[p.telegram_id] ? (
                            <button
                              disabled
                              className="mt-2 px-3 py-1 text-xs rounded-full font-bold bg-green-600/50 text-white border border-green-500/30"
                            >
                              Уже друг
                            </button>
                          ) : (
                            <button
                              disabled={friendsRequested[p.telegram_id]}
                              onClick={() => handleAddFriend(p.telegram_id)}
                              className={`mt-2 px-3 py-1 text-xs rounded-full font-bold transition-all ${friendsRequested[p.telegram_id]
                                ? "bg-gray-700 text-gray-400"
                                : "bg-purple-600 hover:bg-purple-500 text-white"
                                }`}
                            >
                              {friendsRequested[p.telegram_id] ? "Запрос отправлен" : "В друзья"}
                            </button>
                          )
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ANALYTICS */}
              {analytics && analytics.length > 0 && (
                <div className="flex flex-col gap-3 pt-4 border-t border-white/10">
                  <h3 className="text-sm font-bold text-gray-400 text-center">Аналитика игроков</h3>
                  <div className="flex flex-col gap-2">
                    {analytics.map((playerStat, idx) => (
                       <div key={playerStat.id} className={`flex items-center justify-between p-3 rounded-2xl border ${idx === 0 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-black/30 border-white/5'}`}>
                          <div className="flex items-center gap-3">
                             <img src={playerStat.avatar || `https://api.dicebear.com/7.x/thumbs/svg?seed=${playerStat.name || playerStat.id}`} className={`w-10 h-10 rounded-full object-cover border-2 ${idx === 0 ? 'border-amber-400' : 'border-gray-600'}`} alt="p" />
                             <div className="flex flex-col">
                                <span className={`font-bold text-sm ${idx === 0 ? 'text-amber-400' : 'text-white'}`}>
                                  {playerStat.name || "Squirrel"} {idx === 0 && '👑 (MVP)'}
                                </span>
                                <span className="text-[10px] text-gray-400 font-medium">{playerStat.cards_played} карт сыграно</span>
                             </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                             <span className="text-xs font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md">Взяток: {playerStat.tricks}</span>
                             <span className="text-xs font-bold text-green-400 bg-green-500/10 px-2 py-0.5 rounded-md">Очков: {playerStat.points}</span>
                          </div>
                       </div>
                    ))}
                  </div>
                </div>
              )}

              {/* BUTTONS ROW */}
              <div className="mt-6 flex flex-col sm:flex-row justify-center gap-4 pt-2">
                 <button
                   onClick={() => {
                     const botName = import.meta.env.VITE_BOT_NAME || "squirrel_game_bot";
                     const shareUrl = `https://t.me/${botName}?startapp=ref_${user?.id || ''}`;
                     const text = `Я только что сыграл в Белку и набрал ${match.score || 'отличный счет'}! Попробуй побить мой рекорд! 🐿`;
                     if (window.Telegram?.WebApp) {
                        window.Telegram.WebApp.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`);
                     } else {
                        window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`, "_blank");
                     }
                   }}
                   className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:scale-105 active:scale-95 transition-all text-white font-black uppercase tracking-widest rounded-2xl shadow-[0_0_20px_rgba(59,130,246,0.5)] flex items-center justify-center gap-2"
                 >
                   <span>📣</span> ПОХВАСТАТЬСЯ
                 </button>

                 <button
                   onClick={() => onWatchReplay(data)}
                   className="px-6 py-3 bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:scale-105 active:scale-95 transition-all text-white font-black uppercase tracking-widest rounded-2xl shadow-[0_0_20px_rgba(168,85,247,0.5)] flex items-center justify-center gap-2"
                 >
                   <span>▶</span> СМОТРЕТЬ РЕПЛЕЙ
                 </button>
              </div>

            </div>
          )}
        </motion.div>
      </motion.div>

      {selectedProfileId && (
        <UserProfileModal
          targetId={selectedProfileId}
          targetName={selectedProfileName}
          targetAvatar={selectedProfileAvatar}
          onClose={() => setSelectedProfileId(null)}
        />
      )}
    </AnimatePresence>,
    document.body
  );
}
