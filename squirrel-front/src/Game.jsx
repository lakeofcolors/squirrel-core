import { motion, AnimatePresence, LayoutGroup, Reorder } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "./store";
import { playCard, unspectateRoom, surrenderRoom, sendTaunt, sendSponsor, requestToJoin, acceptJoinRequest } from "./ws/client";
import UserProfileModal from "./components/UserProfileModal";
import SlotsModal from "./components/SlotsModal";
import { playTickSound, playMyTurnSound, playDealSound, playCardDropSound } from "./utils/audio";
import { getUrl } from "./config/settings";
import axios from "axios";
import { toast } from "react-toastify";

export const teamMeta = {
  kaskyr: {
    name: "Каскыр",
    icon: "🐺",
    color: "text-amber-400",
    border: "border-amber-400",
    ring: "ring-2 ring-amber-400/80",
    glow: "shadow-[0_0_18px_rgba(251,191,36,0.75)]",
    panel: "from-amber-500/20 to-amber-300/5",
    badge: "bg-amber-400/15 text-amber-300 border border-amber-400/30",
  },
  uzi: {
    name: "Узи",
    icon: "⚡",
    color: "text-purple-400",
    border: "border-purple-500",
    ring: "ring-2 ring-purple-400/80",
    glow: "shadow-[0_0_18px_rgba(168,85,247,0.75)]",
    panel: "from-purple-500/20 to-purple-300/5",
    badge: "bg-purple-400/15 text-purple-300 border border-purple-400/30",
  },
};

export const suitSymbol = {
  Clubs: "♣",
  Diamonds: "♦",
  Hearts: "♥",
  Spades: "♠",
};

export const rankLabel = {
  Seven: "7",
  Eight: "8",
  Nine: "9",
  Ten: "10",
  Jack: "J",
  Queen: "Q",
  King: "K",
  Ace: "A",
};

export const renderTauntGraphic = (taunt, isSmall = false) => {
  if (!taunt) return null;
  const isImage = taunt.endsWith('.png') || taunt.endsWith('.gif') || taunt.endsWith('.webp') || taunt.startsWith('img:');
  if (isImage) {
    const src = taunt.startsWith('img:') ? taunt.slice(4) : taunt;
    const sizeClasses = isSmall ? "w-10 h-10" : "w-[60px] h-[60px] sm:w-[80px] sm:h-[80px]";
    return (
      <img 
        src={`/taunts/${src}`} 
        alt="taunt" 
        className={`${sizeClasses} object-contain drop-shadow-[0_0_15px_rgba(255,165,0,0.6)] rounded-full`} 
        draggable="false"
      />
    );
  }
  return <span>{taunt}</span>;
};

export function getBackground(theme) {
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

export function suitIsRed(suit) {
  return suit === "Hearts" || suit === "Diamonds";
}

export function suitColorClass(suit) {
  return suitIsRed(suit) ? "text-red-500" : "text-slate-900";
}

/**
 * Clockwise seating for UI:
 * For player at bottom: next clockwise is LEFT.
 */
function relativeSeat(myPosition, playerPosition) {
  if (!playerPosition) return "top";

  if (!myPosition) {
    const fixMap = { North: "top", South: "bottom", West: "left", East: "right" };
    return fixMap[playerPosition] || "top";
  }

  const order = ["North", "East", "South", "West"];
  const myIdx = order.indexOf(myPosition);
  const playerIdx = order.indexOf(playerPosition);

  if (myIdx === -1 || playerIdx === -1) return "bottom";

  const delta = (playerIdx - myIdx + 4) % 4;

  switch (delta) {
    case 0:
      return "bottom";
    case 1:
      return "left";
    case 2:
      return "top";
    case 3:
      return "right";
    default:
      return "bottom";
  }
}

export function getDeckTheme(theme, suit) {
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
    arcane: {
      name: "Arcane",
      rarity: "mythic",
      bg: "#080214",
      border: "#a855f7",
      glow: "#c084fc",
      text: isRed ? "#f472b6" : "#c084fc",
      accent: "#fbbf24",
      inner: "#17062e",
      pipBg: "rgba(168,85,247,0.08)",
    },
    mecha: {
      name: "Mecha",
      rarity: "mythic",
      bg: "#070c12",
      border: "#06b6d4",
      glow: "#0891b2",
      text: isRed ? "#fb923c" : "#22d3ee",
      accent: "#f97316",
      inner: "#0f172a",
      pipBg: "rgba(6,182,212,0.08)",
    },
    synthwave: {
      name: "Synthwave",
      rarity: "mythic",
      bg: "#120224",
      border: "#ff007f",
      glow: "#00f0ff",
      text: isRed ? "#ff007f" : "#00f0ff",
      accent: "#f59e0b",
      inner: "#1d043b",
      pipBg: "rgba(255,0,127,0.08)",
    },
    egypt: {
      name: "Egypt",
      rarity: "mythic",
      bg: "#170c02",
      border: "#fbbf24",
      glow: "#f59e0b",
      text: isRed ? "#fef08a" : "#22d3ee",
      accent: "#06b6d4",
      inner: "#2e1a05",
      pipBg: "rgba(251,191,36,0.06)",
    },
    singularity: {
      name: "Singularity",
      rarity: "mythic",
      bg: "#030008",
      border: "#f97316",
      glow: "#ec4899",
      text: isRed ? "#fed7aa" : "#f472b6",
      accent: "#ec4899",
      inner: "#0b0414",
      pipBg: "rgba(249,115,22,0.06)",
    },
    glacier: {
      name: "Glacier",
      rarity: "mythic",
      bg: "#021526",
      border: "#38bdf8",
      glow: "#e0f2fe",
      text: isRed ? "#bae6fd" : "#f0f9ff",
      accent: "#0ea5e9",
      inner: "#07223d",
      pipBg: "rgba(56,189,248,0.06)",
    },
    biohazard: {
      name: "Biohazard",
      rarity: "mythic",
      bg: "#050804",
      border: "#22c55e",
      glow: "#84cc16",
      text: isRed ? "#bef264" : "#bef264",
      accent: "#eab308",
      inner: "#0c1a0c",
      pipBg: "rgba(34,197,94,0.06)",
    },
    celestial: {
      name: "Celestial",
      rarity: "mythic",
      bg: "#020617",
      border: "#fbbf24",
      glow: "#fef08a",
      text: isRed ? "#fef08a" : "#fbbf24",
      accent: "#f97316",
      inner: "#0a0f24",
      pipBg: "rgba(251,191,36,0.08)",
    },
    cyberpunk: {
      name: "Cyberpunk",
      rarity: "mythic",
      bg: "#09090b",
      border: "#ec4899",
      glow: "#06b6d4",
      text: isRed ? "#f472b6" : "#22d3ee",
      accent: "#22c55e",
      inner: "#0c0a0f",
      pipBg: "rgba(236,72,153,0.08)",
    },
    abyss: {
      name: "Abyss",
      rarity: "mythic",
      bg: "#08020f",
      border: "#a855f7",
      glow: "#d946ef",
      text: isRed ? "#f472b6" : "#c084fc",
      accent: "#06b6d4",
      inner: "#040108",
      pipBg: "rgba(168,85,247,0.08)",
    },
    chronos: {
      name: "Chronos",
      rarity: "mythic",
      bg: "#1c1303",
      border: "#d97706",
      glow: "#fbbf24",
      text: isRed ? "#fde047" : "#fb923c",
      accent: "#0d9488",
      inner: "#2e1e07",
      pipBg: "rgba(217,119,6,0.08)",
    },
    inferno: {
      name: "Inferno",
      rarity: "mythic",
      bg: "#140202",
      border: "#ea580c",
      glow: "#facc15",
      text: isRed ? "#fca5a5" : "#fdba74",
      accent: "#dc2626",
      inner: "#290505",
      pipBg: "rgba(234,88,12,0.08)",
    },
    cosmogenesis: {
      name: "Cosmogenesis",
      rarity: "mythic",
      bg: "#030712",
      border: "#8b5cf6",
      glow: "#ffffff",
      text: isRed ? "#c084fc" : "#a78bfa",
      accent: "#e9d5ff",
      inner: "#0f111a",
      pipBg: "rgba(139,92,246,0.08)",
    },
    hyperdrive: {
      name: "Hyperdrive",
      rarity: "mythic",
      bg: "#020617",
      border: "#06b6d4",
      glow: "#ffffff",
      text: isRed ? "#38bdf8" : "#22d3ee",
      accent: "#a5f3fc",
      inner: "#080e1e",
      pipBg: "rgba(6,182,212,0.08)",
    },
    alchemist: {
      name: "Alchemist",
      rarity: "mythic",
      bg: "#110a03",
      border: "#d97706",
      glow: "#14b8a6",
      text: isRed ? "#fcd34d" : "#99f6e4",
      accent: "#fbbf24",
      inner: "#271808",
      pipBg: "rgba(217,119,6,0.08)",
    },
  };

  return themes[theme] || themes.neon;
}

export function get_squirrel_image(card, theme = "neon") {
  // Словарь картинок: Тема -> Ранг
  const assets = {
    classic: {
      Jack: "/classic_jack.png",
      Queen: "/classic_queen.png",
      King: "/classic_king.png",
    },
    cyber: {
      Jack: "/cyber_jack.png",
      Queen: "/cyber_queen.png",
      King: "/cyber_king.png",
    },
    forest: {
      Jack: "/forest_jack.png",
      Queen: "/forest_queen.png",
      King: "/forest_king.png",
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

export function CardFace({ card, compact = false, className = "", theme = "neon" }) {
  const rank = rankLabel[card.rank] ?? card.rank;
  const suit = suitSymbol[card.suit] ?? card.suit;
  const t = getDeckTheme(theme, card.suit);
  const isFaceCard = ["Jack", "Queen", "King"].includes(card.rank);
  const squirrelImg = isFaceCard ? get_squirrel_image(card, theme) : null;

  return (
    <div className={`${compact ? "w-12 h-[72px]" : "w-16 h-24"} ${className}`}>
      <svg viewBox="0 0 100 150" className="w-full h-full">
        <defs>
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
            <ellipse cx="50" cy="75" rx="36" ry="12" fill="none" stroke={`url(#face-frame-${theme}-${rank}-${card.suit})`} strokeWidth="0.75" opacity="0.3" className="orbit-rot" />
            <ellipse cx="50" cy="75" rx="28" ry="24" fill="none" stroke={t.accent} strokeWidth="0.5" opacity="0.2" className="orbit-rot" style={{ animationDirection: 'reverse', animationDuration: '20s' }} />
            <circle cx="25" cy="55" r="1.5" fill="#ffffff" className="star-p-1" />
            <circle cx="75" cy="95" r="1.2" fill="#ffffff" className="star-p-2" />
            <circle cx="35" cy="115" r="1.8" fill="#a78bfa" className="star-p-1" />
            <circle cx="68" cy="45" r="1.0" fill="#06b6d4" className="star-p-2" />
            <circle cx="48" cy="38" r="1.4" fill="#ffffff" className="star-p-1" />
            <circle cx="52" cy="118" r="1.2" fill="#a78bfa" className="star-p-2" />
          </g>
        )}

        {theme === "magma" && (
          <g>
            <path d="M10,135 Q30,115 25,95 T60,85 T78,115 T90,95" fill="none" stroke={t.border} strokeWidth="1.5" strokeLinecap="round" className="lava-f" />
            <path d="M18,138 Q25,120 45,110 T58,128 T85,110" fill="none" stroke={t.accent} strokeWidth="1.0" strokeLinecap="round" className="lava-f" style={{ animationDelay: '2s' }} />
            <path d="M30,30 Q45,50 35,75 T70,60 T85,25" fill="none" stroke={t.border} strokeWidth="1.2" strokeLinecap="round" className="lava-f" style={{ animationDelay: '1s' }} />
          </g>
        )}

        {theme === "matrix" && (
          <g opacity="0.55">
            <line x1="16" y1="12" x2="16" y2="138" stroke={t.accent} strokeWidth="1.0" strokeDasharray="6,24" className="matrix-c" />
            <line x1="34" y1="12" x2="34" y2="138" stroke={t.border} strokeWidth="0.8" strokeDasharray="10,30" className="matrix-c" style={{ animationDuration: '3.5s', animationDirection: 'reverse' }} />
            <line x1="66" y1="12" x2="66" y2="138" stroke={t.accent} strokeWidth="1.2" strokeDasharray="4,20" className="matrix-c" style={{ animationDuration: '1.8s' }} />
            <line x1="84" y1="12" x2="84" y2="138" stroke={t.border} strokeWidth="0.8" strokeDasharray="8,28" className="matrix-c" style={{ animationDuration: '4s' }} />
          </g>
        )}

        {theme === "arcane" && (
          <g>
            <circle cx="50" cy="75" r="34" fill="none" stroke={t.border} strokeWidth="1" strokeDasharray="4,8,12,6" opacity="0.4" className="arcane-rot" />
            <circle cx="50" cy="75" r="26" fill="none" stroke={t.accent} strokeWidth="0.75" strokeDasharray="2,6,4,8" opacity="0.3" className="arcane-rot" style={{ animationDirection: 'reverse', animationDuration: '14s' }} />
            <circle cx="50" cy="36" r="2" fill={t.accent} className="rune-p" />
            <circle cx="50" cy="114" r="2" fill={t.accent} className="rune-p" style={{ animationDelay: '1.5s' }} />
            <circle cx="16" cy="75" r="2" fill={t.border} className="rune-p" style={{ animationDelay: '0.7s' }} />
            <circle cx="84" cy="75" r="2" fill={t.border} className="rune-p" style={{ animationDelay: '2.2s' }} />
          </g>
        )}

        {theme === "mecha" && (
          <g>
            <g className="mecha-h" opacity="0.3">
              <circle cx="50" cy="75" r="30" fill="none" stroke={t.border} strokeWidth="0.75" strokeDasharray="10,5,2,5" />
              <line x1="50" y1="35" x2="50" y2="43" stroke={t.accent} strokeWidth="1" />
              <line x1="50" y1="107" x2="50" y2="115" stroke={t.accent} strokeWidth="1" />
              <line x1="10" y1="75" x2="18" y2="75" stroke={t.border} strokeWidth="1" />
              <line x1="82" y1="75" x2="90" y2="75" stroke={t.border} strokeWidth="1" />
            </g>
            <line x1="8" y1="0" x2="92" y2="0" stroke={t.accent} strokeWidth="1.2" opacity="0.7" className="mecha-s" />
            <path d="M12,16 L18,16 L12,22 Z" fill="none" stroke={t.border} strokeWidth="0.75" opacity="0.4" />
            <path d="M88,16 L82,16 L88,22 Z" fill="none" stroke={t.border} strokeWidth="0.75" opacity="0.4" />
            <path d="M12,134 L18,134 L12,128 Z" fill="none" stroke={t.border} strokeWidth="0.75" opacity="0.4" />
            <path d="M88,134 L82,134 L88,128 Z" fill="none" stroke={t.border} strokeWidth="0.75" opacity="0.4" />
          </g>
        )}

        {theme === "synthwave" && (
          <g>
            <circle cx="50" cy="55" r="18" fill={`url(#face-frame-${theme}-${rank}-${card.suit})`} opacity="0.85" />
            <rect x="30" y="48" width="40" height="1.5" fill={t.bg} />
            <rect x="30" y="54" width="40" height="2" fill={t.bg} />
            <rect x="30" y="61" width="40" height="2.5" fill={t.bg} />
            <rect x="30" y="69" width="40" height="3" fill={t.bg} />
            <g opacity="0.45" className="synth-g">
              <line x1="50" y1="72" x2="10" y2="138" stroke={t.border} strokeWidth="0.75" />
              <line x1="50" y1="72" x2="30" y2="138" stroke={t.border} strokeWidth="0.75" />
              <line x1="50" y1="72" x2="50" y2="138" stroke={t.border} strokeWidth="0.75" />
              <line x1="50" y1="72" x2="70" y2="138" stroke={t.border} strokeWidth="0.75" />
              <line x1="50" y1="72" x2="90" y2="138" stroke={t.border} strokeWidth="0.75" />
              <line x1="16" y1="95" x2="84" y2="95" stroke={t.border} strokeWidth="0.5" />
              <line x1="12" y1="114" x2="88" y2="114" stroke={t.border} strokeWidth="0.5" />
              <line x1="8" y1="130" x2="92" y2="130" stroke={t.border} strokeWidth="0.5" />
            </g>
          </g>
        )}

        {theme === "egypt" && (
          <g>
            <path d="M50,45 A6,6 0 1,0 50,57 L50,85 M43,65 L57,65" fill="none" stroke={t.border} strokeWidth="1.5" opacity="0.3" className="egypt-s" />
            <polygon points="50,90 28,138 72,138" fill="none" stroke={t.accent} strokeWidth="0.75" opacity="0.25" />
            <polygon points="35,102 14,138 56,138" fill="none" stroke={t.border} strokeWidth="0.5" opacity="0.15" />
            <polygon points="65,102 44,138 86,138" fill="none" stroke={t.border} strokeWidth="0.5" opacity="0.15" />
          </g>
        )}

        {theme === "singularity" && (
          <g>
            <circle cx="50" cy="75" r="12" fill="#000000" stroke={t.border} strokeWidth="1" className="sing-w" style={{ animationDuration: '4s' }} />
            <ellipse cx="50" cy="75" rx="34" ry="8" fill="none" stroke={t.border} strokeWidth="1.5" opacity="0.7" className="sing-w" />
            <ellipse cx="50" cy="75" rx="26" ry="12" fill="none" stroke={t.accent} strokeWidth="1" opacity="0.5" className="sing-w" style={{ animationDirection: 'reverse', animationDuration: '8s' }} />
            <ellipse cx="50" cy="75" rx="42" ry="6" fill="none" stroke={t.border} strokeWidth="0.5" opacity="0.3" className="sing-w" style={{ animationDuration: '14s' }} />
          </g>
        )}

        {theme === "glacier" && (
          <g className="glac-s">
            <path d="M50,42 L50,108 M17,75 L83,75 M27,52 L73,98 M27,98 L73,52" fill="none" stroke={t.border} strokeWidth="0.5" opacity="0.25" />
            <circle cx="50" cy="42" r="1.5" fill="#ffffff" opacity="0.7" />
            <circle cx="50" cy="108" r="1.5" fill="#ffffff" opacity="0.7" />
            <circle cx="17" cy="75" r="1.5" fill="#ffffff" opacity="0.7" />
            <circle cx="83" cy="75" r="1.5" fill="#ffffff" opacity="0.7" />
          </g>
        )}

        {theme === "biohazard" && (
          <g>
            <path d="M8,10 L92,10" stroke={t.accent} strokeWidth="2" strokeDasharray="6,6" opacity="0.2" />
            <path d="M8,140 L92,140" stroke={t.accent} strokeWidth="2" strokeDasharray="6,6" opacity="0.2" />
            <circle cx="30" cy="110" r="3" fill="none" stroke={t.border} strokeWidth="0.75" className="bio-b" />
            <circle cx="70" cy="90" r="2" fill="none" stroke={t.border} strokeWidth="0.5" className="bio-b" style={{ animationDelay: '1.2s' }} />
            <circle cx="45" cy="130" r="4" fill="none" stroke={t.accent} strokeWidth="0.75" className="bio-b" style={{ animationDelay: '0.6s' }} />
            <circle cx="55" cy="100" r="1.5" fill="none" stroke={t.border} strokeWidth="0.5" className="bio-b" style={{ animationDelay: '2.4s' }} />
          </g>
        )}

        {theme === "celestial" && (
          <g>
            <ellipse cx="50" cy="75" rx="42" ry="14" fill="none" stroke={t.border} strokeWidth="0.75" opacity="0.35" className="orbit-rot" style={{ animationDuration: '16s' }} />
            <ellipse cx="50" cy="75" rx="14" ry="42" fill="none" stroke={t.accent} strokeWidth="0.5" opacity="0.25" className="orbit-rot" style={{ animationDirection: 'reverse', animationDuration: '24s' }} />
            <circle cx="28" cy="50" r="1.8" fill="#ffffff" className="star-p-1" />
            <circle cx="72" cy="100" r="1.5" fill="#ffffff" className="star-p-2" />
            <circle cx="34" cy="110" r="1.2" fill="#fef08a" className="star-p-1" />
            <circle cx="66" cy="40" r="1.6" fill="#fbbf24" className="star-p-2" />
          </g>
        )}

        {theme === "cyberpunk" && (
          <g opacity="0.6" className="cyber-g">
            <line x1="10" y1="20" x2="90" y2="20" stroke={t.border} strokeWidth="1" className="mecha-s" style={{ animationDuration: '2.5s' }} />
            <line x1="10" y1="130" x2="90" y2="130" stroke={t.accent} strokeWidth="0.75" className="mecha-s" style={{ animationDuration: '4s', animationDirection: 'reverse' }} />
            <path d="M12,12 H88 V138 H12 Z" fill="none" stroke={t.accent} strokeWidth="0.5" strokeDasharray="5,15" className="mecha-h" />
          </g>
        )}

        {theme === "abyss" && (
          <g>
            <circle cx="50" cy="75" r="14" fill="#000000" stroke={t.border} strokeWidth="1.5" />
            <circle cx="50" cy="75" r="28" fill="none" stroke={t.glow} strokeWidth="0.75" strokeDasharray="8,6" className="sing-w" style={{ animationDuration: '6s' }} />
            <circle cx="50" cy="75" r="38" fill="none" stroke={t.accent} strokeWidth="0.5" strokeDasharray="4,8" className="sing-w" style={{ animationDirection: 'reverse', animationDuration: '10s' }} />
          </g>
        )}

        {theme === "chronos" && (
          <g opacity="0.45" className="chronos-t">
            <circle cx="50" cy="75" r="36" fill="none" stroke={t.border} strokeWidth="1.2" strokeDasharray="10,6" />
            <circle cx="50" cy="75" r="22" fill="none" stroke={t.accent} strokeWidth="0.8" strokeDasharray="6,4" style={{ animationDirection: 'reverse', animationDuration: '15s' }} />
            <line x1="50" y1="39" x2="50" y2="111" stroke={t.border} strokeWidth="0.5" />
            <line x1="14" y1="75" x2="86" y2="75" stroke={t.border} strokeWidth="0.5" />
          </g>
        )}

        {theme === "inferno" && (
          <g className="inferno-b">
            <path d="M12,120 Q35,80 50,110 T88,120" fill="none" stroke={t.border} strokeWidth="2" strokeLinecap="round" className="lava-f" />
            <circle cx="28" cy="115" r="1.5" fill="#facc15" className="bio-b" style={{ animationDuration: '2.5s' }} />
            <circle cx="72" cy="95" r="1.2" fill="#ea580c" className="bio-b" style={{ animationDuration: '3.5s', animationDelay: '1s' }} />
            <circle cx="50" cy="130" r="2.0" fill="#dc2626" className="bio-b" style={{ animationDuration: '4s', animationDelay: '0.5s' }} />
          </g>
        )}

        {theme === "cosmogenesis" && (
          <g className="nebula-e">
            <circle cx="50" cy="75" r="32" fill="none" stroke={t.border} strokeWidth="1.2" strokeDasharray="12,18" />
            <circle cx="50" cy="75" r="22" fill="none" stroke={t.accent} strokeWidth="0.8" strokeDasharray="8,10" style={{ animationDirection: 'reverse' }} />
            <path d="M50,35 A40,40 0 0,0 90,75 A40,40 0 0,0 50,115 A40,40 0 0,0 10,75 Z" fill="none" stroke="#ffffff" strokeWidth="0.5" opacity="0.3" />
            <circle cx="35" cy="50" r="1.5" fill="#ffffff" className="star-p-1" />
            <circle cx="65" cy="100" r="1.8" fill="#ffffff" className="star-p-2" />
          </g>
        )}

        {theme === "hyperdrive" && (
          <g>
            <g className="mecha-h" opacity="0.3">
              <path d="M12,12 L88,12 L88,138 L12,138 Z" fill="none" stroke={t.border} strokeWidth="0.5" />
            </g>
            <line x1="25" y1="12" x2="25" y2="138" stroke={t.border} strokeWidth="0.75" strokeDasharray="15,40" className="speed-w" />
            <line x1="50" y1="12" x2="50" y2="138" stroke="#ffffff" strokeWidth="1" strokeDasharray="25,60" className="speed-w" style={{ animationDelay: '0.4s' }} />
            <line x1="75" y1="12" x2="75" y2="138" stroke={t.border} strokeWidth="0.75" strokeDasharray="10,50" className="speed-w" style={{ animationDelay: '0.8s' }} />
          </g>
        )}

        {theme === "alchemist" && (
          <g>
            <g className="rune-s" opacity="0.45">
              <circle cx="50" cy="75" r="38" fill="none" stroke={t.border} strokeWidth="1.2" />
              <polygon points="50,37 83,93 17,93" fill="none" stroke={t.border} strokeWidth="0.75" />
              <polygon points="50,113 83,57 17,57" fill="none" stroke={t.border} strokeWidth="0.75" />
            </g>
            <path d="M10,125 C30,118 40,132 50,125 C60,118 70,132 90,125" fill="none" stroke={t.accent} strokeWidth="1" className="liquid-f" />
            <path d="M10,132 C30,125 40,139 50,132 C60,125 70,139 90,132" fill="none" stroke={t.glow} strokeWidth="0.75" className="liquid-f" style={{ animationDelay: '1.5s' }} />
          </g>
        )}

        <circle cx="50" cy="75" r="52" fill={`url(#face-glow-${theme}-${rank}-${card.suit})`} />

        <text x="10" y="22" fontSize="18" fill={t.text} fontWeight="800">
          {rank}
        </text>
        <text x="12" y="40" fontSize="16" fill={t.text}>
          {suit}
        </text>

        {isFaceCard ? (
          theme === "arcane" ? (
            <g>
              {card.rank === "Jack" && (
                <g>
                  <line x1="50" y1="45" x2="50" y2="115" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="50" y1="50" x2="50" y2="110" stroke="#a855f7" strokeWidth="1.0" />
                  <path d="M43,62 Q50,66 57,62" fill="none" stroke="#fbbf24" strokeWidth="1.5" />
                  <path d="M40,52 Q50,58 60,52" fill="none" stroke="#fbbf24" strokeWidth="2" />
                  <polygon points="50,32 58,45 50,58 42,45" fill={`url(#face-frame-${theme}-${rank}-${card.suit})`} stroke="#fbbf24" strokeWidth="1.5" />
                  <circle cx="50" cy="45" r="3" fill="#ffffff" opacity="0.8" className="rune-p" />
                  <circle cx="50" cy="45" r="12" fill="none" stroke="#fbbf24" strokeWidth="0.75" strokeDasharray="3,3" opacity="0.6" className="arcane-rot" />
                </g>
              )}
              {card.rank === "Queen" && (
                <g>
                  <path d="M30,75 A20,20 0 0,0 70,75" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
                  <path d="M25,75 A25,25 0 0,0 75,75" fill="none" stroke="#a855f7" strokeWidth="1.5" strokeDasharray="4,4" />
                  <circle cx="50" cy="70" r="16" fill={`url(#face-glow-${theme}-${rank}-${card.suit})`} stroke="#c084fc" strokeWidth="1.5" />
                  <circle cx="50" cy="70" r="10" fill="none" stroke="#ffffff" strokeWidth="0.5" opacity="0.4" />
                  <polygon points="50,44 52,48 50,52 48,48" fill="#fbbf24" className="rune-p" />
                  <polygon points="35,68 37,70 35,72 33,70" fill="#fbbf24" className="rune-p" style={{ animationDelay: '1s' }} />
                  <polygon points="65,68 67,70 65,72 63,70" fill="#fbbf24" className="rune-p" style={{ animationDelay: '2s' }} />
                  <path d="M40,92 L60,92 L55,83 L45,83 Z" fill="#fbbf24" stroke="#a855f7" strokeWidth="1" />
                </g>
              )}
              {card.rank === "King" && (
                <g>
                  <polygon points="50,25 58,110 50,118 42,110" fill="none" stroke="#a855f7" strokeWidth="0.5" opacity="0.3" />
                  <path d="M46,42 L54,42 L53,108 L50,115 L47,108 Z" fill="#17062e" stroke="#c084fc" strokeWidth="1.5" />
                  <line x1="50" y1="44" x2="50" y2="105" stroke="#fbbf24" strokeWidth="1.0" strokeDasharray="3,5" />
                  <path d="M34,42 L66,42 L62,38 L38,38 Z" fill="#fbbf24" stroke="#a855f7" strokeWidth="1" />
                  <rect x="47" y="24" width="6" height="14" rx="2" fill="#fbbf24" />
                  <circle cx="50" cy="22" r="3.5" fill="#a855f7" stroke="#fbbf24" strokeWidth="0.75" />
                </g>
              )}
            </g>
          ) : theme === "mecha" ? (
            <g>
              {card.rank === "Jack" && (
                <g>
                  <path d="M46,30 L54,30 L54,105 L46,105 Z" fill="rgba(6,182,212,0.15)" />
                  <line x1="50" y1="30" x2="50" y2="102" stroke="#22d3ee" strokeWidth="4.5" strokeLinecap="round" />
                  <line x1="50" y1="32" x2="50" y2="100" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M38,102 L62,102 L58,107 L42,107 Z" fill="#0f172a" stroke="#f97316" strokeWidth="1.5" />
                  <rect x="47" y="107" width="6" height="16" fill="#1e293b" stroke="#06b6d4" strokeWidth="1" />
                  <rect x="49" y="123" width="2" height="4" fill="#f97316" />
                </g>
              )}
              {card.rank === "Queen" && (
                <g>
                  <polygon points="50,42 74,56 74,84 50,98 26,84 26,56" fill="none" stroke="#f97316" strokeWidth="0.75" opacity="0.6" className="mecha-h" />
                  <polygon points="50,52 66,61 50,70 34,61" fill="#0f172a" stroke="#22d3ee" strokeWidth="1.5" />
                  <polygon points="34,61 50,70 50,88 34,79" fill="#070c12" stroke="#22d3ee" strokeWidth="1.5" />
                  <polygon points="50,70 66,61 66,79 50,88" fill="#1e293b" stroke="#22d3ee" strokeWidth="1.5" />
                  <circle cx="50" cy="70" r="5" fill="#f97316" className="rune-p" />
                  <line x1="50" y1="36" x2="50" y2="46" stroke="#22d3ee" strokeWidth="1" strokeDasharray="2,2" />
                  <line x1="50" y1="94" x2="50" y2="104" stroke="#22d3ee" strokeWidth="1" strokeDasharray="2,2" />
                </g>
              )}
              {card.rank === "King" && (
                <g>
                  <polygon points="32,45 44,35 44,105 28,95" fill="#0f172a" stroke="#06b6d4" strokeWidth="1.5" />
                  <polygon points="68,45 56,35 56,105 72,95" fill="#0f172a" stroke="#06b6d4" strokeWidth="1.5" />
                  <polygon points="46,38 54,38 54,98 46,98" fill="#1e293b" stroke="#f97316" strokeWidth="1.5" />
                  <line x1="50" y1="44" x2="50" y2="92" stroke="#22d3ee" strokeWidth="2" className="rune-p" />
                  <circle cx="40" cy="44" r="1" fill="#f97316" />
                  <circle cx="60" cy="44" r="1" fill="#f97316" />
                  <circle cx="36" cy="94" r="1" fill="#06b6d4" />
                  <circle cx="64" cy="94" r="1" fill="#06b6d4" />
                </g>
              )}
            </g>
          ) : theme === "synthwave" ? (
            <g>
              {card.rank === "Jack" && (
                <g>
                  <polygon points="26,105 78,55 74,48 22,98" fill="#ff007f" stroke="#00f0ff" strokeWidth="1" />
                  <line x1="32" y1="92" x2="68" y2="57" stroke="#ffffff" strokeWidth="2.5" strokeDasharray="3,1" />
                  <polygon points="74,48 90,32 86,28 70,44" fill="#00f0ff" />
                  <circle cx="28" cy="94" r="2.5" fill="#f59e0b" />
                </g>
              )}
              {card.rank === "Queen" && (
                <g>
                  <rect x="25" y="52" width="50" height="32" rx="3" fill="#1d043b" stroke="#ff007f" strokeWidth="2" />
                  <rect x="31" y="57" width="38" height="15" fill="#00f0ff" opacity="0.8" />
                  <circle cx="42" cy="68" r="4.5" fill="#1d043b" stroke="#ff007f" strokeWidth="1" />
                  <circle cx="58" cy="68" r="4.5" fill="#1d043b" stroke="#ff007f" strokeWidth="1" />
                  <rect x="38" y="76" width="24" height="5" fill="#f59e0b" opacity="0.9" />
                </g>
              )}
              {card.rank === "King" && (
                <g>
                  <path d="M22,62 L78,62 L74,78 Q60,82 52,70 Q44,82 30,78 Z" fill="none" stroke="#00f0ff" strokeWidth="2" />
                  <polygon points="25,64 46,64 43,76 30,75" fill="#ff007f" opacity="0.65" />
                  <polygon points="54,64 75,64 70,75 57,76" fill="#ff007f" opacity="0.65" />
                  <line x1="28" y1="67" x2="38" y2="73" stroke="#ffffff" strokeWidth="1" opacity="0.8" />
                  <line x1="57" y1="67" x2="67" y2="73" stroke="#ffffff" strokeWidth="1" opacity="0.8" />
                  <line x1="46" y1="65" x2="54" y2="65" stroke="#f59e0b" strokeWidth="1.5" />
                </g>
              )}
            </g>
          ) : theme === "egypt" ? (
            <g>
              {card.rank === "Jack" && (
                <g>
                  <path d="M66,108 L40,54 Q33,40 45,35 Q55,38 48,50" fill="none" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="34" y1="108" x2="60" y2="54" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="60" y1="54" x2="72" y2="38" stroke="#06b6d4" strokeWidth="1.5" strokeDasharray="3,2" />
                  <line x1="60" y1="54" x2="77" y2="44" stroke="#06b6d4" strokeWidth="1.5" strokeDasharray="3,2" />
                </g>
              )}
              {card.rank === "Queen" && (
                <g>
                  <path d="M50,75 Q25,50 20,70 T48,84 Z" fill="none" stroke="#06b6d4" strokeWidth="1.5" />
                  <path d="M50,75 Q75,50 80,70 T52,84 Z" fill="none" stroke="#06b6d4" strokeWidth="1.5" />
                  <ellipse cx="50" cy="74" rx="7" ry="10" fill="#fbbf24" stroke="#06b6d4" strokeWidth="1" />
                  <circle cx="50" cy="62" r="2.5" fill="#fbbf24" />
                  <path d="M48,60 Q50,57 52,60" fill="none" stroke="#fbbf24" strokeWidth="0.75" />
                  <circle cx="50" cy="51" r="5" fill="#f59e0b" className="rune-p" />
                </g>
              )}
              {card.rank === "King" && (
                <g>
                  <polygon points="50,28 82,90 18,90" fill="none" stroke="#fbbf24" strokeWidth="1.5" />
                  <line x1="50" y1="28" x2="50" y2="90" stroke="#fbbf24" strokeWidth="0.5" opacity="0.4" />
                  <path d="M35,65 Q50,53 65,65 Q50,77 35,65 Z" fill="#2e1a05" stroke="#06b6d4" strokeWidth="1.5" />
                  <circle cx="50" cy="65" r="4.5" fill="#fbbf24" stroke="#06b6d4" strokeWidth="1" />
                  <path d="M43,72 L40,82 L47,78" fill="none" stroke="#06b6d4" strokeWidth="1.2" />
                  <path d="M57,72 Q59,84 65,80" fill="none" stroke="#06b6d4" strokeWidth="1.2" />
                </g>
              )}
            </g>
          ) : theme === "singularity" ? (
            <g>
              {card.rank === "Jack" && (
                <g>
                  <polygon points="50,34 78,50 78,86 50,102 22,86 22,50" fill="none" stroke="#ec4899" strokeWidth="1.5" />
                  <circle cx="50" cy="68" r="22" fill="none" stroke="#f97316" strokeWidth="0.75" strokeDasharray="6,8" className="sing-w" style={{ animationDuration: '6s' }} />
                  <circle cx="50" cy="68" r="16" fill="none" stroke="#ec4899" strokeWidth="0.75" strokeDasharray="4,6" className="sing-w" style={{ animationDirection: 'reverse', animationDuration: '4s' }} />
                  <circle cx="50" cy="68" r="8" fill="#000000" stroke="#ffffff" strokeWidth="1" className="rune-p" />
                </g>
              )}
              {card.rank === "Queen" && (
                <g>
                  <path d="M26,82 L34,48 L50,65 L66,48 L74,82 Z" fill="none" stroke="#ec4899" strokeWidth="1.5" />
                  <path d="M30,82 L38,54 L50,68 L62,54 L70,82" fill="none" stroke="#f97316" strokeWidth="1" opacity="0.7" />
                  <polygon points="34,42 36,46 34,50 32,46" fill="#ffffff" className="rune-p" />
                  <polygon points="50,59 52,63 50,67 48,63" fill="#ffffff" className="rune-p" style={{ animationDelay: '0.8s' }} />
                  <polygon points="66,42 68,46 66,50 64,46" fill="#ffffff" className="rune-p" style={{ animationDelay: '1.6s' }} />
                  <line x1="22" y1="82" x2="78" y2="82" stroke="#ec4899" strokeWidth="2" strokeLinecap="round" />
                </g>
              )}
              {card.rank === "King" && (
                <g>
                  <path d="M24,104 L24,54 A26,26 0 0,1 76,54 L76,104" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" />
                  <ellipse cx="50" cy="54" rx="20" ry="14" fill="none" stroke="#ec4899" strokeWidth="1.5" strokeDasharray="3,5" className="sing-w" />
                  <line x1="28" y1="62" x2="28" y2="102" stroke="#ec4899" strokeWidth="1.2" />
                  <line x1="72" y1="62" x2="72" y2="102" stroke="#ec4899" strokeWidth="1.2" />
                  <circle cx="50" cy="54" r="8" fill="#000000" stroke="#f97316" strokeWidth="1.2" />
                </g>
              )}
            </g>
          ) : theme === "glacier" ? (
            <g>
              {card.rank === "Jack" && (
                <g>
                  <polygon points="46,36 54,36 53,100 50,112 47,100" fill="#f0f9ff" stroke="#38bdf8" strokeWidth="1.5" />
                  <line x1="50" y1="38" x2="50" y2="108" stroke="#ffffff" strokeWidth="1" />
                  <polygon points="34,36 66,36 50,42" fill="#bae6fd" stroke="#0ea5e9" strokeWidth="1" />
                  <rect x="47" y="20" width="6" height="16" rx="1" fill="#07223d" stroke="#38bdf8" strokeWidth="0.75" />
                  <polygon points="50,14 53,17 50,20 47,17" fill="#ffffff" />
                </g>
              )}
              {card.rank === "Queen" && (
                <g>
                  <path d="M26,88 Q50,94 74,88" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />
                  <g transform="translate(50, 60)" className="glac-s">
                    <line x1="0" y1="-18" x2="0" y2="18" stroke="#ffffff" strokeWidth="1.5" />
                    <line x1="-16" y1="-9" x2="16" y2="9" stroke="#ffffff" strokeWidth="1.5" />
                    <line x1="-16" y1="9" x2="16" y2="-9" stroke="#ffffff" strokeWidth="1.5" />
                    <path d="M-4,-13 L0,-16 L4,-13 M-4,13 L0,16 L4,13" stroke="#38bdf8" strokeWidth="1" fill="none" />
                    <path d="M-13,-6 L-16,-9 L-13,-12 M13,6 L16,9 L13,12" stroke="#38bdf8" strokeWidth="1" fill="none" />
                    <path d="M-13,6 L-16,9 L-13,12 M13,-6 L16,-9 L13,-12" stroke="#38bdf8" strokeWidth="1" fill="none" />
                  </g>
                  <circle cx="28" cy="74" r="3" fill="#bae6fd" stroke="#38bdf8" strokeWidth="0.5" />
                  <circle cx="72" cy="74" r="3" fill="#bae6fd" stroke="#38bdf8" strokeWidth="0.5" />
                </g>
              )}
              {card.rank === "King" && (
                <g>
                  <polygon points="50,28 76,43 76,87 50,112 24,87 24,43" fill="#07223d" stroke="#38bdf8" strokeWidth="2" />
                  <polygon points="50,36 68,47 68,81 50,100 32,81 32,47" fill="none" stroke="#bae6fd" strokeWidth="1" opacity="0.8" />
                  <line x1="50" y1="28" x2="50" y2="112" stroke="#ffffff" strokeWidth="1.2" />
                  <line x1="24" y1="43" x2="76" y2="87" stroke="#38bdf8" strokeWidth="0.75" opacity="0.5" />
                  <line x1="24" y1="87" x2="76" y2="43" stroke="#38bdf8" strokeWidth="0.75" opacity="0.5" />
                  <polygon points="50,60 55,65 50,70 45,65" fill="#ffffff" stroke="#0ea5e9" strokeWidth="1" className="glac-s" />
                </g>
              )}
            </g>
          ) : theme === "biohazard" ? (
            <g>
              {card.rank === "Jack" && (
                <g>
                  <path d="M44,32 L44,48 L26,92 A6,6 0 0,0 32,100 L68,100 A6,6 0 0,0 74,92 L56,48 L56,32 Z" fill="none" stroke="#22c55e" strokeWidth="2" />
                  <path d="M30,82 Q50,85 70,82 L71,91 Q68,96 62,96 L38,96 Q32,96 29,91 Z" fill="#84cc16" opacity="0.85" className="rune-p" />
                  <circle cx="42" cy="88" r="1.5" fill="#bef264" />
                  <circle cx="58" cy="85" r="1.2" fill="#bef264" />
                  <circle cx="48" cy="91" r="1" fill="#ffffff" />
                  <rect x="42" y="27" width="16" height="5" rx="1" fill="#eab308" stroke="#22c55e" strokeWidth="1" />
                </g>
              )}
              {card.rank === "Queen" && (
                <g className="sing-w" style={{ animationDuration: '12s' }}>
                  <circle cx="50" cy="72" r="25" fill="none" stroke="#eab308" strokeWidth="1.5" strokeDasharray="8,6" />
                  <circle cx="50" cy="59" r="8" fill="none" stroke="#22c55e" strokeWidth="2" />
                  <circle cx="39" cy="78" r="8" fill="none" stroke="#22c55e" strokeWidth="2" />
                  <circle cx="61" cy="78" r="8" fill="none" stroke="#22c55e" strokeWidth="2" />
                  <circle cx="50" cy="72" r="5" fill="#bef264" stroke="#eab308" strokeWidth="1" />
                  <path d="M43,62 A11,11 0 0,0 57,62" fill="none" stroke="#22c55e" strokeWidth="1.5" />
                  <path d="M36,74 A11,11 0 0,0 47,84" fill="none" stroke="#22c55e" strokeWidth="1.5" />
                  <path d="M53,84 A11,11 0 0,0 64,74" fill="none" stroke="#22c55e" strokeWidth="1.5" />
                </g>
              )}
              {card.rank === "King" && (
                <g>
                  <rect x="25" y="44" width="50" height="56" rx="5" fill="#0c1a0c" stroke="#22c55e" strokeWidth="2" />
                  <circle cx="50" cy="72" r="18" fill="none" stroke="#eab308" strokeWidth="1.5" />
                  <line x1="50" y1="46" x2="50" y2="98" stroke="#22c55e" strokeWidth="1.2" />
                  <line x1="27" y1="72" x2="73" y2="72" stroke="#22c55e" strokeWidth="1.2" />
                  <polygon points="50,72 44,62 56,62" fill="#84cc16" className="rune-p" />
                  <polygon points="50,72 40,77 46,87" fill="#84cc16" className="rune-p" />
                  <polygon points="50,72 60,77 54,87" fill="#84cc16" className="rune-p" />
                  <circle cx="50" cy="72" r="3.5" fill="#0c1a0c" stroke="#eab308" strokeWidth="1" />
                </g>
              )}
            </g>
          ) : theme === "celestial" ? (
            <g>
              {card.rank === "Jack" && (
                <g>
                  <line x1="50" y1="26" x2="50" y2="124" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" />
                  <polygon points="50,22 55,34 50,46 45,34" fill="#ffffff" stroke="#f97316" strokeWidth="1" />
                  <circle cx="50" cy="75" r="9" fill="#ffffff" stroke="#fbbf24" strokeWidth="1.5" className="rune-p" />
                  <line x1="36" y1="75" x2="64" y2="75" stroke="#ffffff" strokeWidth="1.5" />
                </g>
              )}
              {card.rank === "Queen" && (
                <g>
                  <path d="M30,85 A20,20 0 0,1 70,85 A24,24 0 0,0 30,85 Z" fill="#fef08a" stroke="#fbbf24" strokeWidth="1.5" />
                  <circle cx="50" cy="55" r="14" fill="none" stroke="#fbbf24" strokeWidth="1" strokeDasharray="3,5" className="orbit-rot" />
                  <polygon points="50,49 53,52 50,55 47,52" fill="#ffffff" className="rune-p" />
                  <circle cx="50" cy="72" r="4" fill="#ffffff" />
                </g>
              )}
              {card.rank === "King" && (
                <g>
                  <g className="orbit-rot" style={{ animationDuration: '24s' }}>
                    <circle cx="50" cy="72" r="22" fill="none" stroke="#fbbf24" strokeWidth="1" strokeDasharray="4,6" />
                    <circle cx="50" cy="72" r="14" fill="none" stroke="#f97316" strokeWidth="0.75" strokeDasharray="2,4" />
                  </g>
                  <path d="M50,42 L55,54 L68,54 L58,62 L62,75 L50,67 L38,75 L42,62 L32,54 L45,54 Z" fill="#ffffff" stroke="#fbbf24" strokeWidth="2" />
                  <circle cx="50" cy="58" r="4.5" fill="#f97316" />
                </g>
              )}
            </g>
          ) : theme === "cyberpunk" ? (
            <g>
              {card.rank === "Jack" && (
                <g>
                  <rect x="28" y="44" width="44" height="62" rx="4" fill="#09090b" stroke="#ec4899" strokeWidth="2" />
                  <path d="M36,54 L44,54 L44,74 L64,74" fill="none" stroke="#06b6d4" strokeWidth="1.5" />
                  <circle cx="64" cy="74" r="2.5" fill="#22c55e" />
                  <circle cx="36" cy="54" r="2" fill="#06b6d4" />
                  <rect x="42" y="86" width="16" height="8" fill="#ec4899" opacity="0.8" className="rune-p" />
                </g>
              )}
              {card.rank === "Queen" && (
                <g>
                  <path d="M22,70 L78,70 L74,84 L26,84 Z" fill="#09090b" stroke="#06b6d4" strokeWidth="2" />
                  <line x1="26" y1="77" x2="74" y2="77" stroke="#ec4899" strokeWidth="1.5" className="mecha-s" />
                  <path d="M50,70 L50,56 L64,52" fill="none" stroke="#22c55e" strokeWidth="1.2" />
                  <circle cx="64" cy="52" r="2" fill="#22c55e" />
                </g>
              )}
              {card.rank === "King" && (
                <g>
                  <polygon points="50,34 76,49 76,96 50,111 24,96 24,49" fill="#0c0a0f" stroke="#22c55e" strokeWidth="2" />
                  <circle cx="50" cy="72" r="16" fill="none" stroke="#06b6d4" strokeWidth="1.5" strokeDasharray="6,4" />
                  <circle cx="50" cy="72" r="8" fill="#ec4899" className="rune-p" />
                  <line x1="28" y1="53" x2="72" y2="92" stroke="#22c55e" strokeWidth="0.75" opacity="0.6" />
                </g>
              )}
            </g>
          ) : theme === "abyss" ? (
            <g>
              {card.rank === "Jack" && (
                <g>
                  <path d="M50,22 L56,66 L52,106 L50,112 L48,106 L44,66 Z" fill="#040108" stroke="#a855f7" strokeWidth="2" />
                  <path d="M50,32 L53,68 L50,96 L47,68 Z" fill="#d946ef" opacity="0.75" className="rune-p" />
                  <path d="M36,75 C42,72 48,78 50,75 C52,78 58,72 64,75" fill="none" stroke="#06b6d4" strokeWidth="1.2" />
                </g>
              )}
              {card.rank === "Queen" && (
                <g>
                  <path d="M22,86 L30,42 L42,65 L50,34 L58,65 L70,42 L78,86 Z" fill="none" stroke="#d946ef" strokeWidth="2" />
                  <ellipse cx="50" cy="80" rx="22" ry="6" fill="#040108" stroke="#a855f7" strokeWidth="1" />
                  <circle cx="30" cy="38" r="2.5" fill="#06b6d4" />
                  <circle cx="50" cy="30" r="3" fill="#06b6d4" />
                  <circle cx="70" cy="38" r="2.5" fill="#06b6d4" />
                </g>
              )}
              {card.rank === "King" && (
                <g>
                  <circle cx="50" cy="72" r="24" fill="none" stroke="#a855f7" strokeWidth="2" strokeDasharray="10,6" className="sing-w" style={{ animationDuration: '7s' }} />
                  <circle cx="50" cy="72" r="16" fill="#000000" stroke="#d946ef" strokeWidth="1.5" />
                  <circle cx="50" cy="72" r="8" fill="#06b6d4" className="rune-p" />
                </g>
              )}
            </g>
          ) : theme === "chronos" ? (
            <g>
              {card.rank === "Jack" && (
                <g>
                  <path d="M34,44 L66,44 L62,72 Q50,77 38,72 Z" fill="#2e1e07" stroke="#d97706" strokeWidth="1.5" />
                  <path d="M38,78 Q50,73 62,78 L66,106 L34,106 Z" fill="#2e1e07" stroke="#d97706" strokeWidth="1.5" />
                  <polygon points="50,60 52,72 50,102 48,72" fill="#fbbf24" opacity="0.8" className="rune-p" />
                  <line x1="30" y1="44" x2="70" y2="44" stroke="#d97706" strokeWidth="3.5" strokeLinecap="round" />
                  <line x1="30" y1="106" x2="70" y2="106" stroke="#d97706" strokeWidth="3.5" strokeLinecap="round" />
                </g>
              )}
              {card.rank === "Queen" && (
                <g className="orbit-rot" style={{ animationDuration: '10s' }}>
                  <circle cx="50" cy="72" r="22" fill="none" stroke="#d97706" strokeWidth="1.8" strokeDasharray="5,3" />
                  <circle cx="50" cy="72" r="14" fill="none" stroke="#fbbf24" strokeWidth="1.2" strokeDasharray="3,1" />
                  <line x1="50" y1="50" x2="50" y2="94" stroke="#0d9488" strokeWidth="1.5" />
                  <line x1="28" y1="72" x2="72" y2="72" stroke="#0d9488" strokeWidth="1.5" />
                </g>
              )}
              {card.rank === "King" && (
                <g>
                  <circle cx="50" cy="62" r="14" fill="none" stroke="#d97706" strokeWidth="2" strokeDasharray="8,6" className="arcane-rot" />
                  <circle cx="36" cy="84" r="10" fill="none" stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="6,4" className="arcane-rot" style={{ animationDirection: 'reverse' }} />
                  <circle cx="64" cy="84" r="10" fill="none" stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="6,4" className="arcane-rot" />
                  <line x1="50" y1="62" x2="50" y2="48" stroke="#ffffff" strokeWidth="1.5" />
                  <line x1="50" y1="62" x2="60" y2="62" stroke="#ffffff" strokeWidth="1" />
                  <circle cx="50" cy="62" r="2.5" fill="#0d9488" />
                </g>
              )}
            </g>
          ) : theme === "inferno" ? (
            <g>
              {card.rank === "Jack" && (
                <g>
                  <line x1="50" y1="60" x2="50" y2="120" stroke="#ea580c" strokeWidth="3" strokeLinecap="round" />
                  <line x1="50" y1="60" x2="50" y2="114" stroke="#dc2626" strokeWidth="1.2" />
                  <path d="M38,50 Q50,22 62,50 Q50,65 38,50 Z" fill="#ea580c" stroke="#facc15" strokeWidth="1.5" className="rune-p" />
                  <path d="M44,48 Q50,32 56,48 Q50,58 44,48 Z" fill="#ffffff" />
                </g>
              )}
              {card.rank === "Queen" && (
                <g>
                  <path d="M22,86 Q50,78 78,86 L70,48 L50,70 L30,48 Z" fill="#290505" stroke="#ea580c" strokeWidth="1.8" />
                  <path d="M32,44 C42,28 46,38 50,22 C54,38 58,28 68,44" fill="none" stroke="#facc15" strokeWidth="1.2" strokeLinecap="round" className="rune-p" />
                  <circle cx="50" cy="50" r="4" fill="#dc2626" />
                </g>
              )}
              {card.rank === "King" && (
                <g>
                  <rect x="26" y="44" width="48" height="54" rx="4" fill="#140202" stroke="#ea580c" strokeWidth="2.5" />
                  <path d="M32,60 L68,60 L68,92 L32,92 Z" fill="none" stroke="#dc2626" strokeWidth="1" strokeDasharray="3,5" />
                  <polygon points="50,44 64,54 50,64 36,54" fill="#ea580c" stroke="#facc15" strokeWidth="1.2" className="rune-p" />
                  <line x1="50" y1="64" x2="50" y2="92" stroke="#ffffff" strokeWidth="1.5" />
                </g>
              )}
            </g>
          ) : theme === "cosmogenesis" ? (
            <g>
              {card.rank === "Jack" && (
                <g>
                  <line x1="50" y1="28" x2="50" y2="120" stroke="#e9d5ff" strokeWidth="3.5" strokeLinecap="round" />
                  <line x1="50" y1="35" x2="50" y2="115" stroke="#8b5cf6" strokeWidth="1.2" />
                  <circle cx="50" cy="40" r="10" fill="none" stroke="#e9d5ff" strokeWidth="1.5" />
                  <polygon points="50,25 54,36 50,47 46,36" fill="#ffffff" className="rune-p" />
                  <line x1="32" y1="40" x2="68" y2="40" stroke="#ffffff" strokeWidth="1" opacity="0.6" />
                  <line x1="50" y1="22" x2="50" y2="58" stroke="#ffffff" strokeWidth="1" opacity="0.6" />
                </g>
              )}
              {card.rank === "Queen" && (
                <g>
                  <g className="nebula-e" style={{ animationDuration: '6s' }}>
                    <circle cx="50" cy="72" r="28" fill="none" stroke="#e9d5ff" strokeWidth="1" strokeDasharray="4,8" />
                    <circle cx="50" cy="72" r="18" fill="none" stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="3,6" />
                  </g>
                  <path d="M26,82 L34,48 L50,66 L66,48 L74,82 Z" fill="#0f111a" stroke="#e9d5ff" strokeWidth="2" />
                  <circle cx="50" cy="74" r="5" fill="#8b5cf6" className="rune-p" />
                </g>
              )}
              {card.rank === "King" && (
                <g>
                  <g className="orbit-rot" style={{ animationDuration: '10s' }}>
                    <path d="M50,72 Q65,40 50,22 Q35,40 50,72 Z" fill="none" stroke="#e9d5ff" strokeWidth="1" />
                    <path d="M50,72 Q80,72 50,112 Q20,72 50,72 Z" fill="none" stroke="#8b5cf6" strokeWidth="1" />
                  </g>
                  <circle cx="50" cy="72" r="16" fill="#030712" stroke="#ffffff" strokeWidth="2.5" />
                  <circle cx="50" cy="72" r="8" fill="#8b5cf6" className="rune-p" />
                </g>
              )}
            </g>
          ) : theme === "hyperdrive" ? (
            <g>
              {card.rank === "Jack" && (
                <g>
                  <rect x="34" y="38" width="32" height="74" rx="6" fill="#080e1e" stroke="#06b6d4" strokeWidth="2.5" />
                  <line x1="50" y1="46" x2="50" y2="104" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" className="rune-p" />
                  <line x1="42" y1="42" x2="42" y2="108" stroke="#a5f3fc" strokeWidth="1.2" strokeDasharray="4,8" />
                  <line x1="58" y1="42" x2="58" y2="108" stroke="#a5f3fc" strokeWidth="1.2" strokeDasharray="4,8" />
                </g>
              )}
              {card.rank === "Queen" && (
                <g className="orbit-rot" style={{ animationDuration: '14s' }}>
                  <circle cx="50" cy="72" r="26" fill="none" stroke="#06b6d4" strokeWidth="2.5" strokeDasharray="12,6,4,6" />
                  <circle cx="50" cy="72" r="18" fill="none" stroke="#a5f3fc" strokeWidth="1" strokeDasharray="2,4" />
                  <polygon points="50,48 54,58 46,58" fill="#ffffff" />
                  <polygon points="50,96 54,86 46,86" fill="#ffffff" />
                </g>
              )}
              {card.rank === "King" && (
                <g>
                  <circle cx="50" cy="72" r="28" fill="none" stroke="#06b6d4" strokeWidth="3" />
                  <circle cx="50" cy="72" r="22" fill="none" stroke="#ffffff" strokeWidth="1" strokeDasharray="6,4" className="orbit-rot" style={{ animationDuration: '8s' }} />
                  <rect x="28" y="68" width="44" height="8" rx="2" fill="#080e1e" stroke="#a5f3fc" strokeWidth="1.5" />
                  <circle cx="50" cy="72" r="4" fill="#06b6d4" className="rune-p" />
                </g>
              )}
            </g>
          ) : theme === "alchemist" ? (
            <g>
              {card.rank === "Jack" && (
                <g>
                  <path d="M42,40 L58,40 L58,54 L72,88 A16,16 0 0,1 50,110 A16,16 0 0,1 28,88 L42,54 Z" fill="none" stroke="#fbbf24" strokeWidth="2" />
                  <path d="M34,88 A10,10 0 0,0 50,98 A10,10 0 0,0 66,88 Z" fill="#d97706" opacity="0.8" className="liquid-f" />
                  <circle cx="46" cy="85" r="1.5" fill="#ffffff" className="bio-b" style={{ animationDuration: '2s' }} />
                  <circle cx="54" cy="78" r="1" fill="#ffffff" className="bio-b" style={{ animationDuration: '2.5s', animationDelay: '0.8s' }} />
                </g>
              )}
              {card.rank === "Queen" && (
                <g>
                  <path d="M30,55 A22,22 0 0,0 70,55 Q50,72 30,55" fill="none" stroke="#fbbf24" strokeWidth="2" />
                  <path d="M50,75 C53,82 56,86 50,94 C44,86 47,82 50,75" fill="#fbbf24" className="rune-p" />
                  <circle cx="50" cy="62" r="6" fill="#14b8a6" stroke="#fbbf24" strokeWidth="1" />
                </g>
              )}
              {card.rank === "King" && (
                <g>
                  <g className="rune-s" style={{ animationDuration: '18s' }}>
                    <circle cx="50" cy="72" r="28" fill="none" stroke="#fbbf24" strokeWidth="1.8" />
                    <polygon points="50,44 74,86 26,86" fill="none" stroke="#fbbf24" strokeWidth="1" />
                    <polygon points="50,100 74,58 26,58" fill="none" stroke="#fbbf24" strokeWidth="1" />
                  </g>
                  <circle cx="50" cy="72" r="10" fill="#271808" stroke="#14b8a6" strokeWidth="2" />
                  <polygon points="50,68 53,74 47,74" fill="#ffffff" className="rune-p" />
                </g>
              )}
            </g>
          ) : (
            <image
              href={squirrelImg}
              x="0"
              y="25"
              width="90"
              height="100"
              preserveAspectRatio="xMidYMid meet"
            />
          )
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

export function GameHeader({ scores, eyes, lastTrick, deck }) {
  const spectatorCount = useGameStore((s) => s.spectatorCount);

  return (
    <div className="w-full px-4 py-2 mb-4 rounded-lg bg-[#1a1a2e]/90 backdrop-blur border border-purple-500/30">
      <div className="grid grid-cols-[1fr_auto_136px] sm:grid-cols-[1fr_auto_160px] items-center gap-3">
        <div className="w-full min-w-0">
          <div className="hidden sm:flex items-center justify-start gap-6 font-bold text-sm min-w-0">
            <span className="text-amber-400 flex items-center gap-1 whitespace-nowrap">
              🐺 {scores?.kaskyr ?? 0} / {eyes?.kaskyr ?? 0}
            </span>
            <span className="text-purple-400 flex items-center gap-1 whitespace-nowrap">
              ⚡ {scores?.uzi ?? 0} / {eyes?.uzi ?? 0}
            </span>
          </div>

          <div className="sm:hidden flex flex-col gap-1 font-bold text-sm">
            <span className="text-amber-400 flex items-center gap-1">
              🐺 {scores?.kaskyr ?? 0} / {eyes?.kaskyr ?? 0}
            </span>
            <span className="text-purple-400 flex items-center gap-1">
              ⚡ {scores?.uzi ?? 0} / {eyes?.uzi ?? 0}
            </span>
          </div>
        </div>

        <div className="h-10 sm:h-6 w-px bg-white/10" />

        <div className="w-[136px] sm:w-[160px] flex justify-end">
          <div className="flex gap-1 items-center">
            {(lastTrick || []).slice(0, 4).map(([pos, card], idx) => (
              <div
                key={`${pos}-${card.rank}-${card.suit}-${idx}`}
                title={`${pos}: ${rankLabel[card.rank] ?? card.rank}${suitSymbol[card.suit] ?? card.suit}`}
              >
                <CardFace card={card} compact theme={deck} />
              </div>
            ))}
          </div>
        </div>
      </div>
      {spectatorCount > 0 && (
        <div className="mt-2 text-xs text-blue-300 font-semibold w-full text-left">
          👁 Наблюдают: {spectatorCount}
        </div>
      )}
    </div>
  );
}

function TrumpBadge({ trump }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div
        className={`
          w-16 h-16 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm
          flex items-center justify-center text-4xl font-bold
          shadow-[0_0_25px_rgba(255,255,255,0.06)]
          ${suitColorClass(trump)}
        `}
      >
        {suitSymbol[trump] ?? trump}
      </div>
    </div>
  );
}

function TurnChip({ visible }) {
  if (!visible) return <div className="h-[18px]" />;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-400/30 font-semibold"
    >
      Ход
    </motion.div>
  );
}

export function PlayerBadge({ player, isCurrent, seat, isDisconnected, isClubJackOwner }) {
  const team = teamMeta[player.team] || teamMeta.kaskyr;
  const [timeLeft, setTimeLeft] = useState(60);
  const [showInGameProfile, setShowInGameProfile] = useState(null);
  const [showTauntMenu, setShowTauntMenu] = useState(false);

  useEffect(() => {
    if (isCurrent && !isDisconnected) {
      if (seat === "bottom") playMyTurnSound();
      setTimeLeft(60);
      const int = setInterval(() => {
        setTimeLeft(prev => {
          const next = prev - 1;
          if (next <= 10 && next > 0) playTickSound();
          return next;
        });
      }, 1000);
      return () => clearInterval(int);
    } else {
      setTimeLeft(60);
    }
  }, [isCurrent, isDisconnected, seat]);

  const isDanger = timeLeft <= 30;
  const activeTaunt = useGameStore(s => s.activeTaunts[player.position]);

  return (
    <div className="relative flex flex-col items-center gap-1 min-w-[84px]">
      <div className="relative">
        <motion.img
          layoutId={`avatar-${player.meta.id}`}
          onClick={() => {
             if (player.onClick) player.onClick();
          }}
          src={player.meta.photo_url || player.meta.avatar || `https://api.dicebear.com/7.x/thumbs/svg?seed=${player.meta.username || player.meta.id}`}
          className={`
            w-12 h-12 rounded-full object-cover border-2 transition-all duration-300 cursor-pointer
            ${team.border} ${team.ring}
            ${isCurrent ? (seat === "bottom" ? "scale-125 shadow-[0_0_20px_rgba(255,255,255,0.4)]" : "scale-110") : ""}
            ${isDisconnected ? "opacity-40 grayscale" : ""}
          `}
        />
        {isCurrent && !isDisconnected && (
          <svg className="absolute inset-[-4px] w-[56px] h-[56px] -rotate-90 pointer-events-none transition-transform duration-300 scale-110 z-10 overflow-visible">
            <motion.circle
              cx="28"
              cy="28"
              r="26"
              stroke={isDanger ? "#ef4444" : "#34d399"}
              strokeWidth="2"
              strokeLinecap="round"
              fill="transparent"
              strokeDasharray="163.36"
              initial={{ strokeDashoffset: 0 }}
              animate={{ strokeDashoffset: 163.36 }}
              transition={{ duration: 60, ease: "linear" }}
              className={isDanger ? "drop-shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse" : "drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]"}
            />
          </svg>
        )}
        {isClubJackOwner && (
          <div className="absolute -top-2 -right-2 z-20 bg-amber-500/90 border-2 border-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.8)] text-white w-6 h-6 flex items-center justify-center rounded-full text-xs">
            ♣
          </div>
        )}

        {/* Taunt Overlay */}
        {activeTaunt && (
          <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-[100] pointer-events-none flex flex-col items-center">
            <motion.div
              initial={{ scale: 0, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0, opacity: 0, y: 10 }}
              transition={{ type: "spring", bounce: 0.6 }}
              className="bg-black/80 rounded-2xl p-2 border border-purple-500/80 shadow-[0_0_20px_rgba(168,85,247,0.6)] flex items-center justify-center min-w-[44px] min-h-[44px] relative"
            >
               <span className="text-3xl leading-none block flex items-center justify-center">
                  {renderTauntGraphic(activeTaunt)}
               </span>
               <div className="absolute -bottom-[8px] left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-purple-500/80"></div>
            </motion.div>
          </div>
        )}
      </div>

      <div className="text-xs text-gray-200 text-center flex flex-col items-center gap-1 relative">
        {seat === "bottom" ? (
          <span className="font-bold text-amber-300 flex items-center gap-1 justify-center">
            Вы
            {player.meta.id > 0 && <span className="text-[9px] text-fuchsia-300 font-bold border border-fuchsia-500/30 rounded px-1 bg-black/40 shadow-[0_0_5px_rgba(217,70,239,0.3)]">Lv.{Math.floor(Math.sqrt((player.meta.xp || 0) / 100)) + 1}</span>}
          </span>
        ) : (
          <span className="font-semibold truncate max-w-[100px] flex items-center justify-center gap-1" title={player.meta.username || `Player ${player.meta.id}`}>
             <span className="truncate">{player.meta.username || `Player ${player.meta.id}`}</span>
             {player.meta.id > 0 && <span className="text-[9px] text-fuchsia-300 font-bold border border-fuchsia-500/30 rounded px-1 bg-black/40 shadow-[0_0_5px_rgba(217,70,239,0.3)] shrink-0">Lv.{Math.floor(Math.sqrt((player.meta.xp || 0) / 100)) + 1}</span>}
          </span>
        )}
      </div>

      <div className="h-[18px] flex items-center justify-center">
        <AnimatePresence mode="wait">
          {isDisconnected ? (
            <motion.div
              key="offline"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-[10px] text-red-400 font-semibold"
            >
              offline
            </motion.div>
          ) : (
            <TurnChip visible={isCurrent} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function PlayingCard({ card, onClick, clickable = false, compact = false, theme = "neon", highlighted = false }) {
  return (
    <motion.div
      whileHover={clickable ? { y: -12, rotate: 0 } : undefined}
      onClick={onClick}
      className={`${clickable ? "cursor-pointer" : "cursor-default"} relative`}
      animate={highlighted ? { y: [0, -10, 0] } : {}}
      transition={highlighted ? { repeat: Infinity, duration: 1.5, ease: "easeInOut" } : {}}
    >
      <div className={`transition-all duration-300 ${highlighted ? "ring-4 ring-yellow-400/80 shadow-[0_0_20px_rgba(250,204,21,0.6)] rounded-[8px]" : ""}`}>
        <CardFace card={card} compact={compact} theme={theme} />
      </div>
    </motion.div>
  );
}

function startOffsetBySeat(seat) {
  switch (seat) {
    case "top":
      return { x: 0, y: -120 };
    case "bottom":
      return { x: 0, y: 120 };
    case "left":
      return { x: -120, y: 0 };
    case "right":
      return { x: 120, y: 0 };
    default:
      return { x: 0, y: 0 };
  }
}

function targetOffsetBySeat(seat) {
  switch (seat) {
    case "top":
      return { x: 0, y: -180, scale: 0.55, opacity: 0.15 };
    case "bottom":
      return { x: 0, y: 180, scale: 0.55, opacity: 0.15 };
    case "left":
      return { x: -180, y: 0, scale: 0.55, opacity: 0.15 };
    case "right":
      return { x: 180, y: 0, scale: 0.55, opacity: 0.15 };
    default:
      return { x: 0, y: 0, scale: 0.55, opacity: 0.15 };
  }
}

function FinalResultsOverlay({ snapshot, finalScores, me }) {
  const winnerTeam = useMemo(() => {
    const k = finalScores?.kaskyr ?? 0;
    const u = finalScores?.uzi ?? 0;
    if (k === u) return null;
    return k > u ? "kaskyr" : "uzi";
  }, [finalScores]);

  const myTeam = me?.team ?? null;
  const iWon = winnerTeam && myTeam === winnerTeam;

  const title = winnerTeam ? (iWon ? "Ты выиграл" : "Ты проиграл") : "Игра завершена";
  const subtitle = winnerTeam ? `Победила команда ${teamMeta[winnerTeam]?.name}` : "Ничья";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-50 bg-black/75 backdrop-blur-lg flex items-center justify-center p-4 overflow-hidden"
    >
      {/* Лучи света для победителей (если мы победили) */}
      {iWon && (
         <div className="absolute top-1/2 left-1/2 w-[200%] h-[200%] -translate-x-1/2 -translate-y-1/2 opacity-20 pointer-events-none">
            <div className="absolute inset-0 bg-[conic-gradient(from_0deg,transparent_0_340deg,white_360deg)] animate-spin" style={{ animationDuration: '8s' }}/>
            <div className="absolute inset-0 bg-[conic-gradient(from_180deg,transparent_0_340deg,white_360deg)] animate-spin" style={{ animationDuration: '8s', animationDirection: 'reverse' }}/>
         </div>
      )}

      <motion.div
        initial={{ scale: 0.96, y: 10, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ duration: 0.4, type: "spring", bounce: 0.4 }}
        className="relative z-10 w-full max-w-[520px] rounded-[32px] border-2 border-white/10 bg-[#131325]/95 shadow-[0_0_80px_rgba(124,58,237,0.4)] p-5 sm:p-8"
      >
        <div className="text-center mb-6">
          <div
            className={`text-3xl sm:text-4xl font-extrabold ${iWon ? "text-emerald-300" : winnerTeam ? "text-rose-300" : "text-white"
              }`}
          >
            {title}
          </div>
          <div className="text-sm text-gray-300 mt-2">{subtitle}</div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <div
            className={`rounded-2xl p-4 bg-gradient-to-br ${teamMeta.kaskyr.panel}
                        border ${winnerTeam === "kaskyr" ? "border-amber-400/40" : "border-white/10"}`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-amber-300 font-semibold">🐺 Каскыр</div>
            </div>
            <div className="text-2xl font-bold text-white">{finalScores?.kaskyr ?? 0}</div>
          </div>

          <div
            className={`rounded-2xl p-4 bg-gradient-to-br ${teamMeta.uzi.panel}
                        border ${winnerTeam === "uzi" ? "border-purple-400/40" : "border-white/10"}`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-purple-300 font-semibold">⚡ Узи</div>
            </div>
            <div className="text-2xl font-bold text-white">{finalScores?.uzi ?? 0}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {(snapshot?.players || []).map((player, idx) => {
            const team = teamMeta[player.team] || teamMeta.kaskyr;
            const isWinner = winnerTeam ? player.team === winnerTeam : false;
            const isMe = me?.meta?.id === player.meta.id;

            return (
              <motion.div
                key={player.meta.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.06 }}
                className={`rounded-2xl p-3 border flex items-center gap-3 ${isWinner ? "bg-white/10 border-white/15" : "bg-white/5 border-white/10 opacity-80"
                  }`}
              >
                <img
                  src={player.meta.photo_url || "https://placehold.co/100x100?text=Player"}
                  className={`w-12 h-12 rounded-full object-cover border-2 ${team.border} ${team.ring} ${isWinner ? team.glow : ""
                    }`}
                />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-sm font-semibold text-white truncate">
                      {isMe ? "Вы" : player.meta.username || `Player ${player.meta.id}`}
                    </div>
                    <div className={`text-[10px] px-2 py-0.5 rounded-full ${team.badge}`}>
                      {team.icon} {team.name}
                    </div>
                  </div>
                  <div className="text-xs mt-1 font-bold">
                    {winnerTeam ? (
                      isWinner ? (
                        <div className="flex items-center gap-2">
                           <span className="text-emerald-300">Победитель</span>
                           <motion.span 
                             initial={{ opacity: 0, x: -10 }}
                             animate={{ opacity: 1, x: 0 }}
                             transition={{ delay: 1 + idx * 0.2, type: "spring" }}
                             className="text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.8)] px-2 bg-green-500/20 rounded-md"
                           >
                             +25 🏆
                           </motion.span>
                        </div>
                      ) : (
                         <div className="flex items-center gap-2">
                           <span className="text-rose-300">Проиграл</span>
                           <motion.span 
                             initial={{ opacity: 0, x: -10 }}
                             animate={{ opacity: 1, x: 0 }}
                             transition={{ delay: 1 + idx * 0.2, type: "spring" }}
                             className="text-red-400 px-2 bg-red-500/20 rounded-md"
                           >
                             -25 💔
                           </motion.span>
                        </div>
                      )
                    ) : (
                      <span className="text-gray-300">Завершил игру</span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-5 text-center text-xs text-gray-400">
          Возврат в лобби через несколько секунд...
        </div>
      </motion.div>
    </motion.div>
  );
}

function getHandGap(len) {
  // Некомпактные карты (ширина 64px)
  if (len < 5) return "4px";
  if (len === 5) return "-4px";
  if (len === 6) return "-12px";
  if (len === 7) return "-16px";

  // Компактные карты (ширина 48px)
  if (len === 8) return "-4px";
  if (len === 9) return "-10px";
  if (len === 10) return "-14px";
  if (len <= 12) return "-20px";
  if (len <= 14) return "-24px";
  return "-28px";
}

function NutThrowAnimation({ activeThrows, playersBySeat }) {
  if (!activeThrows || activeThrows.length === 0) return null;
  const SEAT_POSITIONS = {
    bottom: { x: "50vw", y: "85vh" },
    top: { x: "50vw", y: "15vh" },
    left: { x: "15vw", y: "50vh" },
    right: { x: "85vw", y: "50vh" }
  };

  const getSeatCoords = (id) => {
    for (const [seat, p] of Object.entries(playersBySeat)) {
      if (p && p.meta && p.meta.id === id) {
        return SEAT_POSITIONS[seat];
      }
    }
    return null;
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-[200] overflow-hidden">
      {activeThrows.map(t => {
        const fromPos = getSeatCoords(t.from_id);
        const toPos = getSeatCoords(t.to_id);
        if (!fromPos || !toPos) return null;
        return (
          <motion.div
            key={t.id}
            initial={{ opacity: 1, left: fromPos.x, top: fromPos.y, scale: 0.5, rotate: 0 }}
            animate={{ 
              left: [fromPos.x, toPos.x],
              top: [fromPos.y, "40vh", toPos.y],
              scale: [1, 2.5, 1],
              rotate: [0, 180, 360]
            }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="absolute -ml-6 -mt-6 text-6xl drop-shadow-[0_0_15px_rgba(217,119,6,1)]"
          >
            🥜
          </motion.div>
        );
      })}
    </div>
  );
}

export default function GameTable() {
  const navigate = useNavigate();
  const snapshot = useGameStore((s) => s.gameSnapshot);
  const activeThrows = useGameStore((s) => s.activeThrows) || [];
  const gameHint = useGameStore((s) => s.gameHint);

  const handStore = useGameStore((s) => s.yourHand);
  const user = useGameStore((s) => s.user);

  const me = useMemo(() => {
    if (!snapshot || !user) return null;
    return snapshot.players.find((p) => p.meta.id === user.id) || null;
  }, [snapshot, user]);

  const myPosition = me?.position || null;
  const activeTrump = snapshot?.trump;

  const [localHand, setLocalHand] = useState(handStore || []);

  useEffect(() => {
    setLocalHand(prev => {
      const getCardWeight = (card) => {
        if (card.rank === "Jack") {
          // Jacks are highest trumps. Order: Clubs > Spades > Hearts > Diamonds
          const jackOrder = { "Clubs": 4000, "Spades": 3000, "Hearts": 2000, "Diamonds": 1000 };
          return 10000 + (jackOrder[card.suit] || 0);
        }

        const rankOrder = { "Ace": 70, "Ten": 60, "King": 50, "Queen": 40, "Nine": 30, "Eight": 20, "Seven": 10 };
        const suitOrder = { "Clubs": 400, "Spades": 300, "Hearts": 200, "Diamonds": 100 };
        
        let weight = rankOrder[card.rank] || 0;
        
        if (activeTrump && card.suit === activeTrump) {
          // Trump suit cards are above normal suits but below Jacks
          weight += 5000;
        } else {
          weight += (suitOrder[card.suit] || 0);
        }
        
        return weight;
      };

      let nextHand = [...(handStore || [])];
      nextHand.sort((a, b) => getCardWeight(b) - getCardWeight(a));

      const prevKeys = prev.map(c => `${c.rank}-${c.suit}`).join(',');
      const newKeys = nextHand.map(c => `${c.rank}-${c.suit}`).join(',');
      
      if (prevKeys === newKeys && prev.length === nextHand.length) return prev;
      return nextHand;
    });
  }, [handStore, activeTrump]);

  const hand = localHand;
  const trickWinner = useGameStore((s) => s.trickWinner);

  const disconnectedPositions = useGameStore((s) => s.disconnectedPositions || []);
  const gameOver = useGameStore((s) => s.gameOver);
  const finalScores = useGameStore((s) => s.finalScores);

  const incomingJoinRequest = useGameStore(s => s.incomingJoinRequest);
  const clearIncomingJoinRequest = useGameStore(s => s.clearIncomingJoinRequest);
  const hasBots = useMemo(() => snapshot?.players?.some(p => p.meta.is_bot && p.meta.id < 0), [snapshot]);

  const deck = useGameStore((s) => s.user?.equipped_deck || "classic");
  const bg = useGameStore((s) => s.user?.equipped_background || "neon");
  const isSpectating = useGameStore((s) => s.isSpectating);
  const bgTheme = getBackground(bg);

  const [showSurrenderModal, setShowSurrenderModal] = useState(false);
  const [showFriendSelectorModal, setShowFriendSelectorModal] = useState(false);
  const [targetBotId, setTargetBotId] = useState(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [profilePlayer, setProfilePlayer] = useState(null);
  const [showTauntMenu, setShowTauntMenu] = useState(false);
  const [showSlotsModal, setShowSlotsModal] = useState(false);
  const [availableTaunts, setAvailableTaunts] = useState(["🐿", "😡", "😂"]);
  const roleModalShownRef = useRef(false);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (token) {
      axios.get(getUrl("/v1/store"), { headers: { Authorization: `Bearer ${token}` } })
        .then(res => {
          if (res.data?.taunts) {
            const ownedKeys = res.data.taunts.filter(t => t.owned).map(t => t.item_key);
            setAvailableTaunts(prev => Array.from(new Set([...prev, ...ownedKeys])));
          }
        })
        .catch(e => console.error("Failed to load taunts", e));
    }
  }, []);

  const [flyCards, setFlyCards] = useState([]);
  const [staticDelayActive, setStaticDelayActive] = useState(false);

  useEffect(() => {
    if (snapshot?.player_trump_map && !roleModalShownRef.current && Object.keys(snapshot.player_trump_map).length > 0) {
      roleModalShownRef.current = true;
      setShowRoleModal(true);
      setTimeout(() => {
        setShowRoleModal(false);
      }, 5000);
    }
  }, [snapshot?.player_trump_map]);

  useEffect(() => {
    if (gameOver) {
      const timer = setTimeout(() => {
        useGameStore.getState().clearGame();
        navigate("/find");
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [gameOver, navigate]);

  const paused = disconnectedPositions.length > 0;

  const [now, setNow] = useState(Date.now());
  const disconnectAtRef = useRef(new Map());

  useEffect(() => {
    if (!paused) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [paused]);

  useEffect(() => {
    for (const pos of disconnectedPositions) {
      if (!disconnectAtRef.current.has(pos)) disconnectAtRef.current.set(pos, Date.now());
    }
    for (const [pos] of disconnectAtRef.current.entries()) {
      if (!disconnectedPositions.includes(pos)) disconnectAtRef.current.delete(pos);
    }
  }, [disconnectedPositions]);

  const minRemaining = useMemo(() => {
    if (!paused) return null;
    let best = null;
    for (const pos of disconnectedPositions) {
      const t0 = disconnectAtRef.current.get(pos);
      if (!t0) continue;
      const rem = Math.max(0, 30 - Math.floor((now - t0) / 1000));
      best = best === null ? rem : Math.min(best, rem);
    }
    return best;
  }, [paused, disconnectedPositions, now]);


  const roomId = snapshot?.room_id;

  const playersBySeat = useMemo(() => {
    if (!snapshot) return {};
    const result = {};
    snapshot.players.forEach((p) => {
      const seat = relativeSeat(myPosition, p.position);
      result[seat] = {
        ...p,
        onClick: seat === "bottom" && !isSpectating ? () => setShowTauntMenu(true) : () => setProfilePlayer(p),
      };
    });
    return result;
  }, [snapshot, myPosition, isSpectating]);

  const tableCards = useMemo(() => {
    if (!snapshot) return [];
    let trickToRender = snapshot.current_trick || [];
    if (trickToRender.length === 0 && staticDelayActive && snapshot.last_trick && snapshot.last_trick.length > 0) {
      trickToRender = snapshot.last_trick;
    }
    return trickToRender.map(([position, card], idx) => ({
      id: `${position}-${card.rank}-${card.suit}-${idx}`,
      seat: relativeSeat(myPosition, position),
      card,
    }));
  }, [snapshot, myPosition, staticDelayActive]);

  const isMyTurn = snapshot?.current_turn === myPosition;

  const handlePlayCard = (card) => {
    if (!roomId || !isMyTurn || paused || gameOver) return;
    playCard(roomId, card);
  };

  const handleExitSpectate = () => {
    if (roomId) {
      unspectateRoom(roomId);
    }
    useGameStore.getState().clearGame();
    navigate("/find");
  };

  const handeSurrenderClick = () => {
    if (snapshot?.players.some(p => p.meta.is_bot)) {
      if (window.confirm("Выйти из игры? Игра с ботами завершится без потерь.")) {
        surrenderRoom(roomId);
      }
    } else {
      setShowSurrenderModal(true);
    }
  };

  const confirmSurrender = () => {
    surrenderRoom(roomId);
    setShowSurrenderModal(false);
  };

  const lastTrickKey = useMemo(
    () => JSON.stringify(snapshot?.last_trick || []),
    [snapshot?.last_trick]
  );

  useEffect(() => {
    if (!trickWinner || !(snapshot?.last_trick?.length > 0) || !myPosition) {
      setStaticDelayActive(false);
      setFlyCards([]);
      return;
    }

    setStaticDelayActive(true);
    setFlyCards([]);

    const t1 = setTimeout(() => {
      setStaticDelayActive(false);
      const list = snapshot.last_trick.map(([pos, card], idx) => ({
        id: `fly-${pos}-${card.rank}-${card.suit}-${idx}-${Date.now()}`,
        fromSeat: relativeSeat(myPosition, pos),
        card,
      }));
      setFlyCards(list);
    }, 1000);

    const t2 = setTimeout(() => setFlyCards([]), 1800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [trickWinner, lastTrickKey, myPosition]);

  if (!snapshot || (!me && !isSpectating)) {
    return (
      <div className="min-h-dvh flex items-center justify-center login-bg text-white">
        Загрузка игры...
      </div>
    );
  }

  const initialBySeat = {
    top: { y: -120, opacity: 0 },
    bottom: { y: 120, opacity: 0 },
    left: { x: -120, opacity: 0 },
    right: { x: 120, opacity: 0 },
  };

  const styleBySeat = {
    top: "absolute top-2 left-1/2 -translate-x-1/2",
    bottom: "absolute bottom-2 left-1/2 -translate-x-1/2",
    left: "absolute left-2 top-1/2 -translate-y-1/2",
    right: "absolute right-2 top-1/2 -translate-y-1/2",
  };

  return (
    <LayoutGroup>
      <NutThrowAnimation activeThrows={activeThrows} playersBySeat={playersBySeat} />

      <div className="min-h-dvh flex items-stretch sm:items-center justify-center login-bg">
        <div
          className={`
            relative isolate w-full max-w-[600px] h-full min-h-[100dvh]
            sm:aspect-[3/4] sm:min-h-0 sm:max-h-[85dvh] rounded-xl border-4 border-purple-700
            ${bgTheme.type === "generated" ? bgTheme.base : "bg-[#15152b]"}
            ${bgTheme.glow}
            p-6 flex flex-col overflow-hidden transition-all duration-1000
            ${isMyTurn && !paused && !gameOver ? "shadow-[inset_0_-80px_80px_-40px_rgba(52,211,153,0.2)] ring-1 ring-emerald-500/30" : ""}
          `}
        >
          {bgTheme.type === "image" && (
            <>
              <img
                src={bgTheme.image}
                alt="table background"
                className="pointer-events-none absolute inset-0 -z-20 h-full w-full object-cover"
              />
              <div
                className={`pointer-events-none absolute inset-0 -z-10 ${bgTheme.overlayClass || "bg-black/35"
                  }`}
              />
            </>
          )}

          {bgTheme.type === "generated" && (
            <div
              className={`pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br ${bgTheme.overlay}`}
            />
          )}

          <GameHeader
            scores={snapshot.scores}
            eyes={snapshot.eyes}
            lastTrick={snapshot.last_trick}
            deck={deck}
          />

          <div className="w-full flex justify-end mb-2 items-center">
            {isSpectating ? (
              <div className="flex items-center gap-2">
                <span className="bg-blue-600 border border-blue-400 text-white font-bold px-3 py-1.5 rounded-full text-xs shadow-[0_0_15px_rgba(37,99,235,0.4)] animate-pulse">
                  👁 Наблюдение
                </span>
                {hasBots && (
                  <button
                    onClick={() => {
                      requestToJoin(roomId);
                      toast.success("Запрос отправлен!");
                    }}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-full text-xs shadow-[0_0_15px_rgba(52,211,153,0.4)] transition active:scale-95"
                  >
                    Запросить место
                  </button>
                )}
                <button
                  onClick={handleExitSpectate}
                  className="bg-red-600 hover:bg-red-500 text-white font-bold px-3 py-1.5 rounded-full text-xs shadow-[0_0_15px_rgba(220,38,38,0.4)] transition active:scale-95"
                >
                  Выйти
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSlotsModal(true)}
                  className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white font-black px-4 py-1.5 rounded-full text-xs shadow-[0_0_15px_rgba(236,72,153,0.5)] transition active:scale-95 flex items-center gap-1"
                >
                  <span className="text-sm">🎰</span> Слоты
                </button>
                <button
                  onClick={handeSurrenderClick}
                  className="bg-red-600 hover:bg-red-500 text-white font-bold px-3 py-1.5 rounded-full text-xs shadow-[0_0_15px_rgba(220,38,38,0.4)] transition active:scale-95"
                >
                  Сдаться / Выйти
                </button>
              </div>
            )}
          </div>

          <AnimatePresence>
            {showSurrenderModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4"
              >
                <div className="bg-[#1a1a2e] border border-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.3)] rounded-2xl p-6 text-center max-w-sm">
                  <h3 className="text-xl font-bold text-red-400 mb-2">Вы точно хотите выйти?</h3>
                  <p className="text-gray-300 text-sm mb-6">
                    Это ранговая игра ПВП! В случае досрочного выхода ваша команда моментально потерпит поражение, а вы потеряете <strong>30 рейтинга</strong> и свою первоначальную <strong>ставку орехов</strong>. Другие игроки, включая вашего союзника, будут компенсированы.
                  </p>
                  <div className="flex gap-4 justify-center">
                    <button
                      onClick={() => setShowSurrenderModal(false)}
                      className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition"
                    >
                      Отмена
                    </button>
                    <button
                      onClick={confirmSurrender}
                      className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition shadow-lg shadow-red-600/30"
                    >
                      Да, сдаться
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {paused && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="mb-3 rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200"
              >
                Игра на паузе: ждём игроков ({disconnectedPositions.join(", ")})
                {minRemaining !== null && (
                  <span className="ml-2 text-emerald-300 font-semibold">
                    • авто-лосс через {minRemaining}s
                  </span>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {playersBySeat.top && (
            <div className="flex justify-center">
              <PlayerBadge
                player={playersBySeat.top}
                seat="top"
                isCurrent={snapshot.current_turn === playersBySeat.top.position}
                isDisconnected={disconnectedPositions.includes(playersBySeat.top.position)}
                isClubJackOwner={snapshot.club_jack_owner === playersBySeat.top.position}
              />
            </div>
          )}

          <div className="flex-1 flex justify-between items-center">
            {playersBySeat.left ? (
              <PlayerBadge
                player={playersBySeat.left}
                seat="left"
                isCurrent={snapshot.current_turn === playersBySeat.left.position}
                isDisconnected={disconnectedPositions.includes(playersBySeat.left.position)}
                isClubJackOwner={snapshot.club_jack_owner === playersBySeat.left.position}
              />
            ) : (
              <div className="w-20" />
            )}

            <div className="relative w-56 h-56 flex items-center justify-center">
              <TrumpBadge trump={snapshot.trump} />

              <AnimatePresence>
                {tableCards.map((item) => (
                  <motion.div
                    key={item.id}
                    layoutId={`table-${item.id}`}
                    initial={initialBySeat[item.seat]}
                    animate={{ x: 0, y: 0, opacity: 1, scale: [1.1, 1] }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    className={styleBySeat[item.seat]}
                  >
                    <CardFace card={item.card} className="w-14 h-20 text-lg relative z-10 drop-shadow-md" theme={deck} />
                  </motion.div>
                ))}
              </AnimatePresence>

              <AnimatePresence>
                {flyCards.map((c) => {
                  const start = startOffsetBySeat(c.fromSeat);
                  const winnerSeat = relativeSeat(myPosition, trickWinner?.position);
                  const end = targetOffsetBySeat(winnerSeat);

                  return (
                    <motion.div
                      key={c.id}
                      initial={{ x: start.x, y: start.y, opacity: 1, scale: 1, rotate: 0 }}
                      animate={{ x: end.x, y: end.y, opacity: end.opacity, scale: end.scale, rotate: (Math.random() > 0.5 ? 1 : -1) * 270 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.65, ease: "backIn" }}
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none"
                    >
                      <CardFace card={c.card} className="w-12 h-18 text-md" theme={deck} />
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {playersBySeat.right ? (
              <PlayerBadge
                player={playersBySeat.right}
                seat="right"
                isCurrent={snapshot.current_turn === playersBySeat.right.position}
                isDisconnected={disconnectedPositions.includes(playersBySeat.right.position)}
                isClubJackOwner={snapshot.club_jack_owner === playersBySeat.right.position}
              />
            ) : (
              <div className="w-20" />
            )}
          </div>

          <div className="flex flex-col items-center gap-3 w-full">
            {playersBySeat.bottom && (
              <PlayerBadge
                player={playersBySeat.bottom}
                seat="bottom"
                isCurrent={snapshot.current_turn === playersBySeat.bottom.position}
                isDisconnected={disconnectedPositions.includes(playersBySeat.bottom.position)}
                isClubJackOwner={snapshot.club_jack_owner === playersBySeat.bottom.position}
              />
            )}

            {gameHint && isMyTurn && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-[98%] sm:max-w-md px-3 py-2 bg-gradient-to-r from-purple-900/90 to-indigo-900/90 backdrop-blur-md border border-purple-500/50 rounded-2xl mb-1 text-white shadow-[0_0_20px_rgba(168,85,247,0.3)] text-center mx-auto z-10 mx-1"
              >
                <div className="font-extrabold text-yellow-300 text-[10px] sm:text-xs uppercase tracking-wider mb-0.5">🎓 Совет</div>
                <div className="text-[11px] sm:text-xs font-medium leading-tight text-purple-100">{gameHint.reason}</div>
              </motion.div>
            )}

            <Reorder.Group
              axis="x"
              values={localHand}
              onReorder={setLocalHand}
              className="flex justify-center items-center w-full px-1 touch-none"
            >
              {!isSpectating && localHand.map((card, i) => {
                const rotate = (i - (localHand.length - 1) / 2) * 6;
                const marginLeft = i === 0 ? "0px" : getHandGap(localHand.length);
                return (
                  <Reorder.Item
                    key={`${card.rank}-${card.suit}`}
                    value={card}
                    style={{ transform: `rotate(${rotate}deg)`, marginLeft }}
                    className="relative"
                  >
                    <PlayingCard
                      card={card}
                      clickable={isMyTurn && !paused && !gameOver}
                      compact={localHand.length > 7}
                      onClick={() => handlePlayCard(card)}
                      theme={deck}
                      highlighted={gameHint?.card?.rank === card.rank && gameHint?.card?.suit === card.suit}
                    />
                  </Reorder.Item>
                );
              })}
            </Reorder.Group>
          </div>

          <AnimatePresence>
            {showRoleModal && snapshot && snapshot.player_trump_map && (
              <RoleAssignmentModal
                players={snapshot.players}
                player_trump_map={snapshot.player_trump_map}
                club_jack_owner={snapshot.club_jack_owner}
                myPosition={myPosition}
              />
            )}

            {profilePlayer && (
              <InGameProfileModal 
                player={profilePlayer} 
                onClose={() => setProfilePlayer(null)} 
                onReplaceBot={() => {
                  setTargetBotId(profilePlayer.meta.id);
                  setProfilePlayer(null);
                  setShowFriendSelectorModal(true);
                }}
              />
            )}

            {showTauntMenu && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm"
                onClick={() => setShowTauntMenu(false)}
              >
                <motion.div 
                  initial={{ y: 200, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 200, opacity: 0 }}
                  transition={{ type: "spring", bounce: 0.4 }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full sm:max-w-md bg-[#1a1a2e] border border-purple-500 shadow-[0_0_40px_rgba(168,85,247,0.4)] rounded-3xl p-6"
                >
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black text-pink-400">Эмоции</h3>
                    <button onClick={() => setShowTauntMenu(false)} className="text-gray-400 hover:text-white">✕</button>
                  </div>

                  <div className="grid grid-cols-4 gap-4">
                    {availableTaunts.map(taunt => (
                      <button
                        key={taunt}
                        onClick={() => {
                          sendTaunt(snapshot.room_id, taunt);
                          useGameStore.getState().triggerTauntAction(myPosition, taunt);
                          setShowTauntMenu(false);
                        }}
                        className="aspect-square flex items-center justify-center text-4xl bg-black/40 border border-purple-500/30 rounded-2xl hover:bg-purple-500/20 hover:scale-110 active:scale-95 transition"
                      >
                        {renderTauntGraphic(taunt, true)}
                      </button>
                    ))}
                  </div>
                </motion.div>
              </motion.div>
            )}

            {gameOver && <FinalResultsOverlay snapshot={snapshot} finalScores={finalScores} me={me} />}

            {incomingJoinRequest && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4"
              >
                <div className="bg-[#1a1a2e] border border-purple-500/50 shadow-[0_0_30px_rgba(168,85,247,0.3)] rounded-2xl p-6 text-center max-w-sm">
                  <h3 className="text-xl font-bold text-pink-400 mb-2">Запрос на вход</h3>
                  <p className="text-gray-300 text-sm mb-6">
                    Игрок <strong className="text-white">{incomingJoinRequest.from.username}</strong> хочет заменить бота и присоединиться к игре!
                  </p>
                  <div className="flex gap-4 justify-center">
                    <button
                      onClick={() => clearIncomingJoinRequest()}
                      className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition"
                    >
                      Отклонить
                    </button>
                    <button
                      onClick={() => {
                        acceptJoinRequest(roomId, incomingJoinRequest.from.id);
                        clearIncomingJoinRequest();
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition shadow-lg shadow-emerald-600/30"
                    >
                      Принять
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {showFriendSelectorModal && (
              <FriendSelectorModal 
                roomId={roomId}
                targetBotId={targetBotId}
                onClose={() => {
                  setShowFriendSelectorModal(false);
                  setTargetBotId(null);
                }}
              />
            )}
          </AnimatePresence>
          
          {showSlotsModal && (
            <SlotsModal onClose={() => setShowSlotsModal(false)} />
          )}
        </div>
      </div>
    </LayoutGroup>
  );
}

function RoleAssignmentModal({ players, player_trump_map, club_jack_owner, myPosition }) {
  if (!player_trump_map || Object.keys(player_trump_map).length === 0) return null;

  const suitsTrans = {
    Clubs: "♣ Крести",
    Diamonds: "♦ Буби",
    Hearts: "♥ Черви",
    Spades: "♠ Пики",
  };

  const suitColors = {
    Clubs: "text-emerald-400 border-emerald-500/50 bg-emerald-900/40",
    Diamonds: "text-red-400 border-red-500/50 bg-red-900/40",
    Hearts: "text-rose-400 border-rose-500/50 bg-rose-900/40",
    Spades: "text-slate-300 border-slate-500/50 bg-slate-800/60",
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ duration: 0.4, type: "spring" }}
        className="w-full max-w-md rounded-3xl border border-purple-500/50 bg-[#131325]/95 shadow-[0_0_40px_rgba(168,85,247,0.35)] p-6"
      >
        <h2 className="text-2xl font-black text-white text-center mb-2">Распределение ролей</h2>
        <p className="text-gray-400 text-sm text-center mb-6">Владелец Крестового Валета задал масти на игру</p>

        <div className="space-y-3">
          {players.map((p) => {
            const suit = player_trump_map[p.position];
            const isMe = p.position === myPosition;
            const isClubJack = p.position === club_jack_owner;
            const sColor = suitColors[suit] || "text-gray-300 border-white/10";

            return (
              <div key={p.meta.id} className={`flex items-center justify-between p-3 rounded-2xl border ${isMe ? 'border-purple-500 bg-purple-900/20' : 'border-white/5 bg-black/30'}`}>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img src={p.meta.photo_url || p.meta.avatar || `https://api.dicebear.com/7.x/thumbs/svg?seed=${p.meta.username}`} className="w-11 h-11 rounded-full border-2 border-gray-600 object-cover" />
                    {isClubJack && (
                      <span className="absolute -top-2 -right-2 text-xl drop-shadow-[0_0_8px_#4ade80]">👑</span>
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-white text-[15px]">{p.meta.username} {isMe && <span className="text-xs text-purple-300 font-normal ml-1">(Вы)</span>}</div>
                    {isClubJack && <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mt-0.5">Крестовый Валет</div>}
                  </div>
                </div>

                <div className={`px-3 py-1.5 rounded-xl border font-bold text-[13px] ${sColor}`}>
                  {suitsTrans[suit]}
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}

function InGameProfileModal({ player, onClose, onReplaceBot }) {
  const [isFriend, setIsFriend] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(true);
  
  const token = localStorage.getItem("access_token");

  useEffect(() => {
    if (player?.meta?.id > 0 && !player?.meta?.is_bot) {
      axios.get(getUrl("/v1/friends"), { headers: { Authorization: `Bearer ${token}` } })
        .then(res => {
          if (Array.isArray(res.data)) {
            setIsFriend(res.data.some(f => f.id === player.meta.id));
          }
        })
        .catch(err => {
          console.error("Failed to load friend status", err);
        })
        .finally(() => setLoadingFriends(false));
    } else {
      setLoadingFriends(false);
    }
  }, [player, token]);

  if (!player) return null;
  const team = teamMeta[player.team] || teamMeta.kaskyr;

  const handleAddFriend = async () => {
    try {
      await axios.post(
        getUrl("/v1/friends/requests"),
        { target_id: player.meta.id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Заявка в друзья отправлена!");
    } catch (e) {
      if (e.response?.data === "Already friends" || e.response?.data?.includes("friends")) {
        toast.info("Вы уже друзья или заявка отправлена");
        setIsFriend(true);
      } else {
        toast.error("Ошибка при добавлении в друзья");
      }
    }
  };

  const handleGift = () => {
    const room_id = useGameStore.getState().gameSnapshot?.room_id;
    if (room_id) {
      sendSponsor(room_id, player.meta.id);
      toast.success("Орех брошен!");
      onClose();
    }
  };

  const extraActions = (
    <div className="flex flex-col gap-3">
      {player.meta.id > 0 && !player.meta.is_bot && !loadingFriends && (
        isFriend ? (
          <button disabled className="py-2.5 rounded-xl font-bold bg-green-600/50 text-white cursor-not-allowed border border-green-500/30">
            ✔️ Ваш друг
          </button>
        ) : (
          <button onClick={handleAddFriend} className="py-2.5 rounded-xl font-bold bg-purple-600 hover:bg-purple-500 text-white transition-all shadow-[0_0_15px_rgba(147,51,234,0.3)]">
            Добавить в друзья
          </button>
        )
      )}
      <button 
        onClick={handleGift}
        className="py-2.5 rounded-xl font-bold bg-amber-600 hover:bg-amber-500 text-white transition-all shadow-[0_0_15px_rgba(217,119,6,0.3)] flex items-center justify-center gap-2"
      >
        <span>🎁</span> Спонсировать (Орех)
      </button>
      {(player.meta.is_bot || player.meta.id < 0) && onReplaceBot && (
        <button 
          onClick={onReplaceBot}
          className="py-2.5 rounded-xl font-bold bg-purple-600 hover:bg-purple-500 text-white transition-all shadow-[0_0_15px_rgba(168,85,247,0.3)] flex items-center justify-center gap-2 mt-1"
        >
          <span>👤</span> Заменить друга
        </button>
      )}
    </div>
  );

  return (
    <UserProfileModal
      targetId={player.meta.id}
      targetName={player.meta.username}
      targetAvatar={player.meta.photo_url || player.meta.avatar}
      onClose={onClose}
      extraActions={extraActions}
    />
  );
}

function FriendSelectorModal({ roomId, targetBotId, onClose }) {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    axios.get(getUrl("/v1/friends"), { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        const allFriends = res.data || [];
        setFriends(allFriends.filter(f => f.online));
      })
      .catch(err => console.error("Failed to load friends", err))
      .finally(() => setLoading(false));
  }, []);

  const handleInvite = (friendId) => {
    import('./ws/client').then(({ inviteFriend }) => {
      inviteFriend(roomId, friendId, targetBotId);
      toast.success("Приглашение отправлено!");
      onClose();
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl border border-purple-500/50 bg-[#15152b] shadow-[0_0_40px_rgba(168,85,247,0.3)] p-6 flex flex-col max-h-[80vh]"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white">Кого пригласить?</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {loading ? (
            <div className="text-center text-gray-400 py-4">Загрузка...</div>
          ) : friends.length === 0 ? (
            <div className="text-center text-gray-400 py-4">У вас пока нет друзей</div>
          ) : (
            friends.map(f => (
              <div key={f.id} className="flex items-center justify-between bg-black/40 p-2 rounded-xl border border-white/5">
                <div className="flex items-center gap-2">
                  <img src={f.avatar || `https://api.dicebear.com/7.x/thumbs/svg?seed=${f.name}`} className="w-10 h-10 rounded-full object-cover" />
                  <span className="text-white font-medium truncate max-w-[120px]">{f.name}</span>
                </div>
                <button 
                  onClick={() => handleInvite(f.id)}
                  className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-lg text-sm font-bold transition-colors shadow-[0_0_10px_rgba(147,51,234,0.3)]"
                >
                  Выбрать
                </button>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
