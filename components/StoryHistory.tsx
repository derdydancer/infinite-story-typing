import React from 'react';
import type { StorySegment } from '../types';

interface StoryHistoryProps {
  history: StorySegment[];
}

const renderSegment = (segment: StorySegment) => {
  const { userInput, prompt, filledWord } = segment;
  // Fix: Use React.ReactElement to resolve "Cannot find namespace 'JSX'" error.
  const characters: React.ReactElement[] = [];

  let filledWordStartIndex = -1;
  let filledWordEndIndex = -1;

  if (filledWord) {
    // After the user fills the blank, the `prompt` contains the filled word.
    filledWordStartIndex = prompt.indexOf(filledWord);
    if (filledWordStartIndex !== -1) {
      filledWordEndIndex = filledWordStartIndex + filledWord.length;
    }
  }
  
  for (let i = 0; i < userInput.length; i++) {
    const char = userInput[i];
    let className = 'text-emerald-400/80'; // Default correct class

    if (filledWordStartIndex !== -1 && i >= filledWordStartIndex && i < filledWordEndIndex) {
      className = 'text-yellow-400 font-bold'; // Filled word
    } else if (char !== prompt[i]) {
      className = 'text-rose-500 bg-rose-500/20 rounded-sm'; // Mistake
    }
    
    characters.push(<span key={i} className={className}>{char}</span>);
  }

  return <span key={segment.id}>{characters}{' '}</span>;
};

const StoryHistory: React.FC<StoryHistoryProps> = ({ history }) => {
  if (history.length === 0) {
    return null;
  }

  return (
    <div className="font-mono text-2xl leading-relaxed tracking-wider max-w-4xl mx-auto text-left mb-4" aria-live="polite" aria-atomic="false">
      <p>
        {history.map(renderSegment)}
      </p>
    </div>
  );
};

export default StoryHistory;
