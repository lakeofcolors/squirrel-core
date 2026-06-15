import { useGameStore } from "../store";

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

export function suitIsRed(suit) {
  return suit === "Hearts" || suit === "Diamonds";
}

export function suitColorClass(suit) {
  return suitIsRed(suit) ? "text-red-500" : "text-slate-900";
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
  };

  const themeGroup = assets[theme] || assets.classic;
  return themeGroup[card.rank] || themeGroup.Jack;
}

export function CardFace({ card, compact = false, className = "", theme = "neon" }) {
  const ecoMode = useGameStore((s) => s.ecoMode);
  const rank = rankLabel[card.rank] ?? card.rank;
  const suit = suitSymbol[card.suit] ?? card.suit;
  const t = getDeckTheme(theme, card.suit);
  const isFaceCard = ["Jack", "Queen", "King"].includes(card.rank);
  const squirrelImg = isFaceCard ? get_squirrel_image(card, theme) : null;

  return (
    <div className={`${compact ? "w-12 h-[72px]" : "w-16 h-24"} ${ecoMode ? "eco-mode" : ""} ${className}`}>
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
              <g className="rune-s" style={{ animationDuration: '18s' }}>
                <circle cx="50" cy="72" r="28" fill="none" stroke="#fbbf24" strokeWidth="1.8" />
                <polygon points="50,44 74,86 26,86" fill="none" stroke="#fbbf24" strokeWidth="1" />
                <polygon points="50,100 74,58 26,58" fill="none" stroke="#fbbf24" strokeWidth="1" />
              </g>
              <circle cx="50" cy="72" r="10" fill="#271808" stroke="#14b8a6" strokeWidth="2" />
              <polygon points="50,68 53,74 47,74" fill="#ffffff" className="rune-p" />
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
