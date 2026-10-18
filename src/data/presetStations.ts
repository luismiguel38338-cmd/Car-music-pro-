import { RadioStation } from '../types/radio';

export const PRESET_STATIONS: RadioStation[] = [
  {
    id: 'synth-city-845',
    name: 'SYNTH CITY',
    callSign: 'WSNT 84.5 FM',
    frequency: 84.5,
    band: 'FM',
    slogan: 'NIGHT DRIVE THROUGH THE GRID',
    genre: 'Synthwave & Retrowave',
    era: '80s Retro',
    palette: {
      primary: '#ff007f', // hot pink
      secondary: '#00f0ff', // electric cyan
      accent: '#ffe600', // neon yellow
      bg: '#0d0718', // deep outrun purple
      text: '#ffffff',
    },
    badgeShape: 'neon-frame',
    iconType: 'tower',
    typography: 'orbitron',
    fx: {
      neonGlow: true,
      scanlines: true,
      vintageDistress: false,
      chromeSheen: true,
      vinylGrooves: false,
    },
    audioGenreSeed: 'synthwave',
    audioStreamUrl: 'https://ice1.somafm.com/u80s-128-mp3',
    bitrate: '320 kbps HD',
    lore: 'Broadcasting from a neon-drenched rooftop in Neo-Miami, dedicated to vintage synthesizers, analog tape delays, and endless highways.',
  },
  {
    id: 'velvet-blue-913',
    name: 'VELVET BLUE',
    callSign: 'WBLU 91.3 FM',
    frequency: 91.3,
    band: 'FM',
    slogan: 'LATE NIGHT SMOKE & SULTRY BRASS',
    genre: 'Midnight Jazz & Soul',
    era: 'Golden Age 50s',
    palette: {
      primary: '#d4af37', // metallic gold
      secondary: '#1e3a8a', // deep midnight navy
      accent: '#f59e0b', // warm amber
      bg: '#0a0d14', // obsidian lounge
      text: '#f8fafc',
    },
    badgeShape: 'oval',
    iconType: 'microphone',
    typography: 'bebas',
    fx: {
      neonGlow: false,
      scanlines: false,
      vintageDistress: true,
      chromeSheen: false,
      vinylGrooves: true,
    },
    audioGenreSeed: 'jazz',
    audioStreamUrl: 'https://ice2.somafm.com/sonicuniverse-128-mp3',
    bitrate: '256 kbps Studio',
    lore: 'Recorded live from the cellar speakeasies of 1958 Harlem and Greenwich Village. Pure tube warmth and uncompressed saxophones.',
  },
  {
    id: 'cyberpunk-1099',
    name: 'CYBER DRIVE',
    callSign: 'K-CYBR 109.9',
    frequency: 107.9,
    band: 'WEB',
    slogan: 'HIGH TECH // LOW LIFE AUDIO',
    genre: 'Darkwave & Cyberpunk',
    era: 'Cyberpunk',
    palette: {
      primary: '#10b981', // acid emerald
      secondary: '#06b6d4', // neon cyan
      accent: '#f43f5e', // laser red
      bg: '#05070a', // deep carbon
      text: '#e2e8f0',
    },
    badgeShape: 'hexagon',
    iconType: 'lightning',
    typography: 'orbitron',
    fx: {
      neonGlow: true,
      scanlines: true,
      vintageDistress: false,
      chromeSheen: false,
      vinylGrooves: false,
    },
    audioGenreSeed: 'cyberpunk',
    audioStreamUrl: 'https://ice4.somafm.com/defcon-128-mp3',
    bitrate: '320 kbps Lossless',
    lore: 'An encrypted pirate relay broadcasting from decommissioned orbital satellites into Sector 7 megacities.',
  },
  {
    id: 'golden-groove-770',
    name: 'GOLDEN GROOVE',
    callSign: 'WGG 770 AM',
    frequency: 770,
    band: 'AM',
    slogan: 'SOLID GOLD SOUL & 45 RPM HITS',
    genre: 'Classic Motown & Funk',
    era: 'Golden Age 50s',
    palette: {
      primary: '#ea580c', // vintage orange
      secondary: '#ca8a04', // mustard yellow
      accent: '#b91c1c', // retro crimson
      bg: '#1c1917', // warm record vinyl
      text: '#fafaf9',
    },
    badgeShape: 'vinyl',
    iconType: 'vinyl',
    typography: 'bebas',
    fx: {
      neonGlow: false,
      scanlines: false,
      vintageDistress: true,
      chromeSheen: false,
      vinylGrooves: true,
    },
    audioGenreSeed: 'funk',
    audioStreamUrl: 'https://ice1.somafm.com/seventies-128-mp3',
    bitrate: 'AM High-Fidelity',
    lore: 'The legendary high-watt AM powerhouse spinning original 45 RPM pressings with natural groove crackle and punchy horn sections.',
  },
  {
    id: 'lofi-rain-889',
    name: 'LO-FI RAIN',
    callSign: 'CHILL 88.9 FM',
    frequency: 88.9,
    band: 'FM',
    slogan: 'STUDY BEATS FOR RAINY AFTERNOONS',
    genre: 'Lo-Fi Chillhop',
    era: '90s Grunge',
    palette: {
      primary: '#c084fc', // soft lilac
      secondary: '#fb923c', // pastel peach
      accent: '#38bdf8', // sky blue
      bg: '#18181b', // moody coffeehouse
      text: '#f4f4f5',
    },
    badgeShape: 'cassette',
    iconType: 'cassette',
    typography: 'syne',
    fx: {
      neonGlow: false,
      scanlines: false,
      vintageDistress: true,
      chromeSheen: false,
      vinylGrooves: false,
    },
    audioGenreSeed: 'lofi',
    audioStreamUrl: 'https://ice2.somafm.com/lush-128-mp3',
    bitrate: 'Tape Cassette Dub',
    lore: 'Warm Rhodes piano chords, gentle vinyl rain, and laid-back boom-bap drum loops recorded straight onto magnetic Type II cassette tapes.',
  },
  {
    id: 'heavy-forge-1067',
    name: 'HEAVY FORGE',
    callSign: 'K-FORG 106.7',
    frequency: 106.7,
    band: 'FM',
    slogan: 'UNFILTERED STEEL & GUITAR RIFFS',
    genre: 'Classic Rock & Heavy Metal',
    era: '80s Retro',
    palette: {
      primary: '#ef4444', // molten red
      secondary: '#94a3b8', // brushed aluminum
      accent: '#f97316', // forge spark orange
      bg: '#09090b', // dark cast iron
      text: '#ffffff',
    },
    badgeShape: 'shield',
    iconType: 'lightning',
    typography: 'bebas',
    fx: {
      neonGlow: false,
      scanlines: false,
      vintageDistress: true,
      chromeSheen: true,
      vinylGrooves: false,
    },
    audioGenreSeed: 'rock',
    audioStreamUrl: 'https://ice1.somafm.com/metal-128-mp3',
    bitrate: '320 kbps Maximum Gain',
    lore: '50,000 watts of high-octane rock, blistering guitar solos, and thunderous double-bass drums from the heart of the industrial rust belt.',
  },
  {
    id: 'solaris-ambient-102',
    name: 'SOLARIS WAVES',
    callSign: 'SOL 102.1 DAB',
    frequency: 102.1,
    band: 'DAB+',
    slogan: 'DEEP SPACE SIGNALS & MODULAR DRONES',
    genre: 'Ambient & Space Music',
    era: 'Modern Minimal',
    palette: {
      primary: '#38bdf8', // orbital cyan
      secondary: '#818cf8', // cosmic violet
      accent: '#a7f3d0', // aurora mint
      bg: '#030712', // deep cosmic void
      text: '#f8fafc',
    },
    badgeShape: 'minimal-circle',
    iconType: 'waves',
    typography: 'space',
    fx: {
      neonGlow: true,
      scanlines: false,
      vintageDistress: false,
      chromeSheen: false,
      vinylGrooves: false,
    },
    audioGenreSeed: 'ambient',
    audioStreamUrl: 'https://ice4.somafm.com/deepspaceone-128-mp3',
    bitrate: 'Lossless 24-bit 96kHz',
    lore: 'Generative modular synthesizer soundscapes reflecting solar winds and distant pulsars. Commercial-free eternal relaxation.',
  },
  {
    id: 'tokyo-night-942',
    name: 'TOKYO NIGHT',
    callSign: 'J-FUNK 94.2',
    frequency: 94.2,
    band: 'FM',
    slogan: 'NEON SHIBUYA CITY POP & GROOVES',
    genre: 'Future Funk & City Pop',
    era: '80s Retro',
    palette: {
      primary: '#f43f5e', // sakura magenta
      secondary: '#06b6d4', // neon aqua
      accent: '#facc15', // shibuya gold
      bg: '#110b1a', // tokyo midnight
      text: '#ffffff',
    },
    badgeShape: 'diamond',
    iconType: 'star',
    typography: 'syne',
    fx: {
      neonGlow: true,
      scanlines: true,
      vintageDistress: false,
      chromeSheen: true,
      vinylGrooves: false,
    },
    audioGenreSeed: 'futurefunk',
    audioStreamUrl: 'https://ice2.somafm.com/bagel-128-mp3',
    bitrate: '320 kbps FM Stereo',
    lore: 'Slap basslines, filtered brass samples, and glittering 1980s Japanese summer melodies bouncing off rain-slicked neon avenues.',
  },
  {
    id: 'ibiza-pulse-1015',
    name: 'IBIZA PULSE',
    callSign: 'IBZ 101.5 FM',
    frequency: 101.5,
    band: 'FM',
    slogan: 'BALEARIC SUNSET & CLUB ANTHEMS',
    genre: 'Deep House & Electronic',
    era: 'Club Neon',
    palette: {
      primary: '#f97316', // sunset orange
      secondary: '#ec4899', // club magenta
      accent: '#06b6d4', // mediterranean cyan
      bg: '#0c0a1a', // open air club
      text: '#ffffff',
    },
    badgeShape: 'neon-frame',
    iconType: 'equalizer',
    typography: 'orbitron',
    fx: {
      neonGlow: true,
      scanlines: false,
      vintageDistress: false,
      chromeSheen: false,
      vinylGrooves: false,
    },
    audioGenreSeed: 'house',
    audioStreamUrl: 'https://ice4.somafm.com/groovesalad-128-mp3',
    bitrate: '320 kbps Direct Feed',
    lore: 'Transmitted straight from open-air cliffside clubs overlooking the Mediterranean Sea. Hypnotic four-on-the-floor rhythms.',
  },
  {
    id: 'swiss-classic-960',
    name: 'KLANGWERK 96',
    callSign: 'KW-96.0 FM',
    frequency: 96.0,
    band: 'FM',
    slogan: 'PURITY IN SYMPHONIC ARCHITECTURE',
    genre: 'Classical & Avant-Garde',
    era: 'Modern Minimal',
    palette: {
      primary: '#dc2626', // swiss red
      secondary: '#ffffff', // pure white
      accent: '#64748b', // precision slate
      bg: '#0f172a', // architectural graphite
      text: '#ffffff',
    },
    badgeShape: 'stamp',
    iconType: 'headphones',
    typography: 'inter',
    fx: {
      neonGlow: false,
      scanlines: false,
      vintageDistress: false,
      chromeSheen: false,
      vinylGrooves: false,
    },
    audioGenreSeed: 'classical',
    audioStreamUrl: 'https://ice1.somafm.com/thistle-128-mp3',
    bitrate: 'Direct Master Tape',
    lore: 'Flawless acoustics, pristine chamber orchestras, and minimalist precision following the timeless International Typographic Style.',
  },
  {
    id: 'pirate-harbor-1042',
    name: 'PIRATE 104',
    callSign: 'PRT 104.2 WEB',
    frequency: 104.2,
    band: 'WEB',
    slogan: 'UNDERGROUND UK GARAGE & JUNGLE',
    genre: 'UK Garage & Drum & Bass',
    era: '90s Grunge',
    palette: {
      primary: '#eab308', // hazardous yellow
      secondary: '#18181b', // matte black
      accent: '#f97316', // warning amber
      bg: '#0a0a0c', // container port
      text: '#f4f4f5',
    },
    badgeShape: 'shield',
    iconType: 'tower',
    typography: 'bebas',
    fx: {
      neonGlow: false,
      scanlines: true,
      vintageDistress: true,
      chromeSheen: false,
      vinylGrooves: false,
    },
    audioGenreSeed: 'dnb',
    audioStreamUrl: 'https://ice2.somafm.com/cliqhop-128-mp3',
    bitrate: 'Stealth Microwave Relay',
    lore: 'Broadcasted via a rogue antenna hoisted on top of abandoned dockside grain elevators in East London. High-speed breakbeats and sub-bass.',
  },
  {
    id: 'havana-sol-995',
    name: 'HAVANA SOL',
    callSign: 'SOL 99.5 FM',
    frequency: 99.5,
    band: 'FM',
    slogan: 'RITMO, CONGAS Y NOCHES TROPICALES',
    genre: 'Afro-Cuban & Salsa Brava',
    era: 'Golden Age 50s',
    palette: {
      primary: '#f59e0b', // caribbean sunshine
      secondary: '#0d9488', // havana teal
      accent: '#e11d48', // tropical hibiscus
      bg: '#140c07', // vintage mahogany
      text: '#fffbeb',
    },
    badgeShape: 'oval',
    iconType: 'speaker',
    typography: 'syne',
    fx: {
      neonGlow: false,
      scanlines: false,
      vintageDistress: true,
      chromeSheen: false,
      vinylGrooves: true,
    },
    audioGenreSeed: 'latin',
    audioStreamUrl: 'https://ice4.somafm.com/suburbsofgoa-128-mp3',
    bitrate: '256 kbps Tropic Stereo',
    lore: 'Warm sea breezes, syncopated montuno pianos, and vintage brass fanfares originating from legendary 1950s Havana dance halls.',
  },
];
