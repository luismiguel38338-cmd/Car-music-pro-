import React, { useState } from 'react';
import { Search, Play, Pause, Edit3, Trash2, Download, Radio, Bookmark } from 'lucide-react';
import { RadioStation, EraStyle, BandType } from '../types/radio';
import { LogoRenderer } from './LogoRenderer';

interface StationDirectoryProps {
  stations: RadioStation[];
  savedStations: RadioStation[];
  currentStation: RadioStation;
  isPlaying: boolean;
  onSelectStation: (station: RadioStation) => void;
  onEditStation: (station: RadioStation) => void;
  onDeleteSavedStation: (stationId: string) => void;
  onTogglePlay: () => void;
}

export const StationDirectory: React.FC<StationDirectoryProps> = ({
  stations,
  savedStations,
  currentStation,
  isPlaying,
  onSelectStation,
  onEditStation,
  onDeleteSavedStation,
  onTogglePlay,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEra, setSelectedEra] = useState<string>('All');
  const [selectedBand, setSelectedBand] = useState<string>('All');
  const [showOnlySaved, setShowOnlySaved] = useState(false);

  const eras = ['All', '80s Retro', 'Golden Age 50s', 'Cyberpunk', 'Modern Minimal', '90s Grunge', 'Club Neon'];
  const bands = ['All', 'FM', 'AM', 'WEB', 'DAB+'];

  const allDisplayStations = showOnlySaved
    ? savedStations
    : [...stations, ...savedStations];

  const filteredStations = allDisplayStations.filter((st) => {
    const matchesSearch =
      st.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      st.callSign.toLowerCase().includes(searchQuery.toLowerCase()) ||
      st.genre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (st.slogan && st.slogan.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesEra = selectedEra === 'All' || st.era === selectedEra;
    const matchesBand = selectedBand === 'All' || st.band === selectedBand;

    return matchesSearch && matchesEra && matchesBand;
  });

  const handleDownloadSvg = (station: RadioStation, e: React.MouseEvent) => {
    e.stopPropagation();
    let svgString = station.customSvg;
    if (!svgString) {
      const container = document.getElementById(`station-card-${station.id}`);
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

  return (
    <div className="w-full space-y-6">
      {/* Search and Filters Bar */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search station name, genre, frequency, or call sign..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* Saved Logos Tab Toggle */}
          <button
            onClick={() => setShowOnlySaved(!showOnlySaved)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
              showOnlySaved
                ? 'bg-rose-500 text-white border-rose-500 shadow-md'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>My Saved Logos ({savedStations.length})</span>
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-900">
          {/* Era Filter */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-400 uppercase">Era:</span>
            <div className="flex flex-wrap gap-1">
              {eras.map((era) => (
                <button
                  key={era}
                  onClick={() => setSelectedEra(era)}
                  className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                    selectedEra === era
                      ? 'bg-slate-800 text-white font-medium shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {era}
                </button>
              ))}
            </div>
          </div>

          {/* Band Filter */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-400 uppercase">Band:</span>
            <div className="flex gap-1">
              {bands.map((band) => (
                <button
                  key={band}
                  onClick={() => setSelectedBand(band)}
                  className={`px-2 py-1 text-xs rounded-lg transition-colors ${
                    selectedBand === band
                      ? 'bg-slate-800 text-white font-medium shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {band}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Station Logos */}
      {filteredStations.length === 0 ? (
        <div className="text-center py-16 bg-slate-950 border border-slate-800 rounded-2xl p-8">
          <Radio className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-300">No station logos found</h3>
          <p className="text-xs text-slate-500 mt-1">
            Try adjusting your search keywords or filter options.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredStations.map((station) => {
            const isCurrent = currentStation.id === station.id;
            const isCurrentlyPlaying = isCurrent && isPlaying;

            return (
              <div
                key={station.id}
                id={`station-card-${station.id}`}
                className={`group bg-slate-950 rounded-2xl border transition-all duration-300 overflow-hidden flex flex-col ${
                  isCurrent
                    ? 'border-rose-500/80 shadow-[0_0_25px_rgba(244,63,94,0.15)] ring-1 ring-rose-500/50'
                    : 'border-slate-800 hover:border-slate-700 hover:shadow-xl'
                }`}
              >
                {/* Station Logo Box */}
                <div
                  onClick={() => onSelectStation(station)}
                  className="relative p-6 flex items-center justify-center bg-slate-900/60 cursor-pointer overflow-hidden min-h-[220px]"
                >
                  {/* Subtle radial glow */}
                  <div
                    className="absolute inset-0 opacity-20 pointer-events-none"
                    style={{
                      background: `radial-gradient(circle at center, ${station.palette.primary} 0%, transparent 70%)`,
                    }}
                  />

                  {/* Logo graphic */}
                  <LogoRenderer
                    station={station}
                    size={170}
                    isPlaying={isCurrentlyPlaying}
                    idPrefix={`grid-${station.id}`}
                  />

                  {/* Play Overlay Button on Hover */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isCurrent) {
                          onTogglePlay();
                        } else {
                          onSelectStation(station);
                        }
                      }}
                      title={isCurrentlyPlaying ? 'Pause' : 'Play Station'}
                      className="p-3 rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow-lg transform transition-transform hover:scale-110 active:scale-95"
                    >
                      {isCurrentlyPlaying ? (
                        <Pause className="w-5 h-5" />
                      ) : (
                        <Play className="w-5 h-5 fill-current" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Station Meta Info */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3 bg-slate-950/80">
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="text-base font-bold text-white font-mono group-hover:text-rose-400 transition-colors">
                        {station.name}
                      </h4>
                      <span className="text-xs font-mono font-bold text-slate-400">
                        {station.frequency} {station.band}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {station.genre}
                    </div>

                    {station.slogan && (
                      <div className="text-[11px] text-slate-500 italic mt-1 line-clamp-1">
                        "{station.slogan}"
                      </div>
                    )}
                  </div>

                  {/* Action Buttons: Remix / Download / Delete */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-900 text-xs">
                    <button
                      onClick={() => onEditStation(station)}
                      className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Remix Logo</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleDownloadSvg(station, e)}
                        title="Download SVG vector"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-900 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>

                      {station.isCustom && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteSavedStation(station.id);
                          }}
                          title="Delete saved logo"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-900 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
