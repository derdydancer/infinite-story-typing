import React from 'react';
import type { Stats } from '../types';

interface StatsDisplayProps {
  stats: Stats;
}

const StatCard: React.FC<{ label: string; value: string | number; colorClass: string }> = ({ label, value, colorClass }) => (
    <div className="bg-slate-800/50 rounded-lg p-4 text-center transform transition-transform hover:scale-105 flex-grow">
        <div className={`text-4xl font-bold font-mono ${colorClass}`}>{value}</div>
        <div className="text-sm uppercase text-slate-400 tracking-widest mt-1">{label}</div>
    </div>
);


const StatsDisplay: React.FC<StatsDisplayProps> = ({ stats }) => {
  return (
    <div className="flex flex-wrap justify-center gap-4 w-full max-w-5xl mx-auto my-8">
      <StatCard label="Score" value={stats.score} colorClass="text-yellow-400" />
      <StatCard label="WPM" value={stats.wpm.toFixed(0)} colorClass="text-cyan-400" />
      <StatCard label="Accuracy" value={`${stats.accuracy.toFixed(0)}%`} colorClass="text-emerald-400" />
      <StatCard label="Chars" value={stats.charsTyped} colorClass="text-amber-400" />
      <StatCard label="Mistakes" value={stats.mistakes} colorClass="text-rose-500" />
      <StatCard label="Lives" value={stats.lives} colorClass="text-violet-400" />
      <StatCard label="Streak" value={stats.flawlessStreak} colorClass="text-orange-400" />
    </div>
  );
};

export default StatsDisplay;
