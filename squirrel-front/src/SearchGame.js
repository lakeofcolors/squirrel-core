import { useState, useEffect, useReducer, useMemo } from "react";
import { useGameStore } from "./store";
import { getUrl } from "./config/settings";
import { useNavigate } from "react-router-dom";
import {
  findGame,
  subscribe,
  cancelGame,
  createRoom,
  sendjoinRoom,
  sendleaveRoom,
  forceCloseSocket,
  playWithBots,
  spectateRoom as spectateRoomApi
} from "./ws/client";
import axios from "axios";
import { toast } from "react-toastify";
import MatchSummaryModal from "./components/MatchSummaryModal";
import ReplayViewer from "./components/ReplayViewer";
import ChestOpeningModal from "./components/ChestOpeningModal";
import DailyRewardsModal from "./components/DailyRewardsModal";
import EventsModal, { getEventTheme } from "./components/EventsModal";
import InviteModal from "./components/InviteModal";
import LuckySpinModal from "./components/LuckySpinModal";
import SlotsModal from "./components/SlotsModal";
import ClansModal from "./components/ClansModal";
import UserProfileModal from "./components/UserProfileModal";
import { renderTauntGraphic } from "./Game";

/* =========================
   STATE MACHINE
========================= */

const TABS = {
  GAMES: "games",
  FRIENDS: "friends",
  RATING: "rating",
  PROFILE: "profile",
  NUTS: "nuts",
};

const initialUIState = {
  activeTab: TABS.GAMES,
};

const STORE_TABS = {
  NUTS: "nuts",
  DECKS: "decks",
  BACKGROUNDS: "backgrounds",
};

function uiReducer(state, action) {
  switch (action.type) {
    case "GO_GAMES":
      return { ...state, activeTab: TABS.GAMES };
    case "GO_FRIENDS":
      return { ...state, activeTab: TABS.FRIENDS };
    case "GO_RATING":
      return { ...state, activeTab: TABS.RATING };
    case "GO_PROFILE":
      return { ...state, activeTab: TABS.PROFILE };
    case "GO_NUTS":
      return { ...state, activeTab: TABS.NUTS };
    default:
      return state;
  }
}

/* =========================
   MOCK DATA
========================= */

const MOCK_RATING = [
  {
    id: 1,
    name: "alpha_wolf",
    league: "Diamond",
    rating: 2450,
    wins: 182,
    avatar: "https://api.dicebear.com/7.x/thumbs/svg?seed=alpha_wolf",
  },
  {
    id: 2,
    name: "storm_ace",
    league: "Diamond",
    rating: 2310,
    wins: 164,
    avatar: "https://api.dicebear.com/7.x/thumbs/svg?seed=storm_ace",
  },
  {
    id: 3,
    name: "senior8me",
    league: "Gold",
    rating: 100,
    wins: 24,
    avatar: "https://api.dicebear.com/7.x/thumbs/svg?seed=senior8me",
  },
  {
    id: 4,
    name: "dark_squirrel",
    league: "Gold",
    rating: 920,
    wins: 73,
    avatar: "https://api.dicebear.com/7.x/thumbs/svg?seed=dark_squirrel",
  },
  {
    id: 5,
    name: "fox_blade",
    league: "Diamond",
    rating: 1870,
    wins: 116,
    avatar: "https://api.dicebear.com/7.x/thumbs/svg?seed=fox_blade",
  },
  {
    id: 6,
    name: "chip_master",
    league: "Silver",
    rating: 740,
    wins: 39,
    avatar: "https://api.dicebear.com/7.x/thumbs/svg?seed=chip_master",
  },
];


const MOCK_INVENTORY = {
  decks: [
    { id: 1, name: "Классическая", preview: "🂡", equipped: true, rarity: "Common" },
    { id: 2, name: "Неоновая", preview: "✨", equipped: false, rarity: "Rare" },
    { id: 3, name: "Лесная", preview: "🌲", equipped: false, rarity: "Epic" },
  ],
  backgrounds: [
    { id: 1, name: "Ночной город", preview: "🌃", equipped: true, rarity: "Common" },
    { id: 2, name: "Фиолетовый неон", preview: "💜", equipped: false, rarity: "Epic" },
    { id: 3, name: "Золотой зал", preview: "✨", equipped: false, rarity: "Legendary" },
  ],
};

const suitSymbol = {
  Clubs: "♣",
  Diamonds: "♦",
  Hearts: "♥",
  Spades: "♠",
};

const rankLabel = {
  Seven: "7",
  Eight: "8",
  Nine: "9",
  Ten: "10",
  Jack: "J",
  Queen: "Q",
  King: "K",
  Ace: "A",
};

function suitIsRed(suit) {
  return suit === "Hearts" || suit === "Diamonds";
}

function getBackground(theme) {
  const backgrounds = {
    default: {
      type: "generated",
      base: "bg-[#15152b]",
      overlay: "from-purple-900/20 via-transparent to-black/40",
      glow: "shadow-[0_0_25px_#7c3aed]",
    },

    neon: {
      type: "generated",
      base: "bg-[#0f0f2a]",
      overlay: "from-fuchsia-500/20 via-purple-500/10 to-black/50",
      glow: "shadow-[0_0_35px_rgba(168,85,247,0.6)]",
    },

    forest: {
      type: "generated",
      base: "bg-[#0c1f17]",
      overlay: "from-green-500/20 via-emerald-500/10 to-black/50",
      glow: "shadow-[0_0_35px_rgba(34,197,94,0.5)]",
    },

    void: {
      type: "generated",
      base: "bg-[#020617]",
      overlay: "from-purple-700/30 via-indigo-500/10 to-black/60",
      glow: "shadow-[0_0_40px_rgba(124,58,237,0.7)]",
    },

    fire: {
      type: "image",
      image: "/backgrounds/fire.webp",
      glow: "shadow-[0_0_30px_rgba(250,204,21,0.35)]",
      overlayClass: "bg-black/30",
    },
    neon_table: {
      type: "image",
      image: "/backgrounds/neon_table.webp",
      glow: "shadow-[0_0_30px_rgba(250,204,21,0.35)]",
      overlayClass: "bg-black/30",
    },

    pink: {
      type: "image",
      image: "/backgrounds/pink.webp",
      glow: "shadow-[0_0_30px_rgba(250,204,21,0.35)]",
      overlayClass: "bg-black/30",
    },
    pool: {
      type: "image",
      image: "/backgrounds/pool.webp",
      glow: "shadow-[0_0_30px_rgba(250,204,21,0.35)]",
      overlayClass: "bg-black/30",
    },
    rug: {
      type: "image",
      image: "/backgrounds/rug_table.webp",
      glow: "shadow-[0_0_30px_rgba(250,204,21,0.35)]",
      overlayClass: "bg-black/30",
    },
    kz: {
      type: "image",
      image: "/backgrounds/kz.webp",
      glow: "shadow-[0_0_30px_rgba(250,204,21,0.35)]",
      overlayClass: "bg-black/30",
    },
  };

  return backgrounds[theme] || backgrounds.default;
}

export function BackgroundPreview({ theme }) {
  const bg = getBackground(theme);

  return (
    <div
      className={`
        relative h-full w-full overflow-hidden rounded-xl
        ${bg.type === "generated" ? bg.base : "bg-[#15152b]"}
      `}
    >
      {bg.type === "image" && (
        <>
          <img
            src={bg.image}
            alt={theme}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className={`absolute inset-0 ${bg.overlayClass || "bg-black/35"}`} />
        </>
      )}

      {bg.type === "generated" && (
        <div className={`absolute inset-0 bg-gradient-to-br ${bg.overlay}`} />
      )}

      {/* лёгкая имитация стола, чтобы было видно как фон сидит */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-[70%] w-[72%] rounded-[999px] border border-white/10 shadow-[0_0_18px_rgba(255,255,255,0.08)]" />
      </div>

      {/* декоративное затемнение */}
      <div className="absolute inset-0 bg-black/10" />
    </div>
  );
}


/* =========================
   HELPERS
========================= */

export function getLevelFromXP(xp) {
  if (!xp || xp < 0) return { level: 1, currentLevelXp: 0, nextLevelXp: 100, progress: 0 };
  const level = Math.floor(Math.sqrt(xp / 100)) + 1;
  const currentTierBaseXp = Math.pow(level - 1, 2) * 100;
  const nextTierBaseXp = Math.pow(level, 2) * 100;
  const xpInCurrentLevel = xp - currentTierBaseXp;
  const xpRequiredForNextLevel = nextTierBaseXp - currentTierBaseXp;
  const progress = Math.min(100, Math.max(0, (xpInCurrentLevel / xpRequiredForNextLevel) * 100));
  return { level, currentLevelXp: xpInCurrentLevel, nextLevelXp: xpRequiredForNextLevel, progress };
}

export function getLeagueByRating(rating) {
  if (rating < 500) return "Bronze";
  if (rating < 1500) return "Silver";
  if (rating < 3000) return "Gold";
  return "Diamond";
}

function LeagueBadge({ league }) {
  const map = {
    Bronze: "bg-amber-700 text-amber-100",
    Silver: "bg-gray-400 text-gray-900",
    Gold: "bg-yellow-400 text-black",
    Diamond: "bg-cyan-400 text-black shadow-[0_0_12px_#22d3ee]",
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-extrabold ${map[league] || "bg-gray-700 text-white"}`}>
      {league}
    </span>
  );
}

function GlassCard({ children, className = "" }) {
  return (
    <div
      className={`rounded-2xl border border-purple-500 bg-[#1a1a2e]/95 shadow-lg shadow-purple-900/30 ${className}`}
    >
      {children}
    </div>
  );
}

function SectionTitle({ children, right }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-lg font-extrabold text-pink-400">{children}</h2>
      {right}
    </div>
  );
}

function getDeckTheme(theme, suit) {
  const isRed = suitIsRed(suit);

  const themes = {
    classic: {
      name: "Classic",
      rarity: "common",
      bg: "#fffdf8",
      border: "#d6d3d1",
      glow: "#ffffff",
      text: isRed ? "#dc2626" : "#111827",
      accent: "#f5f5f4",
      inner: "#ffffff",
      pipBg: "rgba(0,0,0,0.015)",
    },
    neon: {
      bg: "#1a1a2e",
      border: "#a855f7",
      glow: "#a855f7",
      text: isRed ? "#fb7185" : "#ffffff",
      accent: "#e9d5ff",
      inner: "#2a2147",
      pipBg: "rgba(255,255,255,0.04)",
    },
    gold: {
      bg: "#1c1917",
      border: "#facc15",
      glow: "#facc15",
      text: isRed ? "#fb7185" : "#fef3c7",
      accent: "#fde68a",
      inner: "#2b2111",
      pipBg: "rgba(255,255,255,0.03)",
    },
    cyber: {
      bg: "#020617",
      border: "#22d3ee",
      glow: "#22d3ee",
      text: isRed ? "#fb7185" : "#67e8f9",
      accent: "#a5f3fc",
      inner: "#082f49",
      pipBg: "rgba(34,211,238,0.06)",
    },
    forest: {
      bg: "#0f1f17",
      border: "#4ade80",
      glow: "#4ade80",
      text: isRed ? "#f87171" : "#dcfce7",
      accent: "#bbf7d0",
      inner: "#163126",
      pipBg: "rgba(74,222,128,0.06)",
    },
    void: {
      name: "Void",
      rarity: "mythic",
      bg: "#020617",
      border: "#7c3aed",
      glow: "#7c3aed",
      text: isRed ? "#fb7185" : "#c4b5fd",
      accent: "#a78bfa",
      inner: "#0f0f2a",
      pipBg: "rgba(124,58,237,0.06)",
    },
    pink: {
      name: "Pink",
      rarity: "mythic",
      bg: "#5a2346",
      border: "#ff7ac8",
      glow: "#ff7ac8",
      text: isRed ? "#ffe6f4" : "#fffafb",
      accent: "#ffc1e3",
      inner: "#74305a",
      pipBg: "rgba(255,192,227,0.12)",
    },
    cosmic: {
      name: "Cosmic",
      rarity: "mythic",
      bg: "#02000c",
      border: "#d946ef",
      glow: "#8b5cf6",
      text: isRed ? "#fb7185" : "#06b6d4",
      accent: "#a78bfa",
      inner: "#0f0926",
      pipBg: "rgba(217,70,239,0.08)",
    },
    magma: {
      name: "Magma",
      rarity: "mythic",
      bg: "#0c0200",
      border: "#f97316",
      glow: "#ef4444",
      text: isRed ? "#fca5a5" : "#fef08a",
      accent: "#eab308",
      inner: "#240600",
      pipBg: "rgba(249,115,22,0.08)",
    },
    matrix: {
      name: "Matrix",
      rarity: "mythic",
      bg: "#000500",
      border: "#22c55e",
      glow: "#4ade80",
      text: isRed ? "#f87171" : "#86efac",
      accent: "#4ade80",
      inner: "#031703",
      pipBg: "rgba(34,197,94,0.08)",
    },
  };

  return themes[theme] || themes.neon;
}

function get_squirrel_image(card, theme = "neon") {
  // Словарь картинок: Тема -> Ранг
  const assets = {
    classic: {
      Jack: "classic_jack.png",
      Queen: "classic_queen.png",
      King: "classic_king.png",
    },
    cyber: {
      Jack: "cyber_jack.png",
      Queen: "cyber_queen.png",
      King: "cyber_king.png",
    },
    forest: {
      Jack: "forest_jack.png",
      Queen: "forest_queen.png",
      King: "forest_king.png",
    },
    gold: {
      Jack: "/gold_jack.png",
      Queen: "/gold_queen.png",
      King: "/gold_king.png",
    },
    pink: {
      Jack: "/pool_jack.png",
      Queen: "/pool_jack.png",
      King: "/pool_jack.png",
    },

    // Добавь другие темы сюда
  };

  // Проверяем наличие темы, если нет - берем neon
  const themeGroup = assets[theme] || assets.classic;

  // Возвращаем картинку конкретного ранга, либо дефолтного валета этой темы
  return themeGroup[card.rank] || themeGroup.Jack;
}

function CardFace({ card, compact = false, className = "", theme = "neon" }) {
  const rank = rankLabel[card.rank] ?? card.rank;
  const suit = suitSymbol[card.suit] ?? card.suit;
  const t = getDeckTheme(theme, card.suit);
  const isFaceCard = ["Jack", "Queen", "King"].includes(card.rank);
  const squirrelImg = isFaceCard ? get_squirrel_image(card, theme) : null;

  return (
    <div className={`${compact ? "w-12 h-18" : "w-16 h-24"} ${className}`}>
      <svg viewBox="0 0 100 150" className="w-full h-full">
        <defs>
          <style>{`
            @keyframes pulse-stars-${rank}-${card.suit} {
              0%, 100% { opacity: 0.25; }
              50% { opacity: 0.95; }
            }
            @keyframes rotate-orbit-${rank}-${card.suit} {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            @keyframes lava-flow-${rank}-${card.suit} {
              0%, 100% { stroke-opacity: 0.4; filter: drop-shadow(0 0 1px #ef4444); }
              50% { stroke-opacity: 0.9; filter: drop-shadow(0 0 4px #eab308); }
            }
            @keyframes matrix-code-${rank}-${card.suit} {
              0% { stroke-dashoffset: 0; }
              100% { stroke-dashoffset: -30; }
            }
            .star-p-1-${rank}-${card.suit} { animation: pulse-stars-${rank}-${card.suit} 1.5s ease-in-out infinite; }
            .star-p-2-${rank}-${card.suit} { animation: pulse-stars-${rank}-${card.suit} 2.5s ease-in-out infinite; }
            .orbit-rot-${rank}-${card.suit} { transform-origin: 50px 75px; animation: rotate-orbit-${rank}-${card.suit} 12s linear infinite; }
            .lava-f-${rank}-${card.suit} { animation: lava-flow-${rank}-${card.suit} 4s ease-in-out infinite; }
            .matrix-c-${rank}-${card.suit} { animation: matrix-code-${rank}-${card.suit} 2.5s linear infinite; }
          `}</style>
          <radialGradient id={`face-glow-${theme}-${rank}-${card.suit}`} cx="50%" cy="50%">
            <stop offset="0" stopColor={t.glow} stopOpacity="0.35" />
            <stop offset="100%" stopColor="#000" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`face-frame-${theme}-${rank}-${card.suit}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={t.border} stopOpacity="0.95" />
            <stop offset="100%" stopColor={t.accent} stopOpacity="0.55" />
          </linearGradient>
        </defs>

        <rect
          x="0"
          y="0"
          width="100"
          height="150"
          rx="12"
          fill={t.bg}
          stroke={`url(#face-frame-${theme}-${rank}-${card.suit})`}
          strokeWidth="3"
        />

        <rect
          x="6"
          y="6"
          width="88"
          height="138"
          rx="9"
          fill={t.pipBg}
          stroke={t.border}
          strokeOpacity="0.14"
        />

        <circle cx="50" cy="75" r="52" fill={`url(#face-glow-${theme}-${rank}-${card.suit})`} />

        {/* CUSTOM ANIMATED BACKDROPS FOR PREMIUM DECKS */}
        {theme === "cosmic" && (
          <g>
            <ellipse cx="50" cy="75" rx="36" ry="12" fill="none" stroke={`url(#face-frame-${theme}-${rank}-${card.suit})`} strokeWidth="0.75" opacity="0.3" className={`orbit-rot-${rank}-${card.suit}`} />
            <ellipse cx="50" cy="75" rx="28" ry="24" fill="none" stroke={t.accent} strokeWidth="0.5" opacity="0.2" className={`orbit-rot-${rank}-${card.suit}`} style={{ animationDirection: 'reverse', animationDuration: '20s' }} />
            <circle cx="25" cy="55" r="1.5" fill="#ffffff" className={`star-p-1-${rank}-${card.suit}`} />
            <circle cx="75" cy="95" r="1.2" fill="#ffffff" className={`star-p-2-${rank}-${card.suit}`} />
            <circle cx="35" cy="115" r="1.8" fill="#a78bfa" className={`star-p-1-${rank}-${card.suit}`} />
            <circle cx="68" cy="45" r="1.0" fill="#06b6d4" className={`star-p-2-${rank}-${card.suit}`} />
            <circle cx="48" cy="38" r="1.4" fill="#ffffff" className={`star-p-1-${rank}-${card.suit}`} />
            <circle cx="52" cy="118" r="1.2" fill="#a78bfa" className={`star-p-2-${rank}-${card.suit}`} />
          </g>
        )}

        {theme === "magma" && (
          <g>
            <path d="M10,135 Q30,115 25,95 T60,85 T78,115 T90,95" fill="none" stroke={t.border} strokeWidth="1.5" strokeLinecap="round" className={`lava-f-${rank}-${card.suit}`} />
            <path d="M18,138 Q25,120 45,110 T58,128 T85,110" fill="none" stroke={t.accent} strokeWidth="1.0" strokeLinecap="round" className={`lava-f-${rank}-${card.suit}`} style={{ animationDelay: '2s' }} />
            <path d="M30,30 Q45,50 35,75 T70,60 T85,25" fill="none" stroke={t.border} strokeWidth="1.2" strokeLinecap="round" className={`lava-f-${rank}-${card.suit}`} style={{ animationDelay: '1s' }} />
          </g>
        )}

        {theme === "matrix" && (
          <g opacity="0.55">
            <line x1="16" y1="12" x2="16" y2="138" stroke={t.accent} strokeWidth="1.0" strokeDasharray="6,24" className={`matrix-c-${rank}-${card.suit}`} />
            <line x1="34" y1="12" x2="34" y2="138" stroke={t.border} strokeWidth="0.8" strokeDasharray="10,30" className={`matrix-c-${rank}-${card.suit}`} style={{ animationDuration: '3.5s', animationDirection: 'reverse' }} />
            <line x1="66" y1="12" x2="66" y2="138" stroke={t.accent} strokeWidth="1.2" strokeDasharray="4,20" className={`matrix-c-${rank}-${card.suit}`} style={{ animationDuration: '1.8s' }} />
            <line x1="84" y1="12" x2="84" y2="138" stroke={t.border} strokeWidth="0.8" strokeDasharray="8,28" className={`matrix-c-${rank}-${card.suit}`} style={{ animationDuration: '4s' }} />
          </g>
        )}

        <text x="10" y="22" fontSize="18" fill={t.text} fontWeight="800">
          {rank}
        </text>
        <text x="12" y="40" fontSize="16" fill={t.text}>
          {suit}
        </text>

        {isFaceCard ? (
          // Если Валет, Дама или Король — рисуем Белку-Рыцаря
          <image
            href={squirrelImg} // Убедись, что путь правильный
            x="0"
            y="25"
            width="90"
            height="100"
            preserveAspectRatio="xMidYMid meet"
          />
        ) : (
          // Если 7, 8, 9, 10 или Туз — рисуем большую масть
          <text x="50" y="88" fontSize="42" textAnchor="middle" fill={t.text} fontWeight="700">
            {suit}
          </text>
        )}

        <text
          x="90"
          y="132"
          fontSize="18"
          fill={t.text}
          fontWeight="800"
          textAnchor="end"
        >
          {rank}
        </text>

        <text
          x="88"
          y="114"
          fontSize="16"
          fill={t.text}
          textAnchor="end"
        >
          {suit}
        </text>
      </svg>
    </div>
  );
}

export function DeckPreview({ theme }) {
  const cards = [
    { rank: "Ace", suit: "Spades" },
    { rank: "King", suit: "Hearts" },
    { rank: "Jack", suit: "Clubs" },
  ];

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {cards.map((card, i) => {
        const rotate = (i - 1) * 12;
        const offset = i * 10;

        return (
          <div
            key={i}
            className="absolute"
            style={{
              transform: `translateX(${offset}px) rotate(${rotate}deg)`,
              zIndex: i,
            }}
          >
            <CardFace card={card} theme={theme} />
          </div>
        );
      })}
    </div>
  );
}

function StorePage({ onBack }) {
  const user = useGameStore((s) => s.user);
  const setUser = useGameStore((s) => s.setUser);
  const token = useGameStore((s) => s.token) || localStorage.getItem("access_token");

  const [storeTab, setStoreTab] = useState("nuts");
  const [chestToOpen, setChestToOpen] = useState(null);
  const [adLoading, setAdLoading] = useState(false);
  const [adCooldown, setAdCooldown] = useState(0);

  const [storeLoading, setStoreLoading] = useState(true);
  const [storeError, setStoreError] = useState("");
  const [decks, setDecks] = useState([]);
  const [backgrounds, setBackgrounds] = useState([]);
  const [taunts, setTaunts] = useState([]);
  const [nutPacks, setNutPacks] = useState([]);
  const [userChests, setUserChests] = useState({});
  const [selectedPackId, setSelectedPackId] = useState(null);

  const nuts = user?.nuts ?? 0;

  const rarityStyles = {
    common: "bg-slate-500/10 text-slate-300 border-slate-400/20",
    rare: "bg-cyan-500/10 text-cyan-300 border-cyan-400/20",
    epic: "bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-400/20",
    legendary: "bg-yellow-500/10 text-yellow-300 border-yellow-400/20",
    mythic: "bg-violet-500/10 text-violet-300 border-violet-400/20",
  };

  const packUiMeta = {
    nuts_250: {
      badge: null,
      title: "Стартовый",
      glow: "from-slate-500/20 to-slate-700/5 border-slate-400/20",
      popular: false,
    },
    nuts_700: {
      badge: null,
      title: "Стандарт",
      glow: "from-cyan-500/20 to-blue-700/5 border-cyan-400/20",
      popular: false,
    },
    nuts_1500: {
      badge: "Хит",
      title: "Популярный",
      glow: "from-fuchsia-500/20 to-purple-700/10 border-fuchsia-400/30",
      popular: true,
    },
    nuts_4000: {
      badge: "Value",
      title: "Большой",
      glow: "from-yellow-500/20 to-amber-700/10 border-yellow-400/30",
      popular: false,
    },
  };

  const loadStore = async ({ silent = false } = {}) => {
    try {
      if (!silent) setStoreLoading(true);
      setStoreError("");

      const data = await fetchStore();

      const packs = (data.nuts_packs || []).map((pack) => {
        const meta = packUiMeta[pack.id] || {};
        const totalNuts = (pack.nuts_amount ?? 0) + (pack.bonus_nuts_amount ?? 0);

        return {
          id: pack.id,
          nuts: totalNuts,
          baseNuts: pack.nuts_amount ?? 0,
          bonusNuts: pack.bonus_nuts_amount ?? 0,
          priceXtr: pack.price_xtr ?? 0,
          price: `${pack.price_xtr ?? 0} ⭐`,
          bonus:
            (pack.bonus_nuts_amount ?? 0) > 0
              ? `+${pack.bonus_nuts_amount} бонус`
              : null,
          badge: meta.badge ?? null,
          title: meta.title ?? pack.title,
          popular: meta.popular ?? false,
          glow: meta.glow ?? "from-slate-500/20 to-slate-700/5 border-slate-400/20",
          description: pack.description ?? "",
          is_featured: pack.is_featured ?? false,
        };
      });

      setNutPacks(packs);
      setDecks(data.decks || []);
      setBackgrounds(data.backgrounds || []);
      setTaunts(data.taunts || []);

      const chestsRes = await axios.get(getUrl("/v1/chests"), {
         headers: { Authorization: `Bearer ${token}` }
      });
      setUserChests(chestsRes.data || {});

      if (typeof data.balance_nuts === "number" && user) {
        setUser({ ...user, nuts: data.balance_nuts });
      }

      if (packs.length > 0) {
        setSelectedPackId((prev) =>
          prev && packs.some((p) => p.id === prev) ? prev : packs[0].id
        );
      }
    } catch (err) {
      console.error("fetch store failed:", err);
      setStoreError("Не удалось загрузить магазин");
    } finally {
      if (!silent) setStoreLoading(false);
    }
  };

  const handleBuyChest = async (chestType, price) => {
    if (nuts < price) {
      toast.error("Недостаточно орехов!");
      return;
    }
    try {
      await axios.post(getUrl("/v1/chests/buy"), { chest_type: chestType }, {
         headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Сундук куплен!");
      loadStore({ silent: true }); // refresh balance & chests silently
    } catch (e) {
      toast.error("Ошибка при покупке");
    }
  };

  useEffect(() => {
    loadStore();
  }, []);

  useEffect(() => {
    if (adCooldown <= 0) return;

    const timer = setInterval(() => {
      setAdCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [adCooldown]);

  const selectedPack =
    nutPacks.find((p) => p.id === selectedPackId) ??
    nutPacks[0];
  const featuredPack = nutPacks.find((p) => p.is_featured) ?? nutPacks[0]
  const handleBuyNuts = async (pack) => {
    try {
      const tg = window.Telegram?.WebApp;
      const token = localStorage.getItem("access_token");

      if (!tg) {
        alert("Telegram WebApp не найден");
        return;
      }

      if (!token) {
        alert("Не найден access token");
        return;
      }

      const product_id = pack.id;

      const res = await fetch(getUrl("/v1/store/invoice"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ product_id }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("create invoice failed:", errorText);
        alert("Не удалось создать инвойс");
        return;
      }

      const data = await res.json();

      if (!data.invoice_url) {
        alert("Бэк не вернул invoice_url");
        return;
      }

      if (!tg.isVersionAtLeast || !tg.isVersionAtLeast("6.1")) {
        alert("Нужно обновить Telegram, чтобы открыть оплату");
        return;
      }

      tg.openInvoice(data.invoice_url, async (status) => {
        console.log("invoice status:", status);

        if (status === "paid") {
          await loadStore({ silent: true });
          alert("Оплата прошла успешно");
        } else if (status === "cancelled") {
          alert("Оплата отменена");
        } else if (status === "failed") {
          alert("Ошибка оплаты");
        }
      });
    } catch (err) {
      console.error("handleBuyNuts error:", err);
      alert("Ошибка при открытии оплаты");
    }
  };

  const handleWatchAd = () => {
    if (adLoading || adCooldown > 0 || !user) return;

    setAdLoading(true);

    setTimeout(() => {
      setUser({
        ...user,
        nuts: nuts + 50,
      });
      setAdLoading(false);
      setAdCooldown(60);
    }, 30000);
  };

  const buyDeck = async (deckId) => {
    try {
      await buyStoreItem({ item_type: "deck", item_id: deckId });
      await loadStore({ silent: true });
    } catch (err) {
      console.error("buyDeck error:", err);
      alert("Не удалось купить колоду");
    }
  };

  const equipDeck = async (deckId) => {
    try {
      await equipStoreItem({ item_type: "deck", item_id: deckId });
      await loadStore({ silent: true });
      if (user) {
        setUser({ ...user, equipped_deck: deckId });
      }
    } catch (err) {
      console.error("equipDeck error:", err);
      alert("Не удалось применить колоду");
    }
  };

  const buyBackground = async (bgId) => {
    try {
      await buyStoreItem({ item_type: "background", item_id: bgId });
      await loadStore({ silent: true });
    } catch (err) {
      console.error("buyBackground error:", err);
      alert("Не удалось купить фон");
    }
  };

  const equipBackground = async (bgId) => {
    try {
      await equipStoreItem({ item_type: "background", item_id: bgId });
      await loadStore({ silent: true });
      if (user) {
        setUser({ ...user, equipped_background: bgId });
      }
    } catch (err) {
      console.error("equipBackground error:", err);
      alert("Не удалось применить фон");
    }
  };

  const buyTaunt = async (tauntId) => {
    try {
      await buyStoreItem({ item_type: "taunt", item_id: tauntId });
      await loadStore({ silent: true });
    } catch (err) {
      console.error("buyTaunt error:", err);
      alert("Не удалось купить насмешку");
    }
  };

  if (storeLoading) {
    return (
      <div className="space-y-4 pb-28">
        <div className="rounded-3xl border border-purple-500 bg-[#171728]/95 p-6 text-center text-gray-300">
          Загрузка магазина...
        </div>
      </div>
    );
  }

  if (storeError) {
    return (
      <div className="space-y-4 pb-28">
        <div className="rounded-3xl border border-red-500/30 bg-[#171728]/95 p-6 text-center text-red-300">
          {storeError}
          <div className="mt-4">
            <button
              onClick={loadStore}
              className="rounded-xl bg-purple-600 px-4 py-2 text-white font-bold"
            >
              Повторить
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-28">
      <div className="relative overflow-hidden rounded-3xl border border-purple-500 bg-[#171728]/95 p-4 shadow-lg shadow-purple-900/30">
        <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/10 via-transparent to-yellow-500/10 pointer-events-none" />
        <div className="absolute -top-8 -right-8 h-28 w-28 rounded-full bg-fuchsia-500/10 blur-3xl" />
        <div className="absolute -bottom-10 -left-8 h-28 w-28 rounded-full bg-yellow-500/10 blur-3xl" />

        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-extrabold text-pink-400 leading-none">
              Магазин
            </h2>
            <p className="mt-1 text-sm text-gray-400">
              Орехи, колоды и фоны
            </p>

            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <div className="rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1.5 text-xs font-bold text-green-400">
                Баланс: {nuts} 🥜
              </div>
              <div className="rounded-full border border-fuchsia-500/20 bg-fuchsia-500/10 px-3 py-1.5 text-xs font-bold text-fuchsia-300">
                Rewarded +50
              </div>
            </div>
          </div>

          <button
            onClick={onBack}
            className="shrink-0 h-11 rounded-xl border border-purple-500/40 bg-black/20 px-4 text-sm font-bold text-white transition hover:bg-black/30 active:scale-[0.98]"
          >
            Назад
          </button>
        </div>

        {featuredPack && (
          <div className="relative mt-4 rounded-2xl border border-yellow-400/20 bg-gradient-to-r from-yellow-500/15 via-amber-400/10 to-yellow-500/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="inline-flex rounded-full bg-black/20 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-yellow-200">
                  Спецпредложение
                </div>
                <div className="mt-2 text-lg font-extrabold text-white">
                  {featuredPack.nuts} орехов
                </div>
                <div className="mt-1 text-sm text-gray-300">
                  {featuredPack.bonus || featuredPack.description || "Базовый пакет"}
                </div>
              </div>

              <button
                onClick={() => handleBuyNuts(featuredPack)}
                className="shrink-0 rounded-2xl bg-gradient-to-r from-yellow-400 to-amber-400 px-4 py-3 text-sm font-extrabold text-black shadow-[0_0_20px_rgba(250,204,21,0.2)] active:scale-[0.98]"
              >
                {featuredPack.price}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-purple-500 bg-[#171728]/95 p-2 shadow-lg shadow-purple-900/20 overflow-x-auto whitespace-nowrap scrollbar-hide">
        <div className="flex gap-2">
          {[
            { key: "nuts", label: "Орехи" },
            { key: "decks", label: "Колоды" },
            { key: "backgrounds", label: "Фоны" },
            { key: "taunts", label: "Эмодзи" },
            { key: "chests", label: "Сундуки" },
          ].map((tab) => {
            const isActive = storeTab === tab.key;

            return (
              <button
                key={tab.key}
                onClick={() => setStoreTab(tab.key)}
                className={`rounded-xl px-3 py-3 text-sm font-bold transition ${isActive
                    ? "bg-gradient-to-r from-purple-600 to-fuchsia-500 text-white shadow-[0_0_14px_#a855f7]"
                    : "border border-purple-500/30 bg-black/20 text-gray-300"
                  }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {storeTab === "nuts" && (
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-3xl border border-fuchsia-400/30 bg-black from-fuchsia-500/20 via-purple-500/10 to-[#171728] p-4 shadow-[0_0_24px_rgba(168,85,247,0.18)]">
            <div className="absolute -top-10 -right-8 h-28 w-28 rounded-full bg-fuchsia-500/20 blur-3xl" />
            <div className="absolute -bottom-10 -left-8 h-28 w-28 rounded-full bg-purple-500/20 blur-3xl" />

            <div className="relative flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-400/20 bg-black/20 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-fuchsia-200">
                  🎁 Бесплатная награда
                </div>

                <div className="mt-3">
                  <div className="text-white text-lg font-extrabold leading-tight">
                    Бесплатные орехи
                  </div>
                  <div className="mt-1 text-sm text-gray-300 leading-snug">
                    Посмотри короткую рекламу и забери награду
                  </div>
                </div>
              </div>

              <div className="shrink-0 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-right shadow-[0_0_18px_rgba(251,191,36,0.10)]">
                <div className="text-[10px] uppercase tracking-wide text-gray-400">
                  Награда
                </div>
                <div className="mt-1 text-base font-extrabold text-amber-300">
                  +50 🥜
                </div>
              </div>
            </div>

            <button
              onClick={handleWatchAd}
              disabled={adLoading || adCooldown > 0}
              className={`relative mt-4 w-full rounded-2xl px-4 py-4 font-extrabold text-base transition ${adLoading || adCooldown > 0
                  ? "cursor-not-allowed bg-gray-700 text-gray-400"
                  : "bg-gradient-to-r from-fuchsia-500 via-purple-500 to-fuchsia-600 text-white shadow-[0_0_24px_rgba(168,85,247,0.28)] hover:brightness-110 active:scale-[0.985]"
                }`}
            >
              {adLoading
                ? "Смотрим рекламу... 30 сек"
                : adCooldown > 0
                  ? `Повтор через ${adCooldown} сек`
                  : "Получить бесплатно"}
            </button>

            <div className="relative mt-3 flex items-center justify-between gap-2 text-xs text-gray-400">
              <span>Длительность рекламы: ~30 секунд</span>
              <span className="text-fuchsia-300 font-bold">Без покупки</span>
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-300">Пакеты орехов</h3>
              <span className="text-xs text-gray-500">Выбери пакет</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {nutPacks.map((pack) => {
                const isSelected = selectedPackId === pack.id;

                return (
                  <button
                    key={pack.id}
                    onClick={() => setSelectedPackId(pack.id)}
                    className={`relative rounded-3xl border bg-gradient-to-br p-4 text-left shadow-lg transition ${pack.glow} ${isSelected
                        ? "ring-2 ring-fuchsia-500/50 shadow-[0_0_18px_rgba(168,85,247,0.18)]"
                        : "hover:-translate-y-0.5 active:scale-[0.985]"
                      }`}
                  >
                    {pack.badge && (
                      <div className="absolute right-3 top-3 rounded-full bg-black/30 px-2 py-1 text-[10px] font-bold text-gray-200">
                        {pack.badge}
                      </div>
                    )}

                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-xl">
                      🥜
                    </div>

                    <div className="mt-4 text-xs font-bold uppercase tracking-wide text-gray-400">
                      {pack.title}
                    </div>

                    <div className="mt-1 text-lg font-extrabold text-white">
                      {pack.nuts}
                    </div>
                    <div className="text-sm text-gray-400">орехов</div>

                    <div className="mt-2 min-h-[16px] text-xs font-bold text-amber-300">
                      {pack.bonus || " "}
                    </div>

                    <div className="mt-4 text-lg font-extrabold text-yellow-300">
                      {pack.price}
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedPack && (
              <div className="fixed bottom-[100px] left-4 right-4 z-50">
                <button
                  onClick={() => handleBuyNuts(selectedPack)}
                  className="w-full rounded-2xl bg-gradient-to-r from-yellow-400 to-amber-400 px-4 py-4 text-base font-extrabold text-[#1a1a2e] shadow-[0_10px_30px_rgba(250,204,21,0.4)] border-2 border-yellow-200/50 hover:brightness-110 active:scale-[0.985] transition-all"
                >
                  Купить пакет ({selectedPack.price})
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {storeTab === "decks" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-300">Колоды</h3>
            <span className="text-xs text-gray-500">Покупка за 🥜</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {decks.map((deck) => (
              <div
                key={deck.item_key}
                className="rounded-3xl border border-purple-500 bg-[#171728]/95 p-3 shadow-lg shadow-purple-900/20"
              >
                <div className="relative flex h-28 items-center justify-center overflow-hidden rounded-2xl border border-purple-500/20 bg-black/20 text-4xl">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent" />
                  <DeckPreview theme={deck.item_key} />
                </div>

            <div className="mt-3 text-sm font-extrabold text-white">
                  {deck.title}
                </div>

                <div
                  className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold ${rarityStyles[deck.rarity] ||
                    "bg-slate-500/10 text-slate-300 border-slate-400/20"
                    }`}
                >
                  {deck.rarity}
                </div>

                {!deck.owned ? (
                  deck.price_nuts < 0 ? (
                    <div className="mt-4 w-full rounded-2xl border border-pink-500/30 bg-pink-500/10 px-4 py-3 text-center text-sm font-extrabold text-pink-400">
                      Событие
                    </div>
                  ) : (
                    <button
                      onClick={() => buyDeck(deck.item_key)}
                      className="mt-4 w-full rounded-2xl bg-gradient-to-r from-yellow-400 to-amber-400 px-4 py-3 text-sm font-extrabold text-black active:scale-[0.98]"
                    >
                      Купить за {deck.price_nuts} 🥜
                    </button>
                  )
                ) : deck.equipped ? (
                  <div className="mt-4 w-full rounded-2xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-center text-sm font-extrabold text-green-400">
                    Используется
                  </div>
                ) : (
                  <button
                    onClick={() => equipDeck(deck.item_key)}
                    className="mt-4 w-full rounded-2xl border border-purple-500/30 bg-black/20 px-4 py-3 text-sm font-extrabold text-white active:scale-[0.98]"
                  >
                    Выбрать
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {storeTab === "backgrounds" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-300">Фоны</h3>
            <span className="text-xs text-gray-500">Покупка за 🥜</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {backgrounds.map((bg) => (
              <div
                key={bg.item_key}
                className="rounded-3xl border border-purple-500 bg-[#171728]/95 p-3 shadow-lg shadow-purple-900/20"
              >
                <div className="h-44 rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/20 via-fuchsia-500/10 to-blue-500/10 p-2">
                  <div className="flex h-full items-center justify-center rounded-xl bg-black/10 text-4xl">
                    <BackgroundPreview theme={bg.item_key} />
                  </div>
                </div>

                <div className="mt-3 text-sm font-extrabold text-white">
                  {bg.title}
                </div>

                <div
                  className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold ${rarityStyles[bg.rarity] ||
                    "bg-slate-500/10 text-slate-300 border-slate-400/20"
                    }`}
                >
                  {bg.rarity}
                </div>

                {!bg.owned ? (
                  bg.price_nuts < 0 ? (
                    <div className="mt-4 w-full rounded-2xl border border-pink-500/30 bg-pink-500/10 px-4 py-3 text-center text-sm font-extrabold text-pink-400">
                      Событие
                    </div>
                  ) : (
                  <button
                    onClick={() => buyBackground(bg.item_key)}
                    className="mt-4 w-full rounded-2xl bg-gradient-to-r from-yellow-400 to-amber-400 px-4 py-3 text-sm font-extrabold text-black active:scale-[0.98]"
                  >
                    Купить за {bg.price_nuts} 🥜
                  </button>
                  )
                ) : bg.equipped ? (
                  <div className="mt-4 w-full rounded-2xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-center text-sm font-extrabold text-green-400">
                    Используется
                  </div>
                ) : (
                  <button
                    onClick={() => equipBackground(bg.item_key)}
                    className="mt-4 w-full rounded-2xl border border-purple-500/30 bg-black/20 px-4 py-3 text-sm font-extrabold text-white active:scale-[0.98]"
                  >
                    Применить
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAUNTS TAB */}
      {storeTab === "taunts" && (
        <div className="space-y-6 pb-24">
          <div className="space-y-4">
            <div className="flex items-center gap-3 px-2">
              <span className="text-2xl">😎</span>
              <div>
                <h2 className="text-xl font-bold text-white leading-tight">Насмешки</h2>
                <p className="text-xs text-indigo-200/70">Эмодзи для общения в игре</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {taunts.map((t) => (
                <div
                  key={t.item_key}
                  className={`relative overflow-hidden rounded-3xl border p-4 flex flex-col justify-between ${rarityStyles[t.rarity] || rarityStyles.common} ${t.owned ? "opacity-70" : ""}`}
                >
                  <div className="absolute top-0 right-0 -m-8 h-32 w-32 rounded-full bg-current opacity-10 blur-2xl" />

                  <div className="relative z-10 text-center mb-4">
                    <div className="flex items-center justify-center h-20 text-6xl drop-shadow-md">
                       {renderTauntGraphic(t.item_key)}
                    </div>
                    <h3 className="text-lg font-bold mt-2 text-white">{t.title}</h3>
                  </div>

                  <div className="relative z-10 flex gap-2">
                    {t.owned ? (
                        <div className="w-full rounded-xl py-2.5 font-bold text-white text-center bg-gray-500/50">
                          Куплено
                        </div>
                    ) : (
                      t.price_nuts < 0 ? (
                        <div className="w-full rounded-xl py-2.5 font-bold text-pink-400 text-center bg-pink-500/10 border border-pink-500/30">
                          Событие
                        </div>
                      ) : (
                      <button
                        onClick={() => buyTaunt(t.item_key)}
                        className="w-full rounded-xl py-2.5 font-bold text-white shadow-lg flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all bg-gradient-to-r from-amber-500 to-orange-500 shadow-orange-500/30"
                      >
                        <span className="text-amber-100">🥜</span>
                        <span>{t.price_nuts}</span>
                      </button>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {storeTab === "chests" && (
        <div className="space-y-4 pb-12">
           <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-300">Сундуки</h3>
            <span className="text-xs text-gray-500">Лутбоксы</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
             {["common", "rare", "epic", "legendary"].map((cType) => {
                const count = userChests[cType] || 0;
                const prices = { common: 500, rare: 1000, epic: 1500, legendary: null };
                const price = prices[cType];
                
                return (
                <div key={cType} className="relative rounded-3xl border border-purple-500 bg-[#171728]/95 p-3 flex flex-col items-center shadow-lg shadow-purple-900/20 hover:bg-white/5 transition">
                   <div className="absolute top-2 right-2 bg-purple-600 font-bold border border-purple-400 text-white rounded-full px-2 py-0.5 text-xs z-10">{count} шт</div>
                   <div className="relative flex h-32 w-full items-center justify-center rounded-2xl border border-purple-500/20 bg-black/20 text-4xl overflow-hidden mt-2">
                     <img src={`/chests/${cType}.png`} alt={cType} className="w-[120%] h-[120%] max-w-none max-h-none drop-shadow-[0_0_20px_rgba(255,255,255,0.2)] object-cover scale-[1.2]" />
                   </div>
                   <div className="mt-3 text-sm font-extrabold text-white capitalize">{cType} Сундук</div>
                   <div className="w-full flex flex-col gap-2 mt-4">
                     {price ? (
                       <button 
                         onClick={() => handleBuyChest(cType, price)}
                         className="w-full rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-2.5 text-sm font-extrabold text-black active:scale-[0.98] shadow-lg shadow-orange-500/20"
                       >
                         Купить за {price} 🥜
                       </button>
                     ) : (
                       <div className="text-[10px] text-gray-500 font-bold uppercase text-center w-full py-3">Только награда</div>
                     )}
                     {count > 0 && (
                       <button 
                         onClick={() => setChestToOpen(cType)}
                         className="w-full rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-500 px-4 py-2.5 text-sm font-extrabold text-white active:scale-[0.98] shadow-lg shadow-purple-500/20"
                       >
                         Открыть сундук
                       </button>
                     )}
                   </div>
                </div>
                );
             })}
          </div>
        </div>
      )}
      
      <ChestOpeningModal 
         isOpen={!!chestToOpen} 
         chestType={chestToOpen} 
         onClose={() => setChestToOpen(null)} 
         onSuccess={() => {
            loadStore({ silent: true }); // trigger refresh to deduct chest
         }} 
      />
    </div>
  );
}


/* =========================
   HEADER
========================= */
function ProfileHeader({ onOpenRating, onOpenNuts, onOpenClans }) {
  const user = useGameStore((s) => s.user);
  if (!user) return null;

  const nuts = user.nuts ?? 1245;

  return (
    <GlassCard className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={user.photo_url || "https://api.dicebear.com/7.x/thumbs/svg?seed=squirrel"}
            alt="avatar"
            className="w-12 h-12 rounded-full border-2 border-purple-500 shadow-[0_0_10px_#a855f7]"
          />

          <div className="min-w-0">
            <div className="text-pink-400 font-extrabold truncate">
              @{user.username || "squirrelKing"}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1 sm:gap-2">
              <LeagueBadge league={getLeagueByRating(user.rating)} />
              <button 
                onClick={onOpenClans}
                className="text-[10px] uppercase font-black tracking-widest text-white bg-purple-600 px-2 py-0.5 rounded-full border border-purple-400 hover:scale-105 active:scale-95 transition-all shadow-[0_0_10px_rgba(168,85,247,0.5)]"
              >
                Кланы 🛡
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenRating}
            className="min-w-[72px] rounded-xl bg-black/30 border border-yellow-400/20 px-3 py-2 text-center transition hover:bg-yellow-500/10 active:scale-[0.98]"
          >
            <div className="mt-1 flex items-center justify-center gap-1">
              <svg className="w-4 h-4 fill-yellow-400" viewBox="0 0 24 24">
                <path d="M12 .587l3.668 7.568L24 9.423l-6 5.84L19.336 24 12 19.897 4.664 24 6 15.263 0 9.423l8.332-1.268z" />
              </svg>
              <span className="text-yellow-300 font-bold text-sm">
                {user.rating ?? 0}
              </span>
            </div>
          </button>

          <button
            onClick={onOpenNuts}
            className="min-w-[86px] rounded-xl bg-black/30 border border-amber-500/20 px-3 py-2 text-center transition hover:bg-amber-500/10 active:scale-[0.98]"
          >
            <div className="mt-1 flex items-center justify-center gap-1">
              <span className="text-sm">🥜</span>
              <span className="text-amber-300 font-bold text-sm">
                {nuts}
              </span>
            </div>
          </button>
        </div>
      </div>
    </GlassCard>
  );
}

/* =========================
   ROOM CARD
========================= */

function RoomCard({
  roomName,
  playersConnected,
  maxPlayers,
  prizeMoney,
  isRanked,
  isPrivate,
  isFull,
  onJoin,
}) {
  const percent = (playersConnected / maxPlayers) * 100;
  const almostFull = playersConnected === maxPlayers - 1;

  return (
    <div className="relative group p-4 rounded-2xl bg-[#1a1a2e] border border-purple-500 shadow-lg shadow-purple-900/40 overflow-hidden transition hover:scale-[1.02]">
      {isPrivate && (
        <div className="absolute inset-0 pointer-events-none bg-black/40 backdrop-blur-[1px] z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
          <div className="flex flex-col items-center text-pink-400">
            <span className="text-3xl">🔒</span>
            <span className="text-sm font-bold">Private room</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between relative z-10">
        <span
          className={`px-3 py-1 text-xs font-bold rounded-full ${isRanked
              ? "bg-pink-500/20 text-pink-400 border border-pink-500"
              : "bg-gray-500/20 text-gray-300 border border-gray-500"
            }`}
        >
          {isRanked ? "RANKED" : "BOT"}
        </span>

        {almostFull && (
          <span className="text-xs font-bold text-orange-400 animate-pulse">
            🔥 Almost full
          </span>
        )}
      </div>

      <div className="mt-3 text-center space-y-2 relative z-10">
        <h3 className="text-lg font-extrabold text-yellow-300">{roomName}</h3>

        <div className="flex justify-center">
          <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-blue-700 flex items-center justify-center shadow-[0_0_15px_rgba(239,68,68,0.7)] border-4 border-white/20">
            <span className="text-white font-black text-sm">{prizeMoney}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2 relative z-10">
        <div className="text-xs text-gray-300 text-center">
          {playersConnected}/{maxPlayers} игроков
        </div>

        <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-green-400 to-green-600 transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {isFull ? (
        <button
          onClick={onJoin}
          className="mt-4 w-full py-2 rounded-xl font-bold text-white bg-gradient-to-r from-blue-500 to-cyan-400 hover:from-blue-400 hover:to-cyan-300 shadow-lg shadow-blue-500/40 transition active:scale-[0.97]"
        >
          👁 Смотреть
        </button>
      ) : (
        <button
          onClick={onJoin}
          className="mt-4 w-full py-2 rounded-xl font-bold text-black bg-gradient-to-r from-purple-400 to-blue-300 hover:from-purple-300 hover:to-purple-200 active:scale-[0.97] shadow-lg shadow-purple-500/40 transition"
        >
          Войти ▶
        </button>
      )}

      {isRanked && (
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-pink-500/20 blur-3xl" />
      )}
    </div>
  );
}

/* =========================
   MODALS
========================= */

export function BotsModal({ isOpen, onClose, onPlayBots, onOpenRules }) {
  const [maxEyes, setMaxEyes] = useState(12);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-[#1a1a2e] p-8 rounded-2xl border-4 border-blue-500 shadow-[0_0_30px_#3b82f6] flex flex-col items-center space-y-6 w-[90%] max-w-sm">

        {/* Иконка */}
        <div className="relative w-24 h-24 flex items-center justify-center bg-blue-500/20 rounded-full border-4 border-blue-400">
          <span className="text-5xl">🤖</span>
        </div>

        {/* Заголовки */}
        <div className="text-center">
          <h2 className="text-xl font-bold text-blue-400">
            Тренировочный матч
          </h2>
          <p className="text-sm font-semibold text-gray-300 mt-2">
            Выберите сложность и режим:
          </p>
        </div>

        {/* Game Mode */}
        <div className="w-full">
          <div className="flex bg-gray-900 rounded-2xl p-1.5 border border-gray-700">
            <button 
              onClick={() => setMaxEyes(6)}
              className={`flex-1 py-3 rounded-xl font-extrabold transition-all text-xs tracking-wide uppercase ${maxEyes === 6 ? 'bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]' : 'text-gray-500 hover:text-white'}`}
            >
              Быстрая (6)
            </button>
            <button 
              onClick={() => setMaxEyes(12)}
              className={`flex-1 py-3 rounded-xl font-extrabold transition-all text-xs tracking-wide uppercase ${maxEyes === 12 ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.4)]' : 'text-gray-500 hover:text-white'}`}
            >
              Классика (12)
            </button>
          </div>
        </div>

        {/* Кнопки выбора ботов */}
        <div className="flex flex-col space-y-3 w-full">
          <button
            onClick={() => onPlayBots("tutorial", maxEyes)}
            className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-bold shadow-lg shadow-emerald-500/30 active:scale-95 transition-transform"
          >
            🎓 Обучение
          </button>
          
          <button
            onClick={() => onPlayBots("medium", maxEyes)}
            className="px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg font-bold shadow-lg shadow-orange-500/30 active:scale-95 transition-transform"
          >
            🤖 Средние боты
          </button>

          <button
            onClick={() => onPlayBots("hard", maxEyes)}
            className="px-6 py-3 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-lg font-bold shadow-lg shadow-red-500/30 active:scale-95 transition-transform"
          >
            💀 Сложные боты
          </button>

          <button
            onClick={onOpenRules}
            className="px-6 py-3 border border-purple-500/50 bg-purple-900/30 hover:bg-purple-900/50 text-purple-200 rounded-lg font-bold transition-colors active:scale-95"
          >
            ❓ Как играть?
          </button>
        </div>

        {/* Кнопка "Назад" */}
        <button
          onClick={onClose}
          className="w-full px-6 py-3 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-bold transition-colors active:scale-95"
        >
          ⬅ Назад
        </button>
      </div>
    </div>
  );
}

function CreateRoomModal({ isOpen, onClose, onCreate }) {
  const [stake, setStake] = useState("10");
  const [currency, setCurrency] = useState("Virtual");
  // league is hardcoded to Bronze since we removed it from UI
  const league = "Bronze";
  const [roomName, setRoomName] = useState("");
  const [password, setPassword] = useState("");
  const [maxEyes, setMaxEyes] = useState(12);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#0f0f1a]/95 flex items-end sm:items-center justify-center z-50 animate-in fade-in duration-200">
      <div className="bg-[#1a1a2e] w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 border-t-2 sm:border-2 border-purple-500/50 shadow-[0_0_50px_rgba(168,85,247,0.2)] space-y-5">
        <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 text-center tracking-wide">
          СОЗДАТЬ КОМНАТУ
        </h2>

        {/* Currency Selector */}
        <div className="grid grid-cols-2 gap-3 mb-2">
          <button
            onClick={() => setCurrency("Virtual")}
            className={`py-3 rounded-2xl font-extrabold transition-all border ${currency === "Virtual"
              ? "bg-gradient-to-br from-yellow-500 to-orange-500 text-white border-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.5)]"
              : "bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700"
              }`}
          >
            🥜 Орехи
          </button>
          <div className="relative group">
            <button
              disabled
              className="w-full h-full py-3 rounded-2xl font-extrabold transition-all border bg-gray-800/50 text-gray-500 border-gray-700 cursor-not-allowed overflow-hidden"
            >
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm z-10 rounded-2xl">
                <span className="text-xs text-white">В разработке</span>
              </div>
              💎 TONcoin
            </button>
          </div>
        </div>

        {/* Stakes */}
        <div>
          <label className="text-sm font-bold text-gray-400 mb-2 block ml-1 uppercase tracking-widest">Размер ставки</label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { val: "10", name: "Новичок", color: "from-blue-500/10 to-blue-900/40", border: "border-blue-500/30", active: "bg-blue-600 border-blue-400 shadow-blue-500/40 text-white" },
              { val: "50", name: "Бывалый", color: "from-green-500/10 to-green-900/40", border: "border-green-500/30", active: "bg-green-600 border-green-400 shadow-green-500/40 text-white" },
              { val: "100", name: "Профи",  color: "from-yellow-500/10 to-yellow-900/40", border: "border-yellow-500/30", active: "bg-yellow-500 border-yellow-300 shadow-yellow-500/40 text-white" },
              { val: "500", name: "Легенда", color: "from-purple-500/10 to-pink-900/40", border: "border-purple-500/30", active: "bg-gradient-to-r from-purple-600 to-pink-600 border-pink-400 shadow-pink-500/50 text-white" },
            ].map((s) => (
              <button
                key={s.val}
                onClick={() => setStake(s.val)}
                className={`relative overflow-hidden p-3 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all duration-300 border-2 ${
                  stake === s.val 
                    ? `${s.active} shadow-[0_0_20px_var(--tw-shadow-color)] scale-[1.02]`
                    : `bg-gradient-to-br ${s.color} ${s.border} text-gray-400 hover:border-gray-400`
                }`}
              >
                {stake === s.val && (
                  <div className="absolute inset-0 bg-white/20 blur-md rounded-full pointer-events-none" />
                )}
                <span className={`text-[10px] font-black tracking-widest uppercase opacity-80 ${stake === s.val ? 'text-white/90' : 'text-gray-500'}`}>
                  {s.name}
                </span>
                <div className="flex items-center gap-1.5 z-10">
                  <span className={`text-2xl font-black ${stake === s.val ? 'drop-shadow-md' : 'text-white/80'}`}>{s.val}</span>
                  <span className="text-xl drop-shadow-md">🥜</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Game Mode */}
        <div>
          <label className="text-sm font-bold text-gray-400 mb-2 block ml-1 uppercase tracking-widest">Режим игры</label>
          <div className="flex bg-gray-900 rounded-2xl p-1.5 border border-gray-700">
            <button 
              onClick={() => setMaxEyes(6)}
              className={`flex-1 py-3 rounded-xl font-extrabold transition-all text-xs tracking-wide uppercase ${maxEyes === 6 ? 'bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]' : 'text-gray-500 hover:text-white'}`}
            >
              Быстрая (6)
            </button>
            <button 
              onClick={() => setMaxEyes(12)}
              className={`flex-1 py-3 rounded-xl font-extrabold transition-all text-xs tracking-wide uppercase ${maxEyes === 12 ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.4)]' : 'text-gray-500 hover:text-white'}`}
            >
              Классика (12)
            </button>
          </div>
        </div>

        {/* Room Name */}
        <div>
           <label className="text-sm font-bold text-gray-400 mb-2 block ml-1">Название комнаты (опционально)</label>
           <input
             type="text"
             placeholder="Супер игра..."
             value={roomName}
             onChange={(e) => setRoomName(e.target.value)}
             className="w-full p-4 rounded-xl bg-gray-900 text-white border-2 border-transparent focus:border-purple-500 outline-none transition placeholder-gray-600 font-medium"
           />
        </div>

        {/* Password */}
        <div>
           <label className="text-sm font-bold text-gray-400 mb-2 block ml-1">Пароль (опционально)</label>
           <input
             type="password"
             placeholder="Секретный код"
             value={password}
             onChange={(e) => setPassword(e.target.value)}
             className="w-full p-4 rounded-xl bg-gray-900 text-white border-2 border-transparent focus:border-purple-500 outline-none transition placeholder-gray-600 font-medium"
           />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-[0.4] py-4 bg-gray-800 hover:bg-gray-700 rounded-xl text-gray-300 font-bold transition border border-gray-600 active:scale-95"
          >
            Отмена
          </button>
          <button
            onClick={async () => {
              let hash = null;
              if (password) {
                const msgUint8 = new TextEncoder().encode(password);
                const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                hash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
              }
              onCreate({
                stake,
                currency,
                league,
                name: roomName,
                password_hash: hash,
                max_eyes: maxEyes,
              });
            }}
            className="flex-1 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl text-white font-black shadow-lg shadow-pink-500/30 transition-transform active:scale-95 uppercase tracking-wide border border-pink-400/50"
          >
            Создать 🚀
          </button>
        </div>
      </div>
    </div>
  );
}

function Chip({ value, selected, onClick }) {
  return (
    <button
      onClick={() => onClick(value)}
      className={`w-16 h-16 rounded-full font-extrabold transition ${selected
          ? "bg-green-400 text-black scale-110 shadow-[0_0_20px_#4ade80]"
          : "bg-gray-800 text-white border-4 border-gray-600"
        }`}
    >
      {value}
    </button>
  );
}

function PokerStakeSelector({ value, onChange }) {
  const presets = [50, 100, 250, 500, 1000];

  return (
    <div className="space-y-4">
      <label className="text-gray-300 text-sm block text-center">Ставка</label>

      <div className="flex flex-wrap justify-center gap-3">
        {presets.map((v) => (
          <Chip
            key={v}
            value={v}
            selected={Number(value) === v}
            onClick={(val) => onChange(val.toString())}
          />
        ))}
      </div>

      <input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Другая сумма"
        className="w-full p-3 text-center rounded-xl bg-gray-900 text-white border border-purple-500"
      />
    </div>
  );
}

function JoinRoomModal({ isOpen, room, onSpectate, onCancel }) {
  const [friends, setFriends] = useState([]);
  const [showInviteList, setShowInviteList] = useState(false);
  const user = useGameStore((s) => s.user);

  useEffect(() => {
    if (isOpen && room && showInviteList) {
      const fetchF = async () => {
        try {
          const token = localStorage.getItem("access_token");
          const res = await axios.get(getUrl("/v1/friends"), { headers: { Authorization: `Bearer ${token}` } });
          const inRoomIds = new Set((room.players || []).map(p => p.id));
          setFriends(res.data.filter(f => f.online && !inRoomIds.has(f.id)));
        } catch (e) {
          console.error(e);
        }
      };
      fetchF();
      const interval = setInterval(fetchF, 5000);
      return () => clearInterval(interval);
    }
  }, [isOpen, room, showInviteList]);

  if (!isOpen || !room) {
     if (showInviteList) setShowInviteList(false);
     return null;
  }

  const players = room.players || [];
  const filled = players.length;
  const max = room.maxPlayers || 4;
  const isAlmost = filled === max - 1;
  const isFull = filled === max;

  const isMyRoom = players.some(p => p.id === user?.id);

  const statusText = isFull
    ? "🎲 Игра начинается…"
    : isAlmost
      ? "🔥 Осталось одно место"
      : "⏳ Ожидаем игроков";

  const handleInvite = (friend_id) => {
    import('./ws/client').then(({ inviteFriend }) => {
      inviteFriend(room.id, friend_id);
      toast.success("Приглашение отправлено!");
    });
  };

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center">
        <div className="w-full sm:max-w-md bg-[#1a1a2e] rounded-t-3xl sm:rounded-3xl border border-purple-500 shadow-[0_0_40px_rgba(124,58,237,0.4)] p-6 space-y-5 animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:fade-in duration-300">
          <div className="text-center space-y-1">
            <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-400 break-words drop-shadow-md">
              {room.roomName || "Игровая комната"}
            </h2>
            <p className="text-pink-400 font-bold animate-pulse">{statusText}</p>
          </div>

          <div className="flex justify-center gap-4 py-4">
            {Array.from({ length: max }).map((_, i) => {
              const player = players[i];
              const avatar =
                player?.avatar ||
                player?.photo_url ||
                player?.photoUrl ||
                player?.user?.avatar ||
                player?.user?.photo_url ||
                `https://api.dicebear.com/7.x/thumbs/svg?seed=player-${i}`;

              return (
                <div
                  key={i}
                  className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full border-[3px] flex items-center justify-center overflow-hidden transition-all duration-300 ${player
                      ? "border-green-400 shadow-[0_0_20px_rgba(74,222,128,0.6)] scale-110 object-cover"
                      : "border-gray-700 bg-gray-800/80 dashed"
                    }`}
                >
                  {player ? (
                    <img
                      src={avatar}
                      alt="player"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-gray-600 font-bold text-2xl">?</span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="bg-gray-900/60 rounded-xl p-4 flex justify-between items-center text-sm font-bold border border-purple-500/30">
            <div className="flex items-center gap-2">
              <span className="text-xl">🥜</span>
              <span className="text-gray-300">Ставка:</span>
              <span className="text-yellow-400 text-lg ml-1">{room.prizeMoney}</span>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs uppercase tracking-wider ${room.isPrivate ? 'bg-red-500/20 text-red-400 border border-red-500/50' : 'bg-green-500/20 text-green-400 border border-green-500/50'}`}>
              {room.isPrivate ? "Приватная" : "Открытая"}
            </div>
          </div>

          {showInviteList && isMyRoom && !isFull && (
            <div className="mt-4 max-h-48 overflow-y-auto w-full bg-black/40 rounded-xl border border-purple-500/50 p-2 space-y-2">
              <h3 className="text-center text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Друзья онлайн</h3>
              {friends.length === 0 ? (
                <p className="text-center text-gray-500 text-sm py-4">Нет друзей онлайн 😔</p>
              ) : (
                friends.map(f => (
                  <div key={f.id} className="flex justify-between items-center p-2 rounded-xl bg-gray-800/80 border border-gray-700 hover:border-purple-500/50 transition">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <img src={f.avatar || `https://api.dicebear.com/7.x/thumbs/svg?seed=${f.name}`} alt="avatar" className="w-10 h-10 rounded-full border block" />
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-gray-800 block rounded-full"></span>
                      </div>
                      <span className="text-white font-bold">{f.name}</span>
                    </div>
                    <button 
                      onClick={() => handleInvite(f.id)}
                      className="px-4 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-bold shadow-lg shadow-pink-600/30 active:scale-95 transition"
                    >
                      Позвать
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          <div className="flex flex-col gap-3 pt-2">
            {!isFull && (
              <div className="flex gap-3">
                {isMyRoom && (
                  <button
                    onClick={() => setShowInviteList(!showInviteList)}
                    className="flex-1 py-4 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold rounded-2xl border border-gray-600 transition active:scale-95 shadow-md"
                  >
                    {showInviteList ? "Скрыть" : "Пригласить 👥"}
                  </button>
                )}
                <button
                  onClick={onCancel}
                  className="flex-1 py-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black rounded-2xl shadow-lg shadow-red-500/30 transition border border-red-400/50 active:scale-95 uppercase tracking-wider"
                >
                  Выйти 🚪
                </button>
              </div>
            )}

            {isFull && (
              <div className="flex gap-3">
                <button
                  onClick={onSpectate}
                  className="flex-1 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-black rounded-2xl shadow-lg shadow-blue-500/30 transition border border-blue-400/50 active:scale-95 uppercase tracking-wider flex items-center justify-center gap-2"
                >
                  <span>Смотреть</span> <span>👁</span>
                </button>
                <button
                  onClick={onCancel}
                  className="flex-1 py-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black rounded-2xl shadow-lg shadow-red-500/30 transition border border-red-400/50 active:scale-95 uppercase tracking-wider"
                >
                  Выйти 🚪
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
function LoadingModal({ isOpen, onCancel, onPlayBots }) {
  const messages = [
    "Подбираем достойных соперников",
    "Считаем рейтинги и ставки",
    "Ищем честную игру",
    "Почти готовы начать…",
  ];

  const user = useGameStore((s) => s.user);
  const [msgIndex, setMsgIndex] = useState(0);
  const [showBots, setShowBots] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setShowBots(false);
      return;
    }
    const interval = setInterval(() => {
      setMsgIndex((i) => (i + 1) % messages.length);
    }, 2500);

    const botTimer = setTimeout(() => {
      setShowBots(true);
    }, 40000);

    return () => {
      clearInterval(interval);
      clearTimeout(botTimer);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 overflow-hidden">
      {/* Сетка на фоне */}
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 bg-repeat bg-center mix-blend-overlay pointer-events-none" />
      
      <div className="relative flex flex-col items-center space-y-10 w-full max-w-sm z-10">
        
        {/* РАДАР */}
        <div className="relative w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center">
          {/* Волны */}
          <div className="absolute inset-[-60%] rounded-full border border-purple-500/30 animate-[ping_3s_linear_infinite]" />
          <div className="absolute inset-[-30%] rounded-full border border-pink-500/40 animate-[ping_3s_linear_infinite_1.5s]" />
          
          {/* Внешнее кольцо радара */}
          <div className="absolute inset-0 rounded-full border border-purple-500/50 overflow-hidden bg-purple-900/10">
             {/* Луч радара */}
             <div className="absolute top-1/2 left-1/2 w-[150%] h-[150%] origin-top-left border-l-2 border-l-purple-300 animate-spin bg-gradient-to-tr from-transparent via-purple-500/10 to-purple-400/60" style={{ animationDuration: "2s" }} />
          </div>

          <img
            src={user?.photo_url || "https://api.dicebear.com/7.x/thumbs/svg?seed=squirrel"}
            alt="avatar"
            className="relative z-10 w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-purple-500 bg-[#1a1a2e] object-cover shadow-[0_0_50px_rgba(168,85,247,0.7)]"
          />
        </div>

        <div className="text-center">
          <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-b from-purple-300 to-pink-500 uppercase tracking-widest drop-shadow-[0_2px_10px_rgba(236,72,153,0.8)] px-4">
            В поиске игры
          </h2>
          <p className="mt-2 text-md font-bold text-gray-300">
            {messages[msgIndex]}
          </p>
        </div>

        {showBots && (
          <div className="flex flex-col space-y-3 w-full">
            <p className="text-center text-sm font-semibold text-yellow-300">
              Поиск затянулся. Сыграем с ботами?
            </p>
            <button
              onClick={() => onPlayBots("tutorial")}
              className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-bold shadow-lg shadow-emerald-500/30 active:scale-95 transition-transform"
            >
              🎓 Обучение
            </button>
            <button
              onClick={() => onPlayBots("medium")}
              className="px-6 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg font-bold shadow-lg shadow-orange-500/30 active:scale-95 transition-transform"
            >
              🤖 Средние боты
            </button>
            <button
              onClick={() => onPlayBots("hard")}
              className="px-6 py-2 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-lg font-bold shadow-lg shadow-red-500/30 active:scale-95 transition-transform"
            >
              💀 Сложные боты
            </button>
          </div>
        )}

        <button
          onClick={onCancel}
          className={`mt-4 px-8 py-3 bg-red-600/80 hover:bg-red-500 text-white rounded-2xl font-bold border border-red-500 shadow-[0_0_20px_rgba(220,38,38,0.5)] transition-all ${!showBots ? "animate-pulse" : "active:scale-95"}`}
        >
          ✖ Отменить поиск
        </button>
      </div>
    </div>
  );
}

function Accordion({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-purple-500/30 bg-black/20 rounded-2xl overflow-hidden mb-3">
      <button 
        onClick={() => setOpen(!open)}
        className="w-full text-left px-5 py-4 flex justify-between items-center text-white font-bold bg-purple-900/10 hover:bg-purple-900/20 transition-colors"
      >
        <span className="text-base">{title}</span>
        <span className="text-gray-400 text-xs">{open ? "▼" : "▶"}</span>
      </button>
      {open && (
        <div className="p-5 text-[15px] text-gray-300 leading-relaxed border-t border-purple-500/20 bg-black/40">
          {children}
        </div>
      )}
    </div>
  );
}

function RulesModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-2xl max-h-[85vh] flex flex-col bg-[#161625] rounded-t-3xl sm:rounded-3xl border border-purple-500/50 shadow-[0_0_50px_rgba(168,85,247,0.2)]">
        
        <div className="p-5 border-b border-purple-500/30 flex justify-between items-center bg-[#1a1a2e] rounded-t-3xl sm:rounded-t-3xl shrink-0">
          <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">
            🐿 Правила игры «Белка»
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-red-500/20 text-red-400 font-bold hover:bg-red-500 hover:text-white transition-colors">
            ✕
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-2 flex-1 scrollbar-thin scrollbar-thumb-purple-600 scrollbar-track-transparent">
          
          <Accordion title="🎯 Цель игры и Команды" defaultOpen={true}>
            <p className="mb-2"><strong>Белка (народовская)</strong> — это командная карточная игра для 4 человек. Игроки делятся на две команды по 2 человека, сидящие друг напротив друга (Каскыр против Узи).</p>
            <p><strong>Цель:</strong> Набрать 12 «глаз» (раундов). Одно «очко» (глаз) дается за победу в партии. Победа присуждается команде, первой открывшая 12 глаз.</p>
          </Accordion>

          <Accordion title="📦 Колода и Очки">
            <p className="mb-3">Играется колодой из 32 карт (от 7 до Туза). Всего в колоде <strong>120 очков</strong>.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
               <div className="bg-black/50 p-3 rounded-xl text-center shadow-inner shadow-white/5"><span className="text-rose-400 font-black text-lg block">Туз</span> 11 очков</div>
               <div className="bg-black/50 p-3 rounded-xl text-center shadow-inner shadow-white/5"><span className="text-amber-400 font-black text-lg block">Десятка</span> 10 очков</div>
               <div className="bg-black/50 p-3 rounded-xl text-center shadow-inner shadow-white/5"><span className="text-emerald-400 font-black text-lg block">Валет</span> 2 очка</div>
               <div className="bg-black/50 p-3 rounded-xl text-center shadow-inner shadow-white/5"><span className="text-gray-300 font-black text-lg block">Король</span> 4 очка</div>
               <div className="bg-black/50 p-3 rounded-xl text-center shadow-inner shadow-white/5"><span className="text-gray-300 font-black text-lg block">Дама</span> 3 очка</div>
               <div className="bg-black/50 p-3 rounded-xl text-center shadow-inner shadow-white/5"><span className="text-gray-500 font-black text-lg block">7, 8, 9</span> 0 очков</div>
            </div>
          </Accordion>

          <Accordion title="🃏 Старшинство и Козыри (Валеты)">
            <p className="mb-3">Все 4 Валета всегда являются самыми старшими козырями. Владелец <strong>Крестового Валета</strong> диктует кто на какой масти сидит в текущей партии.</p>
            
            <p className="font-bold text-yellow-300 mb-2">Иерархия Валетов:</p>
            <ul className="pl-2 space-y-2 mb-4 text-emerald-100 flex flex-col gap-1">
               <li className="flex items-center gap-2"><span className="w-6 text-center bg-gray-800 rounded">1</span> ♣ Крестовый (самый старший)</li>
               <li className="flex items-center gap-2"><span className="w-6 text-center bg-gray-800 rounded">2</span> ♠ Пиковый</li>
               <li className="flex items-center gap-2"><span className="w-6 text-center bg-gray-800 rounded">3</span> ♥ Червовый</li>
               <li className="flex items-center gap-2"><span className="w-6 text-center bg-gray-800 rounded">4</span> ♦ Бубновый</li>
            </ul>
            
            <p>Козыри бьют любые другие карты.</p>
            <p className="mt-2 text-sm text-gray-400">Внутри одной масти старшинство: Туз &gt; Десятка &gt; Король &gt; Дама &gt; 9 &gt; 8 &gt; 7.</p>
          </Accordion>

          <Accordion title="⚔ Ход игры">
            <ul className="list-disc pl-5 space-y-3">
              <li>Игрокам раздается по 8 карт. Каждый игрок играет за свою назначенную козырную масть.</li>
              <li>При ходе вы <strong>обязаны</strong> бросать карту той же масти, с которой начался ход (или Валета, так как Валет — всегда козырь, а козырь приравнивается к масти козыря).</li>
              <li><strong>Ход с козыря:</strong> Если кто-то пошел с козыря (или с Валета), вы <strong>обязаны</strong> положить козырь или Валета. Если у вас их нет — можно скинуть любую карту.</li>
              <li><strong>Нет нужной масти:</strong> Если у вас нет масти хода, вы <strong>не обязаны</strong> бить козырем. Вы можете сыграть <strong>любой</strong> картой: либо ударить козырем, чтобы забрать взятку, либо скинуть слабую карту чужой масти, чтобы минимизировать потери.</li>
            </ul>
          </Accordion>

          <Accordion title="🏆 Подсчет глаз (Раундов)">
            <p className="mb-3">После каждой раздачи считаются очки во взятках:</p>
            <ul className="list-disc pl-5 space-y-3">
              <li><strong className="text-emerald-400">Победа в раздаче:</strong> от 61 до 119 очков. Команда получает 1 глаз. Если команда взяла 120 очков, она получает 2 глаза (или 3, если это голый).</li>
              <li><strong className="text-yellow-400">Яйца / Спасы (60-60):</strong> Если обе команды набрали ровно по 60 очков, наступает спорная ситуация. В этом раунде никто не получает глаз, но зато <strong>в следующей партии победившая команда заберет очки за обе игры</strong> (то есть получит больше глаз, например +2 глаза вместо одного). Если снова 60-60, очки продолжают накапливаться для будущей победы!</li>
              <li><strong className="text-blue-400">Спас (30 очков):</strong> Команда проиграла со счетом 30-90, но набрала 30 очков — спасла партию, и проиграла лишь 1 или 2 глаза по стандарту. Спасы берегут команду от позорных поражений.</li>
              <li><strong className="text-purple-400">Голая (120 очков):</strong> Если команда забрала ВСЕ 120 очков, ей сразу дается много глаз, так как она раздела соперников всухую.</li>
            </ul>
          </Accordion>

        </div>
        
        <div className="p-5 border-t border-purple-500/30 shrink-0 bg-[#161625] rounded-b-3xl sm:rounded-b-3xl">
          <button
            onClick={onClose}
            className="w-full py-4 bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 rounded-2xl font-extrabold text-white text-lg shadow-[0_0_20px_rgba(168,85,247,0.4)] active:scale-[0.98] transition-all"
          >
            Всё понятно, к игре! 🐿
          </button>
        </div>

      </div>
    </div>
  );
}

/* =========================
   TABS CONTENT
========================= */

function GamesPage({
  rooms,
  setCreateOpen,
  setRulesOpen,
  setBotsOpen,
  setDailyRewardsOpen,
  setEventsOpen,
  setLoading,
  openJoinModal,
  dispatch,
  activeEvent,
}) {
  return (
    <>
      <div className="space-y-3">
        <button
          onClick={() => setDailyRewardsOpen(true)}
          className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 px-5 py-3 text-left shadow-lg shadow-indigo-500/20 transition hover:scale-[1.01] active:scale-[0.985]"
        >
          <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition" />
          <div className="relative flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-extrabold text-white">Ежедневная награда</div>
              <div className="text-sm text-indigo-100">Забирай сундуки и орехи!</div>
            </div>
            <div className="text-3xl drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">🎁</div>
          </div>
        </button>
        {activeEvent && (
          <button
            onClick={() => setEventsOpen(true)}
            className={`group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r ${getEventTheme(activeEvent.event_key).bannerBg} px-5 py-3 text-left shadow-lg ${getEventTheme(activeEvent.event_key).shadowColor} transition hover:scale-[1.01] active:scale-[0.985]`}
          >
            <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition" />
            <div className="relative flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-extrabold text-white">{activeEvent.title}</div>
                <div className="text-sm text-white/80 flex items-center gap-1">
                  Выполняй задания <span className="animate-bounce">{getEventTheme(activeEvent.event_key).emoji}</span>
                </div>
              </div>
              <div className="text-sm font-bold bg-black/20 px-3 py-1.5 rounded-xl text-white backdrop-blur-sm border border-white/20">
                События
              </div>
            </div>
          </button>
        )}
        <button
          onClick={() => {
            const userState = useGameStore.getState().user;
            if ((userState?.nuts ?? 0) < 10) {
              toast.error("Недостаточно орехов для Быстрой игры!");
              return;
            }
            // Предполагается, что findGame() определена где-то выше
            findGame();
            setLoading(true);
          }}
          className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 px-5 py-4 text-left shadow-[0_0_24px_rgba(250,204,21,0.35)] transition hover:scale-[1.01] active:scale-[0.985]"
        >
          <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition" />

          <div className="relative flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-extrabold text-black">Быстрая игра</div>
              <div className="mt-1 text-sm text-black/70">
                Автоподбор комнаты и быстрый вход в матч
              </div>
            </div>

            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-black text-2xl">
              ⚡
            </div>
          </div>
        </button>

        {/* Изменили сетку, чтобы вместить 4 кнопки. На мобилках первые две займут по 50%, а правила и магазин будут под ними (или рядом). */}
        <div className="grid grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto] gap-3">

          {/* Кнопка 1: Создать комнату */}
          <button
            onClick={() => setCreateOpen(true)}
            className="group rounded-2xl border border-purple-500 bg-[#1a1a2e]/95 px-4 py-4 text-left shadow-lg shadow-purple-900/20 transition hover:-translate-y-0.5 hover:bg-[#20203a] active:scale-[0.98]"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold text-white">Создать комнату</div>
                <div className="mt-1 text-xs text-gray-400">
                  Настроить ставку, лигу и правила
                </div>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-green-500 border border-green-400/30 text-lg">
                ➕
              </div>
            </div>
          </button>

          {/* Кнопка 2: Игра с ботами */}
          <button
            onClick={() => setBotsOpen(true)}
            className="group rounded-2xl border border-blue-500 bg-[#1a1a2e]/95 px-4 py-4 text-left shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5 hover:bg-[#20203a] active:scale-[0.98]"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold text-white">Игра с ботами</div>
                <div className="mt-1 text-xs text-gray-400">
                  Тренировка офлайн без ожидания
                </div>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500 border border-blue-400/30 text-lg">
                🤖
              </div>
            </div>
          </button>

          {/* Кнопка 3: Правила */}
          <button
            onClick={() => setRulesOpen(true)}
            className="group flex min-w-[92px] md:col-span-1 flex-col items-center justify-center rounded-2xl border border-purple-500 bg-[#1a1a2e]/95 px-3 py-4 shadow-lg shadow-purple-900/20 transition hover:-translate-y-0.5 hover:bg-[#20203a] active:scale-[0.98]"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/50 border border-purple-400/30 text-lg">
              📜
            </div>
            <div className="mt-2 text-xs font-extrabold text-white">Правила</div>
          </button>

          {/* Кнопка 4: Магазин */}
          <button
            onClick={() => dispatch({ type: "GO_NUTS" })}
            className="group relative flex min-w-[92px] md:col-span-1 flex-col rounded-2xl border border-orange-500 bg-[#1a1a2e]/95 p-0 overflow-hidden shadow-lg shadow-orange-900/20 transition hover:-translate-y-0.5 hover:shadow-orange-800/40 active:scale-[0.98] min-h-[96px]"
          >
            <img src="/shop_preview.png" alt="Магазин" className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
          </button>
        </div>
      </div>

      {rooms.length === 0 ? (
        <GlassCard className="flex flex-col items-center justify-center py-16 text-center mt-5 text-gray-400 px-6">
          <div className="text-6xl mb-6 animate-pulse">🃏</div>
          <h3 className="text-xl font-semibold text-gray-200">
            Пока нет активных комнат
          </h3>
          <p className="text-gray-400 mt-4 max-w-md">
            Сейчас никто не создал комнату. Создай свою или подожди игроков.
          </p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 mt-5 sm:grid-cols-2 gap-4">
          {rooms.map((r) => (
            <RoomCard 
              key={r.id} 
              {...r} 
              isFull={r.playersConnected >= r.maxPlayers}
              onJoin={() => openJoinModal(r)} 
            />
          ))}
        </div>
      )}
    </>
  );
}

function FriendsPage() {
  const user = useGameStore((s) => s.user);
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profileModalOpts, setProfileModalOpts] = useState(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const delayDebounceFn = setTimeout(() => {
      setIsSearching(true);
      const token = localStorage.getItem("access_token");
      axios.get(getUrl(`/v1/users/search?q=${encodeURIComponent(searchQuery)}`), {
        headers: { Authorization: `Bearer ${token}` }
      }).then(res => {
        setSearchResults(res.data);
      }).catch(err => console.error("Search error", err))
        .finally(() => setIsSearching(false));
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const handleSendRequest = async (targetId) => {
    try {
      const token = localStorage.getItem("access_token");
      await axios.post(getUrl("/v1/friends/requests"), { target_id: targetId }, { headers: { Authorization: `Bearer ${token}` } });
      setSearchResults(prev => prev.map(u => u.id === targetId ? { ...u, request_sent: true } : u));
    } catch (err) {
      console.error(err);
    }
  };

  const handleSpectate = (roomId) => {
    if (!roomId) return;
    spectateRoomApi(roomId);
    useGameStore.getState().setIsSpectating(true);
  };

  const handleJoinLobby = (roomId) => {
    if (!roomId) return;
    sendjoinRoom(roomId);
  };

  const fetchFriendsData = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const [fRes, rRes] = await Promise.all([
        axios.get(getUrl("/v1/friends"), { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(getUrl("/v1/friends/requests"), { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setFriends(fRes.data);
      setRequests(rRes.data);
    } catch (err) {
      console.error("Failed to load friends", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFriendsData();
    const interval = setInterval(() => {
      fetchFriendsData();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleInviteShare = () => {
    const tg = window.Telegram?.WebApp;
    const me = user?.id || "";
    
    const botName = process.env.REACT_APP_BOT_NAME || "squirrel_game_bot";
    const shareLink = `https://t.me/${botName}?startapp=ref${me}`;
    
    const shareText = `В карточной игре «Белка» сейчас жарко! 🐿🔥\n\nПрисоединяйся ко мне, побеждай в матчах и забирай уникальные колоды! 🏆\nБрось мне вызов прямо сейчас! 👇`;
    
    const tgShareUrl = `https://t.me/share/url?url=${encodeURIComponent(shareLink)}&text=${encodeURIComponent(shareText)}`;
    
    try {
      if (tg?.openTelegramLink) {
        tg.openTelegramLink(tgShareUrl);
      } else if (tg?.openLink) {
        tg.openLink(tgShareUrl);
      } else {
        window.location.href = tgShareUrl;
      }
    } catch (e) {
      window.location.href = tgShareUrl;
    }
  };

  const handleAcceptRequest = async (id) => {
    try {
      const token = localStorage.getItem("access_token");
      await axios.post(getUrl(`/v1/friends/requests/${id}/accept`), {}, { headers: { Authorization: `Bearer ${token}` } });
      await fetchFriendsData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeclineRequest = async (id) => {
    try {
      const token = localStorage.getItem("access_token");
      await axios.post(getUrl(`/v1/friends/requests/${id}/decline`), {}, { headers: { Authorization: `Bearer ${token}` } });
      await fetchFriendsData();
    } catch (err) {
      console.error(err);
    }
  };

  const onlineFriends = friends.filter((f) => f.online);
  const offlineFriends = friends.filter((f) => !f.online);

  return (
    <div className="space-y-4 relative" onClick={() => setShowSearch(false)}>
      {/* SEARCH BAR */}
      <div className="relative z-50" onClick={(e) => e.stopPropagation()}>
        <input
          type="text"
          className="w-full bg-[#1a1a2e] border-2 border-purple-500/50 rounded-2xl px-4 py-3 placeholder-purple-300/50 text-sm focus:outline-none focus:border-pink-500 transition-all font-bold text-white shadow-lg shadow-purple-900/20"
          placeholder="Поиск по никнейму..."
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setShowSearch(true); }}
          onFocus={() => setShowSearch(true)}
        />
        {searchQuery && (
            <button onClick={() => {setSearchQuery(""); setShowSearch(false);}} className="absolute right-4 top-1/2 -translate-y-1/2 text-purple-400 opacity-50 hover:opacity-100 font-bold">✕</button>
        )}

        {showSearch && searchQuery.trim().length >= 2 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-[#171728] border border-purple-500/40 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-50 overflow-hidden max-h-[300px] overflow-y-auto">
              {isSearching ? (
                <div className="p-4 text-center text-xs text-purple-400 animate-pulse font-bold">Ищем белок... 🐿</div>
              ) : searchResults.length === 0 ? (
                <div className="p-4 text-center text-xs text-gray-400 font-bold">Ничего не найдено</div>
              ) : (
                <div className="divide-y divide-white/5">
                  {searchResults.map(u => (
                    <div key={u.id} className="p-3 flex items-center justify-between hover:bg-white/5 transition px-4">
                      <div className="flex items-center gap-3">
                        <img src={u.photo_url || `https://api.dicebear.com/7.x/thumbs/svg?seed=${u.username || u.id}`} className="w-10 h-10 rounded-full border border-purple-500/30 object-cover" />
                        <div>
                          <div className="font-bold text-sm text-white">{u.username}</div>
                          <div className="text-[10px] text-gray-400 font-semibold uppercase">Рейтинг: <span className="text-purple-300">{parseInt(u.rating)}</span></div>
                        </div>
                      </div>
                      {u.is_friend ? (
                        <span className="text-[10px] text-green-400 bg-green-500/10 px-3 py-1.5 rounded-full font-black border border-green-500/20">В ДРУЗЬЯХ</span>
                      ) : u.request_sent ? (
                        <span className="text-[10px] text-gray-400 bg-white/5 px-3 py-1.5 rounded-full font-bold">ОТПРАВЛЕН</span>
                      ) : (
                        <button onClick={() => handleSendRequest(u.id)} className="bg-purple-600 hover:bg-purple-500 text-[10px] text-white px-4 py-1.5 rounded-full font-black uppercase tracking-wider active:scale-95 transition-all shadow-md shadow-purple-500/30 border border-purple-400">Добавить</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
        )}
      </div>

      {/* HERO HEADER */}
      <div className="rounded-2xl border border-purple-500 bg-[#1a1a2e]/95 px-4 py-4 shadow-lg shadow-purple-900/30">
        <div className="flex items-start justify-between gap-3">
          <div className="ml-3 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-lg">👥</span>
              <h2 className="text-xl font-extrabold text-pink-400">Друзья</h2>
            </div>
            <p className="text-sm text-gray-400 mt-2 leading-snug">
              Смотри кто онлайн и приглашай в игру
            </p>
          </div>
          <button 
            onClick={handleInviteShare}
            className="shrink-0 h-12 px-4 mt-6 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-500 text-white text-sm font-bold shadow-[0_0_18px_#a855f7] active:scale-[0.98] transition">
            Пригласить
          </button>
        </div>

        <div className="mt-4 ml-3 flex items-center gap-2 flex-wrap">
          <div className="px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-bold">
            Онлайн: {onlineFriends.length}
          </div>
          {requests.length > 0 && (
            <div className="px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-bold">
              Запросы: {requests.length}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-10 text-center">
          <div className="text-white font-bold animate-pulse">Загрузка...</div>
        </div>
      ) : (
        <>
          {requests.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-blue-400">Входящие заявки</h3>
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="rounded-2xl border border-blue-500 bg-[#1a1a2e]/95 p-4 shadow-lg shadow-blue-900/30"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <img
                          src={req.photoUrl || `https://api.dicebear.com/7.x/thumbs/svg?seed=${req.username}`}
                          alt={req.username}
                          className="w-12 h-12 rounded-full border-2 border-blue-500 object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-white font-extrabold truncate">
                          @{req.username}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">Рейтинг: {req.rating}</div>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button 
                        onClick={() => handleAcceptRequest(req.id)}
                        className="px-3 py-2 rounded-xl bg-green-500 text-white text-sm font-bold shadow-[0_0_12px_#22c55e]">
                        ✓
                      </button>
                      <button 
                        onClick={() => handleDeclineRequest(req.id)}
                        className="px-3 py-2 rounded-xl bg-red-500 text-white text-sm font-bold">
                        ✗
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-3">
            {onlineFriends.map((friend) => (
              <div
                key={friend.id}
                className="rounded-2xl border border-purple-500 bg-[#1a1a2e]/95 p-4 shadow-lg shadow-purple-900/30"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <img
                        src={friend.avatar}
                        alt={friend.name}
                        className="w-14 h-14 rounded-full border-2 border-purple-500 object-cover"
                      />
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-green-400 border-2 border-[#1a1a2e]" />
                    </div>

                    <div className="min-w-0">
                      <div className="text-white font-extrabold truncate">
                        @{friend.name}
                      </div>

                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <LeagueBadge league={friend.league} />
                        <span className={`text-xs font-bold ${
  friend.status === "В лобби" ? "text-pink-400" :
  friend.status === "В сети" ? "text-green-400" :
  friend.status.includes("Играет") ? "text-blue-400" : "text-gray-500"
}`}>{friend.status}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 shrink-0">
                    <button onClick={() => setProfileModalOpts({ friend })} className="px-3 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold">
                      Профиль
                    </button>
                    {friend.status === "Играет матч" || friend.status === "Наблюдает" ? (
                      <button onClick={() => handleSpectate(friend.room_id)} className="px-3 py-2 rounded-xl bg-green-600 text-white text-sm font-bold shadow-[0_0_12px_#16a34a]">
                        Наблюдать
                      </button>
                    ) : friend.status === "В лобби" ? (
                      <button onClick={() => handleJoinLobby(friend.room_id)} className="px-3 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-bold shadow-[0_0_12px_#a855f7] active:scale-95 transition-transform">
                        🚀 В комнату
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* OFFLINE */}
          {offlineFriends.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-400">
                  Недавно были
                </h3>
              </div>

              {offlineFriends.map((friend) => (
                <div
                  key={friend.id}
                  className="rounded-2xl border border-purple-500/70 bg-[#161625]/95 p-4 shadow-lg shadow-purple-900/20 opacity-90"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <img
                          src={friend.avatar}
                          alt={friend.name}
                          className="w-14 h-14 rounded-full border-2 border-gray-600 object-cover"
                        />
                        <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-gray-500 border-2 border-[#161625]" />
                      </div>

                      <div className="min-w-0">
                        <div className="text-white font-extrabold truncate">
                          @{friend.name}
                        </div>

                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <LeagueBadge league={friend.league} />
                          <span className={`text-xs font-bold ${
  friend.status === "В лобби" ? "text-pink-400" :
  friend.status === "В сети" ? "text-green-400" :
  friend.status.includes("Играет") ? "text-blue-400" : "text-gray-500"
}`}>{friend.status}</span>
                        </div>
                      </div>
                    </div>

                    <button onClick={() => setProfileModalOpts({ friend })} className="px-3 py-2 rounded-xl bg-gray-700 text-gray-200 text-sm font-bold">
                      Профиль
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {profileModalOpts && (
        <UserProfileModal 
          targetId={profileModalOpts.friend.id} 
          targetName={profileModalOpts.friend.name} 
          targetAvatar={profileModalOpts.friend.avatar} 
          onClose={() => setProfileModalOpts(null)} 
        />
      )}
    </div>
  );
}

function RatingPage() {
  const [leagueFilter, setLeagueFilter] = useState("All");
  const [leaderboardData, setLeaderboardData] = useState({ top_players: [], my_player: null, around_me: [] });
  const [loading, setLoading] = useState(false);

  const filters = ["All", "Bronze", "Silver", "Gold", "Diamond"];

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      try {
        const url = leagueFilter === "All" ? "/v1/rating" : `/v1/rating?league=${leagueFilter}`;
        const token = localStorage.getItem("access_token");
        const res = await axios.get(getUrl(url), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (isMounted) setLeaderboardData(res.data);
      } catch (e) {
        if (isMounted) console.error("Failed to load leaderboard", e);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => { isMounted = false; };
  }, [leagueFilter]);

  const { top_players = [], my_player = null, around_me = [] } = leaderboardData;

  const allPlayersMap = new Map();
  top_players.forEach(p => allPlayersMap.set(p.telegram_id, p));
  around_me.forEach(p => allPlayersMap.set(p.telegram_id, p));
  if (my_player) allPlayersMap.set(my_player.telegram_id, my_player);

  const allPlayers = Array.from(allPlayersMap.values()).sort((a, b) => a.rank - b.rank);

  const renderPlayer = (player) => {
    const isMe = player.is_me;
    const avatarUrl = player.photo_url || `https://api.dicebear.com/7.x/thumbs/svg?seed=${player.username || "anon"}`;

    return (
      <div
        key={player.telegram_id}
        className={`flex items-center justify-between gap-3 py-3 ${isMe ? "bg-purple-500/10 rounded-xl px-2" : ""
          }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 text-xs font-extrabold text-gray-400 shrink-0">
            #{player.rank}
          </div>

          <img
            src={avatarUrl}
            alt={player.username}
            className="w-11 h-11 rounded-full border border-purple-500 object-cover shrink-0"
          />

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-white font-bold truncate">
                @{player.username || "anon"}
              </div>
              {isMe && (
                <span className="px-2 py-0.5 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/30 text-[10px] font-bold text-fuchsia-300">
                  Ты
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <LeagueBadge league={player.league} />
            </div>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="text-yellow-300 font-extrabold">
            {player.rating}
          </div>
          <div className="text-[11px] text-gray-500">pts</div>
        </div>
      </div>
    );
  };

  const renderList = [];
  let lastRank = 0;
  allPlayers.forEach(p => {
    if (lastRank !== 0 && p.rank > lastRank + 1) {
      renderList.push(
        <div key={`divider-${p.rank}`} className="flex justify-center py-2">
          <span className="text-gray-500 font-bold tracking-[0.3em]">...</span>
        </div>
      );
    }
    renderList.push(renderPlayer(p));
    lastRank = p.rank;
  });

  return (
    <div className="space-y-4">
      {/* HERO */}
      <div className="rounded-2xl border border-purple-500 bg-[#1a1a2e]/95 px-4 py-4 shadow-lg shadow-purple-900/30">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 mt-3 ml-3 items-center justify-center rounded-xl bg-yellow-500/10 border border-yellow-400/30 text-lg shrink-0">
                🏆
              </div>

              <div className=" mt-3 ml-3 min-w-0">
                <h2 className="text-xl font-extrabold text-pink-400 leading-none">
                  Рейтинг
                </h2>
                <p className="text-sm text-gray-400 mt-1">
                  Следи за лидерами и своим местом в сезоне
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <div className="px-3 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-xs font-bold">
            {loading ? "Загрузка..." : `Участников: ${top_players.length >= 50 ? "50+" : top_players.length}`}
          </div>

          <div className="px-3 py-1.5 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/30 text-cyan-300 text-xs font-bold">
            Сезон активен
          </div>
        </div>
      </div>

      {/* FILTERS */}
      <div className="rounded-2xl border border-purple-500 bg-[#1a1a2e]/95 p-3 shadow-lg shadow-purple-900/30">
        <div className="text-xs mt-2 ml-5 font-bold text-gray-400 uppercase tracking-wide mb-3">
          Фильтр по лиге
        </div>

        <div className="flex ml-4 gap-2 flex-wrap">
          {filters.map((filter) => {
            const isActive = leagueFilter === filter;

            return (
              <button
                key={filter}
                onClick={() => setLeagueFilter(filter)}
                className={`px-3 py-2 rounded-xl text-sm font-bold transition ${isActive
                    ? "bg-gradient-to-r from-purple-600 to-fuchsia-500 text-white shadow-[0_0_14px_#a855f7]"
                    : "bg-black/20 border border-purple-500/40 text-gray-300"
                  }`}
              >
                {filter === "All" ? "Все" : filter}
              </button>
            );
          })}
        </div>
      </div>


      {/* ALL PLAYERS */}
      <GlassCard className="p-4">
        <div className="flex items-center justify-between pb-3 border-b border-purple-500/30">
          <div className="text-sm font-bold text-white">Таблица игроков</div>
          <div className="text-xs text-gray-400">
            {leagueFilter === "All" ? "Все лиги" : leagueFilter}
          </div>
        </div>

        <div className="mt-2 divide-y divide-purple-500/20">
          {loading ? (
            <div className="py-10 text-center">
              <div className="text-white font-bold animate-pulse">Загрузка рейтинга...</div>
            </div>
          ) : (
            <>
              {renderList}
              {allPlayers.length === 0 && (
                <div className="py-10 text-center">
                  <div className="text-4xl mb-3">🏆</div>
                  <div className="text-white font-bold">Нет игроков в этой лиге</div>
                  <div className="text-sm text-gray-400 mt-1">
                    Попробуй выбрать другой фильтр
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </GlassCard>
    </div>
  );
}

function ProfilePage() {
  const user = useGameStore((s) => s.user);

  const [profileTab, setProfileTab] = useState("stats");
  const [historyFilter, setHistoryFilter] = useState("all");
  const [inventoryDecks, setInventoryDecks] = useState([]);
  const [chestToOpen, setChestToOpen] = useState(null);
  const [inventoryBackgrounds, setInventoryBackgrounds] = useState([]);
  const [inventoryBoosters, setInventoryBoosters] = useState([]);
  const [inventoryChests, setInventoryChests] = useState({ common: 0, rare: 0, epic: 0, legendary: 0 });
  
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [selectedMatchReplay, setSelectedMatchReplay] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const token = localStorage.getItem("access_token");
        const res = await axios.get(getUrl("/v1/profile"), {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (isMounted) setProfileData(res.data);
        
        try {
          const storeRes = await fetchStore();
          if (isMounted && storeRes) {
            setInventoryDecks((storeRes.decks || []).filter(d => d.owned));
            setInventoryBackgrounds((storeRes.backgrounds || []).filter(d => d.owned));
            setInventoryBoosters((storeRes.boosters || []).filter(d => d.owned));
          }
        } catch (storeErr) {
          console.error("Failed to load inventory from store api", storeErr);
        }

        try {
          const chestsRes = await axios.get(getUrl("/v1/chests"), {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (isMounted) setInventoryChests(chestsRes.data);
        } catch (chestErr) {
          console.error("Failed to load chests", chestErr);
        }
      } catch (e) {
        console.error("Failed to load profile", e);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => { isMounted = false; };
  }, []);

  const refreshChests = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const chestsRes = await axios.get(getUrl("/v1/chests"), {
        headers: { Authorization: `Bearer ${token}` }
      });
      setInventoryChests(chestsRes.data);
      // Also refetch store items silently in case a deck/bg was dropped
      const storeRes = await fetchStore();
      if (storeRes) {
        setInventoryDecks((storeRes.decks || []).filter(d => d.owned));
        setInventoryBackgrounds((storeRes.backgrounds || []).filter(d => d.owned));
            setInventoryBoosters((storeRes.boosters || []).filter(d => d.owned));
      }
    } catch (e) {}
  };

  const handleUseBooster = async (item_key) => {
    try {
      const token = localStorage.getItem("access_token");
      await axios.post(getUrl("/v1/inventory/use"), { item_key }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Бустер успешно активирован!");
      const storeRes = await fetchStore();
      if (storeRes) {
         setInventoryBoosters((storeRes.boosters || []).filter(d => d.owned));
      }
    } catch (e) {
      toast.error(e.response?.data || "Не удалось использовать предмет");
    }
  };

  const stats = profileData?.stats || {
    matches: 0,
    wins: 0,
    winrate: "0%",
    bestStreak: 0,
    rankPlace: 0,
    favoriteMode: "N/A",
    seasonProgress: 0,
  };

  const rewards = profileData?.rewards || [];
  const history = profileData?.history || [];

  const nuts = user?.nuts ?? 1295;
  const rating = user?.rating ?? 100;

  const rewardStyles = {
    Common: {
      chip: "bg-slate-500/10 text-slate-300 border-slate-400/20",
      glow: "from-slate-500/15 to-slate-700/5 border-slate-400/20",
    },
    Rare: {
      chip: "bg-cyan-500/10 text-cyan-300 border-cyan-400/20",
      glow: "from-cyan-500/15 to-blue-700/10 border-cyan-400/20",
    },
    Epic: {
      chip: "bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-400/20",
      glow: "from-fuchsia-500/15 to-purple-700/10 border-fuchsia-400/20",
    },
    Legendary: {
      chip: "bg-yellow-500/10 text-yellow-300 border-yellow-400/20",
      glow: "from-yellow-500/15 to-amber-700/10 border-yellow-400/20",
    },
  };

  const tabs = [
    { key: "stats", label: "Статистика", icon: "📊" },
    { key: "history", label: "История", icon: "🕘" },
    { key: "rewards", label: "Награды", icon: "🏅" },
    { key: "inventory", label: "Инвентарь", icon: "🎒" },
  ];

  const historyFilters = [
    { key: "all", label: "Все" },
    { key: "ranked", label: "Ranked" },
    { key: "bot", label: "Bot" },
  ];

  const filteredHistory = history.filter((match) => {
    if (historyFilter === "all") return true;
    if (historyFilter === "ranked") return match.mode.toLowerCase().includes("ranked");
    if (historyFilter === "bot") return match.mode.toLowerCase().includes("bot");
    return true;
  });

  const handleEquipDeck = async (deckKey) => {
    try {
      await equipStoreItem({ item_type: "deck", item_id: deckKey });
      setInventoryDecks((prev) =>
        prev.map((deck) => ({
          ...deck,
          equipped: deck.item_key === deckKey,
        }))
      );
      if (user) {
        useGameStore.getState().setUser({ ...user, equipped_deck: deckKey });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEquipBackground = async (bgKey) => {
    try {
      await equipStoreItem({ item_type: "background", item_id: bgKey });
      setInventoryBackgrounds((prev) =>
        prev.map((bg) => ({
          ...bg,
          equipped: bg.item_key === bgKey,
        }))
      );
      if (user) {
        useGameStore.getState().setUser({ ...user, equipped_background: bgKey });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const rarityStylesStore = {
    common: "bg-slate-500/10 text-slate-300 border-slate-400/20",
    rare: "bg-cyan-500/10 text-cyan-300 border-cyan-400/20",
    epic: "bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-400/20",
    legendary: "bg-yellow-500/10 text-yellow-300 border-yellow-400/20",
    mythic: "bg-violet-500/10 text-violet-300 border-violet-400/20",
  };

  return (
    <div className="space-y-4">
      {/* HERO */}
      <div className="relative overflow-hidden rounded-3xl border border-purple-500 bg-[#171728]/95 p-4 shadow-lg shadow-purple-900/30">
        <div className="absolute -top-10 -right-10 h-28 w-28 rounded-full bg-fuchsia-500/10 blur-3xl" />
        <div className="absolute -bottom-10 -left-10 h-28 w-28 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="relative flex items-start justify-between gap-3">
          <div className="flex items-center gap-4 min-w-0">
            <img
              src={user?.photo_url || "https://api.dicebear.com/7.x/thumbs/svg?seed=squirrel_profile"}
              alt="avatar"
              className="w-20 h-20 rounded-full border-2 border-purple-500 shadow-[0_0_15px_#a855f7] object-cover"
            />

            <div className="min-w-0">
              <div className="text-xl font-extrabold text-pink-400 truncate">
                @{user?.username || "senior8me"}
              </div>

              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <LeagueBadge league={getLeagueByRating(rating)} />
                <span className="rounded-full border border-yellow-400/20 bg-yellow-500/10 px-2.5 py-1 text-xs font-bold text-yellow-300">
                  ⭐ {rating}
                </span>
                <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-300">
                  🥜 {nuts}
                </span>
              </div>

              <p className="mt-3 text-sm text-gray-400">
                Активный игрок рейтинговых матчей
              </p>
            </div>
          </div>

        </div>

      {(() => {
        const { level, currentLevelXp, nextLevelXp, progress } = getLevelFromXP(user?.xp || 0);
        return (
          <div className="relative mt-4 rounded-2xl border border-purple-500/20 bg-black/20 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-400">
                  Уровень игрока <span className="font-bold text-white ml-2">Lv. {level}</span>
                </div>
                <div className="mt-1 text-sm font-bold text-white">
                  Опыт: <span className="text-fuchsia-300">{currentLevelXp} / {nextLevelXp} XP</span>
                </div>
              </div>

              <div className="text-sm font-extrabold text-fuchsia-300">
                {Math.round(progress)}%
              </div>
            </div>

            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-purple-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        );
      })()}
      </div>

      {/* INNER TABS */}
      <div className="rounded-2xl border border-purple-500 bg-[#171728]/95 p-2 shadow-lg shadow-purple-900/20">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {tabs.map((tab) => {
            const isActive = profileTab === tab.key;

            return (
              <button
                key={tab.key}
                onClick={() => setProfileTab(tab.key)}
                className={`rounded-xl px-3 py-3 text-sm font-bold transition ${isActive
                    ? "bg-gradient-to-r from-purple-600 to-fuchsia-500 text-white shadow-[0_0_14px_#a855f7]"
                    : "border border-purple-500/30 bg-black/20 text-gray-300"
                  }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="text-base">{tab.icon}</span>
                  <span>{tab.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* STATS TAB */}
      {profileTab === "stats" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <GlassCard className="p-4">
              <div className="text-xs text-gray-400">Матчи</div>
              <div className="mt-2 text-2xl font-extrabold text-white">
                {stats.matches}
              </div>
            </GlassCard>

            <GlassCard className="p-4">
              <div className="text-xs text-gray-400">Победы</div>
              <div className="mt-2 text-2xl font-extrabold text-green-400">
                {stats.wins}
              </div>
            </GlassCard>

            <GlassCard className="p-4">
              <div className="text-xs text-gray-400">Winrate</div>
              <div className="mt-2 text-2xl font-extrabold text-cyan-400">
                {stats.winrate}
              </div>
            </GlassCard>

            <GlassCard className="p-4">
              <div className="text-xs text-gray-400">Серия побед</div>
              <div className="mt-2 text-2xl font-extrabold text-orange-400">
                {stats.bestStreak}
              </div>
            </GlassCard>
          </div>

          <GlassCard className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Место в рейтинге</span>
              <span className="text-white font-bold">#{stats.rankPlace}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-400">Любимый режим</span>
              <span className="text-white font-bold">{stats.favoriteMode}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-400">Лига сезона</span>
              <span className="text-yellow-300 font-bold">{getLeagueByRating(rating)}</span>
            </div>
          </GlassCard>
        </div>
      )}

      {/* HISTORY TAB */}
      {profileTab === "history" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-gray-300">История игр</h3>
            <button className="rounded-xl border border-purple-500/30 bg-black/20 px-3 py-2 text-xs font-bold text-white transition hover:bg-black/30 active:scale-[0.98]">
              Смотреть всё
            </button>
          </div>

          <div className="rounded-2xl border border-purple-500 bg-[#171728]/95 p-2 shadow-lg shadow-purple-900/20">
            <div className="grid grid-cols-3 gap-2">
              {historyFilters.map((filter) => {
                const isActive = historyFilter === filter.key;

                return (
                  <button
                    key={filter.key}
                    onClick={() => setHistoryFilter(filter.key)}
                    className={`rounded-xl px-3 py-3 text-sm font-bold transition ${isActive
                        ? "bg-gradient-to-r from-purple-600 to-fuchsia-500 text-white shadow-[0_0_14px_#a855f7]"
                        : "border border-purple-500/30 bg-black/20 text-gray-300"
                      }`}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>
          </div>

          <GlassCard className="p-3">
            <div className="space-y-3">
              {filteredHistory.slice(0, 5).map((match) => {
                const isWin = match.result === "win";
                const isLose = match.result === "lose";
                const isAbandoned = match.result === "abandoned";

                return (
                  <div
                    key={match.id}
                    onClick={() => setSelectedMatch(match)}
                    className="rounded-2xl border border-purple-500/20 bg-black/20 p-3 cursor-pointer hover:bg-black/40 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${isWin
                                ? "bg-green-500/10 text-green-400 border border-green-500/20"
                                : isLose
                                  ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                  : "bg-orange-500/10 text-orange-300 border border-orange-500/20"
                              }`}
                          >
                            {isWin ? "Победа" : isLose ? "Поражение" : "Покинуто"}
                          </span>

                          <span className="text-sm font-bold text-white">
                            {match.mode}
                          </span>
                        </div>

                        <div className="mt-2 text-xs text-gray-400">
                          Счёт: {match.score} · {match.time}
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <div
                          className={`text-sm font-extrabold ${isWin
                              ? "text-green-400"
                              : isLose
                                ? "text-red-400"
                                : "text-orange-300"
                            }`}
                        >
                          {match.ratingDelta}
                        </div>
                        <div className="text-[11px] text-gray-500">rating</div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredHistory.length === 0 && (
                <div className="py-10 text-center">
                  <div className="text-4xl mb-3">🕘</div>
                  <div className="text-white font-bold">Нет матчей</div>
                  <div className="text-sm text-gray-400 mt-1">
                    Для этого фильтра история пока пустая
                  </div>
                </div>
              )}
            </div>
          </GlassCard>
        </div>
      )}

      {/* REWARDS TAB */}
      {profileTab === "rewards" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-gray-300">Награды</h3>
            <button className="rounded-xl border border-purple-500/30 bg-black/20 px-3 py-2 text-xs font-bold text-white transition hover:bg-black/30 active:scale-[0.98]">
              Смотреть всё
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {rewards.map((reward) => {
              const style = rewardStyles[reward.rarity] || rewardStyles.Common;

              return (
                <div
                  key={reward.id}
                  className={`relative overflow-hidden rounded-3xl border bg-gradient-to-br p-4 shadow-lg shadow-purple-900/20 ${style.glow}`}
                >
                  <div className="absolute -top-6 -right-6 h-16 w-16 rounded-full bg-white/5 blur-2xl" />

                  <div className="relative flex items-center gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-black/25 text-2xl shadow-inner">
                      {reward.icon}
                    </div>

                    <div className="min-w-0">
                      <div className="text-sm font-extrabold text-white leading-tight">
                        {reward.title}
                      </div>

                      <div
                        className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${style.chip}`}
                      >
                        {reward.rarity}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* INVENTORY TAB */}
      {profileTab === "inventory" && (
        <div className="space-y-4">
          {/* CHESTS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-gray-300">Сундуки</h3>
              <span className="text-xs text-gray-400">В наличии ({
                Object.values(inventoryChests).reduce((a, b) => a + b, 0)
              })</span>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {['common', 'rare', 'epic', 'legendary'].map((chestType) => {
                const count = inventoryChests[chestType] || 0;
                if (count === 0) return null;
                const chestNames = {
                  common: "Обычный",
                  rare: "Редкий",
                  epic: "Эпический",
                  legendary: "Легендарный"
                };
                return (
                  <div
                    key={chestType}
                    onClick={() => setChestToOpen(chestType)}
                    className="rounded-3xl border border-purple-500 bg-[#171728]/95 p-3 shadow-lg shadow-purple-900/20 cursor-pointer hover:bg-white/5 transition"
                  >
                    <div className="relative flex h-28 items-center justify-center overflow-hidden rounded-2xl border border-purple-500/20 bg-black/20 text-4xl">
                      <img src={`/chests/${chestType}.png`} alt={chestType} className="max-h-full max-w-full drop-shadow-lg object-contain" />
                      <div className="absolute top-2 right-2 bg-purple-600 font-bold text-white text-xs px-2 py-0.5 rounded-full z-10">
                        x{count}
                      </div>
                    </div>
                    <h4 className="mt-2 text-center text-sm font-bold text-white uppercase tracking-wider">{chestNames[chestType]}</h4>
                    <p className="text-center text-xs text-green-400 pt-1 font-bold">Нажмите, чтобы открыть</p>
                  </div>
                );
              })}
              {Object.values(inventoryChests).reduce((a, b) => a + b, 0) === 0 && (
                <div className="col-span-2 py-4 text-center text-sm text-gray-400">
                  У вас пока нет сундуков
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-gray-300">Колоды</h3>
              <span className="text-xs text-gray-400">Ваши ({inventoryDecks.length})</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {inventoryDecks.map((deck) => {
                return (
                  <div
                    key={deck.item_key}
                    className="rounded-3xl border border-purple-500 bg-[#171728]/95 p-3 shadow-lg shadow-purple-900/20"
                  >
                    <div className="relative flex h-28 items-center justify-center overflow-hidden rounded-2xl border border-purple-500/20 bg-black/20 text-4xl">
                      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent" />
                      <DeckPreview theme={deck.item_key} />
                    </div>

                    <div className="mt-3 text-sm font-extrabold text-white">
                      {deck.title}
                    </div>

                    <div className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold ${rarityStylesStore[deck.rarity] || rarityStylesStore.common}`}>
                      {deck.rarity}
                    </div>

                    {deck.equipped ? (
                      <div className="mt-4 w-full rounded-2xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-center text-sm font-extrabold text-green-400">
                        Используется
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEquipDeck(deck.item_key)}
                        className="mt-4 w-full rounded-2xl border border-purple-500/30 bg-black/20 px-4 py-3 text-center text-sm font-extrabold text-white transition hover:bg-black/30 active:scale-[0.98]"
                      >
                        Выбрать
                      </button>
                    )}
                  </div>
                );
              })}
              {inventoryDecks.length === 0 && (
                <div className="col-span-2 py-4 text-center text-sm text-gray-400">
                  У вас пока нет колод
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-gray-300">Фоны</h3>
              <span className="text-xs text-gray-400">Ваши ({inventoryBackgrounds.length})</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {inventoryBackgrounds.map((bg) => {
                return (
                  <div
                    key={bg.item_key}
                    className="rounded-3xl border border-purple-500 bg-[#171728]/95 p-3 shadow-lg shadow-purple-900/20"
                  >
                    <div className="h-28 rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/20 via-fuchsia-500/10 to-blue-500/10 p-2">
                      <div className="flex h-full items-center justify-center rounded-xl bg-black/10 text-4xl">
                        <BackgroundPreview theme={bg.item_key} />
                      </div>
                    </div>

                    <div className="mt-3 text-sm font-extrabold text-white">
                      {bg.title}
                    </div>

                    <div className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold ${rarityStylesStore[bg.rarity] || rarityStylesStore.common}`}>
                      {bg.rarity}
                    </div>

                    {bg.equipped ? (
                      <div className="mt-4 w-full rounded-2xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-center text-sm font-extrabold text-green-400">
                        Используется
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEquipBackground(bg.item_key)}
                        className="mt-4 w-full rounded-2xl border border-purple-500/30 bg-black/20 px-4 py-3 text-center text-sm font-extrabold text-white transition hover:bg-black/30 active:scale-[0.98]"
                      >
                        Выбрать
                      </button>
                    )}
                  </div>
                );
              })}
              {inventoryBackgrounds.length === 0 && (
                <div className="col-span-2 py-4 text-center text-sm text-gray-400">
                  У вас пока нет фонов
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3 mt-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-gray-300">Бустеры</h3>
              <span className="text-xs text-gray-400">Доступно ({inventoryBoosters.length})</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {inventoryBoosters.map((booster) => (
                  <div key={booster.item_key} className="relative rounded-3xl border border-pink-500/50 bg-[#171728]/95 p-3 shadow-lg shadow-pink-900/20 overflow-hidden group">
                    <div className="relative flex h-28 items-center justify-center rounded-2xl bg-black/40 text-5xl">
                       {booster.item_key.includes("xp") ? "⭐" : "🥜"}
                    </div>
                    <div className="mt-3 text-sm font-extrabold text-white text-center leading-tight">{booster.title}</div>
                    {booster.amount > 1 && <div className="absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-white/20">x{booster.amount}</div>}
                    <button onClick={() => handleUseBooster(booster.item_key)} className="mt-3 w-full rounded-2xl bg-gradient-to-r from-pink-500 to-rose-400 px-4 py-2 text-center text-xs font-bold text-white shadow-lg shadow-pink-500/30 transition hover:scale-105 active:scale-95">Использовать</button>
                  </div>
              ))}
              {inventoryBoosters.length === 0 && (
                <div className="col-span-2 py-4 text-center text-sm text-gray-500 bg-black/20 rounded-2xl border border-white/5">
                  Нет доступных бустеров
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedMatch && !selectedMatchReplay && (
        <MatchSummaryModal 
          match={selectedMatch} 
          currentUserId={user?.id || user?.telegram_id || profileData?.id}
          onClose={() => setSelectedMatch(null)}
          onWatchReplay={(replayData) => setSelectedMatchReplay(replayData)}
        />
      )}

      {selectedMatchReplay && (
        <ReplayViewer 
          replayData={selectedMatchReplay} 
          onClose={() => {
            setSelectedMatchReplay(null);
            setSelectedMatch(null);
          }} 
        />
      )}

      <ChestOpeningModal 
         isOpen={!!chestToOpen} 
         chestType={chestToOpen} 
         onClose={() => setChestToOpen(null)} 
         onSuccess={() => {
            refreshChests();
         }}
      />
    </div>
  );
}

function ScreenRenderer(props) {
  const { activeTab } = props;

  switch (activeTab) {
    case TABS.GAMES:
      return <GamesPage {...props} />;
    case TABS.FRIENDS:
      return <FriendsPage />;
    case TABS.RATING:
      return <RatingPage />;
    case TABS.PROFILE:
      return <ProfilePage />;
    case TABS.NUTS:
      return <StorePage onBack={() => props.dispatch({ type: "GO_GAMES" })} />;
    default:
      return <GamesPage {...props} />;
  }
}
/* =========================
   BOTTOM NAV
========================= */

function BottomNav({ activeTab, dispatch }) {
  const friendRequestsCount = useGameStore((s) => s.friendRequestsCount);

  const items = [
    { key: TABS.GAMES, label: "Играть", icon: "🏠", action: "GO_GAMES" },
    { key: TABS.FRIENDS, label: "Друзья", icon: "👥", action: "GO_FRIENDS" },
    { key: TABS.RATING, label: "Рейтинг", icon: "🏆", action: "GO_RATING" },
    { key: TABS.PROFILE, label: "Профиль", icon: "👤", action: "GO_PROFILE" },
  ];

  return (
    <div className="fixed bottom-0 left-0 w-full bg-[#0f0f1a]/95 backdrop-blur-md border-t border-purple-500/50 pb-[env(safe-area-inset-bottom)] px-4 py-2 flex justify-around z-40">
      {items.map((item) => {
        const isActive = activeTab === item.key;

        return (
          <button
            key={item.key}
            onClick={() => dispatch({ type: item.action })}
            className={`relative flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-300 w-16 ${
              isActive 
                ? "text-pink-400 bg-purple-900/40 translate-y-[-4px] shadow-[0_4px_15px_rgba(168,85,247,0.4)]" 
                : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/50 active:scale-95"
            }`}
          >
            {/* Анимация подчеркивания для активного таба */}
            {isActive && (
              <span className="absolute -bottom-2 w-8 h-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full shadow-[0_0_10px_#ec4899]" />
            )}

            <div className="relative">
              <span className={`text-2xl transition-transform duration-300 drop-shadow-md ${isActive ? 'scale-110 drop-shadow-[0_0_8px_rgba(236,72,153,0.8)]' : ''}`}>
                {item.icon}
              </span>
              {/* Badge for Friends */}
              {item.key === TABS.FRIENDS && friendRequestsCount > 0 && (
                <div className="absolute -top-1 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 min-w-[1.25rem] h-5 rounded-full flex items-center justify-center border-2 border-[#1a1a2e] shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-bounce font-sans z-10">
                  {friendRequestsCount}
                </div>
              )}
            </div>
            <span className={`text-[10px] mt-1 font-bold ${isActive ? 'opacity-100' : 'opacity-70 font-medium'}`}>
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* =========================
   API
========================= */

export async function fetchMe() {
  const token = localStorage.getItem("access_token");
  if (!token) throw new Error("No access token");

  const res = await axios.get(getUrl("/auth/me"), {
    headers: { Authorization: `Bearer ${token}` },
  });

  return res.data;
}

async function fetchStore() {
  const token = localStorage.getItem("access_token");
  if (!token) throw new Error("No access token");

  const res = await axios.get(getUrl("/v1/store"), {
    headers: { Authorization: `Bearer ${token}` },
  });

  return res.data;
}

async function buyStoreItem({ item_type, item_id }) {
  const token = localStorage.getItem("access_token");
  if (!token) throw new Error("No access token");

  const res = await axios.post(
    getUrl("/v1/store/buy"),
    { item_type, item_id },
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  return res.data;
}

async function equipStoreItem({ item_type, item_id }) {
  const token = localStorage.getItem("access_token");
  if (!token) throw new Error("No access token");

  const res = await axios.post(
    getUrl("/v1/store/equip"),
    { item_type, item_id },
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  return res.data;
}

/* =========================
   MAIN
========================= */

export default function GameSearch() {

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const token = localStorage.getItem("access_token");
        if (token) {
          const res = await axios.get(getUrl("/v1/friends/requests"), { headers: { Authorization: `Bearer ${token}` } });
          useGameStore.getState().setFriendRequestsCount(res.data.length);
        }
      } catch (err) {}
    };
    fetchRequests();
    const inv = setInterval(fetchRequests, 10000);
    return () => clearInterval(inv);
  }, []);
  const roomsMap = useGameStore((s) => s.rooms);
  const rooms = useMemo(() => Object.values(roomsMap), [roomsMap]);

  const setUser = useGameStore((s) => s.setUser);
  const currentUser = useGameStore((s) => s.user);

  const [uiState, dispatch] = useReducer(uiReducer, initialUIState);

  const [rulesOpen, setRulesOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [isBotsOpen, setBotsOpen] = useState(false);
  const [clansOpen, setClansOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [passwordRoom, setPasswordRoom] = useState(null);
  const [dailyRewardsOpen, setDailyRewardsOpen] = useState(false);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [luckySpinOpen, setLuckySpinOpen] = useState(false);
  const [activeEvent, setActiveEvent] = useState(null);
  const [slotsModalOpen, setSlotsModalOpen] = useState(false);
  const [chestToOpen, setChestToOpen] = useState(null);

  const handleUseBooster = async (item_key) => {
    try {
      const token = localStorage.getItem("access_token");
      await axios.post(getUrl("/v1/inventory/use"), { item_key }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Бустер успешно активирован!");
      const ures = await axios.get(getUrl("/auth/me"), { headers: { Authorization: `Bearer ${token}` } });
      setUser(ures.data);
    } catch (e) {
      toast.error(e.response?.data || "Не удалось использовать предмет");
    }
  };

  const navigate = useNavigate();

  const openJoinModal = (room) => {
    if (room.playersConnected >= (room.maxPlayers || 4)) {
      setSelectedRoom(room);
    } else {
      if (room.isPrivate) {
        setPasswordRoom(room);
      } else {
        joinRoom(room);
      }
    }
  };

  useEffect(() => {
    if (!currentUser) return;

    const myRoom = rooms.find((r) => r.players?.some((p) => p.id == currentUser.id));
    if (myRoom) {
      setSelectedRoom(myRoom);
    } else {
      // If we selected a full room manually (for spectating), don't clear it immediately
      setSelectedRoom((prev) => {
        if (prev && prev.playersConnected >= (prev.maxPlayers || 4)) return prev;
        return null;
      });
    }
  }, [rooms, currentUser]);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const data = await fetchMe();
        setUser(data);
      } catch (err) {
        console.error("Auth failed:", err);
      }
    };

    loadUser();
  }, [setUser]);

  useEffect(() => {
    const fetchActiveEvent = async () => {
      try {
        const token = localStorage.getItem("access_token");
        if (!token) return;
        const res = await axios.get(getUrl("/v1/events"), {
          headers: { Authorization: `Bearer ${token}` }
        });
        setActiveEvent(res.data.event);
      } catch (e) {
        console.error("Failed to fetch active event", e);
      }
    };
    fetchActiveEvent();
  }, [currentUser]);

  const leaveRoom = (room_id) => {
    sendleaveRoom(room_id);
    setSelectedRoom(null);
  };

  const joinRoom = async (room, passwordStr = null) => {
    let hash = null;
    if (passwordStr) {
      const msgUint8 = new TextEncoder().encode(passwordStr);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      hash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    sendjoinRoom(room.id, hash);
  };

  const spectateRoom = (roomId) => {
    spectateRoomApi(roomId);
    useGameStore.getState().setIsSpectating(true);
    setSelectedRoom(null);
  };

  useEffect(() => {
    const unsubscribe = subscribe((event) => {
      const data = JSON.parse(event.data);
      console.log("WS message SearchGame:", data.event || data);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <div className="min-h-screen login-bg">
      <div className="w-full h-full p-4 pb-24 space-y-6">
        <ProfileHeader onOpenRating={() => dispatch({ type: "GO_RATING" })} onOpenNuts={() => dispatch({ type: "GO_NUTS" })} onOpenClans={() => setClansOpen(true)} />

        <div className="transition-all duration-300 ease-out">
          <ScreenRenderer
            activeTab={uiState.activeTab}
            rooms={rooms}
            setBotsOpen={setBotsOpen}
            setCreateOpen={setCreateOpen}
            setRulesOpen={setRulesOpen}
            setLoading={setLoading}
            openJoinModal={openJoinModal}
            dispatch={dispatch}
            setDailyRewardsOpen={setDailyRewardsOpen}
            setEventsOpen={setEventsOpen}
            activeEvent={activeEvent}
          />
        </div>
      </div>

      <LoadingModal
        isOpen={loading}
        onCancel={() => {
          cancelGame();
          setLoading(false);
        }}
        onPlayBots={(difficulty) => {
          cancelGame();
          playWithBots(difficulty);
          setLoading(false);
        }}
      />

      {/* Floating Casino Buttons */}
      {uiState.activeTab !== TABS.NUTS && (
        <div className="fixed bottom-[100px] sm:bottom-8 right-4 sm:right-8 z-[40] flex flex-col gap-6 sm:gap-8">
          <button
            onClick={() => setSlotsModalOpen(true)}
            className="relative group animate-bounce hover:animate-none scale-110 sm:scale-125 transition-transform"
            style={{ animationDelay: '0.5s' }}
          >
            <div className="absolute -inset-2 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full blur-md opacity-70 group-hover:opacity-100 transition duration-500 group-hover:duration-200"></div>
            <div className="relative w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-purple-900 to-pink-800 rounded-full border-[3px] border-pink-400 flex items-center justify-center overflow-hidden shadow-2xl">
              <span className="text-2xl sm:text-3xl drop-shadow-lg z-10">🎰</span>
            </div>
            <div className="absolute -bottom-2 -left-2 -right-2 bg-black/80 backdrop-blur text-pink-400 text-[10px] sm:text-xs font-black uppercase text-center py-1 rounded-full border border-pink-500/50">
              Слоты
            </div>
          </button>

          <button
            onClick={() => setLuckySpinOpen(true)}
            className="relative group animate-bounce hover:animate-none scale-110 sm:scale-125 transition-transform"
          >
            <div className="absolute -inset-2 bg-gradient-to-r from-yellow-400 to-amber-600 rounded-full blur-md opacity-70 group-hover:opacity-100 transition duration-500 group-hover:duration-200"></div>
            <div className="relative w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-indigo-900 to-purple-800 rounded-full border-[3px] border-amber-400 flex items-center justify-center overflow-hidden shadow-2xl">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 mix-blend-overlay"></div>
              <div className="w-full h-full animate-[spin_10s_linear_infinite] rounded-full border-4 border-dashed border-yellow-500/50 absolute"></div>
              <span className="text-2xl sm:text-3xl drop-shadow-lg z-10">🎡</span>
            </div>
            <div className="absolute -bottom-2 -left-2 -right-2 bg-black/80 backdrop-blur text-yellow-400 text-[10px] sm:text-xs font-black uppercase text-center py-1 rounded-full border border-yellow-500/50">
              Рулетка
            </div>
          </button>
        </div>
      )}

      <CreateRoomModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={(data) => {
          createRoom(data);
          setCreateOpen(false);
        }}
      />

      <JoinRoomModal
        isOpen={!!selectedRoom}
        room={selectedRoom}
        onSpectate={() => spectateRoom(selectedRoom?.id)}
        onCancel={() => leaveRoom(selectedRoom?.id)}
      />

    <BotsModal
        isOpen={isBotsOpen}
        onClose={() => setBotsOpen(false)}
        onOpenRules={() => setRulesOpen(true)}
        onPlayBots={(difficulty, maxEyes) => {
          playWithBots(difficulty, maxEyes);
          setBotsOpen(false); // Закрываем модалку после выбора ботов
        }}
      />

      <DailyRewardsModal 
         isOpen={dailyRewardsOpen}
         onClose={() => setDailyRewardsOpen(false)}
         onSuccess={() => {
           // update user store
           const token = localStorage.getItem("access_token");
           axios.get(getUrl("/auth/me"), { headers: { Authorization: `Bearer ${token}` }}).then(res => setUser(res.data)).catch(()=>{});
         }}
         onOpenChest={(chestType) => {
           setChestToOpen(chestType);
         }}
         onUseBooster={(boosterKey) => {
           handleUseBooster(boosterKey);
         }}
      />

      <RulesModal
        isOpen={rulesOpen}
        onClose={() => setRulesOpen(false)}
      />

      <EventsModal 
        isOpen={eventsOpen} 
        onClose={() => setEventsOpen(false)} 
      />

      <LuckySpinModal
        isOpen={luckySpinOpen}
        onClose={() => setLuckySpinOpen(false)}
      />

      {slotsModalOpen && (
        <SlotsModal onClose={() => setSlotsModalOpen(false)} />
      )}

      {clansOpen && (
        <ClansModal onClose={() => setClansOpen(false)} />
      )}

      {passwordRoom && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1e1c3a] border border-[#2a284c] rounded-2xl w-full max-w-sm overflow-hidden flex flex-col p-6 shadow-2xl relative">
            <h3 className="text-xl font-bold text-white mb-4">Закрытая комната</h3>
            <p className="text-[#8487b3] text-sm mb-4">Вам требуется пароль для входа.</p>
            <input 
              type="password" 
              placeholder="Введите пароль..." 
              id="privateRoomPwdInput"
              autoFocus
              className="bg-black/20 border border-[#3e3b6a] text-white rounded-lg p-3 w-full mb-6 focus:border-purple-500 focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  joinRoom(passwordRoom, e.target.value);
                  setPasswordRoom(null);
                }
              }}
            />
            <div className="flex gap-2 justify-end">
              <button 
                onClick={() => setPasswordRoom(null)} 
                className="px-4 py-2 bg-[#2a284c] text-white font-bold rounded-lg hover:bg-[#3e3b6a] transition"
              >
                Отмена
              </button>
              <button 
                onClick={() => { 
                  let val = document.getElementById('privateRoomPwdInput').value; 
                  joinRoom(passwordRoom, val); 
                  setPasswordRoom(null); 
                }} 
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-500 text-white font-bold rounded-lg hover:brightness-110 shadow-[0_0_15px_rgba(168,85,247,0.4)] transition"
              >
                Войти
              </button>
            </div>
          </div>
        </div>
      )}

      <ChestOpeningModal 
         isOpen={!!chestToOpen} 
         chestType={chestToOpen} 
         onClose={() => setChestToOpen(null)} 
         onSuccess={() => {
            const token = localStorage.getItem("access_token");
            axios.get(getUrl("/auth/me"), { headers: { Authorization: `Bearer ${token}` }}).then(res => setUser(res.data)).catch(()=>{});
         }}
      />

      <InviteModal />
      <BottomNav activeTab={uiState.activeTab} dispatch={dispatch} />
    </div>
  );
}
