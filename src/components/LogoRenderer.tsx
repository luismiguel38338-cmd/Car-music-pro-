import React from 'react';
import { RadioStation, BadgeShape, IconType, TypographyStyle } from '../types/radio';

interface LogoRendererProps {
  station: RadioStation;
  size?: number | string;
  className?: string;
  isPlaying?: boolean;
  idPrefix?: string;
}

export const LogoRenderer: React.FC<LogoRendererProps> = ({
  station,
  size = 320,
  className = '',
  isPlaying = false,
  idPrefix = 'logo',
}) => {
  // If the station has custom SVG code (e.g. from Gemini AI), sanitize and render
  if (station.customSvg && station.customSvg.includes('<svg')) {
    // If it's an SVG string, inject cleanly
    return (
      <div
        className={`relative flex items-center justify-center overflow-hidden select-none ${className}`}
        style={{ width: typeof size === 'number' ? `${size}px` : size, height: typeof size === 'number' ? `${size}px` : size }}
        dangerouslySetInnerHTML={{ __html: station.customSvg }}
      />
    );
  }

  const {
    name,
    callSign,
    frequency,
    band,
    slogan,
    palette,
    badgeShape,
    iconType,
    typography,
    fx,
  } = station;

  const uid = `${idPrefix}-${station.id}`;

  const getFontFamily = (typo: TypographyStyle) => {
    switch (typo) {
      case 'bebas':
        return "'Bebas Neue', sans-serif";
      case 'orbitron':
        return "'Orbitron', sans-serif";
      case 'syne':
        return "'Syne', sans-serif";
      case 'space':
        return "'Space Grotesk', sans-serif";
      case 'inter':
      default:
        return "'Inter', sans-serif";
    }
  };

  // Render Badge Vector Shape
  const renderBadgeBackground = (shape: BadgeShape) => {
    switch (shape) {
      case 'oval':
        return (
          <g>
            <ellipse
              cx="250"
              cy="250"
              rx="230"
              ry="190"
              fill={palette.bg}
              stroke={palette.primary}
              strokeWidth="10"
              filter={fx.neonGlow ? `url(#${uid}-glow)` : undefined}
            />
            <ellipse
              cx="250"
              cy="250"
              rx="215"
              ry="175"
              fill="none"
              stroke={palette.secondary}
              strokeWidth="3"
              strokeDasharray="8 6"
            />
          </g>
        );

      case 'neon-frame':
        return (
          <g>
            <rect
              x="25"
              y="25"
              width="450"
              height="450"
              rx="40"
              fill={palette.bg}
              stroke={palette.primary}
              strokeWidth="10"
              filter={fx.neonGlow ? `url(#${uid}-glow)` : undefined}
            />
            <rect
              x="45"
              y="45"
              width="410"
              height="410"
              rx="28"
              fill="none"
              stroke={palette.secondary}
              strokeWidth="4"
              opacity="0.75"
            />
            {/* Corner brackets */}
            <path
              d="M 50 100 L 50 50 L 100 50 M 400 50 L 450 50 L 450 100 M 450 400 L 450 450 L 400 450 M 100 450 L 50 450 L 50 400"
              fill="none"
              stroke={palette.accent}
              strokeWidth="6"
            />
          </g>
        );

      case 'shield':
        return (
          <g>
            <path
              d="M 250 25 L 450 85 C 450 280, 360 410, 250 475 C 140 410, 50 280, 50 85 Z"
              fill={palette.bg}
              stroke={palette.primary}
              strokeWidth="10"
              filter={fx.neonGlow ? `url(#${uid}-glow)` : undefined}
            />
            <path
              d="M 250 50 L 425 105 C 425 270, 345 385, 250 445 C 155 385, 75 270, 75 105 Z"
              fill="none"
              stroke={palette.secondary}
              strokeWidth="4"
            />
          </g>
        );

      case 'hexagon':
        return (
          <g>
            <polygon
              points="250,20 460,135 460,365 250,480 40,365 40,135"
              fill={palette.bg}
              stroke={palette.primary}
              strokeWidth="10"
              filter={fx.neonGlow ? `url(#${uid}-glow)` : undefined}
            />
            <polygon
              points="250,45 435,148 435,352 250,455 65,352 65,148"
              fill="none"
              stroke={palette.secondary}
              strokeWidth="4"
              strokeDasharray="12 8"
            />
          </g>
        );

      case 'cassette':
        return (
          <g>
            {/* Cassette Shell */}
            <rect
              x="30"
              y="60"
              width="440"
              height="380"
              rx="24"
              fill={palette.bg}
              stroke={palette.primary}
              strokeWidth="10"
              filter={fx.neonGlow ? `url(#${uid}-glow)` : undefined}
            />
            {/* Cassette Label Area */}
            <rect
              x="60"
              y="90"
              width="380"
              height="240"
              rx="12"
              fill={`url(#${uid}-gradient-bg)`}
              stroke={palette.secondary}
              strokeWidth="4"
            />
            {/* Tape Window */}
            <rect
              x="130"
              y="200"
              width="240"
              height="100"
              rx="16"
              fill="#08080c"
              stroke={palette.accent}
              strokeWidth="3"
            />
            {/* Left tape reel */}
            <circle cx="180" cy="250" r="30" fill="none" stroke={palette.text} strokeWidth="3" />
            <circle cx="180" cy="250" r="16" fill={palette.primary} />
            {/* Right tape reel */}
            <circle cx="320" cy="250" r="30" fill="none" stroke={palette.text} strokeWidth="3" />
            <circle cx="320" cy="250" r="16" fill={palette.primary} />
            {/* Tape belt bridge */}
            <rect x="180" y="246" width="140" height="8" fill="#1c1917" />
          </g>
        );

      case 'vinyl':
        return (
          <g>
            {/* Vinyl Edge */}
            <circle
              cx="250"
              cy="250"
              r="230"
              fill="#101014"
              stroke={palette.primary}
              strokeWidth="10"
              filter={fx.neonGlow ? `url(#${uid}-glow)` : undefined}
            />
            {/* Grooves */}
            <circle cx="250" cy="250" r="210" fill="none" stroke="#222" strokeWidth="2" />
            <circle cx="250" cy="250" r="195" fill="none" stroke="#1c1c24" strokeWidth="3" />
            <circle cx="250" cy="250" r="175" fill="none" stroke="#222" strokeWidth="2" />
            <circle cx="250" cy="250" r="155" fill="none" stroke="#1c1c24" strokeWidth="3" />
            {/* Center Label */}
            <circle
              cx="250"
              cy="250"
              r="125"
              fill={palette.bg}
              stroke={palette.secondary}
              strokeWidth="6"
            />
            <circle
              cx="250"
              cy="250"
              r="110"
              fill="none"
              stroke={palette.accent}
              strokeWidth="2"
              strokeDasharray="6 4"
            />
            {/* Center Spindle Hole */}
            <circle cx="250" cy="250" r="18" fill="#050508" stroke={palette.text} strokeWidth="3" />
          </g>
        );

      case 'diamond':
        return (
          <g>
            <polygon
              points="250,20 470,250 250,480 30,250"
              fill={palette.bg}
              stroke={palette.primary}
              strokeWidth="10"
              filter={fx.neonGlow ? `url(#${uid}-glow)` : undefined}
            />
            <polygon
              points="250,45 440,250 250,455 60,250"
              fill="none"
              stroke={palette.secondary}
              strokeWidth="4"
            />
          </g>
        );

      case 'stamp':
        return (
          <g>
            <rect
              x="35"
              y="35"
              width="430"
              height="430"
              fill={palette.bg}
              stroke={palette.primary}
              strokeWidth="12"
              strokeDasharray="28 10"
            />
            <rect
              x="55"
              y="55"
              width="390"
              height="390"
              fill="none"
              stroke={palette.secondary}
              strokeWidth="3"
            />
          </g>
        );

      case 'minimal-circle':
      default:
        return (
          <g>
            <circle
              cx="250"
              cy="250"
              r="225"
              fill={palette.bg}
              stroke={palette.primary}
              strokeWidth="10"
              filter={fx.neonGlow ? `url(#${uid}-glow)` : undefined}
            />
            <circle
              cx="250"
              cy="250"
              r="205"
              fill="none"
              stroke={palette.secondary}
              strokeWidth="4"
              opacity="0.8"
            />
          </g>
        );
    }
  };

  // Render Vector Icon
  const renderIcon = (type: IconType) => {
    const iconColor = palette.accent;
    const secondaryColor = palette.secondary;

    switch (type) {
      case 'tower':
        return (
          <g transform="translate(250, 150) scale(0.9)">
            {/* Mast */}
            <line x1="0" y1="-50" x2="0" y2="40" stroke={iconColor} strokeWidth="6" strokeLinecap="round" />
            <polygon points="-25,40 25,40 0,-40" fill="none" stroke={iconColor} strokeWidth="5" />
            <line x1="-15" y1="15" x2="15" y2="15" stroke={iconColor} strokeWidth="4" />
            <line x1="-8" y1="-10" x2="8" y2="-10" stroke={iconColor} strokeWidth="4" />
            <circle cx="0" cy="-52" r="6" fill={palette.primary} />
            {/* Broadcast wave arcs */}
            <path d="M -30 -65 A 35 35 0 0 1 30 -65" fill="none" stroke={secondaryColor} strokeWidth="4" strokeLinecap="round" />
            <path d="M -45 -78 A 55 55 0 0 1 45 -78" fill="none" stroke={secondaryColor} strokeWidth="5" strokeLinecap="round" opacity="0.8" />
            <path d="M -60 -90 A 75 75 0 0 1 60 -90" fill="none" stroke={secondaryColor} strokeWidth="4" strokeLinecap="round" opacity="0.6" />
          </g>
        );

      case 'microphone':
        return (
          <g transform="translate(250, 140) scale(0.85)">
            {/* Vintage 50s mic capsule */}
            <rect x="-30" y="-55" width="60" height="75" rx="30" fill={palette.bg} stroke={iconColor} strokeWidth="7" />
            {/* Mic grill ribs */}
            <line x1="-22" y1="-30" x2="22" y2="-30" stroke={secondaryColor} strokeWidth="4" />
            <line x1="-25" y1="-15" x2="25" y2="-15" stroke={secondaryColor} strokeWidth="4" />
            <line x1="-22" y1="0" x2="22" y2="0" stroke={secondaryColor} strokeWidth="4" />
            <line x1="0" y1="-55" x2="0" y2="20" stroke={secondaryColor} strokeWidth="4" />
            {/* U-cradle frame */}
            <path d="M -42 -20 C -42 45, 42 45, 42 -20" fill="none" stroke={iconColor} strokeWidth="7" strokeLinecap="round" />
            {/* Stem & base */}
            <line x1="0" y1="36" x2="0" y2="65" stroke={iconColor} strokeWidth="8" />
            <line x1="-35" y1="65" x2="35" y2="65" stroke={iconColor} strokeWidth="8" strokeLinecap="round" />
          </g>
        );

      case 'headphones':
        return (
          <g transform="translate(250, 145) scale(0.85)">
            {/* Headband arch */}
            <path d="M -60 15 A 65 65 0 0 1 60 15" fill="none" stroke={iconColor} strokeWidth="9" strokeLinecap="round" />
            <path d="M -50 15 A 55 55 0 0 1 50 15" fill="none" stroke={secondaryColor} strokeWidth="3" opacity="0.6" />
            {/* Left cup */}
            <rect x="-72" y="5" width="24" height="48" rx="12" fill={iconColor} stroke={palette.text} strokeWidth="3" />
            {/* Right cup */}
            <rect x="48" y="5" width="24" height="48" rx="12" fill={iconColor} stroke={palette.text} strokeWidth="3" />
          </g>
        );

      case 'vinyl':
        return (
          <g transform="translate(250, 140) scale(0.8)">
            <circle cx="0" cy="0" r="55" fill="#141418" stroke={iconColor} strokeWidth="6" />
            <circle cx="0" cy="0" r="42" fill="none" stroke={secondaryColor} strokeWidth="2" />
            <circle cx="0" cy="0" r="28" fill="none" stroke={secondaryColor} strokeWidth="2" opacity="0.6" />
            <circle cx="0" cy="0" r="18" fill={palette.primary} stroke={palette.text} strokeWidth="2" />
            <circle cx="0" cy="0" r="6" fill="#000" />
            {/* Reflection gleam */}
            <path d="M -35 -35 L 35 35" stroke="#ffffff" strokeWidth="4" opacity="0.3" strokeLinecap="round" />
          </g>
        );

      case 'waves':
        return (
          <g transform="translate(250, 145) scale(0.9)">
            <path
              d="M -90 0 Q -67 -40 -45 0 T 0 0 T 45 0 T 90 0"
              fill="none"
              stroke={iconColor}
              strokeWidth="8"
              strokeLinecap="round"
            />
            <path
              d="M -75 25 Q -50 -15 -25 25 T 25 25 T 75 25"
              fill="none"
              stroke={secondaryColor}
              strokeWidth="5"
              strokeLinecap="round"
              opacity="0.8"
            />
          </g>
        );

      case 'lightning':
        return (
          <g transform="translate(250, 140) scale(0.9)">
            <polygon
              points="8,-60 -45,0 -5,0 -20,60 50,-10 10,-10"
              fill={iconColor}
              stroke={palette.primary}
              strokeWidth="4"
              strokeLinejoin="round"
            />
          </g>
        );

      case 'equalizer':
        return (
          <g transform="translate(250, 145)">
            {[-60, -36, -12, 12, 36, 60].map((x, i) => {
              const heights = [35, 65, 85, 55, 75, 45];
              const h = heights[i];
              return (
                <rect
                  key={i}
                  x={x - 8}
                  y={-h / 2}
                  width="16"
                  height={h}
                  rx="4"
                  fill={i % 2 === 0 ? iconColor : secondaryColor}
                />
              );
            })}
          </g>
        );

      case 'cassette':
        return (
          <g transform="translate(250, 140) scale(0.8)">
            <rect x="-65" y="-45" width="130" height="90" rx="10" fill={palette.bg} stroke={iconColor} strokeWidth="6" />
            <rect x="-45" y="-25" width="90" height="50" rx="6" fill="#18181b" stroke={secondaryColor} strokeWidth="3" />
            <circle cx="-22" cy="0" r="14" fill="none" stroke={iconColor} strokeWidth="3" />
            <circle cx="22" cy="0" r="14" fill="none" stroke={iconColor} strokeWidth="3" />
            <circle cx="-22" cy="0" r="6" fill={palette.primary} />
            <circle cx="22" cy="0" r="6" fill={palette.primary} />
            <line x1="-22" y1="-2" x2="22" y2="-2" stroke={secondaryColor} strokeWidth="3" />
          </g>
        );

      case 'speaker':
        return (
          <g transform="translate(250, 140) scale(0.85)">
            <rect x="-55" y="-55" width="110" height="110" rx="16" fill={palette.bg} stroke={iconColor} strokeWidth="7" />
            <circle cx="0" cy="18" r="30" fill="none" stroke={secondaryColor} strokeWidth="6" />
            <circle cx="0" cy="18" r="12" fill={iconColor} />
            <circle cx="0" cy="-28" r="12" fill="none" stroke={secondaryColor} strokeWidth="4" />
          </g>
        );

      case 'star':
      default:
        return (
          <g transform="translate(250, 140) scale(0.9)">
            <path
              d="M 0 -60 L 16 -18 L 60 -18 L 24 10 L 38 52 L 0 26 L -38 52 L -24 10 L -60 -18 L -16 -18 Z"
              fill={iconColor}
              stroke={palette.primary}
              strokeWidth="5"
              strokeLinejoin="round"
            />
          </g>
        );
    }
  };

  const fontFamily = getFontFamily(typography);

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={{
        width: typeof size === 'number' ? `${size}px` : size,
        height: typeof size === 'number' ? `${size}px` : size,
      }}
    >
      <svg
        viewBox="0 0 500 500"
        className="w-full h-full overflow-visible transition-transform duration-300"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Linear background gradient */}
          <linearGradient id={`${uid}-gradient-bg`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={palette.bg} />
            <stop offset="100%" stopColor="#020306" />
          </linearGradient>

          {/* Chrome / metallic highlight */}
          <linearGradient id={`${uid}-chrome`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="48%" stopColor={palette.primary} />
            <stop offset="52%" stopColor="#ffffff" />
            <stop offset="100%" stopColor={palette.secondary} />
          </linearGradient>

          {/* Neon Glow Filter */}
          <filter id={`${uid}-glow`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="8" result="blur1" />
            <feGaussianBlur stdDeviation="18" result="blur2" />
            <feMerge>
              <feMergeNode in="blur2" />
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Subtle Drop Shadow */}
          <filter id={`${uid}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#000000" floodOpacity="0.7" />
          </filter>

          {/* Scanlines Pattern */}
          <pattern id={`${uid}-scanlines`} width="100" height="4" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="100" y2="0" stroke="#ffffff" strokeWidth="1" opacity="0.06" />
          </pattern>

          {/* Distressed Noise Texture Filter */}
          <filter id={`${uid}-grunge`}>
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" result="noise" />
            <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.15 0" />
            <feComposite in2="SourceGraphic" in="glitch" operator="in" />
          </filter>
        </defs>

        {/* 1. Badge Base & Frame */}
        {renderBadgeBackground(badgeShape)}

        {/* 2. Optional FX: Scanline mesh */}
        {fx.scanlines && (
          <rect x="30" y="30" width="440" height="440" rx="30" fill={`url(#${uid}-scanlines)`} pointerEvents="none" />
        )}

        {/* 3. Optional FX: Vinyl groove texture rings if badge isn't already vinyl */}
        {fx.vinylGrooves && badgeShape !== 'vinyl' && (
          <g opacity="0.12" pointerEvents="none">
            <circle cx="250" cy="250" r="180" fill="none" stroke="#fff" strokeWidth="1" />
            <circle cx="250" cy="250" r="140" fill="none" stroke="#fff" strokeWidth="1" />
            <circle cx="250" cy="250" r="100" fill="none" stroke="#fff" strokeWidth="1" />
          </g>
        )}

        {/* 4. Radio Broadcast Icon Symbol */}
        <g id={`${uid}-icon`}>{renderIcon(iconType)}</g>

        {/* 5. Station Name Header / Main Typography */}
        <g id={`${uid}-text`} filter={`url(#${uid}-shadow)`}>
          {/* Main Station Name */}
          <text
            x="250"
            y={badgeShape === 'cassette' ? '180' : '265'}
            textAnchor="middle"
            fill={fx.chromeSheen ? `url(#${uid}-chrome)` : palette.text}
            fontSize={name.length > 12 ? '36' : name.length > 8 ? '44' : '52'}
            fontWeight="900"
            letterSpacing="3"
            style={{ fontFamily }}
          >
            {name.toUpperCase()}
          </text>

          {/* Call Sign & Frequency Tag */}
          <g transform={`translate(250, ${badgeShape === 'cassette' ? '370' : '330'})`}>
            {/* Frequency pill / bar backing */}
            <rect
              x="-150"
              y="-24"
              width="300"
              height="44"
              rx="10"
              fill={palette.primary}
              opacity="0.95"
            />
            {/* Subtle inner highlight */}
            <rect
              x="-148"
              y="-22"
              width="296"
              height="20"
              rx="8"
              fill="#ffffff"
              opacity="0.15"
            />
            {/* Call sign text */}
            <text
              x="0"
              y="6"
              textAnchor="middle"
              fill="#ffffff"
              fontSize="22"
              fontWeight="800"
              letterSpacing="2"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {callSign ? callSign.toUpperCase() : `${frequency} ${band}`}
            </text>
          </g>

          {/* Slogan / Station Tagline */}
          {slogan && (
            <text
              x="250"
              y={badgeShape === 'cassette' ? '415' : '390'}
              textAnchor="middle"
              fill={palette.accent}
              fontSize="13"
              fontWeight="700"
              letterSpacing="4"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {slogan.toUpperCase()}
            </text>
          )}

          {/* Sub-badge frequency pill top or bottom */}
          <g transform={`translate(250, ${badgeShape === 'cassette' ? '110' : '430'})`}>
            <text
              x="0"
              y="0"
              textAnchor="middle"
              fill={palette.secondary}
              fontSize="12"
              fontWeight="800"
              letterSpacing="3"
              opacity="0.85"
              style={{ fontFamily: "'Orbitron', sans-serif" }}
            >
              ● BROADCAST STEREO ● {band} BAND ●
            </text>
          </g>
        </g>

        {/* 6. Live "ON AIR" indicator if station is playing */}
        {isPlaying && (
          <g transform="translate(40, 45)" className="animate-pulse">
            <rect x="0" y="0" width="80" height="24" rx="6" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
            <circle cx="12" cy="12" r="4" fill="#ffffff" />
            <text
              x="44"
              y="16"
              textAnchor="middle"
              fill="#ffffff"
              fontSize="10"
              fontWeight="900"
              letterSpacing="1.5"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              ON AIR
            </text>
          </g>
        )}
      </svg>
    </div>
  );
};
