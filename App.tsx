import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  GamePhase, Player, GameState, CoachAdvice 
} from './types';
import { 
  evaluateHand, gradeStartingHand, getBotDecision 
} from './utils/poker';
import { GameEngine } from './utils/GameEngine';
import { 
  STARTING_CHIPS, BIG_BLIND, SMALL_BLIND, AI_PERSONALITIES, FRIEND_NAMES 
} from './constants';
import { getPokerAdvice, generateOpponentBanter } from './services/gemini';
import Shop from './components/Shop';
import PokerTable from './components/PokerTable';
import GameControls from './components/GameControls';
import HandHistory from './components/HandHistory';

import { 
  Coins, Activity, Scale, Percent, Zap, BookOpen, MessageSquare, ListOrdered, Minus, History, Brain
} from 'lucide-react';

// --- Poker Glossary Data ---
const POKER_GLOSSARY: Record<string, string> = {
  "BUTTON": "The Dealer button. Best position! You act last post-flop, allowing you to see everyone else's move first.",
  "BTN": "The Button (Dealer). Act last, win more.",
  "SB": "Small Blind. You act second-to-last pre-flop, but FIRST post-flop. Very difficult position.",
  "BB": "Big Blind. You act last pre-flop (good) but early post-flop (bad).",
  "UTG": "Under the Gun. First to act pre-flop. You need a monster hand to play here.",
  "EP": "Early Position. Dangerous spots where you act early in the hand.",
  "MP": "Middle Position.",
  "LP": "Late Position (Cutoff, Button). Ideal for stealing blinds and playing wide ranges.",
  "SPR": "Stack-to-Pot Ratio. Low SPR (<3) means you're committed; High SPR (>10) allows for maneuvering.",
  "POT ODDS": "The ratio of pot size to the bet. If your chance to win is higher than the odds, you call.",
  "3-BET": "A re-raise pre-flop (The 3rd bet). Signals immense strength (or a brave bluff).",
  "CONNECTORS": "Cards of consecutive rank (e.g., 8-9). Great for making straights.",
  "SUITED": "Cards of the same suit. They increase your equity by ~2.5% vs offsuit.",
  "SPECULATIVE": "Hands like small pairs or suited connectors. They miss often, but win big stacks when they hit.",
  "MONSTER": "Premium hands (AA, KK, AK) that dominate opponents. Play them fast!",
  "OUT OF POSITION": "Acting before your opponent. It's a major disadvantage.",
  "GAP THEORY": "You need a stronger hand to call a raise than to make a raise yourself.",
  "IMPLIED ODDS": "Money you EXPECT to win on future streets if you hit your hand."
};

// --- Smart Tooltip Components ---

const Tooltip: React.FC<{ term: string; definition: string; children: React.ReactNode }> = ({ term, definition, children }) => {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-block group" 
          onMouseEnter={() => setShow(true)}
          onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-slate-900/95 border border-yellow-500 text-white text-xs p-3 rounded-xl shadow-[0_0_20px_rgba(0,0,0,0.8)] z-[100] animate-deal pointer-events-none">
          <div className="flex items-center gap-2 font-bold text-yellow-400 mb-1 border-b border-yellow-500/30 pb-1 uppercase tracking-wider">
             <BookOpen size={12} /> {term}
          </div>
          <div className="leading-relaxed text-slate-300">
            {definition}
          </div>
          <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900 border-r border-b border-yellow-500 transform rotate-45"></div>
        </div>
      )}
    </span>
  );
};

const SmartText: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;
  const keys = Object.keys(POKER_GLOSSARY).sort((a,b) => b.length - a.length);
  const pattern = new RegExp(`\\b(${keys.join('|')})\\b`, 'gi');
  
  const parts = text.split(pattern);
  
  return (
    <span>
      {parts.map((part, i) => {
        const upperPart = part.toUpperCase();
        if (POKER_GLOSSARY[upperPart]) {
           return (
             <Tooltip key={i} term={upperPart} definition={POKER_GLOSSARY[upperPart]}>
               <span className="border-b-2 border-dotted border-yellow-500/60 cursor-help hover:text-yellow-400 hover:border-yellow-400 transition-colors font-semibold">
                 {part}
               </span>
             </Tooltip>
           );
        }
        return part;
      })}
    </span>
  );
};

// --- Draggable Logic ---

export const useDraggable = (initialPos = { x: 0, y: 0 }) => {
  const [position, setPosition] = useState(initialPos);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    dragStart.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  }, [position]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current) return;
    setPosition({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return { position, handleMouseDown };
};

const DraggableWindow: React.FC<{ 
  title: string; 
  icon: React.ReactNode; 
  initialPosition: { x: number, y: number };
  children: React.ReactNode;
  className?: string;
}> = ({ title, icon, initialPosition, children, className = '' }) => {
  const { position, handleMouseDown } = useDraggable(initialPosition);
  const [isMinimized, setIsMinimized] = useState(false);

  return (
    <div 
      className={`fixed z-40 bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl overflow-hidden transition-shadow duration-300 ${className}`}
      style={{ 
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        boxShadow: isMinimized ? '0 0 0' : '0 20px 40px rgba(0,0,0,0.5)'
      }}
    >
      <div 
        className="flex items-center justify-between px-3 py-2 bg-slate-800 border-b border-slate-700 cursor-move select-none hover:bg-slate-750 transition-colors"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wide">
          {icon} {title}
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
          className="text-slate-400 hover:text-white p-1 hover:bg-slate-700 rounded"
        >
          {isMinimized ? <ListOrdered size={14} /> : <Minus size={14} />}
        </button>
      </div>
      {!isMinimized && (
        <div className="animate-deal origin-top">
          {children}
        </div>
      )}
    </div>
  );
};

// --- Stats HUD Component ---
const StatsHUD: React.FC<{
  handDesc: string;
  potOdds: string | null;
  spr: string;
  handGrade?: { grade: string; tip: string };
}> = ({ handDesc, potOdds, spr, handGrade }) => (
  <div className="flex flex-col gap-2 pointer-events-auto select-none">
    {handGrade && (
      <div className="self-start animate-deal mb-2 group cursor-help">
        <div className={`
          flex items-center gap-2 px-3 py-1 rounded-lg border-2 shadow-[0_0_15px_rgba(0,0,0,0.5)] transition-all duration-300
          ${handGrade.grade === 'S' || handGrade.grade === 'A' ? 'bg-indigo-900/90 border-indigo-400 text-indigo-100 hover:bg-indigo-800' : 
            handGrade.grade === 'F' ? 'bg-red-900/90 border-red-500 text-red-100 hover:bg-red-800' : 'bg-slate-800/90 border-slate-500 text-slate-200 hover:bg-slate-700'}
        `}>
          <div className="flex flex-col items-center leading-none pr-2 border-r border-white/20">
             <span className="text-[10px] font-bold uppercase opacity-70">Grade</span>
             <span className="text-2xl font-black font-poker">{handGrade.grade}</span>
          </div>
          <div className="text-[10px] font-bold max-w-[150px] leading-tight">
            <SmartText text={handGrade.tip} />
          </div>
        </div>
      </div>
    )}

    <div className="flex gap-2 bg-slate-900/95 border border-slate-700 rounded-xl p-2 shadow-2xl backdrop-blur-md">
      <div className="flex flex-col items-center px-3 border-r border-slate-700">
        <div className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
          <Activity size={12} /> Hand
        </div>
        <div className="text-sm font-bold text-indigo-300 whitespace-nowrap">{handDesc || "High Card"}</div>
      </div>
      
      <div className="flex flex-col items-center px-3 border-r border-slate-700 group cursor-help relative">
        <Tooltip term="Pot Odds" definition={POKER_GLOSSARY["POT ODDS"]}>
            <div className="flex flex-col items-center">
                <div className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1 border-b border-dotted border-slate-600">
                <Scale size={12} /> Pot Odds
                </div>
                <div className="text-sm font-bold text-emerald-400">{potOdds || "-"}</div>
            </div>
        </Tooltip>
      </div>

      <div className="flex flex-col items-center px-3 group cursor-help">
        <Tooltip term="SPR" definition={POKER_GLOSSARY["SPR"]}>
            <div className="flex flex-col items-center">
                <div className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1 border-b border-dotted border-slate-600">
                <Percent size={12} /> SPR
                </div>
                <div className="text-sm font-bold text-yellow-400">{spr}</div>
            </div>
        </Tooltip>
      </div>
    </div>
  </div>
);

// --- Game Log Component ---
const GameLog: React.FC<{ log: string[] }> = ({ log }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [log]);

  return (
    <div ref={scrollRef} className="p-3 w-64 h-48 overflow-y-auto text-xs font-mono space-y-1">
      {log.map((entry, i) => (
        <div key={i} className="text-slate-300 leading-tight border-b border-slate-800/50 pb-1 last:border-0 animate-deal">
            <span className={entry.includes('You') ? 'text-yellow-400 font-bold' : ''}>{entry}</span>
        </div>
      ))}
    </div>
  );
};

// --- Chip Leaderboard Component ---
const ChipLeaderboard: React.FC<{ players: Player[] }> = ({ players }) => {
  const sortedPlayers = [...players].sort((a, b) => b.chips - a.chips);

  return (
    <div className="p-2 w-48 bg-slate-900/50">
      {sortedPlayers.map((p, i) => (
        <div key={p.id} className="flex justify-between items-center py-1 border-b border-slate-800 last:border-0 text-xs">
           <div className="flex items-center gap-2">
             <span className={`font-mono font-bold ${i === 0 ? 'text-yellow-400' : 'text-slate-500'}`}>{i + 1}.</span>
             <span className={`truncate max-w-[80px] ${p.isHuman ? 'text-emerald-300 font-bold' : 'text-slate-300'}`}>{p.name}</span>
             {!p.isActive && <span className="text-[9px] text-red-500 uppercase">(Fold)</span>}
           </div>
           <span className="font-mono text-slate-400">{p.chips}</span>
        </div>
      ))}
    </div>
  );
};

// --- Main App Component ---

const App: React.FC = () => {
  // --- State ---
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [humanPerks, setHumanPerks] = useState<string[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  
  // AI & Advice
  const [coachAdvice, setCoachAdvice] = useState<CoachAdvice | null>(null);
  const [isLoadingAdvice, setIsLoadingAdvice] = useState(false);
  const [banter, setBanter] = useState<string>("");

  const initGame = () => {
    // 1. Create Players
    const human: Player = {
      id: 'p1', name: 'You', chips: STARTING_CHIPS, hand: [], isHuman: true,
      isActive: true, isAllIn: false, currentBet: 0, position: 'BTN'
    };
    
    const bots: Player[] = FRIEND_NAMES.map((name, i) => ({
      id: `bot_${i}`,
      name: name,
      chips: STARTING_CHIPS,
      hand: [],
      isHuman: false,
      isActive: true,
      isAllIn: false,
      currentBet: 0,
      position: 'EP',
      avatarSeed: i * 13 + 7, 
      personality: AI_PERSONALITIES[i % AI_PERSONALITIES.length]
    }));

    const allPlayers = [human, ...bots];

    // 2. Start first hand using Engine
    const initialState = GameEngine.setupNewHand(allPlayers, -1, 0, []);
    
    setGameState(initialState);
    setGameStarted(true);
    setCoachAdvice(null);
  };

  const startNewHand = useCallback(() => {
    if (!gameState) return;
    
    const human = gameState.players.find(p => p.isHuman);
    if (human && human.chips <= 0) {
      setGameState(prev => prev ? ({...prev, phase: GamePhase.GAME_OVER}) : null);
      return;
    }

    const newState = GameEngine.setupNewHand(gameState.players, gameState.dealerIndex, gameState.handCount, gameState.handHistory);
    setGameState(newState);
    setCoachAdvice(null);
    setBanter("");
  }, [gameState]);

  // --- AI Logic Turn ---
  useEffect(() => {
    if (!gameState || !gameStarted) return;
    
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    
    // If it's AI turn
    if (!currentPlayer.isHuman && gameState.phase !== GamePhase.SHOWDOWN && gameState.phase !== GamePhase.GAME_OVER && gameState.phase !== GamePhase.MENU && gameState.phase !== GamePhase.SHOP) {
      const timeoutId = setTimeout(() => {
        handleAiTurn();
      }, 800 + Math.random() * 600);
      return () => clearTimeout(timeoutId);
    }
  }, [gameState?.currentPlayerIndex, gameState?.phase]);


  const handleAiTurn = () => {
    if (!gameState) return;
    const player = gameState.players[gameState.currentPlayerIndex];
    
    if (!player.isActive || player.isAllIn) {
      setGameState(GameEngine.nextTurn(gameState));
      return;
    }

    const decision = getBotDecision(player, gameState);

    if (decision.action === 'FOLD') {
      const newPlayers = [...gameState.players];
      newPlayers[gameState.currentPlayerIndex].isActive = false;
      newPlayers[gameState.currentPlayerIndex].actionMessage = "Fold";
      
      const logMsg = `${player.name} folds`;
      
      const updatedState = {
        ...gameState, 
        players: newPlayers,
        roundLog: [...gameState.roundLog, logMsg]
      };
      
      setGameState(updatedState);
      setTimeout(() => clearActionBubble(player.id), 3000);
      
      // Proceed
      setGameState(prev => prev ? GameEngine.nextTurn(prev) : null);

    } else if (decision.action === 'CHECK') {
       const newState = GameEngine.processPlayerAction(gameState, player, 0, "Checks");
       setGameState(newState);
       setTimeout(() => clearActionBubble(player.id), 3000);
       setTimeout(() => setGameState(prev => prev ? GameEngine.nextTurn(prev) : null), 50);

    } else if (decision.action === 'CALL') {
       const toCall = gameState.currentBet - player.currentBet;
       const newState = GameEngine.processPlayerAction(gameState, player, toCall, "Calls");
       setGameState(newState);
       setTimeout(() => clearActionBubble(player.id), 3000);
       setTimeout(() => setGameState(prev => prev ? GameEngine.nextTurn(prev) : null), 50);

    } else if (decision.action === 'RAISE') {
       const toCall = gameState.currentBet - player.currentBet;
       const raiseAmt = decision.amount || gameState.minBet;
       const newState = GameEngine.processPlayerAction(gameState, player, toCall + raiseAmt, "Raises to", player.currentBet + toCall + raiseAmt);
       setGameState(newState);
       setTimeout(() => clearActionBubble(player.id), 3000);
       setTimeout(() => setGameState(prev => prev ? GameEngine.nextTurn(prev) : null), 50);
    }
  };

  const clearActionBubble = (playerId: string) => {
    setGameState(prev => {
      if (!prev) return null;
      const newPlayers = prev.players.map(p => p.id === playerId ? { ...p, actionMessage: undefined } : p);
      return { ...prev, players: newPlayers };
    });
  };

  const handleHumanAction = (action: 'FOLD' | 'CHECK' | 'CALL' | 'RAISE', raiseAmt?: number) => {
    if (!gameState) return;
    const player = gameState.players[gameState.currentPlayerIndex];
    const toCall = gameState.currentBet - player.currentBet;

    if (action === 'FOLD') {
      const newPlayers = [...gameState.players];
      newPlayers[gameState.currentPlayerIndex].isActive = false;
      newPlayers[gameState.currentPlayerIndex].actionMessage = "Fold";
      
      const updatedState = {
        ...gameState, 
        players: newPlayers,
        roundLog: [...gameState.roundLog, "You Fold"]
      };
      setGameState(updatedState);
      setTimeout(() => clearActionBubble(player.id), 3000);
      setGameState(prev => prev ? GameEngine.nextTurn(prev) : null);

    } else if (action === 'CHECK') {
      const newState = GameEngine.processPlayerAction(gameState, player, 0, "Checks");
      setGameState(newState);
      setTimeout(() => clearActionBubble(player.id), 3000);
      setTimeout(() => setGameState(prev => prev ? GameEngine.nextTurn(prev) : null), 50);

    } else if (action === 'CALL') {
      const newState = GameEngine.processPlayerAction(gameState, player, toCall, "Calls");
      setGameState(newState);
      setTimeout(() => clearActionBubble(player.id), 3000);
      setTimeout(() => setGameState(prev => prev ? GameEngine.nextTurn(prev) : null), 50);

    } else if (action === 'RAISE') {
      const amountToBet = raiseAmt || 0;
      const newState = GameEngine.processPlayerAction(gameState, player, amountToBet, "Raises to", player.currentBet + amountToBet);
      setGameState(newState);
      setTimeout(() => clearActionBubble(player.id), 3000);
      setTimeout(() => setGameState(prev => prev ? GameEngine.nextTurn(prev) : null), 50);
    }
  };

  const getCoachHelp = async () => {
    if (!gameState) return;
    setIsLoadingAdvice(true);
    const player = gameState.players.find(p => p.isHuman)!;
    const advice = await getPokerAdvice(
      player.hand,
      gameState.communityCards,
      gameState.pot,
      gameState.currentBet - player.currentBet,
      player.chips,
      gameState.phase,
      gameState.players
    );
    setCoachAdvice(advice);
    setIsLoadingAdvice(false);
  };
  
  useEffect(() => {
     if(gameState?.phase === GamePhase.RIVER) {
        generateOpponentBanter("River card dealt").then(setBanter);
     }
  }, [gameState?.phase]);

  // --- Calculations for HUD ---
  const human = gameState?.players.find(p => p.isHuman);
  const humanHandDesc = human && gameState ? evaluateHand(human.hand, gameState.communityCards).description : "";
  const handGrade = (human && gameState?.phase === GamePhase.PRE_FLOP) ? gradeStartingHand(human.hand) : undefined;
  
  let potOdds = null;
  let spr = "-";

  if (gameState && human) {
    const toCall = gameState.currentBet - human.currentBet;
    if (toCall > 0) {
      const ratio = (gameState.pot / toCall).toFixed(1);
      potOdds = `${ratio} : 1`;
    }
    if (gameState.pot > 0) {
      spr = (human.chips / gameState.pot).toFixed(1);
    }
  }

  // --- Render ---

  if (!gameStarted) {
     return (
       <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white p-4 overflow-hidden relative">
         <div className="absolute inset-0 bg-felt-pattern opacity-10 pointer-events-none"></div>
         <h1 className="text-8xl font-black mb-4 font-poker text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 drop-shadow-[0_5px_5px_rgba(0,0,0,0.8)] animate-pulse-slow">
            FOLD'EM
         </h1>
         <p className="text-xl text-slate-400 mb-8 max-w-md text-center font-mono">
           The Roguelite Poker Trainer.
         </p>
         <button 
           onClick={initGame}
           className="px-10 py-5 bg-gradient-to-r from-emerald-600 to-emerald-800 rounded-lg font-black text-2xl hover:scale-105 transition-all shadow-[0_0_30px_rgba(16,185,129,0.4)] border-2 border-emerald-400 uppercase tracking-widest"
         >
           START RUN
         </button>
         <p className="mt-4 text-slate-600 text-sm font-mono">Buy-in: $40 (1000 Chips)</p>
       </div>
     );
  }
  
  if (gameState?.phase === GamePhase.GAME_OVER) {
    return ( // Game Over Screen
      <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-4 animate-deal">
        <h1 className="text-7xl font-black mb-2 text-red-600 font-poker tracking-widest">BUSTED</h1>
        <button 
          onClick={initGame}
          className="px-8 py-4 bg-slate-800 border border-slate-600 rounded-lg font-bold text-xl hover:bg-slate-700 transition-all uppercase"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (gameState?.phase === GamePhase.SHOP) {
     return (
        <Shop 
          chips={gameState.players.find(p => p.isHuman)?.chips || 0}
          ownedPerks={humanPerks}
          onBuy={(perk) => {
             const newPlayers = gameState.players.map(p => p.isHuman ? {...p, chips: p.chips - perk.cost} : p);
             setHumanPerks([...humanPerks, perk.id]);
             setGameState({...gameState, players: newPlayers});
          }}
          onNextRound={startNewHand}
        />
     );
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white overflow-hidden relative font-sans select-none flex items-center justify-center pb-32"> 
      
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black z-0"></div>

      {/* HUD Header */}
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start z-10 pointer-events-none">
        <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-700 pointer-events-auto backdrop-blur-sm shadow-xl">
          <h2 className="text-slate-400 text-xs font-bold uppercase tracking-wider">Pot</h2>
          <div className="text-3xl font-black font-mono text-yellow-400 flex items-center gap-2 drop-shadow-md">
            <Coins className="text-yellow-500 fill-yellow-500" /> {gameState?.pot}
          </div>
          <div className="text-xs text-slate-500 mt-1 font-mono">Blinds: {SMALL_BLIND}/{BIG_BLIND}</div>
        </div>
        
        {/* Coach Advice */}
        {(coachAdvice || isLoadingAdvice) && (
          <div className="max-w-xs bg-indigo-950/90 border-2 border-indigo-500 p-4 rounded-xl shadow-[0_0_30px_rgba(99,102,241,0.3)] backdrop-blur-md pointer-events-auto animate-deal">
             <div className="flex items-center gap-2 mb-2 text-indigo-300 font-bold uppercase text-xs tracking-wider">
               <Brain size={16} /> AI Coach
             </div>
             {isLoadingAdvice ? (
               <div className="text-indigo-200">Analyzing...</div>
             ) : (
               <>
                 <div className="font-black text-white text-xl mb-1 uppercase italic">{coachAdvice?.action}</div>
                 <div className="text-sm text-slate-200 leading-snug mb-3 font-medium">
                   <SmartText text={coachAdvice?.reasoning || ""} />
                 </div>
                 <div className="flex gap-4 text-xs font-mono text-indigo-200 border-t border-indigo-800 pt-2">
                    <span className="flex items-center gap-1"><Zap size={10}/> Win: {coachAdvice?.winProbability}</span>
                    {humanPerks.includes('odds_calc') && <span>Odds: {coachAdvice?.potOdds || 'N/A'}</span>}
                 </div>
               </>
             )}
          </div>
        )}
      </div>

      {/* Poker Table Component */}
      {gameState && <PokerTable gameState={gameState} human={human} />}

      {/* Human Stats HUD (Floating) */}
      {gameState && human && gameState.phase !== GamePhase.SHOWDOWN && gameState.phase !== GamePhase.GAME_OVER && (
         <DraggableWindow 
            title="Stats" 
            icon={<Activity size={14} />} 
            initialPosition={{x: window.innerWidth / 2 + 250, y: window.innerHeight - 250}}
         >
             <StatsHUD 
                handDesc={humanHandDesc}
                potOdds={potOdds}
                spr={spr}
                handGrade={handGrade}
             />
         </DraggableWindow>
      )}
      
      {/* Windows */}
      {gameState && (
         <>
            <DraggableWindow title="Table Talk" icon={<MessageSquare size={14} />} initialPosition={{x: 20, y: 100}}>
               <GameLog log={gameState.roundLog} />
            </DraggableWindow>

            <DraggableWindow title="Chip Count" icon={<ListOrdered size={14} />} initialPosition={{x: window.innerWidth - 220, y: 100}}>
                <ChipLeaderboard players={gameState.players} />
            </DraggableWindow>

             <DraggableWindow title="History" icon={<History size={14} />} initialPosition={{x: 20, y: 350}}>
                <HandHistory history={gameState.handHistory || []} />
            </DraggableWindow>
         </>
      )}

      {/* Banter */}
      {banter && (
        <div className="absolute top-1/3 right-1/4 bg-white text-black p-3 rounded-2xl rounded-bl-none text-sm font-bold animate-float shadow-xl max-w-[150px] border-2 border-black z-20 transform rotate-2">
          "{banter}"
        </div>
      )}

      {/* Controls */}
      {gameState && human && (
        <GameControls 
            gameState={gameState} 
            human={human}
            onAction={handleHumanAction}
            onNextHand={startNewHand}
            onCoach={getCoachHelp}
            isLoadingAdvice={isLoadingAdvice}
        />
      )}
    </div>
  );
};

export default App;