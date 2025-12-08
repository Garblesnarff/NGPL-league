import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  GamePhase, Player, GameState, Card as CardType, Perk, CoachAdvice 
} from './types';
import { 
  createDeck, shuffleDeck, evaluateHand, determineWinner, gradeStartingHand, getBotDecision 
} from './utils/poker';
import { 
  STARTING_CHIPS, BIG_BLIND, SMALL_BLIND, AI_PERSONALITIES, AVATAR_URL, FRIEND_NAMES 
} from './constants';
import { getPokerAdvice, generateOpponentBanter } from './services/gemini';
import Card from './components/Card';
import Shop from './components/Shop';
import { 
  Coins, User, Bot, HelpCircle, AlertCircle, TrendingUp, RefreshCw, Trophy, Menu, Brain, X, Check, Skull, Activity, Scale, Percent, Zap, BookOpen, MessageSquare, Minus, GripHorizontal, ListOrdered, Move
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

const useDraggable = (initialPos = { x: 0, y: 0 }) => {
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
      {/* Header / Drag Handle */}
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

      {/* Content */}
      {!isMinimized && (
        <div className="animate-deal origin-top">
          {children}
        </div>
      )}
    </div>
  );
};

const DraggablePlayerWrapper: React.FC<{ 
  children: React.ReactNode; 
  className?: string;
}> = ({ children, className }) => {
  const { position, handleMouseDown } = useDraggable({ x: 0, y: 0 });

  return (
    <div 
      className={`absolute ${className}`} 
      style={{ 
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        zIndex: 20 // Base Z-index for players
      }}
    >
      <div className="group relative">
        {/* Drag Handle (Hidden unless hovered) */}
        <div 
          className="absolute -top-4 -right-4 p-2 text-slate-500 opacity-0 group-hover:opacity-100 cursor-move transition-opacity z-50 bg-slate-900/50 rounded-full hover:bg-slate-800 hover:text-white"
          onMouseDown={handleMouseDown}
          title="Move Player"
        >
           <Move size={14} />
        </div>
        {children}
      </div>
    </div>
  );
};

// --- Helper Components ---

// Combined PlayerSpot: Handles Avatar and Dynamically Oriented Hand
const PlayerSpot: React.FC<{ 
  player: Player; 
  isDealer: boolean; 
  isCurrentTurn: boolean;
  cardsVisible: boolean;
  gamePhase: GamePhase;
  isWinner?: boolean;
}> = ({ player, isDealer, isCurrentTurn, cardsVisible, gamePhase, isWinner }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const handRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frameId: number;
    
    const updateOrientation = () => {
      if (!containerRef.current || !handRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      
      // Calculate center of player avatar
      const playerX = rect.left + rect.width / 2;
      const playerY = rect.top + rect.height / 2;
      
      // Calculate angle from player to center
      const dx = centerX - playerX;
      const dy = centerY - playerY;
      const angle = Math.atan2(dy, dx);
      
      // Distance to place hand (radius from avatar center)
      const radius = 95; // px
      
      const handX = Math.cos(angle) * radius;
      const handY = Math.sin(angle) * radius;
      
      // Rotate cards to face center (perpendicular to radius vector)
      // Angle + 90deg to orient bottom-to-top towards center
      const rotation = angle + Math.PI / 2;

      handRef.current.style.transform = `translate(${handX}px, ${handY}px) rotate(${rotation}rad)`;
    };

    const loop = () => {
      updateOrientation();
      frameId = requestAnimationFrame(loop);
    };
    
    loop();
    return () => cancelAnimationFrame(frameId);
  }, []);

  const winnerGlow = isWinner ? 'ring-4 ring-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.6)]' : '';
  const turnGlow = isCurrentTurn && !isWinner ? 'ring-2 ring-emerald-400 animate-pulse' : '';
  const foldOpacity = !player.isActive ? 'opacity-40 grayscale blur-[2px]' : '';
  
  return (
    <div ref={containerRef} className={`relative flex items-center justify-center w-0 h-0 transition-opacity duration-500 ${foldOpacity}`}>
      
      {/* 1. The Avatar Cluster (Centered on 0,0 of this container) */}
      <div className="absolute flex flex-col items-center pointer-events-none transform -translate-x-1/2 -translate-y-1/2">
          {/* Action Bubble */}
          {player.actionMessage && (
            <div className="absolute -top-12 z-50 bg-white text-black font-bold text-xs px-3 py-2 rounded-xl rounded-bl-none shadow-[0_5px_15px_rgba(0,0,0,0.3)] animate-deal border-2 border-black whitespace-nowrap transform -rotate-2 origin-bottom-left">
              {player.actionMessage}
            </div>
          )}

          {/* Avatar Image */}
          <div className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 bg-slate-900 flex items-center justify-center overflow-hidden transition-all duration-300 ${turnGlow} ${winnerGlow} ${player.isActive ? 'border-slate-700' : 'border-red-900'}`}>
            <img src={player.isHuman ? 'https://api.dicebear.com/7.x/avataaars/svg?seed=hero' : AVATAR_URL(player.avatarSeed || 1)} alt="Avatar" className="w-full h-full object-cover" />
          </div>

          {/* Name & Chips */}
          <div className="mt-2 bg-slate-900/90 backdrop-blur-md px-3 py-1 rounded-xl text-center border border-slate-700 min-w-[100px] shadow-[0_4px_10px_rgba(0,0,0,0.5)] z-10">
            <div className="text-[10px] sm:text-xs font-bold text-slate-300 truncate max-w-[100px] mx-auto uppercase tracking-wide">{player.name}</div>
            <div className="text-sm font-mono text-yellow-400 flex items-center justify-center gap-1 font-bold">
              <Coins size={12} className="text-yellow-500" /> {player.chips}
            </div>
          </div>
          
          {player.isAllIn && <div className="absolute top-10 font-black text-red-500 text-2xl shadow-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] rotate-12 bg-black/80 px-2 rounded border-2 border-red-600 animate-pulse">ALL IN</div>}
          {!player.isActive && player.chips > 0 && <div className="absolute top-10 font-black text-slate-500 text-xl shadow-black drop-shadow-md -rotate-12 bg-black/60 px-2 rounded">FOLD</div>}
      </div>

      {/* 2. The Hand Cluster (Dynamically Positioned) */}
      <div ref={handRef} className="absolute z-10 flex flex-col items-center origin-center">
         {/* Cards */}
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

         {/* Dealer & Bet */}
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

// --- Stats HUD Component ---
const StatsHUD: React.FC<{
  handDesc: string;
  potOdds: string | null;
  spr: string;
  handGrade?: { grade: string; tip: string };
}> = ({ handDesc, potOdds, spr, handGrade }) => (
  <div className="flex flex-col gap-2 pointer-events-auto select-none">
    {/* Hand Grade Badge (Roguelite Style) */}
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

    {/* Standard Stats */}
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

  // UI State
  const [showRaiseControl, setShowRaiseControl] = useState(false);
  const [raiseAmount, setRaiseAmount] = useState(0);

  // --- Game Loop Logic ---

  // Helper to start a hand given a list of players
  const setupNewHand = (currentPlayers: Player[], dealerIdx: number): GameState => {
    const deck = shuffleDeck(createDeck());
    
    // Reset player round state
    const players = currentPlayers.map(p => ({
      ...p,
      hand: [],
      isActive: p.chips > 0,
      isAllIn: false,
      currentBet: 0,
      actionMessage: undefined // Clear bubbles
    }));

    // Rotate Dealer
    const nextDealer = (dealerIdx + 1) % players.length;
    
    // Determine Blinds (Heads up is different, but using standard ring game logic for simplicity with 3+ players)
    let sbIndex = (nextDealer + 1) % players.length;
    let bbIndex = (nextDealer + 2) % players.length;

    // If heads up (2 players), Dealer is SB
    if (players.filter(p => p.chips > 0).length === 2) {
       sbIndex = nextDealer;
       bbIndex = (nextDealer + 1) % players.length;
    }

    // Post Blinds
    const sbPlayer = players[sbIndex];
    const sbAmt = Math.min(SMALL_BLIND, sbPlayer.chips);
    sbPlayer.chips -= sbAmt;
    sbPlayer.currentBet = sbAmt;
    if (sbPlayer.chips === 0) sbPlayer.isAllIn = true;

    const bbPlayer = players[bbIndex];
    const bbAmt = Math.min(BIG_BLIND, bbPlayer.chips);
    bbPlayer.chips -= bbAmt;
    bbPlayer.currentBet = bbAmt;
    if (bbPlayer.chips === 0) bbPlayer.isAllIn = true;

    const pot = sbAmt + bbAmt;

    // Deal Cards (2 each)
    players.forEach(p => {
      if (p.isActive) {
        p.hand = [deck.pop()!, deck.pop()!];
      }
    });

    const firstActor = (bbIndex + 1) % players.length;

    return {
      phase: GamePhase.PRE_FLOP,
      pot,
      communityCards: [],
      deck,
      players,
      currentPlayerIndex: firstActor,
      dealerIndex: nextDealer,
      minBet: BIG_BLIND,
      currentBet: BIG_BLIND,
      lastRaiserIndex: bbIndex, // BB is the "aggressor" initially (posted blind)
      roundLog: ["New Hand Started"],
      deckColor: 'blue',
      winners: [],
      winningHandDesc: '',
      lastPotSize: 0,
    };
  };

  const initGame = () => {
    // 1. Create Players
    const human: Player = {
      id: 'p1', name: 'You', chips: STARTING_CHIPS, hand: [], isHuman: true,
      isActive: true, isAllIn: false, currentBet: 0, position: 'BTN'
    };
    
    // Create bots from Friend Names
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
      avatarSeed: i * 13 + 7, // Fixed seeds for consistency
      personality: AI_PERSONALITIES[i % AI_PERSONALITIES.length]
    }));

    const allPlayers = [human, ...bots];

    // 2. Immediately start the first hand
    // Dealer index starts at -1 so nextDealer becomes 0
    const initialState = setupNewHand(allPlayers, -1);
    
    setGameState(initialState);
    setGameStarted(true);
    setCoachAdvice(null);
  };

  const startNewHand = useCallback(() => {
    if (!gameState) return;
    
    // Check for Game Over (Busted)
    const human = gameState.players.find(p => p.isHuman);
    if (human && human.chips <= 0) {
      setGameState(prev => prev ? ({...prev, phase: GamePhase.GAME_OVER}) : null);
      return;
    }

    const newState = setupNewHand(gameState.players, gameState.dealerIndex);
    setGameState(newState);
    setCoachAdvice(null);
    setBanter("");
    setShowRaiseControl(false);
  }, [gameState]);

  // --- AI Logic Turn ---
  useEffect(() => {
    if (!gameState || !gameStarted) return;
    
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    
    // If it's AI turn
    if (!currentPlayer.isHuman && gameState.phase !== GamePhase.SHOWDOWN && gameState.phase !== GamePhase.GAME_OVER && gameState.phase !== GamePhase.MENU && gameState.phase !== GamePhase.SHOP) {
      const timeoutId = setTimeout(() => {
        handleAiTurn();
      }, 800 + Math.random() * 600); // Faster turns for 8 players
      return () => clearTimeout(timeoutId);
    }
  }, [gameState?.currentPlayerIndex, gameState?.phase]);


  const handleAiTurn = () => {
    if (!gameState) return;
    const player = gameState.players[gameState.currentPlayerIndex];
    
    // Skip if inactive
    if (!player.isActive || player.isAllIn) {
      nextTurn();
      return;
    }

    // New Personality Driven Decision
    const decision = getBotDecision(player, gameState);

    if (decision.action === 'FOLD') {
      const newPlayers = [...gameState.players];
      newPlayers[gameState.currentPlayerIndex].isActive = false;
      newPlayers[gameState.currentPlayerIndex].actionMessage = "Fold";
      
      const logMsg = `${player.name} folds`;
      
      setGameState(prev => prev ? ({
        ...prev, 
        players: newPlayers,
        roundLog: [...prev.roundLog, logMsg]
      }) : null);
      
      // Clear bubble after delay
      setTimeout(() => clearActionBubble(player.id), 3000);
      nextTurn();
    } else if (decision.action === 'CHECK') {
       processPlayerAction(player, 0, "Checks");
    } else if (decision.action === 'CALL') {
       const toCall = gameState.currentBet - player.currentBet;
       processPlayerAction(player, toCall, "Calls");
    } else if (decision.action === 'RAISE') {
       const toCall = gameState.currentBet - player.currentBet;
       const raiseAmt = decision.amount || gameState.minBet;
       // Total amount put in this turn = cost to call + raise amount
       processPlayerAction(player, toCall + raiseAmt, "Raises to", player.currentBet + toCall + raiseAmt);
    }
  };

  const clearActionBubble = (playerId: string) => {
    setGameState(prev => {
      if (!prev) return null;
      const newPlayers = prev.players.map(p => p.id === playerId ? { ...p, actionMessage: undefined } : p);
      return { ...prev, players: newPlayers };
    });
  };

  const processPlayerAction = (player: Player, amount: number, actionVerb: string, displayTotal?: number) => {
    if (!gameState) return;
    const pIndex = gameState.players.findIndex(p => p.id === player.id);
    
    // Cap at stack
    const actualAmount = Math.min(amount, player.chips);
    
    const newPlayers = [...gameState.players];
    const p = newPlayers[pIndex];
    
    p.chips -= actualAmount;
    p.currentBet += actualAmount;
    if (p.chips === 0) p.isAllIn = true;
    
    // Set Action Bubble Text
    const bubbleText = `${actionVerb.split(' ')[0]} ${displayTotal || actualAmount || ''}`.trim();
    p.actionMessage = bubbleText === "Checks" ? "Check" : bubbleText;

    // Log
    const logMsg = `${player.name} ${actionVerb.toLowerCase()} ${displayTotal || (actualAmount > 0 ? actualAmount : '')}`.trim();

    const newPot = gameState.pot + actualAmount;
    
    // Check if this is a raise
    let newCurrentBet = gameState.currentBet;
    let newMinBet = gameState.minBet;
    let newLastRaiser = gameState.lastRaiserIndex;

    // If player bet more than the current table bet (Raise)
    if (p.currentBet > gameState.currentBet) {
      const raiseDiff = p.currentBet - gameState.currentBet;
      newCurrentBet = p.currentBet;
      // The new minimum raise must be at least the size of the previous raise
      newMinBet = Math.max(gameState.minBet, raiseDiff);
      newLastRaiser = pIndex;
    }

    setGameState(prev => prev ? ({
      ...prev,
      players: newPlayers,
      pot: newPot,
      currentBet: newCurrentBet,
      minBet: newMinBet,
      lastRaiserIndex: newLastRaiser,
      roundLog: [...prev.roundLog, logMsg]
    }) : null);

    // Clear bubble
    setTimeout(() => clearActionBubble(p.id), 3000);

    // Defer next turn slightly for UI updates
    setTimeout(() => nextTurn(), 50);
  };

  const nextTurn = () => {
    setGameState(prev => {
      if (!prev) return null;
      
      let nextIndex = (prev.currentPlayerIndex + 1) % prev.players.length;
      let loopCount = 0;
      
      // Find next active player
      // FIX: Added loopCount check to prevent infinite loop if everyone is inactive/all-in
      while ((!prev.players[nextIndex].isActive || prev.players[nextIndex].isAllIn) && loopCount < prev.players.length) {
         nextIndex = (nextIndex + 1) % prev.players.length;
         loopCount++;
      }

      // If everyone else is all-in or folded, and loopCount hit max, we might be stuck on the current player.
      // We should check if there are at least 2 active players who are NOT all-in.
      const activeNonAllIn = prev.players.filter(p => p.isActive && !p.isAllIn);
      
      // If 0 or 1 player left acting, and the current bet is matched or no one can act, move to next phase.
      // Specifically if loopCount cycled through everyone, nobody can act.
      if (loopCount >= prev.players.length) {
          return nextPhase(prev);
      }

      const playerToAct = prev.players[nextIndex];
      const isBetMatched = playerToAct.currentBet === prev.currentBet;

      let endPhase = false;

      // If we are back to the last raiser (or BB) and bets are equal
      if (prev.lastRaiserIndex === nextIndex && isBetMatched) {
          endPhase = true;
      }
      
      if (endPhase) {
         return nextPhase(prev);
      }

      return {
        ...prev,
        currentPlayerIndex: nextIndex
      };
    });
  };

  const nextPhase = (state: GameState): GameState => {
    const { phase, deck, communityCards, players } = state;
    
    // Reset bets for new round
    const nextPlayers = players.map(p => ({ ...p, currentBet: 0 }));
    
    let nextGamePhase = phase; // Renamed local variable to avoid shadowing function name
    let newCommunityCards = [...communityCards];
    const newDeck = [...deck];

    if (phase === GamePhase.PRE_FLOP) {
      newDeck.pop(); // Burn
      newCommunityCards.push(newDeck.pop()!, newDeck.pop()!, newDeck.pop()!);
      nextGamePhase = GamePhase.FLOP;
    } else if (phase === GamePhase.FLOP) {
      newDeck.pop();
      newCommunityCards.push(newDeck.pop()!);
      nextGamePhase = GamePhase.TURN;
    } else if (phase === GamePhase.TURN) {
      newDeck.pop();
      newCommunityCards.push(newDeck.pop()!);
      nextGamePhase = GamePhase.RIVER;
    } else if (phase === GamePhase.RIVER) {
      return handleShowdown({...state, players: nextPlayers});
    }

    // Find first actor (Left of Dealer)
    let firstActor = (state.dealerIndex + 1) % players.length;
    let safety = 0;
    while ((!nextPlayers[firstActor].isActive || nextPlayers[firstActor].isAllIn) && safety < 10) {
      firstActor = (firstActor + 1) % players.length;
      safety++;
    }

    // If NO one can act in the next phase (all all-in), strictly speaking we should deal out the rest.
    // For simplicity, if safety loop fails, we just assign it to someone, but the AI turn loop will skip them?
    // Better: if safety hits 10 (everyone all-in), just recurse nextPhase to deal again until showdown.
    const activeNonAllIn = nextPlayers.filter(p => p.isActive && !p.isAllIn);
    if (activeNonAllIn.length === 0 && nextGamePhase !== GamePhase.SHOWDOWN) {
         // Auto-deal next street
         return nextPhase({
             ...state,
             phase: nextGamePhase,
             deck: newDeck,
             communityCards: newCommunityCards,
             players: nextPlayers,
             currentBet: 0,
             minBet: BIG_BLIND,
             currentPlayerIndex: firstActor,
             lastRaiserIndex: firstActor,
             roundLog: [...state.roundLog, `--- ${nextGamePhase} (Auto) ---`]
         });
    }

    return {
      ...state,
      phase: nextGamePhase,
      deck: newDeck,
      communityCards: newCommunityCards,
      players: nextPlayers,
      currentBet: 0,
      minBet: BIG_BLIND,
      currentPlayerIndex: firstActor,
      lastRaiserIndex: firstActor, // Reset aggressor for new street
      roundLog: [...state.roundLog, `--- ${nextGamePhase} ---`]
    };
  };

  const handleShowdown = (state: GameState): GameState => {
    const activePlayers = state.players.filter(p => p.isActive);
    let winners: Player[] = [];
    let bestHandDesc = "";

    if (activePlayers.length === 0) return state;

    // Calculate winning hand description
    let bestScore = -1;
    activePlayers.forEach(p => {
       const evalResult = evaluateHand(p.hand, state.communityCards);
       if (evalResult.score > bestScore) {
         bestScore = evalResult.score;
         winners = [p];
         bestHandDesc = evalResult.description;
       } else if (evalResult.score === bestScore) {
         winners.push(p);
       }
    });

    const winAmount = Math.floor(state.pot / winners.length);
    
    const newPlayers = state.players.map(p => {
       if (winners.find(w => w.id === p.id)) {
         return { ...p, chips: p.chips + winAmount };
       }
       return p;
    });

    return {
      ...state,
      players: newPlayers,
      phase: GamePhase.SHOWDOWN,
      pot: 0,
      lastPotSize: state.pot,
      winners,
      winningHandDesc: bestHandDesc,
      roundLog: [...state.roundLog, `Showdown! Winner: ${winners.map(w => w.name).join(', ')} (${bestHandDesc})`]
    };
  };

  const handleWinner = (state: GameState, winner: Player): GameState => {
     const newPlayers = state.players.map(p => {
       const player = { ...p, currentBet: 0 };
       if (player.id === winner.id) return { ...player, chips: player.chips + state.pot };
       return player;
     });
     return {
       ...state,
       players: newPlayers,
       phase: GamePhase.SHOWDOWN,
       pot: 0,
       lastPotSize: state.pot,
       winners: [winner],
       winningHandDesc: "All opponents folded",
       roundLog: [...state.roundLog, `${winner.name} wins ${state.pot} (Opponents Folded)`]
     };
  };

  const handleHumanAction = (action: 'FOLD' | 'CHECK' | 'CALL' | 'RAISE', raiseAmt?: number) => {
    if (!gameState) return;
    const player = gameState.players[gameState.currentPlayerIndex];
    const toCall = gameState.currentBet - player.currentBet;

    if (action === 'FOLD') {
      const newPlayers = [...gameState.players];
      newPlayers[gameState.currentPlayerIndex].isActive = false;
      newPlayers[gameState.currentPlayerIndex].actionMessage = "Fold";
      
      setGameState(prev => prev ? ({
        ...prev, 
        players: newPlayers,
        roundLog: [...prev.roundLog, "You Fold"]
      }) : null);
      
      setTimeout(() => clearActionBubble(player.id), 3000);
      nextTurn();
    } else if (action === 'CHECK') {
      processPlayerAction(player, 0, "Checks");
    } else if (action === 'CALL') {
      processPlayerAction(player, toCall, "Calls");
    } else if (action === 'RAISE') {
      if (!showRaiseControl) {
        // Initialize slider values
        const minRaise = gameState.minBet + toCall;
        setRaiseAmount(minRaise);
        setShowRaiseControl(true);
        return;
      }
      
      const amountToBet = raiseAmt || raiseAmount;
      // Raising to a total amount (chips put in this round)
      processPlayerAction(player, amountToBet, "Raises to", player.currentBet + amountToBet);
      setShowRaiseControl(false);
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
  
  // Effect for automated banter
  useEffect(() => {
     if(gameState?.phase === GamePhase.RIVER) {
        generateOpponentBanter("River card dealt").then(setBanter);
     }
  }, [gameState?.phase]);

  // --- Render Helpers ---

  // Bot Mapping based on screenshot and FRIEND_NAMES array:
  // 0: Nick (Left Middle)
  // 1: Devin (Bottom Left)
  // 2: Cody A (Top Left)
  // 3: Cody (Top Center)
  // 4: Pat (Top Right)
  // 5: Noah (Bottom Right)
  // 6: Rob (Right Middle)
  
  // AVATAR POSITIONS (Draggable) - Initial layout
  const BOT_LAYOUTS = [
      { style: "top-1/2 -translate-y-1/2 left-4", reverse: false }, // Nick
      { style: "bottom-[15%] left-10", reverse: false }, // Devin
      { style: "top-[15%] left-10", reverse: true }, // Cody A
      { style: "top-4 left-1/2 -translate-x-1/2", reverse: true }, // Cody
      { style: "top-[15%] right-10", reverse: true }, // Pat
      { style: "bottom-[15%] right-10", reverse: false }, // Noah
      { style: "top-1/2 -translate-y-1/2 right-4", reverse: false }, // Rob
  ];

  const renderRaiseControls = (human: Player) => {
    const toCall = (gameState?.currentBet || 0) - human.currentBet;
    const minRaise = Math.max(gameState?.minBet || BIG_BLIND, BIG_BLIND); 
    const minTotalBet = toCall + minRaise;
    const maxBet = human.chips;

    return (
      <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 p-4 rounded-xl shadow-2xl flex flex-col gap-4 w-80 animate-deal z-50">
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
           <button onClick={() => setRaiseAmount(Math.min(maxBet, (gameState?.pot || 0) / 2))} className="px-2 py-1 bg-slate-800 rounded text-xs text-slate-400 hover:bg-slate-700">Half Pot</button>
           <button onClick={() => setRaiseAmount(Math.min(maxBet, (gameState?.pot || 0)))} className="px-2 py-1 bg-slate-800 rounded text-xs text-slate-400 hover:bg-slate-700">Pot</button>
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
             onClick={() => handleHumanAction('RAISE', raiseAmount)}
             className="flex-[3] py-3 rounded-lg font-bold bg-yellow-600 text-white hover:bg-yellow-500 flex justify-center items-center gap-2"
          >
             Confirm ${raiseAmount} <Check size={20} />
          </button>
        </div>
      </div>
    );
  };

  // --- Calculations for HUD ---
  const human = gameState?.players.find(p => p.isHuman);
  const isHumanTurn = gameState?.players[gameState.currentPlayerIndex].isHuman && gameState?.players[gameState.currentPlayerIndex].isActive;
  const humanHandDesc = human && gameState ? evaluateHand(human.hand, gameState.communityCards).description : "";
  const handGrade = (human && gameState?.phase === GamePhase.PRE_FLOP) ? gradeStartingHand(human.hand) : undefined;
  
  let potOdds = null;
  let spr = "-";

  if (gameState && human) {
    const toCall = gameState.currentBet - human.currentBet;
    if (toCall > 0) {
      // Pot Odds: (Current Pot + Bets) : Call Amount
      // gameState.pot includes chips in middle. 
      const ratio = (gameState.pot / toCall).toFixed(1);
      potOdds = `${ratio} : 1`;
    }

    // SPR = Effective Stack / Pot. 
    // Simplified: My Stack / Pot
    if (gameState.pot > 0) {
      spr = (human.chips / gameState.pot).toFixed(1);
    }
  }

  // --- Main Render ---

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
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-4 animate-deal">
        <Skull size={80} className="text-red-600 mb-4 animate-pulse" />
        <h1 className="text-7xl font-black mb-2 text-red-600 font-poker tracking-widest">BUSTED</h1>
        <p className="text-2xl text-slate-400 mb-8 font-mono">The house always wins.</p>
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
      
      {/* Background Texture */}
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
        
        {/* Coach Advice Bubble */}
        {(coachAdvice || isLoadingAdvice) && (
          <div className="max-w-xs bg-indigo-950/90 border-2 border-indigo-500 p-4 rounded-xl shadow-[0_0_30px_rgba(99,102,241,0.3)] backdrop-blur-md pointer-events-auto animate-deal">
             <div className="flex items-center gap-2 mb-2 text-indigo-300 font-bold uppercase text-xs tracking-wider">
               <Brain size={16} /> AI Coach
             </div>
             {isLoadingAdvice ? (
               <div className="flex gap-2 items-center text-indigo-200">
                 <RefreshCw className="animate-spin" size={16}/> Analyzing...
               </div>
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

      {/* Main Table Area - Flex container holding everything */}
      <div className="relative w-[95vw] h-[60vh] md:w-[80vw] md:h-[70vh] flex items-center justify-center z-10">
          
          {/* Table Visuals - Absolutely positioned and CLIPS content (Felt) */}
          <div className="absolute inset-0 rounded-[150px] border-[20px] border-[#2a2a2a] shadow-[0_20px_60px_rgba(0,0,0,0.8)] bg-poker-green overflow-hidden">
             {/* Felt Texture */}
             <div className="absolute inset-0 bg-felt-pattern opacity-40 pointer-events-none mix-blend-overlay"></div>
             {/* Table Gradient (Lighting) */}
             <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.1)_0%,_rgba(0,0,0,0.4)_100%)] pointer-events-none"></div>
             {/* Inner Rail Highlight */}
             <div className="absolute inset-0 border-4 border-black/20 rounded-[130px] pointer-events-none"></div>

             {/* Winner Overlay (Inside clipped area) */}
             {gameState?.phase === GamePhase.SHOWDOWN && gameState.winners && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-deal">
                <div className="text-center p-8 bg-slate-900/90 border-4 border-yellow-500 rounded-2xl shadow-[0_0_100px_rgba(234,179,8,0.5)] transform scale-110 flex flex-col items-center">
                  <div className="text-yellow-400 font-bold uppercase tracking-widest text-sm mb-2 animate-pulse">Winner</div>
                  
                  {/* Winner Names */}
                  <h2 className="text-4xl font-black text-white mb-4 font-poker max-w-lg leading-tight">
                    {gameState.winners.map(w => w.name).join(' & ')}
                  </h2>
                  
                  {/* Winning Hands Display */}
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

          {/* Table Brand - Sits on top of felt but under cards */}
          {gameState?.communityCards.length === 0 && (
             <div className="absolute z-0 text-poker-felt font-black tracking-widest text-6xl opacity-20 select-none font-poker rotate-[-5deg]">
               FOLD'EM
             </div>
          )}

          {/* Community Cards - On top of visuals */}
          <div className="flex gap-2 sm:gap-4 z-10 min-h-[100px] items-center mb-12 sm:mb-20">
            {gameState?.communityCards.map((card, i) => (
              <Card key={card.id} card={card} className="animate-deal shadow-2xl" />
            ))}
          </div>

          {/* Render Bots (Index 1-7) */}
          {gameState && gameState.players.slice(1).map((bot, index) => {
            const layout = BOT_LAYOUTS[index];
            return (
              <DraggablePlayerWrapper key={bot.id} className={layout.style}>
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

          {/* Human (Index 0) */}
          <DraggablePlayerWrapper className="bottom-0 sm:bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
            {gameState && human && (
              <>
                 <PlayerSpot 
                    player={human} 
                    isDealer={gameState.dealerIndex === 0} 
                    isCurrentTurn={gameState.currentPlayerIndex === 0} 
                    cardsVisible={true} 
                    gamePhase={gameState.phase}
                    isWinner={gameState.winners?.some(w => w.id === human.id)}
                 />

                 {/* Stats HUD - Positioned to the right */}
                 {gameState.phase !== GamePhase.SHOWDOWN && gameState.phase !== GamePhase.GAME_OVER && (
                  <div className="absolute left-[110%] bottom-20 sm:bottom-24 w-max pointer-events-none z-50">
                     <StatsHUD 
                       handDesc={humanHandDesc}
                       potOdds={potOdds}
                       spr={spr}
                       handGrade={handGrade}
                     />
                  </div>
                 )}
              </>
            )}
          </DraggablePlayerWrapper>
          
          {/* Game Log Window (Draggable) */}
          {gameState && (
             <DraggableWindow 
                title="Table Talk" 
                icon={<MessageSquare size={14} />} 
                initialPosition={{x: 20, y: 100}}
             >
                <GameLog log={gameState.roundLog} />
             </DraggableWindow>
          )}

          {/* Chip Leaderboard Window (Draggable) */}
          {gameState && (
            <DraggableWindow
                title="Chip Count"
                icon={<ListOrdered size={14} />}
                initialPosition={{x: window.innerWidth - 220, y: 100}}
            >
                <ChipLeaderboard players={gameState.players} />
            </DraggableWindow>
          )}

          {/* Banter */}
          {banter && (
            <div className="absolute top-1/3 right-1/4 bg-white text-black p-3 rounded-2xl rounded-bl-none text-sm font-bold animate-float shadow-xl max-w-[150px] border-2 border-black z-20 transform rotate-2">
              "{banter}"
            </div>
          )}
      </div>

      {/* Raise Controls Overlay */}
      {showRaiseControl && human && renderRaiseControls(human)}

      {/* Control Panel (Sticky Bottom) */}
      <div className="absolute bottom-0 w-full bg-slate-900/90 border-t border-slate-800 p-4 pb-8 flex justify-center items-center gap-4 backdrop-blur-xl z-30 transition-transform duration-300 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
         
         {gameState?.phase === GamePhase.SHOWDOWN ? (
           <button 
             onClick={startNewHand} 
             className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-4 rounded-xl font-black text-xl flex items-center gap-3 shadow-[0_0_20px_rgba(37,99,235,0.6)] animate-pulse border-2 border-blue-400"
           >
             NEXT HAND <TrendingUp size={24} />
           </button>
         ) : (
           <>
             {isHumanTurn ? (
               <div className="flex gap-2 sm:gap-4 items-center">
                  <button 
                    onClick={() => handleHumanAction('FOLD')}
                    className="bg-red-950/80 hover:bg-red-900 text-red-100 border-2 border-red-800 px-6 py-4 rounded-xl font-bold uppercase tracking-wider shadow-lg hover:shadow-red-900/50 transition-all hover:-translate-y-1"
                  >
                    Fold
                  </button>
                  <button 
                    onClick={() => handleHumanAction('CHECK')}
                    disabled={gameState!.currentBet > human!.currentBet}
                    className="bg-slate-800 hover:bg-slate-700 text-white border-2 border-slate-600 px-6 py-4 rounded-xl font-bold uppercase tracking-wider disabled:opacity-50 disabled:hover:translate-y-0 shadow-lg transition-all hover:-translate-y-1"
                  >
                    Check
                  </button>
                  <button 
                    onClick={() => handleHumanAction('CALL')}
                    disabled={gameState!.currentBet <= human!.currentBet}
                    className="bg-emerald-800 hover:bg-emerald-700 text-white border-2 border-emerald-600 px-6 py-4 rounded-xl font-bold uppercase tracking-wider disabled:opacity-50 disabled:hover:translate-y-0 shadow-lg hover:shadow-emerald-900/50 transition-all hover:-translate-y-1 flex flex-col items-center leading-none justify-center"
                  >
                    <span>Call</span>
                    <span className="text-[10px] opacity-70 mt-1 font-mono">${gameState!.currentBet - human!.currentBet}</span>
                  </button>
                  <button 
                    onClick={() => handleHumanAction('RAISE')}
                    className="bg-yellow-700 hover:bg-yellow-600 text-white border-2 border-yellow-500 px-6 py-4 rounded-xl font-bold uppercase tracking-wider shadow-lg hover:shadow-yellow-900/50 transition-all hover:-translate-y-1"
                  >
                    Raise
                  </button>
                  
                  <div className="w-px h-12 bg-slate-700 mx-4"></div>
                  
                  <button 
                    onClick={getCoachHelp}
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
           </>
         )}
      </div>
    </div>
  );
};

export default App;