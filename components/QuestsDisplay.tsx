import React from 'react';
import type { Quest } from '../types';

interface QuestItemProps {
  quest: Quest;
}

const QuestItem: React.FC<QuestItemProps> = ({ quest }) => {
  const isNew = quest.state === 'new';
  const isCompleted = quest.state === 'completed';
  const isFailed = quest.state === 'failed';

  return (
    <li 
      className={`bg-slate-800/70 p-4 rounded-lg border border-slate-700 transition-all duration-500 ${isNew ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'} ${isCompleted || isFailed ? 'opacity-50' : ''}`}
      style={{ transitionDelay: isNew ? '200ms' : '0ms' }}
    >
      <div className="flex justify-between items-center">
        <p className={`flex-1 pr-4 ${isCompleted || isFailed ? 'line-through text-slate-500' : 'text-slate-300'}`}>
          {quest.description}
        </p>
        <div className={`flex items-center font-bold font-mono text-lg px-3 py-1 rounded-full ${isCompleted ? 'bg-emerald-500/20 text-emerald-400' : isFailed ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'}`}>
          {isCompleted && (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )}
          {isFailed && (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          )}
          {quest.points} PTS
        </div>
      </div>
    </li>
  );
};


interface QuestsDisplayProps {
  quests: Quest[];
}

const QuestsDisplay: React.FC<QuestsDisplayProps> = ({ quests }) => {
  if (quests.length === 0) return (
    <div className="w-full max-w-4xl mx-auto my-8 p-4 rounded-lg border border-dashed border-slate-700 text-center text-slate-500">
        <h2 className="text-2xl font-bold text-slate-400 mb-2 tracking-wider">Quests</h2>
        <p>Start the game to generate quests!</p>
    </div>
  );

  return (
    <div className="w-full max-w-4xl mx-auto my-8">
        <h2 className="text-2xl font-bold text-slate-400 mb-4 text-center tracking-wider">Quests</h2>
        <ul className="space-y-3">
            {quests.map((quest) => (
                <QuestItem key={quest.id} quest={quest} />
            ))}
        </ul>
    </div>
  );
};

export default QuestsDisplay;