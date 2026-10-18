export type BandType = 'FM' | 'AM' | 'WEB' | 'DAB+';

export type BadgeShape =
  | 'oval'
  | 'neon-frame'
  | 'shield'
  | 'cassette'
  | 'hexagon'
  | 'vinyl'
  | 'stamp'
  | 'diamond'
  | 'minimal-circle';

export type IconType =
  | 'tower'
  | 'microphone'
  | 'headphones'
  | 'vinyl'
  | 'waves'
  | 'lightning'
  | 'equalizer'
  | 'cassette'
  | 'speaker'
  | 'star';

export type TypographyStyle = 'bebas' | 'orbitron' | 'syne' | 'inter' | 'space';

export type EraStyle =
  | '80s Retro'
  | 'Modern Minimal'
  | 'Cyberpunk'
  | 'Golden Age 50s'
  | '90s Grunge'
  | 'Club Neon';

export interface StationPalette {
  primary: string;
  secondary: string;
  accent: string;
  bg: string;
  text: string;
}

export interface StationLogoFX {
  neonGlow: boolean;
  scanlines: boolean;
  vintageDistress: boolean;
  chromeSheen: boolean;
  vinylGrooves: boolean;
}

export interface RadioStation {
  id: string;
  name: string;
  callSign: string;
  frequency: number;
  band: BandType;
  slogan: string;
  genre: string;
  era: EraStyle;
  palette: StationPalette;
  badgeShape: BadgeShape;
  iconType: IconType;
  typography: TypographyStyle;
  fx: StationLogoFX;
  audioStreamUrl?: string;
  audioGenreSeed: string; // Used by our Web Audio music engine
  customSvg?: string;
  lore?: string;
  bitrate?: string;
  isCustom?: boolean;
}
