import React, { useState } from 'react';
import {
  Download,
  Copy,
  Check,
  Save,
  Radio,
  Sparkles,
  Layers,
  Palette,
  Type,
  Maximize2,
  Tv,
  Disc,
  Shirt,
  Volume2,
} from 'lucide-react';
import {
  RadioStation,
  BadgeShape,
  IconType,
  TypographyStyle,
  BandType,
  StationPalette,
} from '../types/radio';
import { LogoRenderer } from './LogoRenderer';

interface LogoEditorProps {
  station: RadioStation;
  onChange: (updated: RadioStation) => void;
  onSaveToCollection: (station: RadioStation) => void;
  onTuneIn: (station: RadioStation) => void;
  isPlaying: boolean;
}

const SHAPES: { id: BadgeShape; label: string }[] = [
  { id: 'neon-frame', label: 'Neon Frame' },
  { id: 'oval', label: 'Retro Oval' },
  { id: 'shield', label: 'Shield Crest' },
  { id: 'cassette', label: 'Mixtape Cassette' },
  { id: 'hexagon', label: 'Cyber Hexagon' },
  { id: 'vinyl', label: 'Vinyl Disc' },
  { id: 'diamond', label: 'Diamond Badge' },
  { id: 'stamp', label: 'Postal Stamp' },
  { id: 'minimal-circle', label: 'Modern Circle' },
];

const ICONS: { id: IconType; label: string }[] = [
  { id: 'tower', label: 'Radio Tower' },
  { id: 'microphone', label: 'Studio Mic' },
  { id: 'headphones', label: 'Headphones' },
  { id: 'vinyl', label: 'Vinyl Record' },
  { id: 'waves', label: 'Sound Waves' },
  { id: 'lightning', label: 'Lightning' },
  { id: 'equalizer', label: 'Equalizer' },
  { id: 'cassette', label: 'Cassette' },
  { id: 'speaker', label: 'Speaker' },
  { id: 'star', label: 'Broadcast Star' },
];

const TYPOGRAPHIES: { id: TypographyStyle; label: string; sample: string }[] = [
  { id: 'bebas', label: 'Bebas Neue', sample: 'RADIO BEAT' },
  { id: 'orbitron', label: 'Orbitron Cyber', sample: 'SYNTH 99' },
  { id: 'syne', label: 'Syne Expressive', sample: 'AVANT WAVE' },
  { id: 'space', label: 'Space Grotesk', sample: 'MODERN FM' },
  { id: 'inter', label: 'Inter Clean', sample: 'SWISS STUDIO' },
];

const CURATED_PALETTES: { name: string; palette: StationPalette }[] = [
  {
    name: 'Synthwave Neon',
    palette: { primary: '#ff007f', secondary: '#00f0ff', accent: '#ffe600', bg: '#0d0718', text: '#ffffff' },
  },
  {
    name: '1950s Golden Brass',
    palette: { primary: '#d4af37', secondary: '#1e3a8a', accent: '#f59e0b', bg: '#0a0d14', text: '#f8fafc' },
  },
  {
    name: 'Cyber Acid',
    palette: { primary: '#10b981', secondary: '#06b6d4', accent: '#f43f5e', bg: '#05070a', text: '#e2e8f0' },
  },
  {
    name: 'Motown Soul',
    palette: { primary: '#ea580c', secondary: '#ca8a04', accent: '#b91c1c', bg: '#1c1917', text: '#fafaf9' },
  },
  {
    name: 'Lo-Fi Pastel',
    palette: { primary: '#c084fc', secondary: '#fb923c', accent: '#38bdf8', bg: '#18181b', text: '#f4f4f5' },
  },
  {
    name: 'Heavy Steel',
    palette: { primary: '#ef4444', secondary: '#94a3b8', accent: '#f97316', bg: '#09090b', text: '#ffffff' },
  },
  {
    name: 'Swiss Red Minimal',
    palette: { primary: '#dc2626', secondary: '#ffffff', accent: '#64748b', bg: '#0f172a', text: '#ffffff' },
  },
  {
    name: 'Tokyo Sunset',
    palette: { primary: '#f43f5e', secondary: '#06b6d4', accent: '#facc15', bg: '#110b1a', text: '#ffffff' },
  },
];

type MockupType = 'canvas' | 'mic-flag' | 'vinyl' | 'lightbox' | 'merch';

export const LogoEditor: React.FC<LogoEditorProps> = ({
  station,
  onChange,
  onSaveToCollection,
  onTuneIn,
  isPlaying,
}) => {
  const [activeTab, setActiveTab] = useState<'branding' | 'shape' | 'colors' | 'fx'>('branding');
  const [activeMockup, setActiveMockup] = useState<MockupType>('canvas');
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  // Download SVG
  const handleDownloadSvg = () => {
    // If custom SVG exists, download it
    let svgString = station.customSvg;
    if (!svgString) {
      const container = document.getElementById('logo-preview-svg-container');
      const svgElement = container?.querySelector('svg');
      if (svgElement) {
        svgString = new XMLSerializer().serializeToString(svgElement);
      }
    }

    if (!svgString) return;

    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${station.name.toLowerCase().replace(/\s+/g, '-')}-logo.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Download High-Res PNG
  const handleDownloadPng = () => {
    const container = document.getElementById('logo-preview-svg-container');
    const svgElement = container?.querySelector('svg');
    if (!svgElement) return;

    const svgString = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const URLObject = window.URL || window.webkitURL || window;
    const blobURL = URLObject.createObjectURL(svgBlob);

    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1600;
      canvas.height = 1600;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw high-res image
      ctx.drawImage(image, 0, 0, 1600, 1600);
      URLObject.revokeObjectURL(blobURL);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${station.name.toLowerCase().replace(/\s+/g, '-')}-logo-1600px.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 'image/png');
    };
    image.src = blobURL;
  };

  // Copy SVG Code
  const handleCopySvg = async () => {
    let svgString = station.customSvg;
    if (!svgString) {
      const container = document.getElementById('logo-preview-svg-container');
      const svgElement = container?.querySelector('svg');
      if (svgElement) {
        svgString = new XMLSerializer().serializeToString(svgElement);
      }
    }
    if (svgString) {
      await navigator.clipboard.writeText(svgString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSave = () => {
    onSaveToCollection({ ...station, isCustom: true });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* LEFT COLUMN: Live Logo Preview & Realistic Broadcast Mockups (7 cols) */}
      <div className="lg:col-span-7 flex flex-col gap-4">
        {/* Mockup Selector Bar */}
        <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl p-1.5 text-xs">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveMockup('canvas')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
                activeMockup === 'canvas'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Vector Canvas</span>
            </button>
            <button
              onClick={() => setActiveMockup('mic-flag')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
                activeMockup === 'mic-flag'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Studio Mic Flag</span>
            </button>
            <button
              onClick={() => setActiveMockup('vinyl')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
                activeMockup === 'vinyl'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Disc className="w-3.5 h-3.5" />
              <span>Vinyl Label</span>
            </button>
            <button
              onClick={() => setActiveMockup('lightbox')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
                activeMockup === 'lightbox'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
              <span>Studio Lightbox</span>
            </button>
            <button
              onClick={() => setActiveMockup('merch')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
                activeMockup === 'merch'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Shirt className="w-3.5 h-3.5" />
              <span>Station Merch</span>
            </button>
          </div>
        </div>

        {/* Preview Frame Container */}
        <div className="relative min-h-[460px] sm:min-h-[520px] bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-center p-6 sm:p-10 overflow-hidden shadow-2xl">
          {/* Subtle Grid Backdrop */}
          <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none" />

          {/* MOCKUP 1: Pure Vector Canvas */}
          {activeMockup === 'canvas' && (
            <div id="logo-preview-svg-container" className="relative z-10 max-w-full max-h-full">
              <LogoRenderer
                station={station}
                size={380}
                isPlaying={isPlaying}
                idPrefix="editor-preview"
              />
            </div>
          )}

          {/* MOCKUP 2: Radio Studio Mic Flag */}
          {activeMockup === 'mic-flag' && (
            <div className="relative z-10 flex flex-col items-center">
              {/* Broadcast Microphone Mesh Top */}
              <div className="w-20 h-28 bg-gradient-to-b from-slate-700 via-slate-500 to-slate-800 rounded-t-3xl border-2 border-slate-400/50 shadow-2xl relative overflow-hidden flex flex-col justify-around py-2">
                <div className="w-full h-1 bg-slate-400/30" />
                <div className="w-full h-1 bg-slate-400/30" />
                <div className="w-full h-1 bg-slate-400/30" />
                <div className="w-full h-1 bg-slate-400/30" />
                <div className="w-full h-1 bg-slate-400/30" />
              </div>

              {/* Square Studio Mic Flag Cube */}
              <div className="w-56 h-56 bg-slate-900 border-4 border-slate-700 rounded-xl shadow-2xl relative overflow-hidden flex items-center justify-center p-3 my-[-6px] z-10">
                <div id="logo-preview-svg-container">
                  <LogoRenderer station={station} size={200} idPrefix="mic-flag" />
                </div>
              </div>

              {/* Mic Shaft & Boom Arm */}
              <div className="w-10 h-32 bg-gradient-to-r from-slate-800 via-slate-600 to-slate-900 border-x border-slate-700 shadow-xl" />
              <div className="w-24 h-4 bg-slate-800 rounded-full border border-slate-700 shadow-lg" />
            </div>
          )}

          {/* MOCKUP 3: Vinyl Record Center Label */}
          {activeMockup === 'vinyl' && (
            <div className="relative z-10 flex items-center justify-center">
              {/* Spinning 12" Vinyl Disc */}
              <div
                className={`w-[360px] h-[360px] sm:w-[420px] sm:h-[420px] rounded-full bg-gradient-to-tr from-neutral-950 via-neutral-900 to-neutral-950 border-8 border-neutral-900 shadow-2xl relative flex items-center justify-center overflow-hidden ${
                  isPlaying ? 'animate-[spin_8s_linear_infinite]' : ''
                }`}
              >
                {/* Vinyl Grooves reflection lines */}
                <div className="absolute inset-4 rounded-full border border-white/5 pointer-events-none" />
                <div className="absolute inset-8 rounded-full border border-white/5 pointer-events-none" />
                <div className="absolute inset-14 rounded-full border border-white/5 pointer-events-none" />
                <div className="absolute inset-20 rounded-full border border-white/5 pointer-events-none" />
                <div className="absolute inset-28 rounded-full border border-white/5 pointer-events-none" />

                {/* Vinyl Light Glare Sheen */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none" />

                {/* Center Label (The Station Logo) */}
                <div className="w-[180px] h-[180px] sm:w-[210px] sm:h-[210px] rounded-full overflow-hidden shadow-inner flex items-center justify-center bg-slate-900 border-4 border-amber-500/20">
                  <div id="logo-preview-svg-container" className="scale-75 sm:scale-85">
                    <LogoRenderer station={station} size={220} idPrefix="vinyl-preview" />
                  </div>
                </div>

                {/* Center Spindle Hole */}
                <div className="absolute w-6 h-6 rounded-full bg-slate-950 border border-slate-600 shadow-inner z-20 pointer-events-none" />
              </div>
            </div>
          )}

          {/* MOCKUP 4: Studio On-Air Lightbox */}
          {activeMockup === 'lightbox' && (
            <div className="relative z-10 w-full max-w-md bg-neutral-950 border-4 border-neutral-800 rounded-2xl p-6 shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col items-center">
              {/* Aluminum Lightbox Top Edge */}
              <div className="w-full flex justify-between items-center text-[10px] font-mono text-neutral-500 pb-3 border-b border-neutral-800">
                <span>STUDIO A · BROADCAST SIGN</span>
                <span className="text-rose-500 font-bold">LIVE ON-AIR</span>
              </div>

              {/* Glowing Sign Panel */}
              <div
                className="my-6 p-4 rounded-xl border border-white/10 flex items-center justify-center w-full shadow-inner"
                style={{
                  backgroundColor: `${station.palette.bg}`,
                  boxShadow: `0 0 30px ${station.palette.primary}40`,
                }}
              >
                <div id="logo-preview-svg-container">
                  <LogoRenderer station={station} size={280} idPrefix="lightbox-preview" />
                </div>
              </div>

              <div className="text-center text-xs font-mono text-neutral-400">
                WALL MOUNT BROADCAST EMITTING 50KW
              </div>
            </div>
          )}

          {/* MOCKUP 5: Station Merch (T-Shirt) */}
          {activeMockup === 'merch' && (
            <div className="relative z-10 flex flex-col items-center">
              <div className="relative w-80 h-96 bg-neutral-900 rounded-3xl border border-neutral-800 shadow-2xl flex flex-col items-center pt-8 overflow-hidden">
                {/* Collar Rib */}
                <div className="w-24 h-12 rounded-b-full border-2 border-neutral-700 bg-neutral-950 mb-6 shadow-inner" />
                {/* Subtle Fabric Grain */}
                <div className="absolute inset-0 bg-[radial-gradient(#ffffff_0.5px,transparent_0.5px)] [background-size:4px_4px] opacity-5 pointer-events-none" />

                {/* Printed Logo on Chest */}
                <div id="logo-preview-svg-container" className="scale-75 shadow-lg">
                  <LogoRenderer station={station} size={240} idPrefix="merch-preview" />
                </div>

                <div className="mt-auto pb-4 text-[10px] font-mono text-neutral-600 tracking-wider">
                  OFFICIAL BROADCAST CREW APPAREL
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons: Download SVG / PNG, Copy, Save, Tune In */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 rounded-xl p-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadSvg}
              className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg transition-colors border border-slate-700"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Download Vector SVG</span>
            </button>

            <button
              onClick={handleDownloadPng}
              className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg transition-colors border border-slate-700"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>High-Res PNG</span>
            </button>

            <button
              onClick={handleCopySvg}
              className="flex items-center gap-2 px-3 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium rounded-lg transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy SVG'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium rounded-lg transition-colors"
            >
              <Save className="w-3.5 h-3.5 text-violet-400" />
              <span>{saved ? 'Saved!' : 'Save Logo'}</span>
            </button>

            <button
              onClick={() => onTuneIn(station)}
              className="flex items-center gap-2 px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg shadow-md transition-all active:scale-95"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Tune In</span>
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Customization Controls & Studio Inspector (5 cols) */}
      <div className="lg:col-span-5 bg-slate-950 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xl flex flex-col gap-6">
        {/* Studio Sub-Navigation Tabs */}
        <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
          <button
            onClick={() => setActiveTab('branding')}
            className={`flex-1 py-2 rounded-lg font-semibold transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'branding'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Type className="w-3.5 h-3.5" />
            <span>Identity</span>
          </button>
          <button
            onClick={() => setActiveTab('shape')}
            className={`flex-1 py-2 rounded-lg font-semibold transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'shape'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Badge & Icon</span>
          </button>
          <button
            onClick={() => setActiveTab('colors')}
            className={`flex-1 py-2 rounded-lg font-semibold transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'colors'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Colors</span>
          </button>
          <button
            onClick={() => setActiveTab('fx')}
            className={`flex-1 py-2 rounded-lg font-semibold transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'fx'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Effects</span>
          </button>
        </div>

        {/* TAB 1: Identity & Typography */}
        {activeTab === 'branding' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-1">
                Station Brand Name
              </label>
              <input
                type="text"
                value={station.name}
                onChange={(e) =>
                  onChange({
                    ...station,
                    name: e.target.value,
                    customSvg: undefined, // regenerate with procedural vector engine
                  })
                }
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-bold text-sm focus:outline-none focus:border-rose-500"
                placeholder="e.g. SYNTH CITY, K-ROCK"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-1">
                  Call Sign / Tag
                </label>
                <input
                  type="text"
                  value={station.callSign}
                  onChange={(e) =>
                    onChange({
                      ...station,
                      callSign: e.target.value,
                      customSvg: undefined,
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-xs font-mono focus:outline-none focus:border-rose-500"
                  placeholder="e.g. WNYX 104.5"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-1">
                  Band
                </label>
                <select
                  value={station.band}
                  onChange={(e) =>
                    onChange({
                      ...station,
                      band: e.target.value as BandType,
                      customSvg: undefined,
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-xs font-mono focus:outline-none focus:border-rose-500"
                >
                  <option value="FM">FM Stereo</option>
                  <option value="AM">AM High-Power</option>
                  <option value="WEB">WEB Radio</option>
                  <option value="DAB+">DAB+ Digital</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-1">
                Station Tagline / Slogan
              </label>
              <input
                type="text"
                value={station.slogan}
                onChange={(e) =>
                  onChange({
                    ...station,
                    slogan: e.target.value,
                    customSvg: undefined,
                  })
                }
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-xs focus:outline-none focus:border-rose-500"
                placeholder="e.g. The Pulse of the Night"
              />
            </div>

            {/* Typography Selection */}
            <div>
              <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">
                Broadcast Typography
              </label>
              <div className="grid grid-cols-1 gap-2">
                {TYPOGRAPHIES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() =>
                      onChange({
                        ...station,
                        typography: t.id,
                        customSvg: undefined,
                      })
                    }
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                      station.typography === t.id
                        ? 'bg-rose-500/10 border-rose-500 text-white'
                        : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-medium block">{t.label}</span>
                      <span className="text-[11px] text-slate-400 font-mono">{t.sample}</span>
                    </div>
                    {station.typography === t.id && (
                      <Check className="w-4 h-4 text-rose-500" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Badge Shape & Icon Symbol */}
        {activeTab === 'shape' && (
          <div className="space-y-5">
            {/* Badge Shape Selector */}
            <div>
              <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">
                Station Badge Shape
              </label>
              <div className="grid grid-cols-3 gap-2">
                {SHAPES.map((shape) => (
                  <button
                    key={shape.id}
                    onClick={() =>
                      onChange({
                        ...station,
                        badgeShape: shape.id,
                        customSvg: undefined,
                      })
                    }
                    className={`p-2.5 rounded-xl border text-center transition-all ${
                      station.badgeShape === shape.id
                        ? 'bg-rose-500/10 border-rose-500 text-white'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-xs font-medium block">{shape.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Broadcast Icon Symbol Selector */}
            <div>
              <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">
                Broadcast Graphic Icon
              </label>
              <div className="grid grid-cols-2 gap-2">
                {ICONS.map((icon) => (
                  <button
                    key={icon.id}
                    onClick={() =>
                      onChange({
                        ...station,
                        iconType: icon.id,
                        customSvg: undefined,
                      })
                    }
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all ${
                      station.iconType === icon.id
                        ? 'bg-rose-500/10 border-rose-500 text-white'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    <span className="text-xs font-medium">{icon.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Colors & Curated Palettes */}
        {activeTab === 'colors' && (
          <div className="space-y-5">
            {/* Curated Presets */}
            <div>
              <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">
                Curated Broadcast Palettes
              </label>
              <div className="grid grid-cols-2 gap-2">
                {CURATED_PALETTES.map((p) => (
                  <button
                    key={p.name}
                    onClick={() =>
                      onChange({
                        ...station,
                        palette: { ...p.palette },
                        customSvg: undefined,
                      })
                    }
                    className="p-2.5 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl text-left transition-all group"
                  >
                    <span className="text-xs text-slate-300 font-medium block mb-1.5 group-hover:text-white">
                      {p.name}
                    </span>
                    <div className="flex gap-1 h-3 rounded overflow-hidden">
                      <div className="flex-1" style={{ backgroundColor: p.palette.primary }} />
                      <div className="flex-1" style={{ backgroundColor: p.palette.secondary }} />
                      <div className="flex-1" style={{ backgroundColor: p.palette.accent }} />
                      <div className="flex-1" style={{ backgroundColor: p.palette.bg }} />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Color Pickers */}
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider">
                Custom Color Values
              </label>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[11px] text-slate-400 block mb-1">Primary Accent</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={station.palette.primary}
                      onChange={(e) =>
                        onChange({
                          ...station,
                          palette: { ...station.palette, primary: e.target.value },
                          customSvg: undefined,
                        })
                      }
                      className="w-8 h-8 rounded border-0 bg-transparent cursor-pointer"
                    />
                    <span className="text-xs font-mono text-slate-300 uppercase">
                      {station.palette.primary}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 block mb-1">Secondary Accent</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={station.palette.secondary}
                      onChange={(e) =>
                        onChange({
                          ...station,
                          palette: { ...station.palette, secondary: e.target.value },
                          customSvg: undefined,
                        })
                      }
                      className="w-8 h-8 rounded border-0 bg-transparent cursor-pointer"
                    />
                    <span className="text-xs font-mono text-slate-300 uppercase">
                      {station.palette.secondary}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 block mb-1">Highlight / Gold</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={station.palette.accent}
                      onChange={(e) =>
                        onChange({
                          ...station,
                          palette: { ...station.palette, accent: e.target.value },
                          customSvg: undefined,
                        })
                      }
                      className="w-8 h-8 rounded border-0 bg-transparent cursor-pointer"
                    />
                    <span className="text-xs font-mono text-slate-300 uppercase">
                      {station.palette.accent}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 block mb-1">Badge Background</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={station.palette.bg}
                      onChange={(e) =>
                        onChange({
                          ...station,
                          palette: { ...station.palette, bg: e.target.value },
                          customSvg: undefined,
                        })
                      }
                      className="w-8 h-8 rounded border-0 bg-transparent cursor-pointer"
                    />
                    <span className="text-xs font-mono text-slate-300 uppercase">
                      {station.palette.bg}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Visual FX */}
        {activeTab === 'fx' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-900 border border-slate-800 rounded-xl">
              <div>
                <span className="text-xs font-bold text-white block">Neon Tube Glow</span>
                <span className="text-[11px] text-slate-400">Radiating atmospheric halo filter</span>
              </div>
              <input
                type="checkbox"
                checked={station.fx.neonGlow}
                onChange={(e) =>
                  onChange({
                    ...station,
                    fx: { ...station.fx, neonGlow: e.target.checked },
                    customSvg: undefined,
                  })
                }
                className="w-4 h-4 accent-rose-500 rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-900 border border-slate-800 rounded-xl">
              <div>
                <span className="text-xs font-bold text-white block">CRT Scanline Raster</span>
                <span className="text-[11px] text-slate-400">Vintage cathode ray tube raster lines</span>
              </div>
              <input
                type="checkbox"
                checked={station.fx.scanlines}
                onChange={(e) =>
                  onChange({
                    ...station,
                    fx: { ...station.fx, scanlines: e.target.checked },
                    customSvg: undefined,
                  })
                }
                className="w-4 h-4 accent-rose-500 rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-900 border border-slate-800 rounded-xl">
              <div>
                <span className="text-xs font-bold text-white block">Metallic Chrome Sheen</span>
                <span className="text-[11px] text-slate-400">Specular chrome typography gradient</span>
              </div>
              <input
                type="checkbox"
                checked={station.fx.chromeSheen}
                onChange={(e) =>
                  onChange({
                    ...station,
                    fx: { ...station.fx, chromeSheen: e.target.checked },
                    customSvg: undefined,
                  })
                }
                className="w-4 h-4 accent-rose-500 rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-900 border border-slate-800 rounded-xl">
              <div>
                <span className="text-xs font-bold text-white block">Vinyl Groove Rings</span>
                <span className="text-[11px] text-slate-400">Concentric microgroove texture overlay</span>
              </div>
              <input
                type="checkbox"
                checked={station.fx.vinylGrooves}
                onChange={(e) =>
                  onChange({
                    ...station,
                    fx: { ...station.fx, vinylGrooves: e.target.checked },
                    customSvg: undefined,
                  })
                }
                className="w-4 h-4 accent-rose-500 rounded cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
