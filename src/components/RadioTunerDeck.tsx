import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Radio as RadioIcon,
  Activity,
  Waves,
  Disc3,
  Sliders,
} from 'lucide-react';
import { RadioStation } from '../types/radio';
import { radioAudio } from '../services/audioEngine';

interface RadioTunerDeckProps {
  currentStation: RadioStation;
  allStations: RadioStation[];
  isPlaying: boolean;
  onSelectStation: (station: RadioStation) => void;
  onTogglePlay: () => void;
}

export const RadioTunerDeck: React.FC<RadioTunerDeckProps> = ({
  currentStation,
  allStations,
  isPlaying,
  onSelectStation,
  onTogglePlay,
}) => {
  const [visualizerMode, setVisualizerMode] = useState<'bars' | 'wave' | 'radar'>('bars');
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [band, setBand] = useState<'FM' | 'AM'>('FM');
  const [frequency, setFrequency] = useState(currentStation.frequency || 104.5);
  const [vuLevel, setVuLevel] = useState(0.65);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const dialRef = useRef<HTMLDivElement | null>(null);

  // Sync internal frequency when current station changes
  useEffect(() => {
    if (currentStation.frequency) {
      setFrequency(currentStation.frequency);
      if (currentStation.band === 'AM') {
        setBand('AM');
      } else {
        setBand('FM');
      }
    }
  }, [currentStation]);

  // Volume control
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    radioAudio.setVolume(val);
    if (isMuted && val > 0) {
      setIsMuted(false);
      radioAudio.setMute(false);
    }
  };

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    radioAudio.setMute(nextMuted);
  };

  // Skip stations
  const handleNextStation = () => {
    const currentIndex = allStations.findIndex((s) => s.id === currentStation.id);
    const nextIndex = (currentIndex + 1) % allStations.length;
    onSelectStation(allStations[nextIndex]);
  };

  const handlePrevStation = () => {
    const currentIndex = allStations.findIndex((s) => s.id === currentStation.id);
    const prevIndex = (currentIndex - 1 + allStations.length) % allStations.length;
    onSelectStation(allStations[prevIndex]);
  };

  // Dial drag / click logic
  const handleDialClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dialRef.current) return;
    const rect = dialRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));

    let newFreq: number;
    if (band === 'FM') {
      newFreq = Math.round((87.5 + ratio * (108.0 - 87.5)) * 10) / 10;
    } else {
      newFreq = Math.round(540 + ratio * (1600 - 540));
    }
    setFrequency(newFreq);

    // Find closest station on this band
    const matchingStation = allStations.find(
      (s) =>
        (band === 'AM' ? s.band === 'AM' : s.band !== 'AM') &&
        Math.abs(s.frequency - newFreq) <= (band === 'AM' ? 50 : 1.2)
    );
    if (matchingStation) {
      onSelectStation(matchingStation);
    } else {
      radioAudio.playTuningStatic(0.35);
    }
  };

  // Live Canvas Visualizer Loop
  const drawVisualizer = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const freqData = radioAudio.getFrequencyData();
    const timeData = radioAudio.getTimeDomainData();

    // Calculate VU meter level
    if (isPlaying && freqData.length > 0) {
      let sum = 0;
      for (let i = 0; i < 32; i++) {
        sum += freqData[i];
      }
      const avg = sum / (32 * 255);
      setVuLevel((prev) => prev * 0.8 + avg * 0.2);
    } else {
      setVuLevel((prev) => Math.max(0.05, prev * 0.95));
    }

    const primaryColor = currentStation.palette.primary || '#ff007f';
    const secondaryColor = currentStation.palette.secondary || '#00f0ff';
    const accentColor = currentStation.palette.accent || '#ffe600';

    if (visualizerMode === 'bars') {
      const barCount = 48;
      const barWidth = (width / barCount) - 2;

      for (let i = 0; i < barCount; i++) {
        const val = isPlaying ? freqData[i % freqData.length] || 0 : Math.sin(Date.now() / 300 + i * 0.2) * 8 + 10;
        const barHeight = Math.max(4, (val / 255) * height * 0.85);
        const x = i * (barWidth + 2);
        const y = height - barHeight;

        // Gradient bar
        const gradient = ctx.createLinearGradient(0, height, 0, y);
        gradient.addColorStop(0, primaryColor);
        gradient.addColorStop(0.6, secondaryColor);
        gradient.addColorStop(1, accentColor);

        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, barWidth, barHeight);

        // Peak cap
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, Math.max(0, y - 2), barWidth, 2);
      }
    } else if (visualizerMode === 'wave') {
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = secondaryColor;
      ctx.beginPath();

      const sliceWidth = width / timeData.length;
      let x = 0;

      for (let i = 0; i < timeData.length; i++) {
        const v = isPlaying ? timeData[i] / 128.0 : 1.0 + Math.sin((Date.now() / 200) + i * 0.1) * 0.05;
        const y = (v * height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }

      ctx.shadowBlur = 10;
      ctx.shadowColor = primaryColor;
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else if (visualizerMode === 'radar') {
      const centerX = width / 2;
      const centerY = height / 2;
      const baseRadius = Math.min(width, height) * 0.35;

      ctx.save();
      ctx.translate(centerX, centerY);

      // Radar rings
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, baseRadius * 0.5, 0, Math.PI * 2);
      ctx.arc(0, 0, baseRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Audio reactive polygon
      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      const points = 36;
      for (let i = 0; i < points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const freqVal = isPlaying ? freqData[i * 2] || 0 : 20;
        const r = baseRadius + (freqVal / 255) * 35;
        const px = Math.cos(angle) * r;
        const py = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();

      // Sweeping radar beam
      const sweepAngle = (Date.now() / 1000) % (Math.PI * 2);
      ctx.strokeStyle = secondaryColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(sweepAngle) * baseRadius * 1.2, Math.sin(sweepAngle) * baseRadius * 1.2);
      ctx.stroke();

      ctx.restore();
    }

    animationFrameRef.current = requestAnimationFrame(drawVisualizer);
  }, [visualizerMode, isPlaying, currentStation]);

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(drawVisualizer);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [drawVisualizer]);

  // Calculate position percentage of frequency needle on dial
  const getNeedlePercent = () => {
    if (band === 'FM') {
      return ((frequency - 87.5) / (108.0 - 87.5)) * 100;
    } else {
      return ((frequency - 540) / (1600 - 540)) * 100;
    }
  };

  return (
    <div className="w-full bg-slate-950/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-2xl backdrop-blur-xl relative overflow-hidden">
      {/* Background ambient radio tuner grid lines */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-25 pointer-events-none" />

      {/* Top Deck Info Bar */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          {/* ON AIR Lamp */}
          <div
            className={`flex items-center gap-2 px-3 py-1 rounded-md text-xs font-black tracking-widest uppercase transition-all duration-300 ${
              isPlaying
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.4)] animate-pulse'
                : 'bg-slate-900 text-slate-500 border border-slate-800'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isPlaying ? 'bg-rose-500 shadow-[0_0_8px_#f43f5e]' : 'bg-slate-600'
              }`}
            />
            ON AIR
          </div>

          <div className="text-xs text-slate-400 font-mono">
            <span>{currentStation.genre}</span>
            <span className="mx-2 text-slate-600">/</span>
            <span>{currentStation.bitrate || 'FM STEREO'}</span>
          </div>
        </div>

        {/* Digital Frequency Readout */}
        <div className="flex items-center gap-2">
          <div className="px-4 py-1.5 bg-black/80 border border-slate-700/80 rounded-lg flex items-baseline gap-2 font-mono shadow-inner">
            <span className="text-xs font-bold text-slate-500 tracking-wider">{band}</span>
            <span
              className="text-2xl sm:text-3xl font-black tracking-wider transition-colors"
              style={{ color: currentStation.palette.secondary || '#00f0ff' }}
            >
              {band === 'FM' ? frequency.toFixed(1) : Math.round(frequency)}
            </span>
            <span className="text-xs text-slate-400">
              {band === 'FM' ? 'MHz' : 'kHz'}
            </span>
          </div>

          {/* AM / FM Band Toggle */}
          <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs font-bold font-mono">
            <button
              onClick={() => setBand('FM')}
              className={`px-2.5 py-1 rounded transition-colors ${
                band === 'FM'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              FM
            </button>
            <button
              onClick={() => setBand('AM')}
              className={`px-2.5 py-1 rounded transition-colors ${
                band === 'AM'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              AM
            </button>
          </div>
        </div>
      </div>

      {/* Middle Section: Frequency Dial & Signal VU Meter */}
      <div className="relative z-10 py-5 space-y-4">
        {/* Analog Sliding Frequency Dial */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 uppercase tracking-wider px-1">
            <span>Tuner Dial Scale</span>
            <span className="text-slate-500">Click dial to scan frequencies</span>
          </div>

          <div
            ref={dialRef}
            onClick={handleDialClick}
            className="relative h-16 bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-700/60 rounded-xl overflow-hidden cursor-crosshair shadow-inner group"
          >
            {/* Dial Tick Marks */}
            <div className="absolute inset-0 flex items-center justify-between px-3 pointer-events-none select-none opacity-60">
              {band === 'FM'
                ? [88, 90, 92, 94, 96, 98, 100, 102, 104, 106, 108].map((mhz) => (
                    <div key={mhz} className="flex flex-col items-center">
                      <div className="w-0.5 h-4 bg-slate-400" />
                      <span className="text-[10px] font-mono text-slate-400 mt-1">{mhz}</span>
                      <div className="w-0.5 h-2 bg-slate-600 mt-0.5" />
                    </div>
                  ))
                : [550, 700, 850, 1000, 1200, 1400, 1600].map((khz) => (
                    <div key={khz} className="flex flex-col items-center">
                      <div className="w-0.5 h-4 bg-slate-400" />
                      <span className="text-[10px] font-mono text-slate-400 mt-1">{khz}</span>
                      <div className="w-0.5 h-2 bg-slate-600 mt-0.5" />
                    </div>
                  ))}
            </div>

            {/* Station Preset Markers on Dial */}
            {allStations
              .filter((s) => (band === 'AM' ? s.band === 'AM' : s.band !== 'AM'))
              .map((st) => {
                const pct =
                  band === 'FM'
                    ? ((st.frequency - 87.5) / (108.0 - 87.5)) * 100
                    : ((st.frequency - 540) / (1600 - 540)) * 100;
                const isSelected = st.id === currentStation.id;

                return (
                  <button
                    key={st.id}
                    title={`${st.name} (${st.frequency} ${st.band})`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectStation(st);
                    }}
                    style={{ left: `${Math.max(2, Math.min(98, pct))}%` }}
                    className={`absolute top-1 transform -translate-x-1/2 flex flex-col items-center transition-all ${
                      isSelected ? 'z-20 scale-110' : 'z-10 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-white/50 shadow-sm"
                      style={{ backgroundColor: st.palette.primary }}
                    />
                  </button>
                );
              })}

            {/* Glowing Tuning Needle */}
            <div
              className="absolute top-0 bottom-0 w-1 bg-rose-500 shadow-[0_0_12px_#f43f5e] z-30 pointer-events-none transition-all duration-150"
              style={{ left: `${Math.max(0, Math.min(100, getNeedlePercent()))}%` }}
            >
              <div className="absolute -top-1 -left-1.5 w-4 h-2 bg-rose-500 rounded-t-sm shadow-md" />
              <div className="absolute -bottom-1 -left-1.5 w-4 h-2 bg-rose-500 rounded-b-sm shadow-md" />
            </div>
          </div>
        </div>

        {/* Lower Row: Canvas Visualizer + Analog Signal Meter */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          {/* Live Visualizer Screen (3 cols) */}
          <div className="md:col-span-3 bg-slate-950 border border-slate-800/80 rounded-xl p-3 relative overflow-hidden shadow-inner">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                <RadioIcon className="w-3.5 h-3.5 text-slate-500" />
                <span>SPECTRUM MONITOR</span>
              </div>

              {/* Visualizer Mode Switcher */}
              <div className="flex bg-slate-900 border border-slate-800 rounded-md p-0.5 text-xs">
                <button
                  onClick={() => setVisualizerMode('bars')}
                  title="Frequency Bars"
                  className={`p-1.5 rounded transition-colors ${
                    visualizerMode === 'bars'
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setVisualizerMode('wave')}
                  title="Oscilloscope Wave"
                  className={`p-1.5 rounded transition-colors ${
                    visualizerMode === 'wave'
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Waves className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setVisualizerMode('radar')}
                  title="Circular Radar"
                  className={`p-1.5 rounded transition-colors ${
                    visualizerMode === 'radar'
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Disc3 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <canvas
              ref={canvasRef}
              width={640}
              height={110}
              className="w-full h-24 sm:h-28 rounded-lg bg-black/70"
            />
          </div>

          {/* Analog Signal Strength / VU Needle Meter (1 col) */}
          <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between h-full shadow-inner">
            <div className="text-[10px] font-mono text-slate-400 flex items-center justify-between">
              <span>SIGNAL S-METER</span>
              <span className="text-emerald-400 font-bold">STEREO LOCK</span>
            </div>

            {/* Vintage Arc Meter */}
            <div className="relative h-16 w-full flex items-center justify-center my-1 overflow-hidden">
              <svg viewBox="0 0 160 80" className="w-full h-full">
                {/* Meter Arc */}
                <path
                  d="M 20 70 A 60 60 0 0 1 140 70"
                  fill="none"
                  stroke="#334155"
                  strokeWidth="5"
                />
                <path
                  d="M 20 70 A 60 60 0 0 1 100 20"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="5"
                />
                <path
                  d="M 100 20 A 60 60 0 0 1 140 70"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="5"
                />
                {/* Scale Ticks */}
                {[0, 20, 40, 60, 80, 100].map((v) => {
                  const angle = Math.PI - (v / 100) * Math.PI;
                  const x1 = 80 + Math.cos(angle) * 52;
                  const y1 = 70 - Math.sin(angle) * 52;
                  const x2 = 80 + Math.cos(angle) * 62;
                  const y2 = 70 - Math.sin(angle) * 62;
                  return (
                    <line
                      key={v}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="#94a3b8"
                      strokeWidth="1.5"
                    />
                  );
                })}
                {/* Meter Pivot & Needle */}
                <g
                  style={{
                    transformOrigin: '80px 70px',
                    transform: `rotate(${(vuLevel - 0.5) * 80}deg)`,
                    transition: 'transform 100ms ease-out',
                  }}
                >
                  <line x1="80" y1="70" x2="80" y2="16" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="80" cy="70" r="4" fill="#f43f5e" />
                </g>
              </svg>
            </div>

            <div className="flex justify-between text-[9px] font-mono text-slate-500">
              <span>0dB</span>
              <span>PEAK +3dB</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Controls Bar: Playback Buttons & Volume */}
      <div className="relative z-10 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
        {/* Playback Transport Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrevStation}
            title="Previous Station"
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 active:scale-95 transition-all"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            onClick={onTogglePlay}
            title={isPlaying ? 'Pause Broadcast' : 'Start Broadcast'}
            className="p-3.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold shadow-lg shadow-rose-950/40 active:scale-95 transition-all flex items-center gap-2"
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
            <span className="text-xs tracking-wider uppercase">
              {isPlaying ? 'PAUSE' : 'BROADCAST'}
            </span>
          </button>

          <button
            onClick={handleNextStation}
            title="Next Station"
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 active:scale-95 transition-all"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Current Station Call Letters */}
        <div className="hidden sm:flex flex-col text-left">
          <span className="text-xs font-black tracking-widest text-slate-200 uppercase font-mono">
            {currentStation.name}
          </span>
          <span className="text-[11px] text-slate-400 font-mono">
            {currentStation.callSign} · {currentStation.slogan}
          </span>
        </div>

        {/* Volume & Audio Settings */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleMute}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            aria-label="Volume"
            className="w-20 sm:w-28 accent-rose-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};
