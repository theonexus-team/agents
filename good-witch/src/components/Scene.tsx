"use client";

/**
 * Atmospheric still-life scenes drawn in SVG.
 *
 * The concept had no supplied imagery available in this build environment,
 * so these scenes stand in for photography. To use real photos, add files to
 * /public/photos and map them in PHOTO_OVERRIDES below. Every <Scene> with a
 * mapped name then renders the photo instead.
 */
import { useId } from "react";

export type SceneName =
  | "hat"
  | "moon"
  | "candles"
  | "tarot"
  | "botanical"
  | "circle"
  | "stash-hat"
  | "necklace-spiral"
  | "necklace-fish"
  | "necklace-thorn"
  | "necklace-leaf";

/** e.g. { hat: "/photos/purple-hat.jpg" } */
export const PHOTO_OVERRIDES: Partial<Record<SceneName, string>> = {};

type Props = {
  name: SceneName;
  className?: string;
  /** Focus point for "slice" cropping: e.g. "xMidYMid" or "xMidYMax" */
  align?: string;
  label?: string;
};

export function Scene({ name, className = "", align = "xMidYMid", label }: Props) {
  const raw = useId();
  const id = raw.replace(/[^a-zA-Z0-9]/g, "");
  const photo = PHOTO_OVERRIDES[name];

  if (photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photo} alt={label ?? ""} className={`h-full w-full object-cover ${className}`} />
    );
  }

  const body = (() => {
    switch (name) {
      case "hat":
        return <HatScene id={id} />;
      case "moon":
        return <MoonScene id={id} />;
      case "candles":
        return <CandleScene id={id} />;
      case "tarot":
        return <TarotScene id={id} />;
      case "botanical":
        return <BotanicalScene id={id} />;
      case "circle":
        return <CircleScene id={id} />;
      case "stash-hat":
        return <StashHatScene id={id} />;
      default:
        return <NecklaceScene id={id} variant={name.replace("necklace-", "") as NecklaceVariant} />;
    }
  })();

  return (
    <div className={`grain relative h-full w-full overflow-hidden ${className}`}>
      <svg
        viewBox="0 0 400 500"
        preserveAspectRatio={`${align} slice`}
        className="absolute inset-0 h-full w-full"
        role={label ? "img" : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
      >
        {body}
      </svg>
    </div>
  );
}

/* ================================================================ */
/* Shared pieces                                                     */
/* ================================================================ */

/* Deterministic integer PRNG: identical on server and client (no Math.sin drift). */
function rng(seed: number) {
  let a = seed * 2654435761 >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) % 10000) / 10000;
  };
}
const r2 = (n: number) => Math.round(n * 100) / 100;

function Blur({ id, sd }: { id: string; sd: number }) {
  return (
    <filter id={id} x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation={sd} />
    </filter>
  );
}

function Bokeh({ id, seed = 1, color = "#e2cb94", count = 14, opacity = 0.35 }: { id: string; seed?: number; color?: string; count?: number; opacity?: number }) {
  const rand = rng(seed + 100);
  const dots = Array.from({ length: count }, () => {
    const r3 = rand();
    return { x: r2(rand() * 400), y: r2(rand() * 330), s: r2(3 + r3 * 14), o: r2(0.25 + r3 * 0.75) };
  });
  return (
    <g filter={`url(#${id}-bk)`}>
      <defs>
        <Blur id={`${id}-bk`} sd={2.2} />
      </defs>
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.s} fill={color} opacity={d.o * opacity} />
      ))}
    </g>
  );
}

function Stars({ seed = 2, count = 40, maxY = 300 }: { seed?: number; count?: number; maxY?: number }) {
  return (
    <g>
      {(() => {
        const rand = rng(seed);
        return Array.from({ length: count }, (_, i) => {
          const x = r2(rand() * 400);
          const y = r2(rand() * maxY);
          const s = r2(rand() * 1.1 + 0.3);
          return <circle key={i} cx={x} cy={y} r={s} fill="#fdfaf4" opacity={r2(0.35 + (s / 1.4) * 0.6)} />;
        });
      })()}
    </g>
  );
}

/** A purple witch hat. Origin: brim centre at (0,0), ~300 wide. */
function Hat({ id, flowers = true, light = false }: { id: string; flowers?: boolean; light?: boolean }) {
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-cone`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#1f0f27" />
          <stop offset="0.45" stopColor="#4d2a5e" />
          <stop offset="0.7" stopColor="#66397a" />
          <stop offset="1" stopColor="#2b1636" />
        </linearGradient>
        <radialGradient id={`${id}-brim`} cx="0.55" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#7f4e95" />
          <stop offset="0.55" stopColor="#4d2a5e" />
          <stop offset="1" stopColor="#1f0f27" />
        </radialGradient>
        <linearGradient id={`${id}-band`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#6b5330" />
          <stop offset="0.5" stopColor="#e2cb94" />
          <stop offset="1" stopColor="#7b6136" />
        </linearGradient>
        <Blur id={`${id}-shadow`} sd={10} />
      </defs>
      {/* cast shadow */}
      <ellipse cx="6" cy="20" rx="160" ry="26" fill={light ? "#4d2a5e" : "#000"} opacity={light ? 0.22 : 0.5} filter={`url(#${id}-shadow)`} />
      {/* brim back */}
      <ellipse cx="0" cy="0" rx="150" ry="34" fill={`url(#${id}-brim)`} />
      <ellipse cx="0" cy="-3" rx="146" ry="30" fill="none" stroke="#a98bbd" strokeOpacity="0.25" strokeWidth="1" />
      {/* cone */}
      <path
        d="M-82 -6 C-62 -80 -38 -150 -12 -200 C4 -232 26 -256 64 -268 C48 -250 38 -224 36 -194 C40 -128 60 -62 84 -6 C40 6 -40 6 -82 -6 Z"
        fill={`url(#${id}-cone)`}
      />
      <path d="M-12 -200 C4 -232 26 -256 64 -268 C50 -252 42 -232 38 -206" fill="none" stroke="#c4aed3" strokeOpacity="0.35" strokeWidth="1.2" />
      <path d="M20 -150 C24 -100 40 -50 58 -10" fill="none" stroke="#c4aed3" strokeOpacity="0.18" strokeWidth="6" strokeLinecap="round" />
      {/* band */}
      <path d="M-79 -18 C-40 -6 40 -6 80 -18 L76 -40 C36 -30 -34 -30 -72 -40 Z" fill={`url(#${id}-band)`} />
      <path d="M-79 -18 C-40 -6 40 -6 80 -18" fill="none" stroke="#3a2a12" strokeOpacity="0.4" strokeWidth="1" />
      {/* crescent charm on band */}
      <g transform="translate(30 -27)">
        <circle r="9" fill="#e2cb94" />
        <circle cx="4" cy="-2" r="8" fill="#957543" />
      </g>
      {/* brim front lip */}
      <path d="M-150 0 C-130 30 130 30 150 0 C120 22 -120 22 -150 0 Z" fill="#1f0f27" opacity="0.65" />
      {flowers && <FlowerCluster id={id} />}
    </g>
  );
}

function Rose({ x, y, r, c1, c2 }: { x: number; y: number; r: number; c1: string; c2: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={r} fill={c1} />
      <circle r={r * 0.82} cx={r * 0.08} cy={-r * 0.06} fill={c2} opacity="0.85" />
      <path d={`M${-r * 0.5} 0 A ${r * 0.5} ${r * 0.5} 0 1 1 ${r * 0.5} ${r * 0.1}`} fill="none" stroke={c1} strokeWidth={r * 0.14} opacity="0.8" />
      <path d={`M${-r * 0.22} ${-r * 0.05} A ${r * 0.25} ${r * 0.25} 0 1 0 ${r * 0.22} ${r * 0.08}`} fill="none" stroke={c1} strokeWidth={r * 0.12} opacity="0.9" />
      <circle r={r} fill="none" stroke="#fff" strokeOpacity="0.12" />
    </g>
  );
}

function Blossom({ x, y, r, c, center = "#e2cb94" }: { x: number; y: number; r: number; c: string; center?: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx="0" cy={-r * 0.6} rx={r * 0.42} ry={r * 0.62} fill={c} transform={`rotate(${a})`} opacity="0.95" />
      ))}
      <circle r={r * 0.25} fill={center} />
    </g>
  );
}

function Lavender({ x, y, h, angle, color = "#a98bbd" }: { x: number; y: number; h: number; angle: number; color?: string }) {
  const buds = Array.from({ length: 9 }, (_, i) => i);
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      <path d={`M0 0 L0 ${-h}`} stroke="#5f6b4a" strokeWidth="1.4" />
      {buds.map((i) => (
        <g key={i}>
          <ellipse cx={-2.2} cy={-h + i * 5.5} rx="2.2" ry="3.4" fill={color} transform={`rotate(-20 -2.2 ${-h + i * 5.5})`} />
          <ellipse cx={2.2} cy={-h + 2 + i * 5.5} rx="2.2" ry="3.4" fill={color} opacity="0.85" transform={`rotate(20 2.2 ${-h + 2 + i * 5.5})`} />
        </g>
      ))}
    </g>
  );
}

function Leaf({ x, y, s, angle, c = "#55643f" }: { x: number; y: number; s: number; angle: number; c?: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${s})`}>
      <path d="M0 0 C8 -10 8 -26 0 -36 C-8 -26 -8 -10 0 0 Z" fill={c} />
      <path d="M0 -2 L0 -32" stroke="#000" strokeOpacity="0.2" strokeWidth="0.8" />
    </g>
  );
}

function FlowerCluster({ id }: { id: string }) {
  return (
    <g>
      <defs>
        <Blur id={`${id}-fs`} sd={3} />
      </defs>
      <ellipse cx="-40" cy="-8" rx="70" ry="16" fill="#000" opacity="0.35" filter={`url(#${id}-fs)`} />
      <Lavender x={-100} y={-14} h={58} angle={-38} />
      <Lavender x={-90} y={-12} h={66} angle={-24} color="#c4aed3" />
      <Lavender x={-20} y={-14} h={52} angle={16} />
      <Leaf x={-112} y={-12} s={0.9} angle={-70} />
      <Leaf x={-4} y={-12} s={0.8} angle={60} c="#6b7a50" />
      <Leaf x={-70} y={-14} s={0.7} angle={-10} c="#46553a" />
      <Rose x={-78} y={-22} r={17} c1="#5c2141" c2="#8a3a63" />
      <Rose x={-46} y={-18} r={14} c1="#efe6d6" c2="#fdfaf4" />
      <Rose x={-104} y={-26} r={11} c1="#7b4a8f" c2="#a37bb7" />
      <Blossom x={-26} y={-24} r={8} c="#ddd0e6" />
      <Blossom x={-122} y={-22} r={6} c="#fdfaf4" />
      <Blossom x={-60} y={-38} r={6} c="#c4aed3" />
    </g>
  );
}

function Flame({ id, x, y, s = 1 }: { id: string; x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <circle r="60" fill={`url(#${id}-glow)`} />
      <g className="animate-flicker" style={{ transformOrigin: "0px 0px", transformBox: "fill-box" }}>
        <path d="M0 0 C-7 -8 -6 -18 0 -30 C6 -18 7 -8 0 0 Z" fill={`url(#${id}-flame)`} />
        <path d="M0 -2 C-3 -6 -2.5 -11 0 -16 C2.5 -11 3 -6 0 -2 Z" fill="#fffbe9" />
      </g>
    </g>
  );
}

function FlameDefs({ id }: { id: string }) {
  return (
    <>
      <radialGradient id={`${id}-glow`}>
        <stop offset="0" stopColor="#ffd98a" stopOpacity="0.55" />
        <stop offset="0.35" stopColor="#e2a65a" stopOpacity="0.18" />
        <stop offset="1" stopColor="#e2a65a" stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`${id}-flame`} x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stopColor="#ff9d3b" />
        <stop offset="0.5" stopColor="#ffd27a" />
        <stop offset="1" stopColor="#fff4cf" />
      </linearGradient>
    </>
  );
}

function Candle({ id, x, base, h, w }: { id: string; x: number; base: number; h: number; w: number }) {
  const top = base - h;
  return (
    <g>
      <rect x={x - w / 2} y={top} width={w} height={h} rx={w * 0.12} fill={`url(#${id}-wax)`} />
      <path
        d={`M${x - w / 2} ${top + 6} q ${w * 0.12} 18 ${w * 0.2} 0 q ${w * 0.1} 28 ${w * 0.22} 2 q ${w * 0.12} 12 ${w * 0.24} -2 L ${x + w / 2} ${top + 4} L ${x + w / 2} ${top} L ${x - w / 2} ${top} Z`}
        fill="#fdfaf4"
        opacity="0.9"
      />
      <ellipse cx={x} cy={top + 1} rx={w / 2} ry={w * 0.12} fill="#fff8ea" />
      <path d={`M${x} ${top} l 0 -7`} stroke="#2a1a12" strokeWidth="1.6" />
      <Flame id={id} x={x} y={top - 6} s={w / 34} />
    </g>
  );
}

/* ================================================================ */
/* Scenes                                                            */
/* ================================================================ */

function HatScene({ id }: { id: string }) {
  return (
    <g>
      <defs>
        <radialGradient id={`${id}-bg`} cx="0.7" cy="0.2" r="1">
          <stop offset="0" stopColor="#5a3470" />
          <stop offset="0.45" stopColor="#2b1636" />
          <stop offset="1" stopColor="#120a1a" />
        </radialGradient>
        <radialGradient id={`${id}-moonglow`}>
          <stop offset="0" stopColor="#fdfaf4" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fdfaf4" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-table`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b1636" />
          <stop offset="1" stopColor="#120a1a" />
        </linearGradient>
        <Blur id={`${id}-mist`} sd={18} />
      </defs>
      <rect width="400" height="500" fill={`url(#${id}-bg)`} />
      <Stars seed={4} count={30} maxY={230} />
      <circle cx="300" cy="110" r="120" fill={`url(#${id}-moonglow)`} />
      <circle cx="300" cy="110" r="40" fill="#f8f2e8" />
      <circle cx="288" cy="100" r="7" fill="#e3d6c0" opacity="0.6" />
      <circle cx="312" cy="124" r="5" fill="#e3d6c0" opacity="0.5" />
      <circle cx="306" cy="96" r="3" fill="#e3d6c0" opacity="0.5" />
      <Bokeh id={id} seed={3} count={12} opacity={0.3} />
      <rect y="380" width="400" height="120" fill={`url(#${id}-table)`} />
      <ellipse cx="200" cy="380" rx="260" ry="26" fill="#a98bbd" opacity="0.12" filter={`url(#${id}-mist)`} />
      <g transform="translate(205 392)">
        <Hat id={id} />
      </g>
      <Lavender x={330} y={470} h={70} angle={-12} />
      <Lavender x={345} y={472} h={60} angle={8} color="#c4aed3" />
      <Blossom x={60} y={455} r={7} c="#ddd0e6" />
      <Blossom x={84} y={466} r={5} c="#fdfaf4" />
    </g>
  );
}

function MoonScene({ id }: { id: string }) {
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#120a1a" />
          <stop offset="0.6" stopColor="#3a1f48" />
          <stop offset="1" stopColor="#66397a" />
        </linearGradient>
        <radialGradient id={`${id}-halo`}>
          <stop offset="0.3" stopColor="#f8f2e8" stopOpacity="0.4" />
          <stop offset="1" stopColor="#f8f2e8" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-moon`} cx="0.4" cy="0.35">
          <stop offset="0" stopColor="#fdfaf4" />
          <stop offset="1" stopColor="#e3d6c0" />
        </radialGradient>
        <Blur id={`${id}-fog`} sd={14} />
      </defs>
      <rect width="400" height="500" fill={`url(#${id}-sky)`} />
      <Stars seed={9} count={70} maxY={340} />
      <circle cx="200" cy="200" r="170" fill={`url(#${id}-halo)`} />
      <circle cx="200" cy="200" r="78" fill={`url(#${id}-moon)`} />
      {[
        [175, 180, 14],
        [228, 222, 10],
        [214, 168, 7],
        [186, 236, 8],
        [236, 190, 5],
      ].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#d8c9ae" opacity="0.45" />
      ))}
      <ellipse cx="200" cy="370" rx="320" ry="40" fill="#c4aed3" opacity="0.2" filter={`url(#${id}-fog)`} />
      <path d="M0 400 C80 360 140 380 210 395 C280 410 330 370 400 380 L400 500 L0 500 Z" fill="#2b1636" />
      <path d="M0 440 C90 410 170 430 240 440 C310 450 350 425 400 430 L400 500 L0 500 Z" fill="#1c1024" />
      {Array.from({ length: 22 }, (_, i) => (
        <Lavender key={i} x={10 + i * 18 + (i % 3) * 4} y={500} h={40 + ((i * 37) % 30)} angle={((i * 13) % 20) - 10} color={i % 2 ? "#4d2a5e" : "#3a1f48"} />
      ))}
    </g>
  );
}

function CandleScene({ id }: { id: string }) {
  return (
    <g>
      <defs>
        <radialGradient id={`${id}-bg`} cx="0.5" cy="0.45" r="0.8">
          <stop offset="0" stopColor="#4d2a5e" />
          <stop offset="0.6" stopColor="#1f0f27" />
          <stop offset="1" stopColor="#0c0612" />
        </radialGradient>
        <linearGradient id={`${id}-wax`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#d9cbb3" />
          <stop offset="0.4" stopColor="#fbf5ea" />
          <stop offset="1" stopColor="#bfae92" />
        </linearGradient>
        <linearGradient id={`${id}-table`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b1636" />
          <stop offset="1" stopColor="#0c0612" />
        </linearGradient>
        <FlameDefs id={id} />
        <Blur id={`${id}-refl`} sd={6} />
      </defs>
      <rect width="400" height="500" fill={`url(#${id}-bg)`} />
      <Bokeh id={id} seed={7} count={16} color="#ffd98a" opacity={0.3} />
      <rect y="390" width="400" height="110" fill={`url(#${id}-table)`} />
      <g opacity="0.35" filter={`url(#${id}-refl)`}>
        <rect x="112" y="392" width="56" height="60" fill="#fbf5ea" opacity="0.4" />
        <rect x="182" y="392" width="44" height="70" fill="#fbf5ea" opacity="0.4" />
        <rect x="244" y="392" width="50" height="50" fill="#fbf5ea" opacity="0.4" />
      </g>
      <Candle id={id} x={140} base={392} h={150} w={56} />
      <Candle id={id} x={204} base={392} h={220} w={44} />
      <Candle id={id} x={269} base={392} h={110} w={50} />
      <Rose x={88} y={396} r={14} c1="#5c2141" c2="#8a3a63" />
      <Leaf x={70} y={398} s={0.7} angle={-70} />
      <Blossom x={320} y={398} r={7} c="#ddd0e6" />
      <Blossom x={338} y={404} r={5} c="#fdfaf4" />
    </g>
  );
}

function TarotCard({ symbol, label }: { symbol: "sun" | "moon" | "star"; label: string }) {
  return (
    <g>
      <rect x="-56" y="-92" width="112" height="184" rx="9" fill="#2b1636" stroke="#cfb173" strokeWidth="1.5" />
      <rect x="-48" y="-84" width="96" height="168" rx="5" fill="none" stroke="#cfb173" strokeOpacity="0.6" strokeWidth="0.8" />
      <rect x="-44" y="-80" width="88" height="140" rx="3" fill="#3a1f48" />
      {symbol === "sun" && (
        <g transform="translate(0 -14)" stroke="#e2cb94" fill="none">
          <circle r="16" fill="#cfb173" stroke="none" />
          {Array.from({ length: 12 }, (_, i) => (
            <line key={i} x1="0" y1="-22" x2="0" y2="-32" transform={`rotate(${i * 30})`} strokeWidth="1.4" />
          ))}
        </g>
      )}
      {symbol === "moon" && (
        <g transform="translate(0 -14)">
          <circle r="22" fill="#e2cb94" />
          <circle cx="9" cy="-5" r="19" fill="#3a1f48" />
          {[[-26, -30], [22, 24], [26, -28]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="1.5" fill="#e2cb94" />
          ))}
        </g>
      )}
      {symbol === "star" && (
        <g transform="translate(0 -14)" fill="#e2cb94">
          <path d="M0 -28 L6 -8 L27 -8 L10 4 L17 24 L0 12 L-17 24 L-10 4 L-27 -8 L-6 -8 Z" />
          <circle cx="-26" cy="-30" r="2" />
          <circle cx="26" cy="26" r="2" />
        </g>
      )}
      <text y="76" textAnchor="middle" fontFamily="Cormorant Garamond, serif" fontSize="11" letterSpacing="2.5" fill="#e2cb94">
        {label}
      </text>
    </g>
  );
}

function TarotScene({ id }: { id: string }) {
  return (
    <g>
      <defs>
        <radialGradient id={`${id}-bg`} cx="0.5" cy="0.55" r="0.75">
          <stop offset="0" stopColor="#66397a" />
          <stop offset="0.55" stopColor="#2b1636" />
          <stop offset="1" stopColor="#120a1a" />
        </radialGradient>
        <Blur id={`${id}-sh`} sd={8} />
      </defs>
      <rect width="400" height="500" fill={`url(#${id}-bg)`} />
      {/* velvet folds */}
      <path d="M0 120 C120 160 260 80 400 140" stroke="#7f4e95" strokeOpacity="0.15" strokeWidth="30" fill="none" />
      <path d="M0 390 C140 350 250 430 400 380" stroke="#120a1a" strokeOpacity="0.35" strokeWidth="40" fill="none" />
      <Bokeh id={id} seed={11} count={10} opacity={0.25} />
      <g transform="translate(200 270)">
        {[
          { r: -16, x: -86, y: 14, s: "moon" as const, l: "THE MOON" },
          { r: 16, x: 86, y: 14, s: "star" as const, l: "THE STAR" },
          { r: 0, x: 0, y: -10, s: "sun" as const, l: "THE SUN" },
        ].map((c) => (
          <g key={c.l} transform={`translate(${c.x} ${c.y}) rotate(${c.r})`}>
            <rect x="-56" y="-88" width="112" height="184" rx="9" fill="#000" opacity="0.5" filter={`url(#${id}-sh)`} />
            <TarotCard symbol={c.s} label={c.l} />
          </g>
        ))}
      </g>
      {/* scattered crystals + petals */}
      <g transform="translate(70 430)">
        <path d="M0 0 L10 -26 L20 0 Z" fill="#a98bbd" />
        <path d="M10 -26 L20 0 L14 0 Z" fill="#ddd0e6" opacity="0.7" />
        <path d="M18 2 L26 -14 L34 2 Z" fill="#7f4e95" />
      </g>
      <Rose x={330} y={440} r={13} c1="#5c2141" c2="#8a3a63" />
      <ellipse cx="300" cy="455" rx="6" ry="3" fill="#8a3a63" transform="rotate(30 300 455)" />
      <ellipse cx="352" cy="420" rx="5" ry="2.5" fill="#8a3a63" transform="rotate(-20 352 420)" />
    </g>
  );
}

function BotanicalScene({ id }: { id: string }) {
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f8f2e8" />
          <stop offset="0.6" stopColor="#eee6f2" />
          <stop offset="1" stopColor="#ddd0e6" />
        </linearGradient>
        <radialGradient id={`${id}-sun`} cx="0.15" cy="0.1" r="0.8">
          <stop offset="0" stopColor="#fff7e0" stopOpacity="0.9" />
          <stop offset="1" stopColor="#fff7e0" stopOpacity="0" />
        </radialGradient>
        <Blur id={`${id}-sh`} sd={5} />
      </defs>
      <rect width="400" height="500" fill={`url(#${id}-bg)`} />
      <rect width="400" height="500" fill={`url(#${id}-sun)`} />
      {/* window light */}
      <g opacity="0.25" fill="#fff">
        <path d="M-40 0 L80 0 L260 500 L140 500 Z" />
        <path d="M110 0 L150 0 L330 500 L290 500 Z" />
      </g>
      {/* bundle shadow */}
      <g transform="translate(14 14)" opacity="0.18" filter={`url(#${id}-sh)`}>
        <path d="M200 420 L140 120 M200 420 L200 100 M200 420 L260 120" stroke="#2b1636" strokeWidth="18" />
      </g>
      {/* twine bundle */}
      {Array.from({ length: 13 }, (_, i) => {
        const a = -26 + i * 4.3;
        return <Lavender key={i} x={200} y={430} h={250 + ((i * 29) % 50)} angle={a} color={i % 3 === 0 ? "#c4aed3" : i % 3 === 1 ? "#a98bbd" : "#7f4e95"} />;
      })}
      {[-40, -20, 20, 44].map((a, i) => (
        <g key={a} transform={`rotate(${a} 200 430)`}>
          <path d="M200 430 L200 220" stroke="#6b7a50" strokeWidth="1.5" />
          {Array.from({ length: 7 }, (_, j) => (
            <Leaf key={j} x={200} y={410 - j * 28} s={0.7} angle={j % 2 ? 40 : -40} c={i % 2 ? "#7d8c63" : "#94a27a"} />
          ))}
        </g>
      ))}
      <rect x="186" y="380" width="28" height="14" rx="3" fill="#b8965a" />
      <path d="M186 386 L214 386" stroke="#6b5330" strokeWidth="1" />
      <path d="M200 394 C190 420 175 432 168 452 M200 394 C214 420 224 436 234 452" stroke="#b8965a" strokeWidth="2" fill="none" />
      <Blossom x={150} y={300} r={9} c="#fdfaf4" />
      <Blossom x={244} y={250} r={8} c="#fdfaf4" />
      <Rose x={226} y={340} r={14} c1="#d9b8c8" c2="#f1dbe5" />
    </g>
  );
}

function CircleScene({ id }: { id: string }) {
  const n = 12;
  return (
    <g>
      <defs>
        <radialGradient id={`${id}-bg`} cx="0.5" cy="0.55" r="0.8">
          <stop offset="0" stopColor="#4d2a5e" />
          <stop offset="0.6" stopColor="#1f0f27" />
          <stop offset="1" stopColor="#0c0612" />
        </radialGradient>
        <linearGradient id={`${id}-wax`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#d9cbb3" />
          <stop offset="0.4" stopColor="#fbf5ea" />
          <stop offset="1" stopColor="#bfae92" />
        </linearGradient>
        <FlameDefs id={id} />
      </defs>
      <rect width="400" height="500" fill={`url(#${id}-bg)`} />
      <Stars seed={21} count={30} maxY={160} />
      <ellipse cx="200" cy="320" rx="150" ry="58" fill="none" stroke="#cfb173" strokeOpacity="0.35" />
      <ellipse cx="200" cy="320" rx="110" ry="40" fill="none" stroke="#cfb173" strokeOpacity="0.2" />
      {/* petals in the centre */}
      <g transform="translate(200 320) scale(1 0.4)">
        {Array.from({ length: 10 }, (_, i) => (
          <ellipse key={i} cx="0" cy="-34" rx="12" ry="30" fill={i % 2 ? "#a98bbd" : "#c4aed3"} transform={`rotate(${i * 36})`} opacity="0.8" />
        ))}
        <circle r="16" fill="#e2cb94" />
      </g>
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2;
        const x = r2(200 + Math.cos(a) * 150);
        const y = r2(320 + Math.sin(a) * 58);
        const depth = r2((Math.sin(a) + 1) / 2);
        return { x, y, depth, i };
      })
        .sort((p, q) => p.y - q.y)
        .map(({ x, y, depth, i }) => <Candle key={i} id={id} x={x} base={y} h={36 + depth * 22} w={12 + depth * 8} />)}
    </g>
  );
}

function StashHatScene({ id }: { id: string }) {
  return (
    <g>
      <defs>
        <radialGradient id={`${id}-bg`} cx="0.5" cy="0.4" r="0.8">
          <stop offset="0" stopColor="#fdfaf4" />
          <stop offset="0.6" stopColor="#eee6f2" />
          <stop offset="1" stopColor="#c4aed3" />
        </radialGradient>
      </defs>
      <rect width="400" height="500" fill={`url(#${id}-bg)`} />
      <path d="M0 360 C120 340 280 340 400 360 L400 500 L0 500 Z" fill="#efe6d6" opacity="0.7" />
      <g transform="translate(200 370) scale(1.05)">
        <Hat id={id} light />
        {/* magnetic stash clasp hint */}
        <g transform="translate(14 -120)">
          <circle r="9" fill="#2b1636" stroke="#cfb173" strokeWidth="1.5" />
          <circle r="3" fill="#e2cb94" />
          <path d="M-22 14 C-8 22 8 22 24 12" stroke="#cfb173" strokeOpacity="0.6" strokeDasharray="2 3" fill="none" />
        </g>
      </g>
    </g>
  );
}

type NecklaceVariant = "spiral" | "fish" | "thorn" | "leaf";

const NECKLACE_COLORS: Record<NecklaceVariant, { a: string; b: string; c: string; bg1: string; bg2: string; metal: [string, string] }> = {
  spiral: { a: "#9e2a2b", b: "#2c4f8a", c: "#e9e2d0", bg1: "#f8f2e8", bg2: "#e3d6c0", metal: ["#f1f1ef", "#8e8f95"] },
  fish: { a: "#1e2f4d", b: "#3f6f78", c: "#c9d1d6", bg1: "#f3f1ee", bg2: "#d6d3d9", metal: ["#fafafa", "#8b9096"] },
  thorn: { a: "#5c1a2b", b: "#82283e", c: "#2b1636", bg1: "#f5ede8", bg2: "#ddc9c9", metal: ["#d9d4d0", "#5e5a58"] },
  leaf: { a: "#6b4226", b: "#5f6b3a", c: "#b8763f", bg1: "#f8f2e8", bg2: "#e3d2b8", metal: ["#f2b27a", "#8a4b22"] },
};

const SPIRAL = (() => {
  const pts: string[] = [];
  for (let i = 0; i <= 120; i++) {
    const t = (i / 120) * Math.PI * 6;
    const r = 1 + t * 1.05;
    pts.push(`${r2(Math.cos(t) * r)} ${r2(Math.sin(t) * r)}`);
  }
  return `M${pts.join(" L")}`;
})();

function NecklaceScene({ id, variant }: { id: string; variant: NecklaceVariant }) {
  const k = NECKLACE_COLORS[variant] ?? NECKLACE_COLORS.spiral;
  const cord = "M60 -10 C60 180 120 320 200 330 C280 320 340 180 340 -10";
  return (
    <g>
      <defs>
        <radialGradient id={`${id}-bg`} cx="0.45" cy="0.4" r="0.85">
          <stop offset="0" stopColor={k.bg1} />
          <stop offset="1" stopColor={k.bg2} />
        </radialGradient>
        <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={k.metal[0]} />
          <stop offset="1" stopColor={k.metal[1]} />
        </linearGradient>
        <pattern id={`${id}-linen`} width="6" height="6" patternUnits="userSpaceOnUse">
          <path d="M0 3 H6 M3 0 V6" stroke="#000" strokeOpacity="0.035" />
        </pattern>
        <Blur id={`${id}-sh`} sd={4} />
      </defs>
      <rect width="400" height="500" fill={`url(#${id}-bg)`} />
      <rect width="400" height="500" fill={`url(#${id}-linen)`} />
      {/* soft folded fabric */}
      <path d="M0 420 C100 400 220 450 400 410 L400 500 L0 500 Z" fill="#fff" opacity="0.35" />
      {/* shadow */}
      <path d={cord} transform="translate(5 8)" stroke="#2b1636" strokeOpacity="0.22" strokeWidth="12" fill="none" filter={`url(#${id}-sh)`} />
      {/* braided cord: base + twisted overlays */}
      <path d={cord} stroke={k.a} strokeWidth="11" fill="none" strokeLinecap="round" />
      <path d={cord} stroke={k.b} strokeWidth="11" fill="none" strokeDasharray="5 5" />
      <path d={cord} stroke={k.c} strokeWidth="3" fill="none" strokeDasharray="2 8" strokeDashoffset="3" opacity="0.8" />
      <path d={cord} stroke="#fff" strokeOpacity="0.18" strokeWidth="2" fill="none" transform="translate(-2 -2)" />
      {/* end cap + bail */}
      <circle cx="200" cy="331" r="7" fill={`url(#${id}-metal)`} />
      <g transform="translate(200 338) scale(1.35)">
        {variant === "spiral" && (
          <g transform="translate(0 30)">
            <circle r="27" fill="#2b1636" opacity="0.18" transform="translate(3 5)" filter={`url(#${id}-sh)`} />
            <circle r="27" fill={`url(#${id}-metal)`} />
            <circle r="23.5" fill="none" stroke="#6d6e74" strokeOpacity="0.5" />
            <path d={SPIRAL} fill="none" stroke="#5d5e64" strokeWidth="2" strokeLinecap="round" />
          </g>
        )}
        {variant === "fish" && (
          <g transform="translate(0 30) rotate(90)">
            <path d="M-34 0 C-20 -20 14 -22 30 0 C14 22 -20 20 -34 0 Z" fill={`url(#${id}-metal)`} />
            <path d="M28 0 L48 -16 L44 0 L48 16 Z" fill={`url(#${id}-metal)`} />
            <circle cx="-20" cy="-4" r="2.4" fill="#2b2f36" />
            {[-6, 4, 14].map((x) => (
              <path key={x} d={`M${x} -12 C${x + 6} -4 ${x + 6} 4 ${x} 12`} stroke="#6d737b" strokeWidth="1" fill="none" />
            ))}
          </g>
        )}
        {variant === "thorn" && (
          <g transform="translate(0 4)">
            <path d="M0 0 C-6 20 -4 44 6 66 C2 44 4 20 8 0 Z" fill={`url(#${id}-metal)`} />
            <path d="M-2 18 L-18 10 L-3 26 Z M5 36 L22 28 L6 44 Z M-1 52 L-14 50 L1 58 Z" fill={`url(#${id}-metal)`} />
          </g>
        )}
        {variant === "leaf" && (
          <g transform="translate(0 2)">
            <path d="M0 0 C30 18 34 54 0 82 C-34 54 -30 18 0 0 Z" fill={`url(#${id}-metal)`} />
            <path d="M0 4 L0 78" stroke="#6b3a1a" strokeWidth="1.4" />
            {[20, 34, 48, 62].map((y) => (
              <g key={y} stroke="#6b3a1a" strokeWidth="1" fill="none">
                <path d={`M0 ${y} C8 ${y - 4} 14 ${y - 10} 18 ${y - 16}`} />
                <path d={`M0 ${y} C-8 ${y - 4} -14 ${y - 10} -18 ${y - 16}`} />
              </g>
            ))}
          </g>
        )}
      </g>
      <Blossom x={64} y={440} r={8} c="#fdfaf4" center="#cfb173" />
      <Leaf x={350} y={460} s={0.9} angle={-30} c="#94a27a" />
      <Leaf x={364} y={458} s={0.7} angle={20} c="#7d8c63" />
    </g>
  );
}
