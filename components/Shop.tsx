import React from 'react';
import { INITIAL_PERKS } from '../constants';
import { Perk } from '../types';
import { ShoppingBag, Zap, Brain } from 'lucide-react';

interface ShopProps {
  chips: number;
  ownedPerks: string[];
  onBuy: (perk: Perk) => void;
  onNextRound: () => void;
}

const Shop: React.FC<ShopProps> = ({ chips, ownedPerks, onBuy, onNextRound }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 p-6 space-y-8 animate-deal">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 mb-2 font-mono">
          The Grinder's Shop
        </h1>
        <p className="text-slate-400">Upgrade your mind, stack your chips.</p>
        <div className="mt-4 inline-block px-6 py-2 bg-slate-900 rounded-full border border-slate-700 text-yellow-400 font-mono text-xl">
          Bankroll: ${chips}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
        {INITIAL_PERKS.map((perk) => {
          const isOwned = ownedPerks.includes(perk.id);
          const canAfford = chips >= perk.cost;

          return (
            <div 
              key={perk.id} 
              className={`
                relative p-6 rounded-xl border-2 transition-all duration-300 flex flex-col justify-between h-64
                ${isOwned 
                  ? 'bg-slate-900/50 border-slate-700 opacity-50 cursor-not-allowed' 
                  : 'bg-slate-800 border-indigo-500 hover:border-pink-500 hover:shadow-[0_0_20px_rgba(168,85,247,0.4)]'
                }
              `}
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2 bg-indigo-900/50 rounded-lg text-indigo-300">
                    {perk.id === 'odds_calc' ? <Brain size={24}/> : <Zap size={24}/>}
                  </div>
                  <span className="font-mono text-yellow-400 font-bold">${perk.cost}</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{perk.name}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{perk.description}</p>
              </div>

              <button
                disabled={isOwned || !canAfford}
                onClick={() => onBuy(perk)}
                className={`
                  w-full py-2 rounded-lg font-bold mt-4 transition-colors
                  ${isOwned 
                    ? 'bg-slate-700 text-slate-400' 
                    : canAfford 
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg' 
                      : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  }
                `}
              >
                {isOwned ? 'OWNED' : canAfford ? 'BUY' : 'BROKE'}
              </button>
            </div>
          );
        })}
      </div>

      <button
        onClick={onNextRound}
        className="mt-8 px-12 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xl rounded-full shadow-[0_0_15px_rgba(16,185,129,0.5)] transition-all transform hover:scale-105 flex items-center gap-2"
      >
        Next Game <ShoppingBag size={20}/>
      </button>
    </div>
  );
};

export default Shop;