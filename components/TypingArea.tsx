import React from 'react';

type CharacterState = 'correct' | 'incorrect' | 'current' | 'pending';

interface TypingAreaProps {
  prompt: string;
  userInput: string;
}

const Character: React.FC<{ char: string; state: CharacterState }> = ({ char, state }) => {
    let className = 'transition-colors duration-200 ';
    switch(state) {
        case 'correct':
            className += 'text-emerald-400';
            break;
        case 'incorrect':
            className += 'text-rose-500 bg-rose-500/20 rounded-sm';
            break;
        case 'current':
            className += 'text-slate-100 bg-cyan-500/50 rounded-sm animate-pulse';
            break;
        case 'pending':
            className += 'text-slate-500';
            break;
    }
    
    if (char === ' ') {
        if(state === 'current') {
            return <span className={className}>&nbsp;</span>
        }
        if(state === 'incorrect') {
            return <span className="text-rose-500 bg-rose-500/20 rounded-sm underline decoration-rose-500">&nbsp;</span>
        }
    }
    
    return <span className={className}>{char}</span>;
}


const TypingArea: React.FC<TypingAreaProps> = ({ prompt, userInput }) => {
  const characters = prompt.split('').map((char, index) => {
    let state: CharacterState = 'pending';
    
    if (index < userInput.length) {
      state = userInput[index] === char ? 'correct' : 'incorrect';
    } else if (index === userInput.length) {
      state = 'current';
    }

    return <Character key={`${char}-${index}`} char={char} state={state} />;
  });

  return (
    <div className="bg-slate-800 p-6 rounded-lg font-mono text-2xl leading-relaxed tracking-wider shadow-lg max-w-4xl mx-auto text-left min-h-[7rem] flex items-center">
      <p>{characters}</p>
    </div>
  );
};

export default TypingArea;