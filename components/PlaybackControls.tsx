import React, { useEffect, useState } from 'react';

interface PlaybackControlsProps {
  isPlaying: boolean;
  isMixing: boolean;
  onPlayPause: () => void;
  onStop: () => void;
  onMusicChange: (musicType: string) => void;
  musicChoice: string;
  onVolumeChange: (volume: number) => void;
  volume: number;
  disabled: boolean; // Controls overall disabled state
  hasAudioForDownload: boolean; // New prop to indicate if a downloadable audio is available
  onDownload: () => void; // New prop for download action
  isMixedAudioPlaying: boolean; // New prop to control specific mixed audio styling
}

const musicOptions = [
  { value: 'none', label: 'No Background Music' },
  { value: 'ambient', label: 'Ambient Soundscape' },
  { value: 'orchestral', label: 'Orchestral Harmony' },
];

const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  isPlaying,
  isMixing,
  onPlayPause,
  onStop,
  onMusicChange,
  musicChoice,
  onVolumeChange,
  volume,
  disabled,
  hasAudioForDownload,
  onDownload,
  isMixedAudioPlaying,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Show component with fade-in animation when not disabled
    if (!disabled) {
      setIsVisible(true);
    } else {
      setIsVisible(false); // Hide with fade-out
    }
  }, [disabled]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    onVolumeChange(newVolume);
  };

  const handleMusicSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onMusicChange(e.target.value);
  };

  const playPauseLabel = isPlaying ? 'Pause' : 'Play';
  const playPauseIcon = isPlaying ? '❚❚' : '▶'; // Unicode for Pause and Play

  const containerClasses = `
    flex flex-col lg:flex-row items-center justify-between p-4 md:p-6
    bg-gray-800 bg-opacity-70 border border-purple-700 rounded-xl shadow-lg
    mt-4 w-full max-w-4xl mx-auto transition-all duration-500 ease-in-out
    ${isVisible ? 'opacity-100 animate-fade-in' : 'opacity-0 pointer-events-none'}
    ${isMixedAudioPlaying ? 'bg-gradient-to-br from-purple-900 to-indigo-900 animate-soft-pulse-glow shadow-glow-lg' : ''}
  `;

  return (
    <div className={containerClasses}>
      {/* Play/Pause and Stop Buttons */}
      <div className="flex items-center space-x-4 mb-4 lg:mb-0">
        <button
          onClick={onPlayPause}
          disabled={disabled || isMixing}
          className="flex items-center justify-center w-16 h-16 rounded-full bg-purple-600 hover:bg-purple-700
                     text-white text-3xl font-bold shadow-lg transition-colors duration-300 ease-in-out
                     disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={playPauseLabel}
        >
          {playPauseIcon}
        </button>
        <button
          onClick={onStop}
          disabled={disabled || isMixing}
          className="flex items-center justify-center w-16 h-16 rounded-full bg-red-600 hover:bg-red-700
                     text-white text-3xl font-bold shadow-lg transition-colors duration-300 ease-in-out
                     disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Stop Playback"
        >
          ■
        </button>
      </div>

      {/* Music Selection */}
      <div className="flex flex-col items-center lg:items-start mb-4 lg:mb-0">
        <label htmlFor="music-select" className="text-gray-300 text-sm mb-1">
          Background Music:
        </label>
        <select
          id="music-select"
          value={musicChoice}
          onChange={handleMusicSelectChange}
          disabled={disabled || isMixing}
          className="p-2 rounded-md bg-gray-700 text-white border border-purple-500 focus:ring-purple-400
                     focus:border-purple-400 transition-all duration-300 ease-in-out disabled:opacity-50
                     disabled:cursor-not-allowed cursor-pointer"
          aria-label="Select background music"
        >
          {musicOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Volume Control */}
      <div className="flex items-center space-x-3 w-full lg:w-auto mb-4 lg:mb-0">
        <span className="text-gray-300 text-lg">Volume:</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={handleVolumeChange}
          disabled={disabled || isMixing}
          className="w-full lg:w-40 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer range-lg
                     [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full
                     [&::-webkit-slider-thumb]:bg-purple-400 [&::-webkit-slider-thumb]:appearance-none"
          aria-label="Volume slider"
        />
      </div>

      {/* Download Button */}
      <button
        onClick={onDownload}
        disabled={disabled || isMixing || !hasAudioForDownload}
        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-lg font-semibold
                   rounded-full shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105
                   disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        aria-label="Download Soulful Recitation"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L10 12.586l2.293-2.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
          <path fillRule="evenodd" d="M10 2a1 1 0 011 1v9.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L9 12.586V3a1 1 0 011-1z" clipRule="evenodd" />
        </svg>
        <span>Download Recitation</span>
      </button>
    </div>
  );
};

export default PlaybackControls;