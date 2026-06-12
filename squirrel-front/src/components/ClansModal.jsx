import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { getUrl } from "../config/settings";
import { useGameStore } from "../store";
import { sendjoinRoom } from "../ws/client";

export default function ClansModal({ onClose }) {
  const [activeTab, setActiveTab] = useState("search"); // 'search', 'my_clan', 'create'
  const [clans, setClans] = useState([]);
  const [myClanData, setMyClanData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tournaments, setTournaments] = useState([]);
  const [activeTournamentId, setActiveTournamentId] = useState(null);
  const [tournamentDetails, setTournamentDetails] = useState(null);
  const [registrationMode, setRegistrationMode] = useState(false);
  const [selectedMain, setSelectedMain] = useState([]);
  const [selectedSubs, setSelectedSubs] = useState([]);
  const [createForm, setCreateForm] = useState({ name: "", tag: "" });
  const [errorMsg, setErrorMsg] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const chatEndRef = React.useRef(null);
  const user = useGameStore(s => s.user);
  const fetchUser = useGameStore(s => s.fetchUser);
  const token = localStorage.getItem("access_token");

  useEffect(() => {
    fetchClans();
    checkMyClan();
    fetchTournaments();
  }, []);

  useEffect(() => {
    let interval;
    if (activeTab === "tournaments" && activeTournamentId) {
      interval = setInterval(() => {
        fetchTournamentDetails(activeTournamentId, false);
      }, 10000); // Poll every 10 seconds
    }
    if (activeTab === "chat" && myClanData) {
      interval = setInterval(() => {
        fetchClanChat(myClanData.clan.id, false);
      }, 3000); // Poll chat every 3 seconds
    }
    return () => clearInterval(interval);
  }, [activeTab, activeTournamentId, myClanData]);

  const fetchTournaments = () => {
    axios.get(getUrl("/v1/tournaments"), { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setTournaments(res.data))
      .catch(e => console.error("Failed to fetch tournaments", e));
  };

  const fetchClans = () => {
    setLoading(true);
    axios.get(getUrl("/v1/clans"), { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        setClans(res.data);
        setLoading(false);
      })
      .catch(e => {
        console.error(e);
        setLoading(false);
      });
  };

  const checkMyClan = () => {
    // A bit hacky: to check if I have a clan, I can check my public profile
    axios.get(getUrl(`/v1/profile/${user.id}`), { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        if (res.data.clan) {
          fetchClanDetails(res.data.clan.id);
        }
      }).catch(e => console.error(e));
  };

  const fetchClanDetails = (clanId) => {
    axios.get(getUrl(`/v1/clans/${clanId}`), { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        setMyClanData(res.data);
      }).catch(e => console.error(e));
  };

  const fetchTournamentDetails = (id, showLoading = true) => {
    if (showLoading) setLoading(true);
    if (showLoading) setErrorMsg("");
    axios.get(getUrl(`/v1/tournaments/${id}`), { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        setTournamentDetails(res.data);
        setActiveTournamentId(id);
        if (showLoading) setRegistrationMode(false);
        if (showLoading) setLoading(false);
      })
      .catch(e => {
        console.error(e);
        if (showLoading) setLoading(false);
      });
  };

  const fetchClanChat = (clanId, scrollToBottom = true) => {
    axios.get(getUrl(`/v1/clans/${clanId}/chat`), { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        setChatMessages(res.data);
        if (scrollToBottom) {
          setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        }
      }).catch(e => console.error("Chat error", e));
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !myClanData) return;
    try {
      await axios.post(getUrl(`/v1/clans/${myClanData.clan.id}/chat`), { message: newMessage }, { headers: { Authorization: `Bearer ${token}` } });
      setNewMessage("");
      fetchClanChat(myClanData.clan.id, true);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRoleChange = async (targetId, newRole) => {
    try {
      await axios.post(getUrl(`/v1/clans/${myClanData.clan.id}/members/${targetId}/role`), { role: newRole }, { headers: { Authorization: `Bearer ${token}` } });
      fetchClanDetails(myClanData.clan.id);
    } catch (e) {
      alert(e.response?.data || "Ошибка");
    }
  };

  const handleKick = async (targetId) => {
    if (!window.confirm("Уверены, что хотите выгнать игрока?")) return;
    try {
      await axios.post(getUrl(`/v1/clans/${myClanData.clan.id}/members/${targetId}/kick`), {}, { headers: { Authorization: `Bearer ${token}` } });
      fetchClanDetails(myClanData.clan.id);
    } catch (e) {
      alert(e.response?.data || "Ошибка");
    }
  };

  const handleRegisterTournament = async () => {
    if (selectedMain.length !== 2) {
      setErrorMsg("В основном составе должно быть ровно 2 игрока");
      return;
    }
    if (selectedSubs.length > 4) {
      setErrorMsg("Запасных может быть не больше 4");
      return;
    }
    try {
      await axios.post(getUrl(`/v1/tournaments/${activeTournamentId}/register`), {
        main_squad: selectedMain,
        substitutes: selectedSubs
      }, { headers: { Authorization: `Bearer ${token}` } });
      alert("Клан успешно зарегистрирован!");
      fetchTournamentDetails(activeTournamentId);
    } catch (e) {
      setErrorMsg(e.response?.data?.message || e.response?.data || "Ошибка регистрации");
    }
  };

  const handleCreate = async () => {
    setErrorMsg("");
    try {
      const res = await axios.post(getUrl("/v1/clans"), createForm, { headers: { Authorization: `Bearer ${token}` } });
      await fetchUser(token); // Update balance
      fetchClanDetails(res.data.id);
    } catch (e) {
      setErrorMsg(e.response?.data?.message || e.response?.data || "Ошибка создания клана");
    }
  };

  const handleJoin = async (clanId) => {
    setErrorMsg("");
    try {
      await axios.post(getUrl(`/v1/clans/${clanId}/join`), {}, { headers: { Authorization: `Bearer ${token}` } });
      fetchClanDetails(clanId);
    } catch (e) {
      setErrorMsg(e.response?.data?.message || e.response?.data || "Не удалось вступить");
    }
  };

  const handleLeave = async () => {
    if (!window.confirm("Вы уверены, что хотите покинуть клан?")) return;
    try {
      await axios.post(getUrl(`/v1/clans/leave`), {}, { headers: { Authorization: `Bearer ${token}` } });
      setMyClanData(null);
      setActiveTab("search");
      fetchClans();
    } catch (e) {
      alert("Ошибка выхода из клана");
    }
  };

  return ReactDOM.createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="bg-gray-900 border border-purple-500/50 rounded-4xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-[0_0_40px_rgba(168,85,247,0.3)] overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative p-6 bg-gradient-to-b from-purple-900/40 to-transparent border-b border-white/5">
            <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white">✕</button>
            <h2 className="text-3xl font-black text-center text-white mb-4">🛡 Кланы</h2>
            
            {/* Tabs */}
            <div className="flex bg-black/40 rounded-xl p-1 gap-1">
              <button
                onClick={() => setActiveTab("search")}
                className={`flex-1 py-2 text-xs sm:text-sm font-bold uppercase rounded-lg transition-all ${activeTab === 'search' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                Топ кланов
              </button>
              <button
                onClick={() => { setActiveTab("tournaments"); setActiveTournamentId(null); }}
                className={`flex-1 py-2 text-xs sm:text-sm font-bold uppercase rounded-lg transition-all ${activeTab === 'tournaments' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                Турниры
              </button>
              {myClanData ? (
                <>
                  <button
                    onClick={() => setActiveTab("my_clan")}
                    className={`flex-1 py-2 text-xs sm:text-sm font-bold uppercase rounded-lg transition-all ${activeTab === 'my_clan' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
                  >
                    Мой Клан
                  </button>
                  <button
                    onClick={() => { setActiveTab("chat"); fetchClanChat(myClanData.clan.id); }}
                    className={`flex-1 py-2 text-xs sm:text-sm font-bold uppercase rounded-lg transition-all ${activeTab === 'chat' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'}`}
                  >
                    Чат
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setActiveTab("create")}
                  className={`flex-1 py-2 text-xs sm:text-sm font-bold uppercase rounded-lg transition-all ${activeTab === 'create' ? 'bg-amber-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  Создать
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 no-scrollbar relative min-h-[300px]">
            {loading && activeTab === "search" ? (
              <div className="text-center text-purple-400 py-10 animate-pulse">Поиск кланов...</div>
            ) : (
              <>
                {/* Search Tab */}
                {activeTab === "search" && (
                  <div className="space-y-3">
                    {errorMsg && <div className="text-red-400 text-center text-sm font-bold mb-2 bg-red-500/10 p-2 rounded-lg">{errorMsg}</div>}
                    {clans.length === 0 ? (
                      <div className="text-center text-gray-500 py-10">Нет доступных кланов</div>
                    ) : (
                      clans.map((c, i) => (
                        <div key={c.id} className="flex justify-between items-center bg-black/40 p-4 rounded-2xl border border-white/5 hover:bg-black/60 transition-colors">
                          <div className="flex items-center gap-4">
                            <span className="text-gray-500 font-black text-lg w-6 text-center">#{i + 1}</span>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-amber-400">[{c.tag}]</span>
                                <span className="font-bold text-white text-lg">{c.name}</span>
                              </div>
                              <div className="text-xs text-gray-400 flex gap-3 mt-1">
                                <span>👥 {c.members_count} / 50</span>
                                <span>🏆 {c.trophies} Трофеев</span>
                              </div>
                            </div>
                          </div>
                          {!myClanData && (
                            <button
                              onClick={() => handleJoin(c.id)}
                              className="px-4 py-2 bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 rounded-xl font-bold transition-colors border border-purple-500/30 text-sm"
                            >
                              Вступить
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Tournaments Tab */}
                {activeTab === "tournaments" && !activeTournamentId && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center bg-blue-900/20 border border-blue-500/30 rounded-2xl p-4 mb-4">
                      <div>
                        <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Ваш баланс</div>
                        <div className="text-xl font-black text-white flex items-center gap-2">
                          {user?.tournament_coins || 0} 
                          <span className="text-blue-400">🛡</span>
                        </div>
                      </div>
                      <div className="text-right max-w-[150px]">
                        <div className="text-[10px] text-gray-400 leading-tight">Участвуйте в клановых битвах, чтобы зарабатывать монеты!</div>
                      </div>
                    </div>

                    {tournaments.length === 0 ? (
                      <div className="text-center text-gray-500 py-10">Нет доступных турниров</div>
                    ) : (
                      tournaments.map(t => (
                        <div key={t.id} onClick={() => fetchTournamentDetails(t.id, true)} className="relative bg-black/40 border border-white/5 rounded-2xl p-5 overflow-hidden cursor-pointer hover:bg-black/60 transition-colors">
                          <div className={`absolute top-0 right-0 px-3 py-1 rounded-bl-xl text-[10px] font-black uppercase tracking-widest ${
                            t.status === 'active' ? 'bg-green-500/20 text-green-400' : 
                            t.status === 'upcoming' ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-500/20 text-gray-400'
                          }`}>
                            {t.status === 'active' ? 'Активный' : t.status === 'upcoming' ? 'Ожидается' : 'Завершен'}
                          </div>
                          
                          <h4 className="text-xl font-black text-white mb-1 pr-20">{t.title}</h4>
                          
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 mt-4">
                            <div className="flex flex-col">
                              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Начало</span>
                              <span className="text-sm font-bold text-gray-300">{new Date(t.startTime).toLocaleString()}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Окончание</span>
                              <span className="text-sm font-bold text-gray-300">{new Date(t.endTime).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === "tournaments" && activeTournamentId && tournamentDetails && (
                  <div className="space-y-4">
                    <button onClick={() => setActiveTournamentId(null)} className="text-blue-400 text-sm font-bold flex items-center gap-1 hover:text-blue-300">
                      ← Назад к списку турниров
                    </button>
                    
                    <div className="bg-black/40 border border-blue-500/30 rounded-2xl p-4 text-center">
                      <h3 className="text-2xl font-black text-white">{tournamentDetails.title}</h3>
                      <div className="text-sm text-gray-400 mt-1">
                        Статус: <span className={tournamentDetails.status === 'upcoming' ? 'text-amber-400' : 'text-green-400'}>{tournamentDetails.status}</span>
                      </div>
                    </div>

                    {errorMsg && <div className="text-red-400 text-center text-sm font-bold mb-2 bg-red-500/10 p-2 rounded-lg">{errorMsg}</div>}

                    {tournamentDetails.status === 'upcoming' && (
                      <div className="bg-[#1a1a2e]/80 border border-white/5 rounded-2xl p-4">
                        <h4 className="font-bold text-white mb-3">Регистрация клана</h4>
                        {tournamentDetails.myClanRegistration ? (
                          <div className="text-center py-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                            <span className="text-green-400 font-bold block mb-1">Ваш клан уже зарегистрирован!</span>
                            <span className="text-sm text-gray-400">Основа: {tournamentDetails.myClanRegistration.squad.filter(s => !s.isSubstitute).length} чел. • Замена: {tournamentDetails.myClanRegistration.squad.filter(s => s.isSubstitute).length} чел.</span>
                          </div>
                        ) : myClanData && myClanData.clan.owner_id === user?.id ? (
                          registrationMode ? (
                            <div className="space-y-4">
                              <p className="text-sm text-gray-400 text-center mb-2">Выберите 2 игроков для основы и до 4 для замены.</p>
                              <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                {myClanData.members.map(m => (
                                  <div key={m.telegram_id} className="flex items-center justify-between bg-black/30 p-2 rounded-xl">
                                    <div className="flex items-center gap-2">
                                      <img src={m.avatar} className="w-8 h-8 rounded-full" />
                                      <span className="text-white font-bold">{m.username}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs">
                                      <label className="flex items-center gap-1 cursor-pointer">
                                        <input type="checkbox" checked={selectedMain.includes(m.telegram_id)} onChange={(e) => {
                                          if (e.target.checked) {
                                            setSelectedMain(prev => [...prev, m.telegram_id]);
                                            setSelectedSubs(prev => prev.filter(id => id !== m.telegram_id));
                                          } else setSelectedMain(prev => prev.filter(id => id !== m.telegram_id));
                                        }} />
                                        Основа
                                      </label>
                                      <label className="flex items-center gap-1 cursor-pointer">
                                        <input type="checkbox" checked={selectedSubs.includes(m.telegram_id)} onChange={(e) => {
                                          if (e.target.checked) {
                                            setSelectedSubs(prev => [...prev, m.telegram_id]);
                                            setSelectedMain(prev => prev.filter(id => id !== m.telegram_id));
                                          } else setSelectedSubs(prev => prev.filter(id => id !== m.telegram_id));
                                        }} />
                                        Замена
                                      </label>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <button onClick={handleRegisterTournament} className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition">
                                Подтвердить заявку
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => setRegistrationMode(true)} className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                              Подать заявку на участие
                            </button>
                          )
                        ) : (
                          <div className="text-center py-4 bg-black/40 rounded-xl text-gray-400 text-sm">
                            Только лидер клана может подать заявку на турнир.
                          </div>
                        )}
                      </div>
                    )}

                    {(tournamentDetails.status === 'active' || tournamentDetails.status === 'finished') && (
                      <div className="bg-[#1a1a2e]/80 border border-white/5 rounded-2xl p-4 overflow-x-auto">
                        <h4 className="font-bold text-white mb-3 text-center">Турнирная сетка</h4>
                        {tournamentDetails.matches && tournamentDetails.matches.length > 0 ? (
                          <div className="flex gap-8 justify-center min-w-max p-2">
                            {/* Simple Bracket Visualization (Grouping by Round) */}
                            {[...new Set(tournamentDetails.matches.map(m => m.round))].map(round => (
                              <div key={round} className="flex flex-col gap-4 justify-around">
                                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest text-center">Раунд {round}</div>
                                {tournamentDetails.matches.filter(m => m.round === round).map(m => (
                                  <div key={m.id} className="bg-black/50 border border-purple-500/20 rounded-lg p-2 w-48 text-sm relative">
                                    <div className={`flex justify-between items-center py-1 ${m.winnerId === m.clan1Id ? 'text-green-400 font-bold' : m.winnerId ? 'text-gray-500 line-through' : 'text-gray-300'}`}>
                                      <span>Клан {m.clan1Id || 'BYE'}</span>
                                      {m.winnerId === m.clan1Id && <span className="text-amber-400">★</span>}
                                    </div>
                                    <div className="h-[1px] bg-white/10 w-full my-1"></div>
                                    <div className={`flex justify-between items-center py-1 ${m.winnerId === m.clan2Id ? 'text-green-400 font-bold' : m.winnerId ? 'text-gray-500 line-through' : 'text-gray-300'}`}>
                                      <span>Клан {m.clan2Id || 'BYE'}</span>
                                      {m.winnerId === m.clan2Id && <span className="text-amber-400">★</span>}
                                    </div>
                                    
                                    {m.roomId && !m.winnerId && tournamentDetails.myClanRegistration?.squad.some(s => s.telegramId === user?.id) && (m.clan1Id === myClanData?.clan?.id || m.clan2Id === myClanData?.clan?.id) && (
                                      <div className="mt-2 space-y-1">
                                        <div className="text-[10px] text-amber-400 font-bold text-center animate-pulse">Матч начался! Тайм-аут: 5 минут</div>
                                        <button 
                                          onClick={() => { sendjoinRoom(m.roomId); onClose(); }} 
                                          className="w-full py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded-lg transition"
                                        >
                                          Войти в игру
                                        </button>
                                      </div>
                                    )}
                                    {m.roomId && !m.winnerId && !(tournamentDetails.myClanRegistration?.squad.some(s => s.telegramId === user?.id) && (m.clan1Id === myClanData?.clan?.id || m.clan2Id === myClanData?.clan?.id)) && (
                                      <div className="mt-2 text-[10px] text-blue-400 font-bold text-center animate-pulse">Ожидание результатов...</div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-4 text-gray-500 text-sm">Сетка формируется...</div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* My Clan Tab */}
                {activeTab === "my_clan" && myClanData && (
                  <div className="space-y-6">
                    <div className="text-center">
                      <div className="inline-block px-4 py-1 bg-amber-500/20 border border-amber-500/50 rounded-full text-amber-400 font-black tracking-widest mb-3">
                        [{myClanData.clan.tag}]
                      </div>
                      <h3 className="text-3xl font-black text-white">{myClanData.clan.name}</h3>
                      <div className="mt-4 flex justify-center gap-6">
                        <div className="flex flex-col items-center">
                          <span className="text-gray-500 text-[10px] uppercase font-bold tracking-widest mb-1">Трофеи</span>
                          <span className="text-xl font-black text-amber-400">🏆 {myClanData.clan.trophies}</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-gray-500 text-[10px] uppercase font-bold tracking-widest mb-1">Участники</span>
                          <span className="text-xl font-black text-purple-400">👥 {myClanData.clan.members_count}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-black/30 rounded-2xl border border-white/5 overflow-hidden">
                      <div className="bg-black/50 py-2 px-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-white/5 flex justify-between">
                        <span>Игрок</span>
                        <span>Рейтинг</span>
                      </div>
                      <div className="max-h-[300px] overflow-y-auto no-scrollbar">
                        {myClanData.members.map(m => {
                          const isMe = m.telegram_id === user?.id;
                          const myRole = myClanData.members.find(x => x.telegram_id === user?.id)?.role;
                          const canManage = (myRole === 'leader' || (myRole === 'officer' && m.role === 'member')) && !isMe;

                          return (
                            <div key={m.telegram_id} className="flex justify-between items-center p-3 sm:px-4 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors group">
                              <div className="flex items-center gap-3">
                                <img src={m.avatar || `https://api.dicebear.com/7.x/thumbs/svg?seed=${m.username}`} className="w-10 h-10 rounded-full" alt="avatar" />
                                <div className="flex flex-col">
                                  <span className="font-bold text-white flex items-center gap-2">
                                    {m.username} {isMe && <span className="text-[10px] bg-white/20 px-1.5 rounded text-white">Вы</span>}
                                  </span>
                                  <span className={`text-[10px] font-bold uppercase ${m.role === 'leader' ? 'text-amber-400' : m.role === 'officer' ? 'text-blue-400' : 'text-gray-500'}`}>
                                    {m.role === 'leader' ? 'Лидер' : m.role === 'officer' ? 'Офицер' : 'Участник'}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="font-bold text-purple-400 mr-2 group-hover:hidden block">{m.rating}</span>
                                {canManage && (
                                  <div className="hidden group-hover:flex items-center gap-1">
                                    {myRole === 'leader' && m.role === 'member' && (
                                      <button onClick={() => handleRoleChange(m.telegram_id, 'officer')} className="bg-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white px-2 py-1 rounded text-xs font-bold transition">↑ Офицер</button>
                                    )}
                                    {myRole === 'leader' && m.role === 'officer' && (
                                      <button onClick={() => handleRoleChange(m.telegram_id, 'member')} className="bg-orange-500/20 text-orange-400 hover:bg-orange-500 hover:text-white px-2 py-1 rounded text-xs font-bold transition">↓ Разжаловать</button>
                                    )}
                                    <button onClick={() => handleKick(m.telegram_id)} className="bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white px-2 py-1 rounded text-xs font-bold transition">Кик</button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex justify-center">
                      <button onClick={handleLeave} className="text-red-400 hover:text-red-300 text-sm font-bold uppercase tracking-widest transition-colors py-2 px-6 rounded-xl hover:bg-red-500/10">
                        Покинуть клан
                      </button>
                    </div>
                  </div>
                )}

                {/* Chat Tab */}
                {activeTab === "chat" && myClanData && (
                  <div className="flex flex-col h-full min-h-[400px]">
                    <div className="flex-1 bg-black/30 rounded-t-2xl border border-white/5 p-4 overflow-y-auto space-y-3 mb-2 flex flex-col max-h-[50vh]">
                      {chatMessages.length === 0 ? (
                        <div className="text-center text-gray-500 my-auto text-sm">В чате пока тихо... Напишите первыми!</div>
                      ) : (
                        chatMessages.map(msg => {
                          const isMe = msg.senderId === user?.id;
                          return (
                            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                              <div className="flex items-end gap-2 max-w-[80%]">
                                {!isMe && <div className="text-[10px] text-gray-400 mb-1 ml-1">{msg.senderName}</div>}
                                <div className={`px-4 py-2 rounded-2xl text-sm ${isMe ? 'bg-green-600 text-white rounded-br-none' : 'bg-gray-800 text-gray-200 rounded-bl-none'}`}>
                                  {msg.message}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                      <div ref={chatEndRef} />
                    </div>
                    <form onSubmit={handleSendMessage} className="flex gap-2">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={e => setNewMessage(e.target.value)}
                        placeholder="Написать клану..."
                        maxLength={200}
                        className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-green-500 transition-colors"
                      />
                      <button 
                        type="submit" 
                        disabled={!newMessage.trim()}
                        className="px-6 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:hover:bg-green-600 rounded-xl text-white font-bold transition"
                      >
                        ↑
                      </button>
                    </form>
                  </div>
                )}

                {/* Create Clan Tab */}
                {activeTab === "create" && (
                  <div className="flex flex-col items-center space-y-6 pt-4">
                    <div className="text-center">
                      <div className="text-6xl mb-4">🛡</div>
                      <h3 className="text-xl font-black text-white">Основать клан</h3>
                      <p className="text-gray-400 text-sm mt-2 max-w-sm">Соберите команду, участвуйте в турнирах выходного дня и зарабатывайте турнирные монеты!</p>
                    </div>

                    <div className="w-full max-w-sm space-y-4">
                      {errorMsg && <div className="text-red-400 text-center text-sm font-bold bg-red-500/10 p-3 rounded-xl border border-red-500/20">{errorMsg}</div>}
                      
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-2">Название клана</label>
                        <input
                          type="text"
                          value={createForm.name}
                          onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))}
                          className="w-full mt-1 bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-purple-500 transition-colors"
                          placeholder="Например: Сильные Белки"
                          maxLength={20}
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-2">Тег (ДО 5 СИМВОЛОВ)</label>
                        <input
                          type="text"
                          value={createForm.tag}
                          onChange={e => setCreateForm(p => ({ ...p, tag: e.target.value.toUpperCase() }))}
                          className="w-full mt-1 bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white font-bold uppercase focus:outline-none focus:border-purple-500 transition-colors"
                          placeholder="PRO"
                          maxLength={5}
                        />
                      </div>

                      <button
                        onClick={handleCreate}
                        disabled={!createForm.name || !createForm.tag}
                        className="w-full mt-4 py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:scale-105 active:scale-95 transition-all text-white font-black uppercase tracking-widest shadow-[0_0_20px_rgba(245,158,11,0.4)] disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        Создать за 10,000 🌰
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
