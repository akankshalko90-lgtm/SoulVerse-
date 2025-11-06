import React, { useState, useEffect } from 'react';

interface PoemDisplayProps {
  poemLines: string[];
  currentLineIndex: number;
  spokenPoemText: string; // Keep this for initial display if no lines are active
}

const PoemDisplay: React.FC<PoemDisplayProps> = ({ poemLines, currentLineIndex, spokenPoemText }) => {
  const [displayedLine, setDisplayedLine] = useState<string>('');
  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);

  useEffect(() => {
    if (currentLineIndex >= 0 && currentLineIndex < poemLines.length) {
      setIsFadingOut(true); // Start fade-out of previous line (if any)
      const fadeOutTimer = setTimeout(() => {
        setDisplayedLine(poemLines[currentLineIndex]);
        setIsFadingOut(false); // Start fade-in of new line
      }, 200); // Duration for fade-out

      return () => clearTimeout(fadeOutTimer);
    } else {
      setDisplayedLine(''); // Clear displayed line if no line is active
      setIsFadingOut(false);
    }
  }, [currentLineIndex, poemLines]);

  // If no lines are active, show the full poem text initially, or a placeholder
  const contentToShow = poemLines.length > 0 && currentLineIndex === -1 && spokenPoemText.trim() !== ''
    ? spokenPoemText
    : displayedLine || "Your generated poem will appear here...";
  
  const isPlayingLine = currentLineIndex >= 0;

  return (
    <div className="w-full p-4 md:p-6 bg-gray-800 bg-opacity-70 border border-purple-700 rounded-xl shadow-lg
                    text-lg md:text-xl text-white font-playfair-display leading-relaxed whitespace-pre-wrap
                    h-64 md:h-80 flex items-center justify-center text-center overflow-hidden relative">
      <div 
        className={`transition-opacity duration-300 ease-out ${isFadingOut ? 'opacity-0' : 'opacity-100'}
                    ${isPlayingLine && !isFadingOut ? 'text-purple-300 text-glow animate-fade-in' : 'text-gray-200'}`}
        style={{ transition: 'opacity 0.3s ease-out, transform 0.3s ease-out' }} // Soft motion transition
      >
        {contentToShow}
      </div>
    </div>
  );
};

export default PoemDisplay;