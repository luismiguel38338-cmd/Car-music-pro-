import React, { useState } from 'react';
import { Sparkles, Radio, Loader2, ArrowRight, Wand2, Lightbulb, Music } from 'lucide-react';
import { RadioStation, EraStyle, BadgeShape, IconType, TypographyStyle } from '../types/radio';
import { LogoRenderer } from './LogoRenderer';

interface AILogoGeneratorProps {
  onStationGenerated: (station: RadioStation) => void;
  onTuneIn: (station: RadioStation) => void;
}

const INSPIRATION_IDEAS = [
  {
    title: 'Neon Miami 84',
    prompt: 'A sunny 1984 Miami convertible radio playing outrun synthwave and city pop with palm trees and neon grids',
    style: '80s Retro',
  },
  {
    title: 'Berlin Bunker Techno',
    prompt: 'An underground Berlin warehouse dark techno broadcast in an old power station with industrial concrete vibes',
    style: 'Cyberpunk',
  },
  {
    title: 'Harlem 1958 Speakeasy',
    prompt: 'A smoky midnight jazz club in Harlem playing upright bass, saxophone, and vintage vinyl recordings',
    style: 'Golden Age 50s',
  },
  {
    title: 'Submarine Ambient Waves',
    prompt: 'A deep oceanic research submarine broadcasting modular synthesizer drones and hydrophone recordings',
    style: 'Modern Minimal',
  },
  {
    title: 'Rainy Kyoto Lo-Fi',
    prompt: 'A cozy rainy Kyoto coffeehouse playing dusty lo-fi hip hop and tape loops',
    style: '90s Grunge',
  },
  {
    title: 'Outlaw Desert Rock',
    prompt: 'A pirate radio station on an old rusty windmill in the Nevada desert playing heavy fuzz rock',
    style: '80s Retro',
  },
];

export const AILogoGenerator: React.FC<AILogoGeneratorProps> = ({
  onStationGenerated,
  onTuneIn,
}) => {
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<string>('80s Retro');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedStation, setGeneratedStation] = useState<RadioStation | null>(null);

  // Procedural algorithmic generator fallback
  const generateProceduralStation = (userPrompt: string, styleChoice: string): RadioStation => {
    const id = `ai-${Date.now()}`;
    const p = userPrompt.toLowerCase();

    let name = 'NEON PULSE';
    let callSign = 'WPLS 98.7 FM';
    let frequency = 98.7;
    let genre = 'Electronic Synth';
    let era: EraStyle = '80s Retro';
    let badgeShape: BadgeShape = 'neon-frame';
    let iconType: IconType = 'tower';
    let typography: TypographyStyle = 'orbitron';
    let palette = {
      primary: '#ff007f',
      secondary: '#00f0ff',
      accent: '#ffe600',
      bg: '#0c0717',
      text: '#ffffff',
    };
    let audioSeed = 'synthwave';

    if (p.includes('jazz') || p.includes('speakeasy') || p.includes('smoke') || p.includes('brass')) {
      name = 'BLUE NOTE 92';
      callSign = 'WBNO 92.5 FM';
      frequency = 92.5;
      genre = 'Midnight Speakeasy Jazz';
      era = 'Golden Age 50s';
      badgeShape = 'oval';
      iconType = 'microphone';
      typography = 'bebas';
      palette = {
        primary: '#d4af37',
        secondary: '#1e3a8a',
        accent: '#f59e0b',
        bg: '#080a10',
        text: '#f8fafc',
      };
      audioSeed = 'jazz';
    } else if (p.includes('techno') || p.includes('bunker') || p.includes('cyber') || p.includes('dark')) {
      name = 'SECTOR NINE';
      callSign = 'K-SEC 109.1';
      frequency = 107.5;
      genre = 'Underground Darkwave';
      era = 'Cyberpunk';
      badgeShape = 'hexagon';
      iconType = 'lightning';
      typography = 'orbitron';
      palette = {
        primary: '#10b981',
        secondary: '#06b6d4',
        accent: '#f43f5e',
        bg: '#040608',
        text: '#f1f5f9',
      };
      audioSeed = 'cyberpunk';
    } else if (p.includes('lofi') || p.includes('lo-fi') || p.includes('coffee') || p.includes('rain')) {
      name = 'RAIN TAPE 88';
      callSign = 'WLOF 88.5 FM';
      frequency = 88.5;
      genre = 'Chillhop & Tape Loops';
      era = '90s Grunge';
      badgeShape = 'cassette';
      iconType = 'cassette';
      typography = 'syne';
      palette = {
        primary: '#c084fc',
        secondary: '#fb923c',
        accent: '#38bdf8',
        bg: '#18181b',
        text: '#f4f4f5',
      };
      audioSeed = 'lofi';
    } else if (p.includes('rock') || p.includes('desert') || p.includes('metal') || p.includes('fuzz')) {
      name = 'DESERT THUNDER';
      callSign = 'K-THUN 105.3';
      frequency = 105.3;
      genre = 'Heavy Desert Rock';
      era = '80s Retro';
      badgeShape = 'shield';
      iconType = 'lightning';
      typography = 'bebas';
      palette = {
        primary: '#ef4444',
        secondary: '#94a3b8',
        accent: '#f97316',
        bg: '#0a0a0c',
        text: '#ffffff',
      };
      audioSeed = 'rock';
    } else if (p.includes('ambient') || p.includes('sub') || p.includes('drone') || p.includes('ocean')) {
      name = 'DEEP TRENCH';
      callSign = 'ABYS 101.9 DAB';
      frequency = 101.9;
      genre = 'Subaquatic Modular Ambient';
      era = 'Modern Minimal';
      badgeShape = 'minimal-circle';
      iconType = 'waves';
      typography = 'space';
      palette = {
        primary: '#38bdf8',
        secondary: '#818cf8',
        accent: '#a7f3d0',
        bg: '#020617',
        text: '#f8fafc',
      };
      audioSeed = 'ambient';
    }

    return {
      id,
      name,
      callSign,
      frequency,
      band: 'FM',
      slogan: 'TRANSMITTING STEREO REALITY',
      genre,
      era,
      palette,
      badgeShape,
      iconType,
      typography,
      fx: {
        neonGlow: true,
        scanlines: true,
        vintageDistress: false,
        chromeSheen: true,
        vinylGrooves: false,
      },
      audioGenreSeed: audioSeed,
      bitrate: '320 kbps Studio',
      lore: `A custom broadcast identity synthesized for: "${userPrompt}".`,
      isCustom: true,
    };
  };

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/generate-station', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, style: selectedStyle }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.data && json.data.name) {
          const raw = json.data;
          const newStation: RadioStation = {
            id: `ai-${Date.now()}`,
            name: raw.name || 'AI BROADCAST',
            callSign: raw.callSign || 'WAIR 99.9 FM',
            frequency: typeof raw.frequency === 'number' ? raw.frequency : 99.9,
            band: raw.band || 'FM',
            slogan: raw.slogan || 'THE SOUND OF TOMORROW',
            genre: raw.genre || 'Eclectic Broadcast',
            era: raw.era || '80s Retro',
            palette: {
              primary: raw.primaryColor || '#ff007f',
              secondary: raw.secondaryColor || '#00f0ff',
              accent: raw.accentColor || '#ffe600',
              bg: raw.bgColor || '#0b0c10',
              text: '#ffffff',
            },
            badgeShape: raw.badgeShape || 'neon-frame',
            iconType: raw.iconType || 'tower',
            typography: raw.typography || 'orbitron',
            fx: {
              neonGlow: true,
              scanlines: false,
              vintageDistress: false,
              chromeSheen: true,
              vinylGrooves: false,
            },
            customSvg: raw.customSvg,
            lore: raw.lore,
            audioGenreSeed: raw.genre?.toLowerCase().includes('jazz')
              ? 'jazz'
              : raw.genre?.toLowerCase().includes('rock')
              ? 'rock'
              : raw.genre?.toLowerCase().includes('lofi')
              ? 'lofi'
              : raw.genre?.toLowerCase().includes('ambient')
              ? 'ambient'
              : 'synthwave',
            bitrate: '320 kbps AI HD',
            isCustom: true,
          };
          setGeneratedStation(newStation);
          setLoading(false);
          return;
        }
      }

      // If server route is not available or returned non-200, fallback gracefully
      const fallback = generateProceduralStation(prompt, selectedStyle);
      setGeneratedStation(fallback);
    } catch {
      // Fallback
      const fallback = generateProceduralStation(prompt, selectedStyle);
      setGeneratedStation(fallback);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
      {/* Background glow header */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-0 left-0 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-4xl mx-auto space-y-8">
        {/* Title */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold tracking-wider uppercase">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Station Branding Engine</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Create an Entire Station Identity in Seconds
          </h2>
          <p className="text-slate-400 text-sm max-w-xl mx-auto">
            Describe your station’s musical aesthetic, era, or broadcast location. Gemini will
            architect call letters, dial frequency, typography, color harmony, and a full vector
            emblem.
          </p>
        </div>

        {/* Input Form */}
        <form onSubmit={handleGenerate} className="space-y-4">
          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. A pirate radio station on an old North Sea lightship playing dark atmospheric synthwave and maritime weather reports..."
              rows={3}
              className="w-full bg-slate-900/90 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-rose-500 shadow-inner resize-none"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Style Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400 uppercase">Aesthetic Era:</span>
              <div className="flex flex-wrap gap-1">
                {[
                  '80s Retro',
                  'Modern Minimal',
                  'Cyberpunk',
                  'Golden Age 50s',
                  '90s Grunge',
                  'Club Neon',
                ].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setSelectedStyle(st)}
                    className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                      selectedStyle === st
                        ? 'bg-rose-500 text-white shadow-sm'
                        : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              className="px-6 py-2.5 bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-950/50 flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Synthesizing Identity...</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  <span>Generate Station & Logo</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Quick Inspiration Prompts */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400 uppercase">
            <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
            <span>Need inspiration? Try one of these concepts:</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {INSPIRATION_IDEAS.map((idea) => (
              <button
                key={idea.title}
                type="button"
                onClick={() => {
                  setPrompt(idea.prompt);
                  setSelectedStyle(idea.style);
                }}
                className="text-left p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 hover:bg-slate-800/50 transition-all group"
              >
                <div className="text-xs font-bold text-slate-200 group-hover:text-rose-400 mb-1">
                  {idea.title}
                </div>
                <div className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                  {idea.prompt}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Generated Station Result Card */}
        {generatedStation && (
          <div className="mt-8 pt-8 border-t border-slate-800 animate-fadeIn">
            <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-center gap-8 shadow-2xl">
              {/* Logo Preview */}
              <div className="w-64 h-64 shrink-0 flex items-center justify-center bg-slate-950 rounded-xl border border-slate-800 p-2 shadow-inner">
                <LogoRenderer station={generatedStation} size={240} idPrefix="ai-result" />
              </div>

              {/* Station Details & Lore */}
              <div className="flex-1 space-y-4 text-left">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-black text-white font-mono">
                      {generatedStation.name}
                    </span>
                    <span className="px-2.5 py-0.5 rounded text-xs font-bold font-mono bg-rose-500/20 text-rose-400 border border-rose-500/40">
                      {generatedStation.callSign}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-amber-400 mt-1">
                    "{generatedStation.slogan}"
                  </div>
                </div>

                <div className="text-xs text-slate-300 leading-relaxed font-mono bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
                  {generatedStation.lore}
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 font-mono">
                  <span>{generatedStation.genre}</span>
                  <span>·</span>
                  <span>{generatedStation.era}</span>
                  <span>·</span>
                  <span>{generatedStation.bitrate}</span>
                </div>

                {/* Buttons to open in Editor or Tune In */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => onStationGenerated(generatedStation)}
                    className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl border border-slate-700 transition-colors flex items-center gap-2"
                  >
                    <span>Open in Logo Lab</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => onTuneIn(generatedStation)}
                    className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-md transition-colors flex items-center gap-2"
                  >
                    <Music className="w-3.5 h-3.5" />
                    <span>Tune In & Play</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
