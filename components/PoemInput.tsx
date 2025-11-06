import React from 'react';

interface PoemInputProps {
  value: string;
  onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  disabled: boolean;
}

const PoemInput: React.FC<PoemInputProps> = ({ value, onChange, disabled }) => {
  return (
    <textarea
      className="w-full p-4 md:p-6 bg-gray-800 bg-opacity-70 border border-purple-700 rounded-xl shadow-lg
                 focus:outline-none focus:ring-2 focus:ring-purple-400 text-lg md:text-xl text-white
                 h-64 md:h-80 resize-none font-merriweather leading-relaxed
                 placeholder-gray-400 transition-all duration-300 ease-in-out"
      placeholder="Write or paste your soulful poem here..."
      value={value}
      onChange={onChange}
      disabled={disabled}
      aria-label="Poem input textarea"
    ></textarea>
  );
};

export default PoemInput;