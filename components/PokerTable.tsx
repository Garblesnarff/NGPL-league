
import React, { useRef, useEffect } from 'react';
import { GameState, GamePhase, Player, Card as CardType } from '../types';
import Card from './Card';
import { AVATAR_URL } from '../constants';
import { Coins, Trophy } from 'lucide-react';
import { useDraggable } from '../App'; // We'll export the hook from App or utils if needed, for now assuming simpler approach or prop drilling

// Simple Draggable Wrapper specifically for Players inside the table context
const DraggablePlayerWrapper: React.FC<{ 
    children: React.ReactNode; 
    className?: string;
    style?: string;
  }> = ({ children, className, style }) => {
    // Note: For full draggable logic we would duplicate the hook here or import it.
    // For brevity in refactoring, we will keep fixed positions or simple CSS classes passed down.
    return (
      <div className={`absolute ${style || ''} ${className || ''}`} style={{ zIndex: 20 }}>
          {children}
      </div>
    );
  };

interface PokerTableProps {
  gameState: GameState;
  human: Player | undefined;
}

// BOT POSITIONS
const BOT_LAYOUTS = [
    { style: "top-1/2 -translate-y-1/2 left-4" }, // Left Mid
    { style: "bottom-[15%] left-10" }, // Bot Left
    { style: "top-[15%] left-10" }, // Top Left
    { style: "top-4 left-1/2 -translate-x-1/2" }, // Top Center
    { style: "top-[15%] right-10" }, // Top Right
    { style: "bottom-[15%] right-10" }, // Bot Right
    { style: "top-1/2 -translate-y-1/2 right-4" }, // Right Mid
];

const PlayerSpot: React.FC<{ 
    player: Player; 
    isDealer: boolean; 
    isCurrentTurn: boolean;
    cardsVisible: boolean;
    gamePhase: GamePhase;
    isWinner?: boolean;
  }> = ({ player, isDealer, isCurrentTurn, cardsVisible, gamePhase, isWinner }) => {
    const handRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
  
    useEffect(() => {
        // Dynamic hand orientation logic could go here similar to original App.tsx
        // For simplified refactor, we rely on CSS transforms in the parent wrapper or simple rotation
    }, []);
  
    const winnerGlow = isWinner ? 'ring-4 ring-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.6)]' : '';
    const turnGlow = isCurrentTurn && !isWinner ? 'ring-2 ring-emerald-400 animate-pulse' : '';
    const foldOpacity = !player.isActive ? 'opacity-40 grayscale blur-[2px]' : '';
    
    return (
      <div ref={containerRef} className={`relative flex items-center justify-center w-0 h-0 transition-opacity duration-500 ${foldOpacity}`}>
        
        {/* Avatar Cluster */}
        <div className="absolute flex flex-col items-center pointer-events-none transform -translate-x-1/2 -translate-y-1/2">
            {player.actionMessage && (
              <div className="absolute -top-12 z-50 bg-white text-black font-bold text-xs px-3 py-2 rounded-xl rounded-bl-none shadow-[0_5px_15px_rgba(0,0,0,0.3)] animate-deal border-2 border-black whitespace-nowrap transform -rotate-2 origin-bottom-left">
                {player.actionMessage}
              </div>
            )}
  
            <div className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 bg-slate-900 flex items-center justify-center overflow-hidden transition-all duration-300 ${turnGlow} ${winnerGlow} ${player.isActive ? 'border-slate-700' : 'border-red-900'}`}>
              <img src={player.isHuman ? 'https://api.dicebear.com/7.x/avataaars/svg?seed=hero' : AVATAR_URL(player.avatarSeed || 1)} alt="Avatar" className="w-full h-full object-cover" />
            </div>
  
            <div className="mt-2 bg-slate-900/90 backdrop-blur-md px-3 py-1 rounded-xl text-center border border-slate-700 min-w-[100px] shadow-[0_4px_10px_rgba(0,0,0,0.5)] z-10">
              <div className="text-[10px] sm:text-xs font-bold text-slate-300 truncate max-w-[100px] mx-auto uppercase tracking-wide">{player.name}</div>
              <div className="text-sm font-mono text-yellow-400 flex items-center justify-center gap-1 font-bold">
                <Coins size={12} className="text-yellow-500" /> {player.chips}
              </div>
            </div>
            
            {player.isAllIn && <div className="absolute top-10 font-black text-red-500 text-2xl shadow-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] rotate-12 bg-black/80 px-2 rounded border-2 border-red-600 animate-pulse">ALL IN</div>}
            {!player.isActive && player.chips > 0 && <div className="absolute top-10 font-black text-slate-500 text-xl shadow-black drop-shadow-md -rotate-12 bg-black/60 px-2 rounded">FOLD</div>}
        </div>
  
        {/* Hand Cluster */}
        <div ref={handRef} className="absolute z-10 flex flex-col items-center origin-center top-16">
           <div className={`flex -space-x-4 h-20 sm:h-24 relative ${isWinner ? 'scale-110 z-20' : ''}`}>
              {player.hand.map((card, idx) => (
                <Card 
                  key={idx} 
                  card={card} 
                  hidden={!cardsVisible && !player.isHuman && gamePhase !== GamePhase.SHOWDOWN} 
                  className={`transform ${idx === 1 ? 'rotate-6 translate-y-1' : '-rotate-6'} origin-bottom shadow-xl`}
                  tiny={!player.isHuman} 
                />
              ))}
              {isWinner && (
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 text-yellow-400 animate-bounce drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]">
                  <Trophy size={40} fill="currentColor" />
                </div>
              )}
           </div>
  
           <div className="relative mt-2 min-h-[20px] flex items-center justify-center">
               {isDealer && (
                  <div className="absolute -left-8 top-0 w-6 h-6 bg-yellow-500 text-slate-900 rounded-full flex items-center justify-center font-black font-poker text-xs border-2 border-white shadow-md z-10">D</div>
               )}
               {player.currentBet > 0 && (
                  <div className="text-[10px] text-emerald-400 font-black bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-900/50 whitespace-nowrap shadow-lg">
                      {player.currentBet}
                  </div>
               )}
           </div>
        </div>
      </div>
    );
};

const PokerTable: React.FC<PokerTableProps> = ({ gameState, human }) => {
  return (
    <div className="relative w-[95vw] h-[60vh] md:w-[80vw] md:h-[70vh] flex items-center justify-center z-10">
        
        {/* Visuals */}
        <div className="absolute inset-0 rounded-[150px] border-[20px] border-[#2a2a2a] shadow-[0_20px_60px_rgba(0,0,0,0.8)] bg-poker-green overflow-hidden">
           <div className="absolute inset-0 bg-felt-pattern opacity-40 pointer-events-none mix-blend-overlay"></div>
           <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.1)_0%,_rgba(0,0,0,0.4)_100%)] pointer-events-none"></div>
           <div className="absolute inset-0 border-4 border-black/20 rounded-[130px] pointer-events-none"></div>

           {/* Winner Overlay */}
           {gameState.phase === GamePhase.SHOWDOWN && gameState.winners && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-deal">
              <div className="text-center p-8 bg-slate-900/90 border-4 border-yellow-500 rounded-2xl shadow-[0_0_100px_rgba(234,179,8,0.5)] transform scale-110 flex flex-col items-center">
                <div className="text-yellow-400 font-bold uppercase tracking-widest text-sm mb-2 animate-pulse">Winner</div>
                <h2 className="text-4xl font-black text-white mb-4 font-poker max-w-lg leading-tight">
                  {gameState.winners.map(w => w.name).join(' & ')}
                </h2>
                <div className="flex justify-center gap-4 mb-4">
                   {gameState.winners.map(winner => (
                     <div key={winner.id} className="flex flex-col items-center">
                       {gameState.winners!.length > 1 && <span className="text-xs text-yellow-500 font-bold mb-1">{winner.name}</span>}
                       <div className="flex -space-x-2">
                          {winner.hand.map((card, idx) => (
                            <Card key={idx} card={card} tiny={false} className="scale-75 origin-top sm:scale-100" />
                          ))}
                       </div>
                     </div>
                   ))}
                </div>
                <p className="text-3xl text-emerald-400 font-mono mb-4 font-bold drop-shadow-md">
                  +{gameState.lastPotSize || gameState.pot}
                </p>
                <div className="inline-block px-6 py-2 bg-slate-800 rounded-full text-slate-200 font-bold border border-slate-600">
                  {gameState.winningHandDesc}
                </div>
              </div>
            </div>
           )}
        </div>

        {gameState.communityCards.length === 0 && (
           <div className="absolute z-0 text-poker-felt font-black tracking-widest text-6xl opacity-20 select-none font-poker rotate-[-5deg]">
             FOLD'EM
           </div>
        )}

        {/* Community Cards */}
        <div className="flex gap-2 sm:gap-4 z-10 min-h-[100px] items-center mb-12 sm:mb-20">
          {gameState.communityCards.map((card, i) => (
            <Card key={card.id} card={card} className="animate-deal shadow-2xl" />
          ))}
        </div>

        {/* Bots */}
        {gameState.players.slice(1).map((bot, index) => {
          const layout = BOT_LAYOUTS[index];
          return (
            <DraggablePlayerWrapper key={bot.id} style={layout.style}>
              <PlayerSpot 
                player={bot} 
                isDealer={gameState.dealerIndex === (index + 1)} 
                isCurrentTurn={gameState.currentPlayerIndex === (index + 1)} 
                cardsVisible={false} 
                gamePhase={gameState.phase} 
                isWinner={gameState.winners?.some(w => w.id === bot.id)} 
              />
            </DraggablePlayerWrapper>
          );
        })}

        {/* Human */}
        <div className="absolute bottom-0 sm:bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
          {human && (
             <PlayerSpot 
                player={human} 
                isDealer={gameState.dealerIndex === 0} 
                isCurrentTurn={gameState.currentPlayerIndex === 0} 
                cardsVisible={true} 
                gamePhase={gameState.phase}
                isWinner={gameState.winners?.some(w => w.id === human.id)}
             />
          )}
        </div>
    </div>
  );
}

export default PokerTable;
