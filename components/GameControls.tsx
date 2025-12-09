
import React, { useState } from 'react';
import { GameState, Player, GamePhase } from '../types';
import { Brain, Check, X, TrendingUp } from 'lucide-react';
import { BIG_BLIND, SMALL_BLIND } from '../constants';

interface GameControlsProps {
  gameState: GameState;
  human: Player;
  onAction: (action: 'FOLD' | 'CHECK' | 'CALL' | 'RAISE', amount?: number) => void;
  onNextHand: () => void;
  onCoach: () => void;
  isLoadingAdvice: boolean;
}

const GameControls: React.FC<GameControlsProps> = ({ gameState, human, onAction, onNextHand, onCoach, isLoadingAdvice }) => {
  const [showRaiseControl, setShowRaiseControl] = useState(false);
  const [raiseAmount, setRaiseAmount] = useState(0);

  const isHumanTurn = gameState.players[gameState.currentPlayerIndex].isHuman && gameState.players[gameState.currentPlayerIndex].isActive;
  const toCall = gameState.currentBet - human.currentBet;
  
  // Raise Calculation
  const minRaise = Math.max(gameState.minBet, BIG_BLIND); 
  const minTotalBet = toCall + minRaise;
  const maxBet = human.chips;

  const initiateRaise = () => {
    setRaiseAmount(minTotalBet);
    setShowRaiseControl(true);
  };

  const confirmRaise = () => {
    onAction('RAISE', raiseAmount);
    setShowRaiseControl(false);
  };

  if (gameState.phase === GamePhase.SHOWDOWN) {
    return (
       <div className="absolute bottom-0 w-full bg-slate-900/90 border-t border-slate-800 p-4 pb-8 flex justify-center items-center gap-4 backdrop-blur-xl z-30 transition-transform duration-300 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
           <button 
             onClick={onNextHand} 
             className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-4 rounded-xl font-black text-xl flex items-center gap-3 shadow-[0_0_20px_rgba(37,99,235,0.6)] animate-pulse border-2 border-blue-400"
           >
             NEXT HAND <TrendingUp size={24} />
           </button>
       </div>
    );
  }

  return (
    <>
      {/* Raise Overlay */}
      {showRaiseControl && (
        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 p-4 rounded-xl shadow-2xl flex flex-col gap-4 w-80 animate-deal z-50">
          <div className="flex justify-between items-center text-sm font-bold text-slate-300">
            <span>Raise Amount</span>
            <span className="text-yellow-400 font-mono">${raiseAmount}</span>
          </div>
          
          <input 
            type="range" 
            min={minTotalBet} 
            max={maxBet} 
            step={SMALL_BLIND}
            value={raiseAmount}
            onChange={(e) => setRaiseAmount(Number(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />

          <div className="flex justify-between gap-2">
            <button onClick={() => setRaiseAmount(Math.min(maxBet, minTotalBet * 2.5))} className="px-2 py-1 bg-slate-800 rounded text-xs text-slate-400 hover:bg-slate-700">2.5x</button>
            <button onClick={() => setRaiseAmount(Math.min(maxBet, gameState.pot / 2))} className="px-2 py-1 bg-slate-800 rounded text-xs text-slate-400 hover:bg-slate-700">50% Pot</button>
            <button onClick={() => setRaiseAmount(Math.min(maxBet, gameState.pot))} className="px-2 py-1 bg-slate-800 rounded text-xs text-slate-400 hover:bg-slate-700">Pot</button>
            <button onClick={() => setRaiseAmount(maxBet)} className="px-2 py-1 bg-red-900/50 rounded text-xs text-red-400 hover:bg-red-900">MAX</button>
          </div>

          <div className="flex gap-2">
            <button 
              onClick={() => setShowRaiseControl(false)}
              className="flex-1 py-3 rounded-lg font-bold bg-slate-700 text-slate-300 hover:bg-slate-600 flex justify-center"
            >
              <X size={20} />
            </button>
            <button 
              onClick={confirmRaise}
              className="flex-[3] py-3 rounded-lg font-bold bg-yellow-600 text-white hover:bg-yellow-500 flex justify-center items-center gap-2"
            >
              Confirm ${raiseAmount} <Check size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Main Bar */}
      <div className="absolute bottom-0 w-full bg-slate-900/90 border-t border-slate-800 p-4 pb-8 flex justify-center items-center gap-4 backdrop-blur-xl z-30 transition-transform duration-300 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
         {isHumanTurn ? (
           <div className="flex gap-2 sm:gap-4 items-center">
              <button 
                onClick={() => onAction('FOLD')}
                className="bg-red-950/80 hover:bg-red-900 text-red-100 border-2 border-red-800 px-6 py-4 rounded-xl font-bold uppercase tracking-wider shadow-lg hover:shadow-red-900/50 transition-all hover:-translate-y-1"
              >
                Fold
              </button>
              <button 
                onClick={() => onAction('CHECK')}
                disabled={gameState.currentBet > human.currentBet}
                className="bg-slate-800 hover:bg-slate-700 text-white border-2 border-slate-600 px-6 py-4 rounded-xl font-bold uppercase tracking-wider disabled:opacity-50 disabled:hover:translate-y-0 shadow-lg transition-all hover:-translate-y-1"
              >
                Check
              </button>
              <button 
                onClick={() => onAction('CALL')}
                disabled={gameState.currentBet <= human.currentBet}
                className="bg-emerald-800 hover:bg-emerald-700 text-white border-2 border-emerald-600 px-6 py-4 rounded-xl font-bold uppercase tracking-wider disabled:opacity-50 disabled:hover:translate-y-0 shadow-lg hover:shadow-emerald-900/50 transition-all hover:-translate-y-1 flex flex-col items-center leading-none justify-center"
              >
                <span>Call</span>
                <span className="text-[10px] opacity-70 mt-1 font-mono">${gameState.currentBet - human.currentBet}</span>
              </button>
              <button 
                onClick={initiateRaise}
                className="bg-yellow-700 hover:bg-yellow-600 text-white border-2 border-yellow-500 px-6 py-4 rounded-xl font-bold uppercase tracking-wider shadow-lg hover:shadow-yellow-900/50 transition-all hover:-translate-y-1"
              >
                Raise
              </button>
              
              <div className="w-px h-12 bg-slate-700 mx-4"></div>
              
              <button 
                onClick={onCoach}
                disabled={isLoadingAdvice}
                className="bg-indigo-700 hover:bg-indigo-600 text-white p-4 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.5)] border-2 border-indigo-400 hover:scale-110 transition-all"
                title="Ask AI Coach"
              >
                <Brain size={28} />
              </button>
           </div>
         ) : (
           <div className="text-slate-400 font-mono animate-pulse bg-slate-900 px-6 py-3 rounded-xl border border-slate-700 flex items-center gap-3">
             <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
             <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-75"></div>
             <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-150"></div>
             Opponents Thinking
           </div>
         )}
      </div>
    </>
  );
};

export default GameControls;
