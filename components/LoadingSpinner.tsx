import React from 'react';

/**
 * A simple loading spinner component.
 * @param {object} props - Component props.
 * @param {string} [props.message="Loading..."] - Message to display below the spinner.
 */
const LoadingSpinner: React.FC<{ message?: string }> = ({ message = "Loading..." }) => {
  return (
    <div className="flex flex-col items-center justify-center p-4">
      <div className="w-12 h-12 border-4 border-t-4 border-gray-600 border-t-purple-400 rounded-full animate-spin"></div>
      <p className="mt-3 text-lg text-gray-300 font-medium">{message}</p>
    </div>
  );
};

export default LoadingSpinner;