import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Trophy, Users, Sparkles, 
  ChevronRight, ArrowUpRight,
  Play, Gamepad2, Info, RefreshCw,
  Award, Menu, X
} from "lucide-react";
import confetti from "canvas-confetti";
import { CardFace } from "./components/CardFace";
import { useGameStore } from "./store";
import ChestGraphic from "./components/ChestGraphic";

export default function LandingPage() {
  const navigate = useNavigate();
  const ecoMode = useGameStore((s) => s.ecoMode);
  const setEcoMode = useGameStore((s) => s.setEcoMode);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Detect mobile/tablet screen widths to apply touch-safe styles & layouts
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  
  // Real-time online stats
  const [playersOnline, setPlayersOnline] = useState(6425);
  const [matchesPlayed, setMatchesPlayed] = useState(148720);
  useEffect(() => {
    const interval = setInterval(() => {
      setPlayersOnline(prev => prev + Math.floor(Math.random() * 9) - 4);
      setMatchesPlayed(prev => prev + Math.floor(Math.random() * 2));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // 1. CHEST OPENER STATE
  const [chestType, setChestType] = useState("epic"); // common | epic
  const [isOpening, setIsOpening] = useState(false);
  const [rewardCard, setRewardCard] = useState(null); // card + theme
  const [shakeActive, setShakeActive] = useState(false);

  const cardPool = [
    { rank: "King", suit: "Spades", theme: "forest", name: "Лесной Король", rarity: "rare", glow: "#10b981" },
    { rank: "Queen", suit: "Hearts", theme: "cyber", name: "Кибер-Королева", rarity: "mythic", glow: "#06b6d4" },
    { rank: "Jack", suit: "Clubs", theme: "classic", name: "Валет Треф", rarity: "common", glow: "#d6d3d1" },
    { rank: "King", suit: "Diamonds", theme: "gold", name: "Золотой Король", rarity: "mythic", glow: "#fbbf24" },
    { rank: "Jack", suit: "Hearts", theme: "pink", name: "Пляжный Валет", rarity: "rare", glow: "#ec4899" }
  ];

  const handleOpenChest = () => {
    if (isOpening) return;
    setIsOpening(true);
    setShakeActive(true);
    setRewardCard(null);

    // Stop shaking and reveal card
    setTimeout(() => {
      setShakeActive(false);
      const randomCard = cardPool[Math.floor(Math.random() * cardPool.length)];
      setRewardCard(randomCard);
      
      // Trigger confetti
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 }
      });
      setIsOpening(false);
    }, 1200);
  };

  // 2. GAMEPLAY TABLE SIMULATOR STATE
  const [simStep, setSimStep] = useState(0); // 0: Deal, 1: Opp1, 2: Partner, 3: Opp2, 4: You (Win Trick), 5: Results
  const [trickPoints, setTrickPoints] = useState(0);

  const handleNextSimStep = () => {
    if (simStep === 5) {
      setSimStep(0);
      setTrickPoints(0);
    } else {
      setSimStep(prev => prev + 1);
      if (simStep === 3) {
        setTrickPoints(25);
      }
    }
  };

  // 3. TOURNAMENT ACTIVE BRACKET
  const bracketData = {
    quarter: [
      { id: 1, team1: "KSKR 🐺", team2: "SRYA 🦅", score1: 3, score2: 1 },
      { id: 2, team1: "UZIX ⚡", team2: "ALMT 🌟", score1: 3, score2: 2 }
    ],
    semi: [
      { id: 3, team1: "KSKR 🐺", team2: "UZIX ⚡", score1: 3, score2: 2 }
    ],
    final: [
      { id: 4, team1: "KSKR 🐺", team2: "SQRL 🐿️", score1: 2, score2: 1, live: true }
    ]
  };

  // 4. RULES TOGGLER
  const [ruleType, setRuleType] = useState("almaty"); // almaty | northern
  
  const rules = {
    almaty: {
      title: "Алматинские Правила (Классика)",
      cards: "Постоянные козыри — Трефы (Clubs). Валеты всегда являются высшими картами в игре.",
      order: "Валет ♣ > Валет ♠ > Валет ♥ > Валет ♦ > 9 ♣ > Туз ♣ > 10 ♣ > Король ♣...",
      score: "Для победы в партии необходимо набрать 12 очков в раундах. Каждая раздача имеет 120 очков."
    },
    northern: {
      title: "Северные / Региональные Правила",
      cards: "Козырь выбирается во время раздачи в зависимости от первой карты или заявок игроков.",
      order: "Валеты также остаются старшими козырями, но сила масти меняется динамически.",
      score: "Игры ведутся до 12 или 24 очков, допускается объявление особых комбинаций («хвалиться»)."
    }
  };

  // 5. GALLERY OF DECKS
  const [activeTab, setActiveTab] = useState("classic");
  const featuredDecks = {
    classic: {
      title: "Классическая (Classic)",
      rarity: "common",
      description: "Традиционный дизайн карт «Белка» с милыми белками-персонажами в роли Валета, Дамы и Короля.",
      color: "text-gray-300",
      border: "border-stone-400/30",
      accent: "#d6d3d1"
    },
    cyber: {
      title: "Кибер-Белка (Cyberpunk)",
      rarity: "mythic",
      description: "Белка из неонового будущего. Модифицированные кибер-импланты, светящиеся визоры и футуристичный хай-тек дизайн интерфейса.",
      color: "text-cyan-400",
      border: "border-cyan-500/50",
      accent: "#06b6d4"
    },
    gold: {
      title: "Золотой Орех (Golden)",
      rarity: "mythic",
      description: "Премиальное издание. Белка, отлитая из чистейшего золота, на фоне королевского темно-серого бархата с золотым тиснением.",
      color: "text-amber-400",
      border: "border-amber-500/50",
      accent: "#f59e0b"
    },
    forest: {
      title: "Лесной Союз (Forest)",
      rarity: "rare",
      description: "Дикие белки в своей естественной среде обитания. Элементы листвы, лесных орехов и зеленых древесных узоров.",
      color: "text-green-400",
      border: "border-emerald-500/50",
      accent: "#10b981"
    },
    arcane: {
      title: "Чародейская (Arcane)",
      rarity: "mythic",
      description: "Древние мистические руны, вращающиеся знаки призыва и переливающееся магическое сияние на фиолетовом бархате.",
      color: "text-purple-400",
      border: "border-purple-500/50",
      accent: "#a855f7"
    },
    matrix: {
      title: "Код Матрицы (Matrix)",
      rarity: "mythic",
      description: "Бегущий зеленый бинарный код, цифровая неоновая разметка и футуристическая сетка киберпространства стола.",
      color: "text-emerald-400",
      border: "border-emerald-500/50",
      accent: "#22c55e"
    },
    synthwave: {
      title: "Ретровейв (Synthwave)",
      rarity: "mythic",
      description: "Закат в стиле 80-х, неоновые сетки перспективы, хромированные шрифты и сияющее неоновое ретро-солнце.",
      color: "text-pink-500",
      border: "border-pink-500/50",
      accent: "#ff007f"
    }
  };
  const currentDeck = featuredDecks[activeTab];

  return (
    <div className="min-h-screen bg-[#07080f] text-white overflow-x-hidden font-sans selection:bg-purple-500 selection:text-white">
      {/* Background neon elements */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff02_1px,transparent_1px),linear-gradient(to_bottom,#ffffff02_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
      <div className="absolute top-0 left-1/4 w-[280px] sm:w-[600px] h-[300px] sm:h-[600px] bg-purple-600/10 rounded-full blur-[100px] sm:blur-[140px] pointer-events-none" />
      <div className="absolute top-[800px] right-1/4 w-[250px] sm:w-[500px] h-[250px] sm:h-[500px] bg-cyan-600/10 rounded-full blur-[80px] sm:blur-[120px] pointer-events-none" />
      
      {/* STICKY HEADER NAVBAR */}
      <header className="sticky top-0 z-50 backdrop-blur-lg bg-[#07080f]/80 border-b border-white/5 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-18 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/")}>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-500 flex items-center justify-center font-black text-base shadow-[0_0_20px_rgba(139,92,246,0.4)]">
              🐿️
            </div>
            <span className="font-extrabold text-lg sm:text-xl tracking-tight">
              BELKA<span className="text-purple-500">ONLINE</span>
            </span>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-8 text-sm font-medium text-gray-400">
            <a href="#simulator" className="hover:text-white transition-colors">Симулятор</a>
            <a href="#chest-opener" className="hover:text-white transition-colors">Кейсы</a>
            <a href="#showroom" className="hover:text-white transition-colors">Рубашки</a>
            <a href="#tournament" className="hover:text-white transition-colors">Турниры</a>
            <a href="#clans" className="hover:text-white transition-colors">Кланы</a>
            <a href="#rules" className="hover:text-white transition-colors">Правила</a>
          </nav>

          <div className="flex items-center gap-3">
            {/* Eco Mode Toggle */}
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-2.5 py-1.5 rounded-xl text-xs font-bold text-gray-300">
              <span className="hidden xs:inline">🔋 Эко-режим</span>
              <span className="inline xs:hidden">🔋</span>
              <button 
                onClick={() => setEcoMode(!ecoMode)}
                className={`w-8 h-4 rounded-full transition-colors relative ${ecoMode ? "bg-emerald-500" : "bg-gray-600"}`}
                aria-label="Переключить эко-режим"
              >
                <span className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all ${ecoMode ? "left-4" : "left-0.5"}`} />
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-3">
              <button 
                onClick={() => navigate("/login")} 
                className="px-4 py-2 rounded-xl text-sm font-bold bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
              >
                Войти
              </button>
              <button 
                onClick={() => navigate("/login")}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 shadow-md active:scale-95 transition-all flex items-center gap-2"
              >
                <Play size={12} fill="currentColor" /> Играть
              </button>
            </div>
          </div>

          {/* Hamburger Menu Trigger for Mobile */}
          <button 
            onClick={() => setMobileMenuOpen(true)}
            className="flex lg:hidden p-2 rounded-lg text-gray-400 hover:text-white bg-white/5 border border-white/10 active:scale-95 transition-all"
            aria-label="Открыть меню"
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      {/* MOBILE FULL-SCREEN NAVIGATION OVERLAY (Drawer Style) */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Dark glass backdrop overlay */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm"
            />
            {/* Slide-out Panel */}
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 220 }}
              className="fixed top-0 right-0 bottom-0 w-full sm:max-w-md z-[100] bg-[#07080f]/98 border-l border-white/10 backdrop-blur-xl flex flex-col p-6 sm:p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-8 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-cyan-500 flex items-center justify-center text-sm font-black">🐿️</div>
                  <span className="font-extrabold text-lg">BELKA<span className="text-purple-500">ONLINE</span></span>
                </div>
                <button 
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2.5 rounded-xl bg-white/5 text-gray-400 hover:text-white border border-white/10 active:scale-95 transition-all"
                  aria-label="Закрыть меню"
                >
                  <X size={20} />
                </button>
              </div>

              <nav className="flex flex-col gap-5 text-lg font-bold text-gray-300 py-10">
                <a href="#simulator" onClick={() => setMobileMenuOpen(false)} className="hover:text-white flex items-center justify-between py-2 border-b border-white/[0.02] transition-colors">Симулятор игры <ChevronRight size={16} className="text-gray-600" /></a>
                <a href="#chest-opener" onClick={() => setMobileMenuOpen(false)} className="hover:text-white flex items-center justify-between py-2 border-b border-white/[0.02] transition-colors">Кейсы и сундуки <ChevronRight size={16} className="text-gray-600" /></a>
                <a href="#showroom" onClick={() => setMobileMenuOpen(false)} className="hover:text-white flex items-center justify-between py-2 border-b border-white/[0.02] transition-colors">Анимированные колоды <ChevronRight size={16} className="text-gray-600" /></a>
                <a href="#tournament" onClick={() => setMobileMenuOpen(false)} className="hover:text-white flex items-center justify-between py-2 border-b border-white/[0.02] transition-colors">Турниры кланов <ChevronRight size={16} className="text-gray-600" /></a>
                <a href="#clans" onClick={() => setMobileMenuOpen(false)} className="hover:text-white flex items-center justify-between py-2 border-b border-white/[0.02] transition-colors">Таблица лидеров <ChevronRight size={16} className="text-gray-600" /></a>
                <a href="#rules" onClick={() => setMobileMenuOpen(false)} className="hover:text-white flex items-center justify-between py-2 border-b border-white/[0.02] transition-colors">Правила Белки <ChevronRight size={16} className="text-gray-600" /></a>
              </nav>

              <div className="mt-auto flex flex-col gap-4">
                <button 
                  onClick={() => { setMobileMenuOpen(false); navigate("/login"); }}
                  className="w-full py-4 rounded-xl font-bold bg-white/5 border border-white/10 text-center active:scale-98 transition-all"
                >
                  Войти в профиль
                </button>
                <button 
                  onClick={() => { setMobileMenuOpen(false); navigate("/login"); }}
                  className="w-full py-4 rounded-xl font-bold bg-gradient-to-r from-purple-600 to-cyan-600 shadow-[0_0_20px_rgba(139,92,246,0.3)] text-center active:scale-98 transition-all"
                >
                  Начать игру
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* HERO SECTION */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-16 md:pt-20 md:pb-28 flex flex-col lg:flex-row items-center gap-10 lg:gap-6">
        <div className="flex-1 space-y-6 text-center lg:text-left z-10 w-full">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-xs font-bold text-purple-300">
            <Sparkles size={11} className="animate-pulse" /> Карточный хит в Telegram WebApp
          </div>
          
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1]">
            Легендарная карточная <br className="hidden sm:inline" />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-cyan-400 to-amber-300">
              Белка Онлайн
            </span>
          </h1>

          <p className="text-gray-400 max-w-xl text-sm sm:text-base leading-relaxed mx-auto lg:mx-0">
            Командное противостояние 2х2 с игроками по всей сети. Уникальный геймплей с козырями, союзы, клановые войны, сундуки с ценными призами и мифические анимированные колоды на вашем смартфоне.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5 pt-2">
            <button 
              onClick={() => navigate("/login")}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl text-base font-bold bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 active:scale-98 transition-all flex items-center justify-center gap-2.5 shadow-lg"
            >
              <Gamepad2 size={18} /> Играть Бесплатно
            </button>
            <a 
              href="#simulator" 
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl text-base font-bold bg-white/5 border border-white/10 active:scale-98 transition-all text-center flex items-center justify-center gap-1.5"
            >
              Интерактивный гайд <ChevronRight size={16} />
            </a>
          </div>

          <div className="flex justify-center lg:justify-start items-center gap-8 pt-6 border-t border-white/5 max-w-sm mx-auto lg:mx-0">
            <div>
              <div className="text-2xl font-black text-white">{playersOnline.toLocaleString()}</div>
              <div className="text-[10px] text-purple-400 font-bold uppercase tracking-widest">Онлайн</div>
            </div>
            <div className="w-px h-6 bg-white/10" />
            <div>
              <div className="text-2xl font-black text-white">{matchesPlayed.toLocaleString()}</div>
              <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest">Игр сыграно</div>
            </div>
          </div>
        </div>

        {/* 3D Visual Cards Column (Prevent overlap on mobile by setting explicit container heights) */}
        <div className="flex-1 w-full flex justify-center items-center relative h-[220px] sm:h-[400px] mt-6 sm:mt-0">
          <div className="absolute w-[240px] h-[240px] bg-purple-500/5 rounded-full blur-[70px]" />
          
          {/* Responsive Card Deck Fan Layout (Fixed height prevents container collapse) */}
          <div className="relative w-full max-w-[280px] sm:max-w-[340px] h-[160px] sm:h-[280px] flex justify-center items-center" style={{ perspective: "1000px" }}>
            {/* Forest Squirrel Card (Left) */}
            <motion.div 
              className="absolute left-0 origin-bottom cursor-pointer scale-75 sm:scale-100"
              style={{ zIndex: 10, rotate: -15, x: isMobile ? -20 : -35, y: 15 }}
              whileHover={isMobile ? {} : { scale: 1.05, rotate: -5, zIndex: 40, y: -10 }}
              whileTap={{ scale: 0.98 }}
            >
              <CardFace card={{ rank: "King", suit: "Spades" }} theme="forest" className="hero-card shadow-2xl border border-emerald-500/10 rounded-[12px]" />
            </motion.div>

            {/* Cyber Squirrel Card (Center) */}
            <motion.div 
              className="absolute z-20 cursor-pointer scale-80 sm:scale-105"
              style={{ y: -10 }}
              whileHover={isMobile ? {} : { scale: 1.1, y: -20, zIndex: 40 }}
              whileTap={{ scale: 0.98 }}
            >
              <CardFace card={{ rank: "Queen", suit: "Hearts" }} theme="cyber" className="hero-card shadow-2xl border border-cyan-500/10 rounded-[12px]" />
            </motion.div>

            {/* Gold Squirrel Card (Right) */}
            <motion.div 
              className="absolute right-0 origin-bottom cursor-pointer scale-75 sm:scale-100"
              style={{ zIndex: 10, rotate: 15, x: isMobile ? 20 : 35, y: 15 }}
              whileHover={isMobile ? {} : { scale: 1.05, rotate: 5, zIndex: 40, y: -10 }}
              whileTap={{ scale: 0.98 }}
            >
              <CardFace card={{ rank: "Jack", suit: "Clubs" }} theme="gold" className="hero-card shadow-2xl border border-amber-500/10 rounded-[12px]" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* 2. GAMEPLAY TABLE SIMULATOR */}
      <section id="simulator" className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-24 border-t border-white/5">
        <div className="flex flex-col lg:flex-row items-center gap-10 sm:gap-12">
          {/* Explanation Column */}
          <div className="flex-1 space-y-6 w-full">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-xs font-bold text-cyan-300">
              <Gamepad2 size={12} /> Интерактивная зона
            </div>
            
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
              Интерактивный симулятор игры
            </h2>
            <p className="text-gray-400 text-sm sm:text-base leading-relaxed">
              Оцените реальную механику игры 2х2. Индикатор хода, подсчет очков взятки и козырные срезы соответствуют официальным правилам «Белки». Попробуйте сыграть!
            </p>

            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2.5">
              <h4 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
                <span className="text-purple-400 shrink-0">Шаг {simStep + 1}:</span>
                <span className="truncate">
                  {simStep === 0 && "Ожидание хода..."}
                  {simStep === 1 && "Соперник 1 сходил с Туза (A♦)"}
                  {simStep === 2 && "Напарник поддержал 10-кой (10♦)"}
                  {simStep === 3 && "Соперник 2 снес Короля (K♦)"}
                  {simStep === 4 && "Вы бьете Девяткой Треф (9♣)!"}
                  {simStep === 5 && "Взятка сыграна в вашу пользу!"}
                </span>
              </h4>
              <p className="text-xs text-gray-400 leading-relaxed min-h-[48px]">
                {simStep === 0 && "Идет раздача. Ход принадлежит Сопернику 1 (сверху-слева). Козыри по классике — Трефы."}
                {simStep === 1 && "Соперник 1 заходит с Туза Бубен. Туз приносит команде оппонентов 11 очков. Очередь хода переходит к вашему напарнику."}
                {simStep === 2 && "Напарник играет 10 Бубен (приносит 10 очков в общую копилку взятки). Ход делает Соперник 2."}
                {simStep === 3 && "Соперник 2 сносит Короля (4 очка). Суммарная ценность взятки на кону составляет 25 очков. Ход за вами!"}
                {simStep === 4 && "У вас нет Бубен, но есть козыри! Нажмите на 9♣ в своей руке или кнопку действия, чтобы козырнуть и забрать взятку."}
                {simStep === 5 && "Отлично! Вы сыграли 9 Треф (высший козырь). Все 25 очков с этой раздачи переходят вашей команде (⚡ Uzi)!"}
              </p>
            </div>

            <div>
              <button 
                onClick={handleNextSimStep}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl text-sm font-bold bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw size={14} className={simStep === 4 ? "animate-spin" : ""} /> 
                {simStep === 0 && "Сдать карты"}
                {simStep === 1 && "Сделать ход за Соперника 1"}
                {simStep === 2 && "Сделать ход за Напарника"}
                {simStep === 3 && "Сделать ход за Соперника 2"}
                {simStep === 4 && "Сыграть 9♣ (Козырь)"}
                {simStep === 5 && "Собрать взятку (+25)"}
              </button>
            </div>
          </div>

          {/* Virtual Table Board Column (Optimized for Mobile viewports) */}
          <div className="flex-1 w-full bg-radial from-[#131d2e] to-[#080d16] border border-white/5 rounded-3xl p-3 sm:p-6 flex flex-col items-center justify-between min-h-[360px] sm:min-h-[390px] relative overflow-hidden shadow-2xl">
            {/* Real Game score overlay */}
            <div className="w-full flex items-center justify-between text-[10px] sm:text-xs font-extrabold z-20 bg-black/40 border border-white/5 px-2.5 py-1.5 rounded-xl mb-4">
              <div className="flex gap-3">
                <span className="text-amber-400 flex items-center gap-1">
                  🐺 {isMobile ? "Опп:" : "Kaskyr:"} {simStep === 1 ? "0 / 11" : simStep === 2 ? "0 / 11" : simStep === 3 ? "0 / 15" : simStep === 4 ? "0 / 15" : "0 / 0"}
                </span>
                <span className="text-purple-400 flex items-center gap-1">
                  ⚡ {isMobile ? "Мы:" : "Uzi:"} {simStep === 2 ? "0 / 10" : simStep === 3 ? "0 / 10" : simStep === 4 ? "0 / 10" : simStep === 5 ? "0 / 25" : "0 / 0"}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-500 font-semibold">Козырь:</span>
                <span className="text-emerald-400 bg-emerald-950/40 border border-emerald-500/20 px-1 py-0.5 rounded text-[9px] font-black">♣ Трефы</span>
              </div>
            </div>

            {/* Table Center Felt Ring */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 sm:w-64 sm:h-64 rounded-full border border-cyan-500/5 bg-cyan-950/5 pointer-events-none" />

            {/* PARTNER (TOP) */}
            <div className={`flex flex-col items-center z-10 transition-all ${simStep === 1 ? "scale-105" : "opacity-80"}`}>
              <span className={`text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full mb-1 transition-all ${
                simStep === 1 
                  ? "bg-purple-500 text-white shadow-[0_0_10px_rgba(168,85,247,0.5)] border border-purple-400" 
                  : "bg-purple-950/40 border border-purple-500/20 text-purple-400"
              }`}>
                👥 {isMobile ? "Нап" : "Напарник"}
              </span>
              <div className="flex gap-0.5">
                {simStep < 2 ? (
                  [1, 2, 3].map(i => (
                    <div key={i} className="w-5 h-7 sm:w-6 sm:h-9 rounded bg-purple-900/30 border border-purple-500/10" />
                  ))
                ) : (
                  [1, 2].map(i => (
                    <div key={i} className="w-5 h-7 sm:w-6 sm:h-9 rounded bg-purple-900/15 border border-purple-500/5" />
                  ))
                )}
              </div>
            </div>

            {/* TABLE MIDDLE AREA */}
            <div className="w-full flex justify-between items-center py-2 relative">
              {/* OPPONENT 1 (LEFT) */}
              <div className={`flex flex-col items-center shrink-0 transition-all ${simStep === 0 ? "scale-105" : "opacity-80"}`}>
                <span className={`text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-full mb-1 transition-all ${
                  simStep === 0 
                    ? "bg-amber-500 text-white shadow-[0_0_10px_rgba(249,115,22,0.5)] border border-amber-400" 
                    : "bg-white/5 border border-white/10 text-gray-400"
                }`}>
                  🦊 {isMobile ? "Опп 1" : "Соперник 1"}
                </span>
                <div className="flex flex-col gap-0.5">
                  {simStep < 1 ? (
                    [1, 2].map(i => (
                      <div key={i} className="w-7 h-5 sm:w-9 sm:h-6 rounded bg-red-950/15 border border-red-500/10" />
                    ))
                  ) : (
                    <div className="w-7 h-5 sm:w-9 sm:h-6 rounded bg-red-950/5 border border-red-500/5 opacity-50" />
                  )}
                </div>
              </div>

              {/* CARD PLAY ARENA (SCALED RESPONSIVELY) */}
              <div className="relative w-32 h-32 sm:w-44 sm:h-44 flex items-center justify-center shrink-0 mx-2">
                {/* Trump suit watermark badge in the center */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                  <div className="w-12 h-12 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm flex items-center justify-center text-xl font-bold text-emerald-500 shadow-[inset_0_0_10px_rgba(16,185,129,0.1)]">
                    ♣
                  </div>
                </div>

                <AnimatePresence>
                  {simStep >= 1 && (
                    <motion.div 
                      initial={{ scale: 0, x: -50, opacity: 0 }} 
                      animate={{ scale: 1, x: isMobile ? -16 : -26, opacity: 1 }} 
                      exit={{ scale: 0, opacity: 0 }}
                      className="absolute"
                    >
                      <CardFace card={{ rank: "Ace", suit: "Diamonds" }} theme="neon" className="sim-card" />
                    </motion.div>
                  )}
                  {simStep >= 2 && (
                    <motion.div 
                      initial={{ scale: 0, y: -50, opacity: 0 }} 
                      animate={{ scale: 1, y: isMobile ? -14 : -22, opacity: 1 }} 
                      exit={{ scale: 0, opacity: 0 }}
                      className="absolute"
                    >
                      <CardFace card={{ rank: "Ten", suit: "Diamonds" }} theme="neon" className="sim-card" />
                    </motion.div>
                  )}
                  {simStep >= 3 && (
                    <motion.div 
                      initial={{ scale: 0, x: 50, opacity: 0 }} 
                      animate={{ scale: 1, x: isMobile ? 16 : 26, opacity: 1 }} 
                      exit={{ scale: 0, opacity: 0 }}
                      className="absolute"
                    >
                      <CardFace card={{ rank: "King", suit: "Diamonds" }} theme="neon" className="sim-card" />
                    </motion.div>
                  )}
                  {simStep >= 4 && (
                    <motion.div 
                      initial={{ scale: 0, y: 50, opacity: 0 }} 
                      animate={{ scale: 1, y: isMobile ? 14 : 22, rotate: 4, zIndex: 10, opacity: 1 }} 
                      exit={{ scale: 0, opacity: 0 }}
                      className="absolute"
                    >
                      <CardFace card={{ rank: "Nine", suit: "Clubs" }} theme="classic" className="sim-card shadow-[0_0_12px_rgba(251,191,36,0.4)]" />
                    </motion.div>
                  )}

                  {simStep === 5 && (
                    <motion.div 
                      initial={{ scale: 0 }} 
                      animate={{ scale: 1 }} 
                      className="absolute bg-emerald-500/95 text-white font-black text-center text-[9px] sm:text-xs py-1.5 px-3 rounded-lg shadow-lg z-20"
                    >
                      Команда берет взятку! <br />
                      <span className="text-yellow-300 font-extrabold">+{trickPoints} очков</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* OPPONENT 2 (RIGHT) */}
              <div className={`flex flex-col items-center shrink-0 transition-all ${simStep === 2 ? "scale-105" : "opacity-80"}`}>
                <span className={`text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-full mb-1 transition-all ${
                  simStep === 2 
                    ? "bg-amber-500 text-white shadow-[0_0_10px_rgba(249,115,22,0.5)] border border-amber-400" 
                    : "bg-white/5 border border-white/10 text-gray-400"
                }`}>
                  🐼 {isMobile ? "Опп 2" : "Соперник 2"}
                </span>
                <div className="flex flex-col gap-0.5">
                  {simStep < 3 ? (
                    [1, 2].map(i => (
                      <div key={i} className="w-7 h-5 sm:w-9 sm:h-6 rounded bg-red-950/15 border border-red-500/10" />
                    ))
                  ) : (
                    <div className="w-7 h-5 sm:w-9 sm:h-6 rounded bg-red-950/5 border border-red-500/5 opacity-50" />
                  )}
                </div>
              </div>
            </div>

            {/* YOU (BOTTOM) */}
            <div className={`flex flex-col items-center z-10 w-full transition-all ${simStep === 3 ? "scale-105" : ""}`}>
              <div className="flex gap-1.5 justify-center mb-1">
                <div className="opacity-50 pointer-events-none">
                  <CardFace card={{ rank: "Jack", suit: "Spades" }} theme="classic" className="hand-card shadow-sm" />
                </div>
                <div className="opacity-50 pointer-events-none">
                  <CardFace card={{ rank: "King", suit: "Hearts" }} theme="classic" className="hand-card shadow-sm" />
                </div>
                {simStep < 4 ? (
                  <motion.div 
                    onClick={simStep === 3 ? handleNextSimStep : undefined}
                    whileHover={simStep === 3 ? { y: -8, scale: 1.05 } : {}}
                    whileTap={simStep === 3 ? { scale: 0.95 } : {}}
                    className={`${
                      simStep === 3 
                        ? "cursor-pointer animate-pulse" 
                        : "opacity-80"
                    }`}
                  >
                    <CardFace 
                      card={{ rank: "Nine", suit: "Clubs" }} 
                      theme="classic" 
                      className={`hand-card shadow-lg ${
                        simStep === 3 ? "border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.6)]" : ""
                      }`} 
                    />
                  </motion.div>
                ) : (
                  <div className="hand-card rounded-xl border border-white/5 bg-white/[0.02] flex items-center justify-center text-[9px] sm:text-[10px] text-gray-600 font-bold">
                    Сыграно
                  </div>
                )}
              </div>
              <span className={`text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full transition-all ${
                simStep === 3 
                  ? "bg-cyan-500 text-white shadow-[0_0_12px_rgba(34,211,238,0.6)] border border-cyan-400" 
                  : "bg-cyan-950/40 border border-cyan-500/20 text-cyan-400"
              }`}>
                👤 Вы
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. INTERACTIVE CHEST OPENER */}
      <section id="chest-opener" className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-24 border-t border-white/5">
        <div className="flex flex-col lg:flex-row items-center gap-10 sm:gap-12">
          {/* Visual Opener Column */}
          <div className="flex-1 w-full bg-radial from-[#151124] to-[#080710] border border-purple-500/10 rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-center min-h-[320px] sm:min-h-[380px] relative shadow-xl overflow-hidden">
            <div className="absolute w-52 h-52 bg-purple-500/10 rounded-full blur-[90px] pointer-events-none" />
            
            <AnimatePresence mode="wait">
              {!rewardCard ? (
                <motion.div 
                  key="chest"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="flex flex-col items-center gap-6"
                >
                  <motion.div 
                    className={`relative w-36 h-36 sm:w-44 sm:h-44 cursor-pointer flex items-center justify-center ${shakeActive ? "animate-shake" : ""}`}
                    onClick={handleOpenChest}
                    animate={shakeActive ? {} : {}}
                  >
                    <div className={`absolute w-32 h-32 rounded-full blur-2xl opacity-40 ${
                      chestType === "epic" ? "bg-amber-400 shadow-[0_0_35px_#fbbf24]" : "bg-purple-500 shadow-[0_0_30px_#a855f7]"
                    }`} />
                    
                    <ChestGraphic chestType={chestType} className="w-28 h-28 sm:w-36 sm:h-36 relative z-10" />
                  </motion.div>
                  
                  <div className="text-center space-y-1">
                    <h4 className="font-extrabold text-white text-base sm:text-lg">
                      {chestType === "epic" ? "Эпический сундук" : "Обычный сундук"}
                    </h4>
                    <p className="text-xs text-gray-400">Коснитесь сундука для открытия</p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="reward"
                  initial={{ scale: 0.6, opacity: 0, rotateY: 180 }}
                  animate={{ scale: 1, opacity: 1, rotateY: 0 }}
                  exit={{ scale: 0.6, opacity: 0 }}
                  className="flex flex-col items-center gap-5"
                >
                  <div className="relative" style={{ perspective: "1000px" }}>
                    <div className="absolute inset-0 rounded-[12px] blur-xl opacity-60" style={{ backgroundColor: rewardCard.glow, transform: 'scale(1.08)' }} />
                    <CardFace card={rewardCard} theme={rewardCard.theme} className="reward-card relative z-10 border border-white/10 rounded-[12px]" />
                  </div>
                  
                  <div className="text-center space-y-1 z-10">
                    <span className="text-[9px] tracking-widest font-black uppercase text-amber-400 px-2 py-0.5 rounded bg-amber-950/40 border border-amber-500/20">
                      Открыто
                    </span>
                    <h4 className="font-black text-white text-base sm:text-lg pt-1">{rewardCard.name}</h4>
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">{rewardCard.rarity}</p>
                  </div>
                  
                  <button 
                    onClick={() => setRewardCard(null)} 
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 border border-white/10 active:scale-95 transition-all text-gray-300"
                  >
                    Еще раз
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Controls Column */}
          <div className="flex-1 space-y-6 w-full">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-xs font-semibold text-purple-300">
              <Sparkles size={11} /> Коллекция рубашек
            </div>

            <h2 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
              Разблокируйте редкие рубашки
            </h2>
            
            <p className="text-gray-400 text-sm sm:text-base leading-relaxed">
              Участие в еженедельных лигах и победы над боссами принесут вам монеты и ключи от сундуков. Соберите всю коллекцию и кастомизируйте свой игровой стол.
            </p>

            {/* Responsive selector buttons (Flex-col on mobile) */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setChestType("common")}
                className={`p-4 rounded-xl border text-left transition-all ${
                  chestType === "common" 
                    ? "bg-purple-950/20 border-purple-500/40" 
                    : "bg-transparent border-white/5 hover:bg-white/[0.01] text-gray-400"
                }`}
              >
                <div className="font-bold text-sm text-white">Обычный сундук</div>
                <div className="text-xs text-purple-400/80 pt-0.5">Классические рубашки</div>
              </button>

              <button
                onClick={() => setChestType("epic")}
                className={`p-4 rounded-xl border text-left transition-all ${
                  chestType === "epic" 
                    ? "bg-amber-950/20 border-amber-500/40" 
                    : "bg-transparent border-white/5 hover:bg-white/[0.01] text-gray-400"
                }`}
              >
                <div className="font-bold text-sm text-white">Эпический сундук</div>
                <div className="text-xs text-amber-400/80 pt-0.5">Мифические анимации</div>
              </button>
            </div>

            <div>
              <button
                onClick={handleOpenChest}
                disabled={isOpening}
                className="w-full py-4 rounded-xl text-sm sm:text-base font-bold bg-gradient-to-r from-purple-600 to-amber-600 hover:from-purple-500 hover:to-amber-500 shadow-lg active:scale-98 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                <Sparkles size={16} />
                {isOpening ? "Сундук открывается..." : "Открыть сундук бесплатно"}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* SHOWROOM CARDS PREVIEW (Optimized responsive scrolling tabs) */}
      <section id="showroom" className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-24 border-t border-white/5 relative">
        <div className="flex flex-col lg:flex-row items-center gap-12">
          {/* Description Column */}
          <div className="flex-1 space-y-6 w-full">
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
              Интерактивная галерея
            </h2>
            <p className="text-gray-400 text-sm sm:text-base leading-relaxed">
              Карты в игре полностью анимированы и реагируют на гироскоп и прикосновения. Попробуйте покрутить карту в галерее!
            </p>

            {/* TAB SELECTOR: Swipable Row on Mobile, Stacked on Desktop */}
            <div className="flex flex-row lg:flex-col gap-2.5 overflow-x-auto pb-3 lg:pb-0 scrollbar-none snap-x snap-mandatory pt-1">
              {Object.entries(featuredDecks).map(([key, value]) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`p-3.5 rounded-xl border flex items-center justify-between transition-all shrink-0 snap-center min-w-[220px] lg:min-w-0 ${
                    activeTab === key 
                      ? `bg-white/5 ${value.border} shadow-sm` 
                      : "bg-transparent border-transparent hover:bg-white/[0.01] text-gray-400"
                  }`}
                >
                  <div className="text-left">
                    <div className={`font-bold text-sm ${activeTab === key ? value.color : "text-white"}`}>{value.title}</div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-widest pt-0.5">{value.rarity}</div>
                  </div>
                  <ChevronRight size={14} className={`hidden lg:block ${activeTab === key ? value.color : "text-gray-500"}`} />
                </button>
              ))}
            </div>
          </div>

          {/* Rendering Column */}
          <div className="flex-1 w-full flex flex-col items-center justify-center bg-white/[0.01] border border-white/5 rounded-3xl p-6 sm:p-12 relative overflow-hidden">
            <div className="absolute w-[200px] h-[200px] rounded-full blur-[80px] pointer-events-none opacity-25" style={{ backgroundColor: currentDeck.accent }} />
            
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="flex flex-col items-center gap-6 relative z-10 w-full"
            >
              <div className="flex gap-2 sm:gap-4 justify-center items-center py-4" style={{ perspective: "1000px" }}>
                {/* Jack */}
                <motion.div
                  whileHover={isMobile ? {} : { y: -12, rotateY: -12, rotateX: 6, zIndex: 30 }}
                  whileTap={{ scale: 0.97 }}
                  className="relative z-10 cursor-grab active:cursor-grabbing"
                >
                  <CardFace card={{ rank: "Jack", suit: "Clubs" }} theme={activeTab} className="gallery-card shadow-[0_15px_35px_rgba(0,0,0,0.55)] border border-white/10 rounded-[12px]" />
                </motion.div>
                {/* Queen */}
                <motion.div
                  whileHover={isMobile ? {} : { y: -16, scale: 1.05, zIndex: 20 }}
                  whileTap={{ scale: 0.97 }}
                  className="relative z-20 cursor-grab active:cursor-grabbing"
                >
                  <CardFace card={{ rank: "Queen", suit: "Hearts" }} theme={activeTab} className="gallery-card shadow-[0_20px_45px_rgba(0,0,0,0.6)] border border-white/10 rounded-[12px]" />
                </motion.div>
                {/* King */}
                <motion.div
                  whileHover={isMobile ? {} : { y: -12, rotateY: 12, rotateX: 6, zIndex: 30 }}
                  whileTap={{ scale: 0.97 }}
                  className="relative z-10 cursor-grab active:cursor-grabbing"
                >
                  <CardFace card={{ rank: "King", suit: "Diamonds" }} theme={activeTab} className="gallery-card shadow-[0_15px_35px_rgba(0,0,0,0.55)] border border-white/10 rounded-[12px]" />
                </motion.div>
              </div>

              <div className="text-center max-w-sm px-2">
                <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
                  {currentDeck.description}
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 4. TOURNAMENT ACTIVE BRACKET */}
      <section id="tournament" className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-24 border-t border-white/5">
        <div className="text-center space-y-4 mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-300">
            <Trophy size={12} /> Чемпионаты
          </div>
          <h2 className="text-2xl sm:text-4xl font-black tracking-tight">Еженедельные Турниры</h2>
          <p className="text-gray-400 text-sm sm:text-base max-w-lg mx-auto">
            Официальная клановая сетка турниров. Сражайтесь с лучшими командами лиги за кубки и специальные звания.
          </p>
        </div>

        {/* BRACKET LAYOUT (Horizontal swipe on mobile, flex on desktop) */}
        <div className="flex flex-row lg:flex-row overflow-x-auto lg:overflow-x-visible pb-4 lg:pb-0 gap-6 scrollbar-none snap-x snap-mandatory bg-white/[0.01] border border-white/5 p-4 sm:p-8 rounded-3xl relative overflow-hidden">
          {/* Quarterfinals */}
          <div className="min-w-[270px] xs:min-w-[290px] sm:min-w-[320px] lg:min-w-0 flex-1 snap-center space-y-4">
            <div className="text-[10px] uppercase font-bold tracking-widest text-gray-500 border-b border-white/5 pb-2">Четвертьфиналы</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
              {bracketData.quarter.map(match => (
                <div key={match.id} className="p-4 rounded-xl bg-white/[0.01] border border-white/5 space-y-1 text-xs sm:text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-300">{match.team1}</span>
                    <span className="font-black text-white">{match.score1}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-300">{match.team2}</span>
                    <span className="font-black text-white">{match.score2}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Semifinals */}
          <div className="min-w-[270px] xs:min-w-[290px] sm:min-w-[320px] lg:min-w-0 flex-1 snap-center space-y-4">
            <div className="text-[10px] uppercase font-bold tracking-widest text-purple-400 border-b border-purple-500/10 pb-2">Полуфинал</div>
            {bracketData.semi.map(match => (
              <div key={match.id} className="p-4 rounded-xl bg-purple-950/5 border border-purple-500/10 space-y-1 text-xs sm:text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-purple-200">{match.team1}</span>
                  <span className="font-black text-purple-400">{match.score1}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-400">{match.team2}</span>
                  <span className="font-black text-gray-500">{match.score2}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Finals */}
          <div className="min-w-[270px] xs:min-w-[290px] sm:min-w-[320px] lg:min-w-0 flex-1 snap-center space-y-4">
            <div className="text-[10px] uppercase font-bold tracking-widest text-amber-400 border-b border-amber-500/10 pb-2">Финал</div>
            {bracketData.final.map(match => (
              <div key={match.id} className="p-4 rounded-xl bg-amber-950/5 border border-amber-500/20 space-y-2 text-xs sm:text-sm relative overflow-hidden">
                {match.live && (
                  <div className="absolute top-2 right-2 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[8px] uppercase font-bold text-red-400 tracking-wider">Прямой эфир</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-amber-200">{match.team1}</span>
                  <span className="font-black text-amber-400">{match.score1}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-400">{match.team2}</span>
                  <span className="font-black text-gray-400">{match.score2}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. CLAN LEADERBOARD */}
      <section id="clans" className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-24 border-t border-white/5">
        <div className="flex flex-col lg:flex-row gap-10 sm:gap-12">
          {/* Leaderboard data */}
          <div className="flex-1 space-y-6 w-full order-2 lg:order-1">
            <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-3">
              <Award className="text-purple-400" /> Топ Кланов Недели
            </h3>

            <div className="border border-white/5 rounded-2xl overflow-hidden divide-y divide-white/5 bg-white/[0.01] text-xs sm:text-sm">
              <div className="p-4 flex items-center justify-between hover:bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <span className="w-5 font-black text-amber-400 text-center">1</span>
                  <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">🐺</div>
                  <div>
                    <div className="font-extrabold text-white">Каскыр (Kaskyr)</div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-widest pt-0.5">KSKR • 20/20 участников</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-black text-amber-400">12 850 🏆</div>
                  <div className="text-[8px] text-gray-500 uppercase tracking-widest">Трофеи</div>
                </div>
              </div>

              <div className="p-4 flex items-center justify-between hover:bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <span className="w-5 font-black text-gray-400 text-center">2</span>
                  <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center">⚡</div>
                  <div>
                    <div className="font-extrabold text-white">Узи (Uzi)</div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-widest pt-0.5">UZIX • 20/20 участников</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-black text-purple-400">11 420 🏆</div>
                  <div className="text-[8px] text-gray-500 uppercase tracking-widest">Трофеи</div>
                </div>
              </div>

              <div className="p-4 flex items-center justify-between hover:bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <span className="w-5 font-black text-orange-600 text-center">3</span>
                  <div className="w-9 h-9 rounded-lg bg-cyan-500/10 flex items-center justify-center">🌟</div>
                  <div>
                    <div className="font-extrabold text-white">Almaty Stars</div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-widest pt-0.5">ALMT • 19/20 участников</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-black text-cyan-400">9 800 🏆</div>
                  <div className="text-[8px] text-gray-500 uppercase tracking-widest">Трофеи</div>
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="flex-1 space-y-6 w-full order-1 lg:order-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-xs font-semibold text-purple-300">
              <Users size={12} /> Сообщества
            </div>
            
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
              Объединяйтесь с друзьями
            </h2>

            <p className="text-gray-400 text-sm sm:text-base leading-relaxed">
              Карточные баталии в Белке полностью раскрываются только в командном зачете. Создайте свой клан, зарабатывайте кубки и поднимайтесь в топ.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm text-gray-300 pt-2">
              <div className="flex items-center gap-2">
                <span className="text-purple-400 font-bold">✓</span> Внутриклановый чат
              </div>
              <div className="flex items-center gap-2">
                <span className="text-purple-400 font-bold">✓</span> Быстрые тренировочные лобби
              </div>
              <div className="flex items-center gap-2">
                <span className="text-purple-400 font-bold">✓</span> Статистика активности
              </div>
              <div className="flex items-center gap-2">
                <span className="text-purple-400 font-bold">✓</span> Клановые аватары
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. DETAILED RULES ACCORDION */}
      <section id="rules" className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-24 border-t border-white/5">
        <div className="text-center space-y-4 mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-xs font-semibold text-cyan-300">
            <Info size={12} /> Справочник
          </div>
          <h2 className="text-2xl sm:text-4xl font-black tracking-tight">Свод правил «Белки»</h2>
          <p className="text-gray-400 text-sm sm:text-base max-w-lg mx-auto">
            Ознакомьтесь с правилами в один клик.
          </p>
        </div>

        {/* Toggler Layout */}
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex rounded-xl bg-white/5 border border-white/10 p-1">
            <button
              onClick={() => setRuleType("almaty")}
              className={`flex-1 py-3 text-xs sm:text-sm font-bold rounded-lg transition-all ${
                ruleType === "almaty" ? "bg-purple-600 text-white shadow" : "text-gray-400 hover:text-white"
              }`}
            >
              Классические Алматинские
            </button>
            <button
              onClick={() => setRuleType("northern")}
              className={`flex-1 py-3 text-xs sm:text-sm font-bold rounded-lg transition-all ${
                ruleType === "northern" ? "bg-purple-600 text-white shadow" : "text-gray-400 hover:text-white"
              }`}
            >
              Северные модификации
            </button>
          </div>

          <motion.div
            key={ruleType}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 sm:p-8 rounded-2xl bg-white/[0.01] border border-white/5 space-y-4"
          >
            <h4 className="font-extrabold text-lg sm:text-xl text-white">{rules[ruleType].title}</h4>
            <div className="space-y-3.5 text-xs sm:text-sm text-gray-300">
              <div>
                <span className="font-bold text-purple-400">Козырная система:</span>
                <p className="text-gray-400 pt-1 leading-relaxed">{rules[ruleType].cards}</p>
              </div>
              <div>
                <span className="font-bold text-cyan-400">Старшинство карт во взятке:</span>
                <p className="text-gray-400 pt-1 font-mono text-[10px] sm:text-xs leading-relaxed">{rules[ruleType].order}</p>
              </div>
              <div>
                <span className="font-bold text-amber-400">Подсчет очков:</span>
                <p className="text-gray-400 pt-1 leading-relaxed">{rules[ruleType].score}</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/5 bg-[#040508]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-cyan-500 flex items-center justify-center font-black tracking-wider text-sm shadow-[0_0_15px_rgba(139,92,246,0.3)]">
              🐿️
            </div>
            <span className="text-sm font-extrabold tracking-wider text-gray-300">
              BELKA<span className="text-purple-500">ONLINE</span>
            </span>
          </div>

          <div className="text-[11px] sm:text-xs text-gray-500 text-center md:text-left">
            © 2026 Belka Online. Все права защищены. Разработано с любовью 💜
          </div>

          <div className="flex items-center gap-4 text-xs text-gray-400">
            <a href="https://t.me/belka_game_bot" className="hover:text-white transition-colors flex items-center gap-1">
              Telegram Bot <ArrowUpRight size={12} />
            </a>
            <a href="https://github.com/lakeofcolors/squirrel-core" className="hover:text-white transition-colors flex items-center gap-1">
              GitHub Repository <ArrowUpRight size={12} />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
