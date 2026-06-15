import React from 'react';

export default function ChestGraphic({ chestType = "common", className = "" }) {
  // Define styling and color definitions per chestType
  const config = {
    common: {
      bodyGrad: ["#4b5563", "#1f2937"],
      rimGrad: ["#9ca3af", "#374151"],
      accentGrad: ["#d1d5db", "#6b7280"],
      lockColor: "#9ca3af",
      gemColor: "#d1d5db",
      glowColor: "rgba(156, 163, 175, 0.4)",
    },
    rare: {
      bodyGrad: ["#1e3a8a", "#0f172a"],
      rimGrad: ["#3b82f6", "#1d4ed8"],
      accentGrad: ["#60a5fa", "#2563eb"],
      lockColor: "#06b6d4",
      gemColor: "#22d3ee",
      glowColor: "rgba(34, 211, 238, 0.6)",
    },
    epic: {
      bodyGrad: ["#581c87", "#1e1b4b"],
      rimGrad: ["#d946ef", "#7e22ce"],
      accentGrad: ["#f472b6", "#a855f7"],
      lockColor: "#ec4899",
      gemColor: "#f472b6",
      glowColor: "rgba(236, 72, 153, 0.6)",
    },
    legendary: {
      bodyGrad: ["#78350f", "#2c0e0e"],
      rimGrad: ["#fbbf24", "#ea580c"],
      accentGrad: ["#fde68a", "#f59e0b"],
      lockColor: "#ef4444",
      gemColor: "#f97316",
      glowColor: "rgba(249, 115, 22, 0.7)",
    }
  };

  const c = config[chestType] || config.common;

  return (
    <svg viewBox="0 0 120 120" className={`w-full h-full select-none ${className}`}>
      <defs>
        {/* Glow Filter */}
        <filter id={`chest-glow-${chestType}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        
        {/* Body Gradient */}
        <linearGradient id={`c-body-${chestType}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={c.bodyGrad[0]} />
          <stop offset="100%" stopColor={c.bodyGrad[1]} />
        </linearGradient>
        
        {/* Rim Gradient */}
        <linearGradient id={`c-rim-${chestType}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={c.rimGrad[0]} />
          <stop offset="100%" stopColor={c.rimGrad[1]} />
        </linearGradient>
        
        {/* Accent Metal Gradient */}
        <linearGradient id={`c-accent-${chestType}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={c.accentGrad[0]} />
          <stop offset="100%" stopColor={c.accentGrad[1]} />
        </linearGradient>
        
        {/* Inside Glow Radial */}
        <radialGradient id={`c-glow-${chestType}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={c.gemColor} stopOpacity="0.9" />
          <stop offset="100%" stopColor={c.gemColor} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Ground Shadow */}
      <ellipse cx="60" cy="102" rx="40" ry="9" fill="black" opacity="0.65" />
      <ellipse cx="60" cy="100" rx="30" ry="7" fill={`url(#c-glow-${chestType})`} opacity="0.45" filter={`url(#chest-glow-${chestType})`} />

      {/* Chest Base Block */}
      <path
        d="M22,58 L98,58 L92,94 C91,97 88,100 84,100 L36,100 C32,100 29,97 28,94 Z"
        fill={`url(#c-body-${chestType})`}
        stroke={`url(#c-rim-${chestType})`}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />

      {/* Base Corner Bindings */}
      <path d="M22,58 L32,58 L32,68 L25,78 L22,58 Z" fill={`url(#c-accent-${chestType})`} />
      <path d="M98,58 L88,58 L88,68 L95,78 L98,58 Z" fill={`url(#c-accent-${chestType})`} />
      <path d="M28,94 L36,100 L28,100 Z" fill={`url(#c-accent-${chestType})`} />
      <path d="M92,94 L84,100 L92,100 Z" fill={`url(#c-accent-${chestType})`} />

      {/* Base Vertical Metal Straps */}
      <rect x="36" y="58" width="8" height="42" fill={`url(#c-accent-${chestType})`} />
      <rect x="76" y="58" width="8" height="42" fill={`url(#c-accent-${chestType})`} />

      {/* Vaulted Lid */}
      <path
        d="M20,58 C20,30 35,24 60,24 C85,24 100,30 100,58 Z"
        fill={`url(#c-body-${chestType})`}
        stroke={`url(#c-rim-${chestType})`}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />

      {/* Lid Rims */}
      <path
        d="M20,58 C20,30 35,24 60,24 C85,24 100,30 100,58 L90,58 C90,36 78,30 60,30 C42,30 30,36 30,58 Z"
        fill={`url(#c-accent-${chestType})`}
        opacity="0.9"
      />

      {/* Lid Vertical Metal Straps */}
      <path d="M36,58 C36,34 40,28 44,28 L44,58 Z" fill={`url(#c-accent-${chestType})`} />
      <path d="M76,58 C76,34 72,28 68,28 L68,58 Z" fill={`url(#c-accent-${chestType})`} />
      <path d="M40,58 C40,34 44,28 48,28 L48,58 Z" fill="rgba(255,255,255,0.12)" />
      <path d="M80,58 C80,34 76,28 80,28 L80,58 Z" fill="rgba(0,0,0,0.15)" />

      {/* Horizontal Seam Rims */}
      <line x1="20" y1="58" x2="100" y2="58" stroke={`url(#c-rim-${chestType})`} strokeWidth="3.5" />

      {/* Strap Rivets */}
      <circle cx="40" cy="65" r="1.2" fill="#fff" opacity="0.8" />
      <circle cx="40" cy="77" r="1.2" fill="#fff" opacity="0.8" />
      <circle cx="40" cy="89" r="1.2" fill="#fff" opacity="0.8" />
      <circle cx="80" cy="65" r="1.2" fill="#fff" opacity="0.8" />
      <circle cx="80" cy="77" r="1.2" fill="#fff" opacity="0.8" />
      <circle cx="80" cy="89" r="1.2" fill="#fff" opacity="0.8" />

      {/* Lid Rivets */}
      <circle cx="33" cy="43" r="1" fill="#fff" opacity="0.7" />
      <circle cx="43" cy="33" r="1" fill="#fff" opacity="0.7" />
      <circle cx="77" cy="33" r="1" fill="#fff" opacity="0.7" />
      <circle cx="87" cy="43" r="1" fill="#fff" opacity="0.7" />

      {/* Escutcheon Lock Plate */}
      <path
        d="M50,45 L70,45 L68,63 C68,71 60,75 50,78 C40,75 32,71 32,63 L30,45 Z"
        fill="#1e293b"
        stroke={`url(#c-rim-${chestType})`}
        strokeWidth="1.5"
      />

      {/* Gem Lock */}
      <circle
        cx="50"
        cy="56"
        r="8.5"
        fill={c.lockColor}
        filter={`url(#chest-glow-${chestType})`}
      />
      <circle
        cx="50"
        cy="56"
        r="5.5"
        fill={c.gemColor}
      />
      {/* Light Reflection */}
      <circle cx="48" cy="54" r="1.8" fill="#ffffff" opacity="0.9" />

      {/* Keyhole Slot */}
      <path d="M50,59 L50,69 M47.5,69 L52.5,69" stroke={`url(#c-rim-${chestType})`} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
