import React, { useState, useEffect } from 'react';
import {
  Radio,
  Sliders,
  Sparkles,
  Layers,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Disc,
  Headphones,
  Compass,
} from 'lucide-react';
import { RadioStation } from './types/radio';
import { PRESET_STATIONS } from './data/presetStations';
import { radioAudio } from './services/audioEngine';
import { RadioTunerDeck } from './components/RadioTunerDeck';
import { LogoRenderer } from './components/LogoRenderer';
import { LogoEditor } from './components/LogoEditor';
import { AILogoGenerator } from './components/AILogoGenerator';
import { StationDirectory } from './components/StationDirectory';

type MainView = 'tuner' | 'studio' | 'ai-generator' | 'archive';

export default function App() {
  const [activeView, setActiveView] = useState<MainView>('tuner');
  const [currentStation, setCurrentStation] = useState<RadioStation>(PRESET_STATIONS[0]);
  const [editingStation, setEditingStation] = useState<RadioStation>(PRESET_STATIONS[0]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [savedStations, setSavedStations] = useState<RadioStation[]>([]);

  // Load custom stations from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('radio_saved_logos');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setSavedStations(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Save custom stations
  const handleSaveToCollection = (newStation: RadioStation) => {
    const updated = [
      newStation,
      ...savedStations.filter((s) => s.id !== newStation.id),
    ];
    setSavedStations(updated);
    try {
      localStorage.setItem('radio_saved_logos', JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const handleDeleteSavedStation = (id: string) => {
    const updated = savedStations.filter((s) => s.id !== id);
    setSavedStations(updated);
    try {
      localStorage.setItem('radio_saved_logos', JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  // Switch and play station
  const handleSelectStation = (station: RadioStation) => {
    setCurrentStation(station);
    setEditingStation(station);
    radioAudio.playStation(station);
    setIsPlaying(true);
  };

  // Toggle Play / Pause
  const handleTogglePlay = () => {
    if (isPlaying) {
      radioAudio.stop();
      setIsPlaying(false);
    } else {
      radioAudio.playStation(currentStation);
      setIsPlaying(true);
    }
  };

  // Handle Station edit navigation
  const handleOpenInEditor = (station: RadioStation) => {
    setEditingStation(station);
    setActiveView('studio');
  };

  // Combined list of all stations
  const allStations = [...PRESET_STATIONS, ...savedStations];

  return (
    <div className="min-h-screen bg-[#06070a] text-slate-100 flex flex-col font-sans selection:bg-rose-500 selection:text-white">
      {/* Top Main Navigation Header */}
      <header className="sticky top-0 z-50 bg-[#06070a]/90 backdrop-blur-md border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Brand Identity */}
          <div
            onClick={() => setActiveView('tuner')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 to-amber-500 p-0.5 shadow-lg shadow-rose-950/50 flex items-center justify-center group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Radio className="w-5 h-5 text-rose-400 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base sm:text-lg tracking-wider font-mono text-white">
                  RADIO MUSIC LOGOS
                </span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40">
                  STUDIO
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono hidden sm:block">
                BROADCAST IDENTITY & LIVE AUDIO TUNER
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setActiveView('tuner')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeView === 'tuner'
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-950/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Radio className="w-4 h-4" />
              <span>Tuner Deck</span>
            </button>

            <button
              onClick={() => setActiveView('studio')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeView === 'studio'
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-950/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>Logo Lab</span>
            </button>

            <button
              onClick={() => setActiveView('ai-generator')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeView === 'ai-generator'
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-950/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">AI Studio</span>
              <span className="sm:hidden">AI</span>
            </button>

            <button
              onClick={() => setActiveView('archive')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeView === 'archive'
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-950/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Archive</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Body Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">
        {/* VIEW 1: TUNER DECK (Live Experience) */}
        {activeView === 'tuner' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Tuner Deck Interactive Component */}
            <RadioTunerDeck
              currentStation={currentStation}
              allStations={allStations}
              isPlaying={isPlaying}
              onSelectStation={handleSelectStation}
              onTogglePlay={handleTogglePlay}
            />

            {/* Featured Broadcast Station Showcase Card */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 sm:p-8 flex flex-col lg:flex-row items-center gap-8 shadow-2xl relative overflow-hidden">
              {/* Dynamic ambient backlight */}
              <div
                className="absolute inset-0 opacity-15 pointer-events-none transition-all duration-700"
                style={{
                  background: `radial-gradient(circle at 30% 50%, ${currentStation.palette.primary} 0%, transparent 60%)`,
                }}
              />

              {/* Station Logo Hero */}
              <div className="w-72 h-72 sm:w-80 sm:h-80 shrink-0 flex items-center justify-center relative z-10">
                <LogoRenderer
                  station={currentStation}
                  size={300}
                  isPlaying={isPlaying}
                  idPrefix="featured-hero"
                />
              </div>

              {/* Station Story & Actions */}
              <div className="flex-1 space-y-5 text-left relative z-10">
                <div>
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <span className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight">
                      {currentStation.name}
                    </span>
                    <span
                      className="px-3 py-1 rounded-md text-xs font-bold font-mono border"
                      style={{
                        backgroundColor: `${currentStation.palette.primary}20`,
                        color: currentStation.palette.primary,
                        borderColor: `${currentStation.palette.primary}50`,
                      }}
                    >
                      {currentStation.callSign}
                    </span>
                  </div>

                  <div className="text-base font-bold text-amber-400">
                    "{currentStation.slogan}"
                  </div>
                </div>

                <p className="text-sm text-slate-300 leading-relaxed font-mono">
                  {currentStation.lore ||
                    'Broadcasting high fidelity audio through calibrated transmitters and dedicated studio signal paths.'}
                </p>

                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 font-mono">
                  <span>Frequency: {currentStation.frequency} {currentStation.band}</span>
                  <span>·</span>
                  <span>Genre: {currentStation.genre}</span>
                  <span>·</span>
                  <span>Aesthetic: {currentStation.era}</span>
                </div>

                {/* Quick actions for this station */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    onClick={handleTogglePlay}
                    className="px-6 py-3 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-2"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                    <span>{isPlaying ? 'PAUSE BROADCAST' : 'TUNE IN NOW'}</span>
                  </button>

                  <button
                    onClick={() => handleOpenInEditor(currentStation)}
                    className="px-5 py-3 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition-colors flex items-center gap-2"
                  >
                    <Sliders className="w-4 h-4 text-cyan-400" />
                    <span>Customize in Logo Lab</span>
                  </button>

                  <button
                    onClick={() => setActiveView('ai-generator')}
                    className="px-5 py-3 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition-colors flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Generate AI Station</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Stations Row */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-slate-300">
                  Featured Stations & Badges
                </h3>
                <button
                  onClick={() => setActiveView('archive')}
                  className="text-xs text-rose-400 hover:text-rose-300 transition-colors font-medium"
                >
                  View all ({allStations.length}) →
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {allStations.slice(0, 6).map((st) => (
                  <button
                    key={st.id}
                    onClick={() => handleSelectStation(st)}
                    className={`p-3 rounded-xl border text-left transition-all flex flex-col items-center gap-2 ${
                      currentStation.id === st.id
                        ? 'bg-rose-500/10 border-rose-500 shadow-md'
                        : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="w-20 h-20 flex items-center justify-center">
                      <LogoRenderer station={st} size={70} idPrefix={`quick-${st.id}`} />
                    </div>
                    <div className="w-full text-center">
                      <span className="text-xs font-bold block truncate text-slate-200 font-mono">
                        {st.name}
                      </span>
                      <span className="text-[10px] text-slate-400 block truncate">
                        {st.frequency} {st.band}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: LOGO LAB (Studio Designer & Mockups) */}
        {activeView === 'studio' && (
          <div className="animate-fadeIn">
            <LogoEditor
              station={editingStation}
              onChange={(updated) => {
                setEditingStation(updated);
                if (currentStation.id === updated.id) {
                  setCurrentStation(updated);
                }
              }}
              onSaveToCollection={handleSaveToCollection}
              onTuneIn={(st) => {
                handleSelectStation(st);
                setActiveView('tuner');
              }}
              isPlaying={isPlaying}
            />
          </div>
        )}

        {/* VIEW 3: AI BRAND ENGINE (Gemini Generator) */}
        {activeView === 'ai-generator' && (
          <div className="animate-fadeIn">
            <AILogoGenerator
              onStationGenerated={(st) => {
                handleSaveToCollection(st);
                setEditingStation(st);
                setActiveView('studio');
              }}
              onTuneIn={(st) => {
                handleSaveToCollection(st);
                handleSelectStation(st);
                setActiveView('tuner');
              }}
            />
          </div>
        )}

        {/* VIEW 4: ARCHIVE & PRESET DIRECTORY */}
        {activeView === 'archive' && (
          <div className="animate-fadeIn">
            <StationDirectory
              stations={PRESET_STATIONS}
              savedStations={savedStations}
              currentStation={currentStation}
              isPlaying={isPlaying}
              onSelectStation={handleSelectStation}
              onEditStation={handleOpenInEditor}
              onDeleteSavedStation={handleDeleteSavedStation}
              onTogglePlay={handleTogglePlay}
            />
          </div>
        )}
      </main>

      {/* Floating Bottom Broadcast Player Bar (always visible if navigating away from tuner or playing) */}
      <footer className="sticky bottom-0 z-40 bg-slate-950/95 backdrop-blur-lg border-t border-slate-800/80 py-2.5 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Station Mini Emblem & Now Playing Info */}
          <div className="flex items-center gap-3 min-w-0">
            <div
              onClick={() => setActiveView('tuner')}
              className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 cursor-pointer overflow-hidden p-1"
            >
              <LogoRenderer station={currentStation} size={36} idPrefix="footer-mini" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white font-mono truncate">
                  {currentStation.name}
                </span>
                <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                  {currentStation.frequency} {currentStation.band}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 block truncate">
                {currentStation.genre}
              </span>
            </div>
          </div>

          {/* Quick Play Transport */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleTogglePlay}
              className="p-2.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow-md active:scale-95 transition-all"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
            </button>
            <span className="text-[11px] font-mono text-slate-400 hidden md:inline">
              {isPlaying ? 'STREAMING ACTIVE' : 'BROADCAST IDLE'}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
