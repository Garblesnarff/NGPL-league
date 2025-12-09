
import React from 'react';
import { HandHistoryEntry } from '../types';

interface HandHistoryProps {
  history: HandHistoryEntry[];
}

const HandHistory: React.FC<HandHistoryProps> = ({ history }) => {
  return (
    <div className="p-3 w-80 h-64 overflow-y-auto text-xs font-mono space-y-2 bg-slate-900/50">
      {history.length === 0 && <div className="text-slate-500 italic text-center p-4">No history yet.</div>}
      
      {[...history].reverse().map((entry) => (
        <div key={entry.id} className="border-b border-slate-700 pb-2 mb-2 last:mb-0 last:border-0 hover:bg-slate-800/50 p-2 rounded transition-colors">
            <div className="flex justify-between items-center mb-1">
                <span className="text-yellow-500 font-bold">Hand #{entry.handNumber}</span>
                <span className="text-slate-500">{entry.date}</span>
            </div>
            <div className="text-slate-300">
                Winner: <span className="text-emerald-400 font-bold">{entry.winnerNames.join(', ')}</span>
            </div>
            <div className="flex justify-between text-slate-400 mt-1">
                <span>{entry.winningHand}</span>
                <span className="text-yellow-400 font-bold">+${entry.winAmount}</span>
            </div>
        </div>
      ))}
    </div>
  );
};

export default HandHistory;
