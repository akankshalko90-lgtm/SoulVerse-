import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom'; // Import ReactDOM for createPortal
import { GoogleGenAI } from "@google/genai";
import PoemInput from './components/PoemInput';
import PoemDisplay from './components/PoemDisplay';
import PlaybackControls from './components/PlaybackControls';
import LoadingSpinner from './components/LoadingSpinner';
import { generateSpeech } from './services/ttsService'; // generateSpeech now returns ArrayBuffer of MP3
import './types'; // Ensure global types for AudioContext are loaded

const App: React.FC = () => {
  const [poemInput, setPoemInput] = useState<string>('');
  const [generatedPoem, setGeneratedPoem] = useState<string>(''); // The full text of the generated poem
  const [poemLines, setPoemLines] = useState<string[]>([]);
  const [currentLineIndex, setCurrentLineIndex] = useState<number>(-1);
  const [speechOnlyDecodedBuffer, setSpeechOnlyDecodedBuffer] = useState<AudioBuffer | null>(null);
  const [speechOnlyRawMp3Buffer, setSpeechOnlyRawMp3Buffer] = useState<ArrayBuffer | null>(null); // For downloading speech-only
  const [mixedDecodedBuffer, setMixedDecodedBuffer] = useState<AudioBuffer | null>(null);
  const [mixedRawMp3Buffer, setMixedRawMp3Buffer] = useState<ArrayBuffer | null>(null); // For downloading mixed
  const [currentPlaybackAudioBuffer, setCurrentPlaybackAudioBuffer] = useState<AudioBuffer | null>(null); // Decoded buffer currently selected for playback
  const [currentDownloadMp3Buffer, setCurrentDownloadMp3Buffer] = useState<ArrayBuffer | null>(null); // Raw MP3 buffer currently selected for download
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [musicChoice, setMusicChoice] = useState<string>('none'); // 'none', 'ambient', 'orchestral'
  const [volume, setVolume] = useState<number>(0.75); // Master volume control
  const [isMixing, setIsMixing] = useState<boolean>(false); // State for when mixing is in progress
  const [isMixedAudioPlaying, setIsMixedAudioPlaying] = useState<boolean>(false); // State to trigger glow animation for mixed audio player

  // Audio context references
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const lineTimerRef = useRef<number | null>(null); // NodeJS.Timeout is not available in browser global scope, use number

  // Portal root for PoemDisplay
  const [poemDisplayPortalRoot, setPoemDisplayPortalRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // Safely get the #poem-display element for the portal
    const root = document.getElementById('poem-display');
    if (root) {
      setPoemDisplayPortalRoot(root);
    } else {
      console.error("Could not find element with id 'poem-display' for PoemDisplay portal.");
    }

    const initAudioContext = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        gainNodeRef.current = audioContextRef.current.createGain();
        gainNodeRef.current.connect(audioContextRef.current.destination);
        gainNodeRef.current.gain.value = volume;
      }
    };

    document.documentElement.addEventListener('click', initAudioContext, { once: true });
    document.documentElement.addEventListener('keydown', initAudioContext, { once: true });

    return () => {
      document.documentElement.removeEventListener('click', initAudioContext);
      document.documentElement.removeEventListener('keydown', initAudioContext);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error);
      }
      if (lineTimerRef.current !== null) {
        clearTimeout(lineTimerRef.current);
      }
    };
  }, [volume]);

  // Update gain node volume when volume state changes
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = volume;
    }
  }, [volume]);

  const clearLineTimers = useCallback(() => {
    if (lineTimerRef.current !== null) {
      clearTimeout(lineTimerRef.current);
      lineTimerRef.current = null;
    }
  }, []);

  const stopAudio = useCallback(() => {
    if (audioSourceRef.current) {
      audioSourceRef.current.stop();
      audioSourceRef.current.disconnect();
      audioSourceRef.current = null;
    }
    clearLineTimers();
    setIsPlaying(false);
    setCurrentLineIndex(-1);
    setIsMixedAudioPlaying(false);
  }, [clearLineTimers]);

  // Cleanup audio on component unmount
  useEffect(() => {
    return () => {
      stopAudio();
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error);
      }
    };
  }, [stopAudio]);

  const setAudioAndSyncData = useCallback((decodedBuffer: AudioBuffer, rawMp3Buffer: ArrayBuffer, type: 'speechOnly' | 'mixed') => {
    setCurrentPlaybackAudioBuffer(decodedBuffer);
    setCurrentDownloadMp3Buffer(rawMp3Buffer);
    setPoemLines(generatedPoem.split('\n').filter(line => line.trim() !== ''));
    if (type === 'speechOnly') {
      setSpeechOnlyDecodedBuffer(decodedBuffer);
      setSpeechOnlyRawMp3Buffer(rawMp3Buffer);
      setMixedDecodedBuffer(null);
      setMixedRawMp3Buffer(null);
      setIsMixedAudioPlaying(false);
    } else { // type === 'mixed'
      setMixedDecodedBuffer(decodedBuffer);
      setMixedRawMp3Buffer(rawMp3Buffer);
      setIsMixedAudioPlaying(true); // Activate glow for mixed audio
    }
  }, [generatedPoem]);


  const playAudio = useCallback((buffer: AudioBuffer) => {
    if (!audioContextRef.current || !gainNodeRef.current) {
      setErrorMessage("Audio context not initialized. Please interact with the page first.");
      return;
    }

    stopAudio(); // Stop any currently playing audio

    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(gainNodeRef.current);

    source.onended = () => {
      setIsPlaying(false);
      setCurrentLineIndex(-1);
      audioSourceRef.current = null;
      setIsMixedAudioPlaying(false);
    };

    source.start(0);
    audioSourceRef.current = source;
    setIsPlaying(true);

    // Logic for highlighting lines if poemLines are available
    if (poemLines.length > 0) {
      clearLineTimers();
      const totalDuration = buffer.duration;
      const lineDurations: number[] = [];
      const totalChars = poemLines.reduce((sum, line) => sum + line.length, 0);

      // Simple heuristic for line durations based on character count
      poemLines.forEach(line => {
        lineDurations.push(totalDuration * (line.length / totalChars));
      });

      let cumulativeTime = 0;
      lineDurations.forEach((duration, i) => {
        lineTimerRef.current = setTimeout(() => {
          if (audioSourceRef.current) { // Only update if still playing
            setCurrentLineIndex(i);
          }
        }, cumulativeTime * 1000); // Convert to milliseconds
        cumulativeTime += duration;
      });
      // Clear last line highlight after total duration
      lineTimerRef.current = setTimeout(() => {
        if (audioSourceRef.current) {
          setCurrentLineIndex(-1);
        }
      }, totalDuration * 1000);
    } else {
      setCurrentLineIndex(-1); // No lines to highlight
    }
  }, [poemLines, stopAudio, clearLineTimers]);

  const handlePlayPause = useCallback(() => {
    if (!currentPlaybackAudioBuffer) {
      setErrorMessage("No audio to play. Generate your poem first!");
      return;
    }

    if (isPlaying) {
      stopAudio();
    } else {
      playAudio(currentPlaybackAudioBuffer);
    }
  }, [currentPlaybackAudioBuffer, isPlaying, playAudio, stopAudio]);

  const handleStop = useCallback(() => {
    stopAudio();
  }, [stopAudio]);

  const handleMusicChange = useCallback(async (newMusicChoice: string) => {
    if (!generatedPoem) {
      setErrorMessage("A voice unheard. Generate your poem's narration before seeking its symphony.");
      return;
    }
    if (!audioContextRef.current) {
      setErrorMessage("Audio context not initialized. Please interact with the page first.");
      return;
    }
    if (musicChoice === newMusicChoice) return; // No change

    stopAudio(); // Stop current playback immediately
    setErrorMessage('');
    setMusicChoice(newMusicChoice);
    setIsMixing(true);
    setLoadingMessage(`Weaving your verse with a new melody...`);

    try {
      if (newMusicChoice === 'none') {
        // Switch back to the original speech-only audio
        if (speechOnlyDecodedBuffer && speechOnlyRawMp3Buffer) {
          setAudioAndSyncData(speechOnlyDecodedBuffer, speechOnlyRawMp3Buffer, 'speechOnly');
        } else {
          // Fallback: if speechOnly buffers are somehow null, regenerate
          const speechMp3ArrayBuffer = await generateSpeech(generatedPoem);
          if (!speechMp3ArrayBuffer) throw new Error("Failed to regenerate speech for 'none' music.");
          const decodedBuffer = await audioContextRef.current.decodeAudioData(speechMp3ArrayBuffer);
          setAudioAndSyncData(decodedBuffer, speechMp3ArrayBuffer, 'speechOnly');
        }
        playAudio(currentPlaybackAudioBuffer!); // Play after switching
      } else {
        // Ensure we have the raw MP3 for the voice to send to the mixer
        let voiceMp3ArrayBuffer = speechOnlyRawMp3Buffer;
        if (!voiceMp3ArrayBuffer) {
          // If not already stored, generate it
          voiceMp3ArrayBuffer = await generateSpeech(generatedPoem);
          if (!voiceMp3ArrayBuffer) throw new Error("Could not retrieve MP3 speech audio for mixing.");
          // Store it for future use if needed, though handleMusicChange is primarily for mixing
          setSpeechOnlyRawMp3Buffer(voiceMp3ArrayBuffer);
        }

        const formData = new FormData();
        formData.append('voice_audio', new Blob([voiceMp3ArrayBuffer], { type: 'audio/mpeg' }), 'voice.mp3');
        formData.append('musicChoice', newMusicChoice);

        const response = await fetch('/api/mix', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown mixing error' }));
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const mixedAudioBlob = await response.blob();
        const mixedAudioArrayBuffer = await mixedAudioBlob.arrayBuffer();
        const newDecodedBuffer = await audioContextRef.current.decodeAudioData(mixedAudioArrayBuffer);

        setAudioAndSyncData(newDecodedBuffer, mixedAudioArrayBuffer, 'mixed');
        playAudio(newDecodedBuffer); // Auto-play mixed audio
      }
    } catch (error) {
      console.error('Error mixing audio:', error);
      setErrorMessage(error instanceof Error ? error.message : String(error));
      // Revert music choice if mixing failed
      setMusicChoice('none');
      if (speechOnlyDecodedBuffer && speechOnlyRawMp3Buffer) {
        setAudioAndSyncData(speechOnlyDecodedBuffer, speechOnlyRawMp3Buffer, 'speechOnly');
      }
    } finally {
      setIsMixing(false);
      setLoadingMessage('');
    }
  }, [musicChoice, generatedPoem, speechOnlyDecodedBuffer, speechOnlyRawMp3Buffer, stopAudio, playAudio, setAudioAndSyncData, currentPlaybackAudioBuffer]);

  const handleVolumeChange = useCallback((newVolume: number) => {
    setVolume(newVolume);
  }, []);

  const handleGeneratePoem = async () => {
    if (!poemInput.trim()) {
      setErrorMessage("Your parchment is blank. Please inscribe your verse before invoking the voice.");
      return;
    }

    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    stopAudio();
    setErrorMessage('');
    setGeneratedPoem('');
    setPoemLines([]);
    setSpeechOnlyDecodedBuffer(null);
    setSpeechOnlyRawMp3Buffer(null);
    setMixedDecodedBuffer(null);
    setMixedRawMp3Buffer(null);
    setCurrentPlaybackAudioBuffer(null);
    setCurrentDownloadMp3Buffer(null);
    setMusicChoice('none'); // Reset music choice on new generation
    setIsLoading(true);
    setLoadingMessage('Summoning poetic verse...');

    try {
      // 1. Generate the poem using Google GenAI (text-to-text)
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const poemResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash', // Recommended for basic text tasks
        contents: `Write a beautiful and inspiring poem based on the following text, focusing on evocative imagery and emotional depth. Ensure the poem is at least 8 lines long. Text: "${poemInput}"`,
      });

      const poemText = poemResponse.text;
      if (!poemText) {
        throw new Error("No poem text received from the model.");
      }
      setGeneratedPoem(poemText); // Store full generated poem text

      setLoadingMessage('Whispering the words into existence...');

      // 2. Generate speech for the poem using the external TTS service (OpenAI via /api/voice)
      const speechMp3ArrayBuffer = await generateSpeech(poemText);
      if (!speechMp3ArrayBuffer || !audioContextRef.current) {
        throw new Error("The muse fell silent. Could not capture the voice of your poem.");
      }
      const speechDecodedBuffer = await audioContextRef.current.decodeAudioData(speechMp3ArrayBuffer);
      
      setAudioAndSyncData(speechDecodedBuffer, speechMp3ArrayBuffer, 'speechOnly');
      
      setLoadingMessage('Poem and voice ready!');
      playAudio(speechDecodedBuffer); // Auto-play speech-only audio

    } catch (error) {
      console.error('Error during poem generation or speech synthesis:', error);
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const handleDownload = useCallback(() => {
    if (!currentDownloadMp3Buffer) {
      setErrorMessage("An empty canvas. There's no audio masterpiece to download yet.");
      return;
    }
    try {
      const blob = new Blob([currentDownloadMp3Buffer], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'soulful_recitation.mp3';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading audio:', error);
      setErrorMessage('A silken thread broke. Failed to prepare your masterpiece for download.');
    }
  }, [currentDownloadMp3Buffer]);


  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-950 to-indigo-950 text-gray-100 font-sans p-4 flex flex-col items-center">
      <header className="text-center my-8">
        <h1 className="text-5xl md:text-7xl font-playfair-display font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-indigo-300 tracking-tight leading-tight text-glow">
          SoulVerse
        </h1>
        <p className="mt-3 text-xl md:text-2xl text-gray-300 font-merriweather italic text-glow">
          Weaving words into a symphony of verse and voice.
        </p>
      </header>

      <main className="flex flex-col items-center w-full max-w-4xl space-y-6 flex-grow">
        <PoemInput
          value={poemInput}
          onChange={(e) => setPoemInput(e.target.value)}
          disabled={isLoading || isMixing}
        />

        <button
          onClick={handleGeneratePoem}
          disabled={isLoading || isMixing || !poemInput.trim()}
          className="px-8 py-4 bg-purple-600 hover:bg-purple-700 text-white text-xl font-semibold
                     rounded-full shadow-xl transition-all duration-300 ease-in-out transform hover:scale-105
                     disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          aria-label="Generate Poem and Voice"
        >
          {isLoading ? (
            <LoadingSpinner message={loadingMessage} />
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span>Conjure Verse & Voice</span>
            </>
          )}
        </button>

        {errorMessage && (
          <div className="w-full p-4 bg-red-800 bg-opacity-70 border border-red-500 rounded-lg text-red-200 text-center">
            <p className="font-semibold">{errorMessage}</p>
          </div>
        )}

        {/* PoemDisplay rendered via portal */}
        {poemDisplayPortalRoot && (
          ReactDOM.createPortal(
            <PoemDisplay
              poemLines={poemLines}
              currentLineIndex={currentLineIndex}
              spokenPoemText={generatedPoem}
            />,
            poemDisplayPortalRoot
          )
        )}
        
        {currentPlaybackAudioBuffer && (
          <PlaybackControls
            isPlaying={isPlaying}
            isMixing={isMixing}
            onPlayPause={handlePlayPause}
            onStop={handleStop}
            onMusicChange={handleMusicChange}
            musicChoice={musicChoice}
            onVolumeChange={handleVolumeChange}
            volume={volume}
            disabled={isLoading || isMixing}
            hasAudioForDownload={!!currentDownloadMp3Buffer}
            onDownload={handleDownload}
            isMixedAudioPlaying={isMixedAudioPlaying}
          />
        )}
      </main>

      <footer className="mt-8 mb-4 text-gray-500 text-sm">
        <p>Created with love by Akanksha Gupta Vedantika ✨</p>
      </footer>
    </div>
  );
};

export default App;