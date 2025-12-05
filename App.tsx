import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  GamePhase, Player, GameState, Card as CardType, Perk, CoachAdvice 
} from './types';
import { 
  createDeck, shuffleDeck, evaluateHand, determineWinner 
} from './utils/poker';
import { 
  STARTING_CHIPS, BIG_BLIND, SMALL_BLIND, AI_PERSONALITIES, AVATAR_URL, FRIEND_NAMES 
} from './constants';
import { getPokerAdvice, generateOpponentBanter } from './services/gemini';
import Card from './components/Card';
import Shop from './components/Shop';
import { 
  Coins, User, Bot, HelpCircle, AlertCircle, TrendingUp, RefreshCw, Trophy, Menu, Brain, X, Check, Skull, Activity, Scale, Percent
} from 'lucide-react';

// --- Helper Components ---

const PlayerSpot: React.FC<{ 
  player: Player; 
  isDealer: boolean; 
  isCurrentTurn: boolean;
  cardsVisible: boolean;
  gamePhase: GamePhase;
  isWinner?: boolean;
}> = ({ player, isDealer, isCurrentTurn, cardsVisible, gamePhase, isWinner }) => {
  const winnerGlow = isWinner ? 'ring-4 ring-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.6)] scale-110 z-20' : '';
  const turnGlow = isCurrentTurn && !isWinner ? 'ring-2 ring-emerald-400 animate-pulse' : '';
  const foldOpacity = !player.isActive ? 'opacity-40 grayscale' : '';
  
  return (
    <div className={`relative flex flex-col items-center transition-all duration-500 ${foldOpacity} ${isWinner ? 'translate-y-[-10px]' : ''}`}>
      {/* Cards */}
      <div className="flex -space-x-4 mb-2 h-20 sm:h-24 relative">
        {player.hand.map((card, idx) => (
          <Card 
            key={idx} 
            card={card} 
            hidden={!cardsVisible && !player.isHuman && gamePhase !== GamePhase.SHOWDOWN} 
            className={`transform ${idx === 1 ? 'rotate-6 translate-y-1' : '-rotate-6'} origin-bottom transition-transform duration-500`}
            tiny={!player.isHuman} // Make bots cards slightly smaller to fit 8 players
          />
        ))}
        {isWinner && (
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-yellow-400 animate-bounce">
            <Trophy size={32} fill="currentColor" />
          </div>
        )}
      </div>

      {/* Avatar & Info */}
      <div className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 bg-slate-800 flex items-center justify-center overflow-hidden transition-all duration-300 ${turnGlow} ${winnerGlow} ${player.isActive ? 'border-slate-600' : 'border-red-900'}`}>
         <img src={player.isHuman ? 'https://api.dicebear.com/7.x/avataaars/svg?seed=hero' : AVATAR_URL(player.avatarSeed || 1)} alt="Avatar" className="w-full h-full object-cover" />
         {isDealer && (
           <div className="absolute -top-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 bg-white text-slate-900 rounded-full flex items-center justify-center font-bold text-[10px] sm:text-xs border-2 border-slate-300 shadow-md">D</div>
         )}
      </div>

      {/* Name & Chips */}
      <div className="mt-1 sm:mt-2 bg-slate-900/80 backdrop-blur-sm px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-center border border-slate-700 min-w-[80px] sm:min-w-[100px] shadow-lg z-10">
        <div className="text-[10px] sm:text-xs font-bold text-slate-300 truncate max-w-[80px] sm:max-w-[100px] mx-auto">{player.name}</div>
        <div className="text-[10px] sm:text-sm font-mono text-yellow-400 flex items-center justify-center gap-1">
          <Coins size={10} /> {player.chips}
        </div>
        {player.currentBet > 0 && (
          <div className="text-[10px] sm:text-xs text-emerald-400 font-bold bg-emerald-900/30 px-1 rounded mt-0.5">
            Bet: {player.currentBet}
          </div>
        )}
      </div>
      
      {player.isAllIn && <div className="absolute top-10 font-black text-red-500 text-lg sm:text-xl shadow-black drop-shadow-md rotate-12 bg-black/50 px-2 rounded">ALL IN</div>}
      {!player.isActive && player.chips > 0 && <div className="absolute top-10 font-black text-slate-500 text-lg sm:text-xl shadow-black drop-shadow-md -rotate-12 bg-black/50 px-2 rounded">FOLD</div>}
    </div>
  );
};

// --- Stats HUD Component ---
const StatsHUD: React.FC<{
  handDesc: string;
  potOdds: string | null;
  spr: string;
}> = ({ handDesc, potOdds, spr }) => (
  <div className="flex gap-2 bg-slate-900/90 border border-slate-700 rounded-xl p-2 shadow-2xl backdrop-blur-sm animate-deal">
    <div className="flex flex-col items-center px-3 border-r border-slate-700">
      <div className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
        <Activity size={12} /> Hand
      </div>
      <div className="text-sm font-bold text-indigo-300">{handDesc || "High Card"}</div>
    </div>
    
    <div className="flex flex-col items-center px-3 border-r border-slate-700">
      <div className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
        <Scale size={12} /> Pot Odds
      </div>
      <div className="text-sm font-bold text-emerald-400">{potOdds || "-"}</div>
    </div>

    <div className="flex flex-col items-center px-3">
      <div className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
        <Percent size={12} /> SPR
      </div>
      <div className="text-sm font-bold text-yellow-400">{spr}</div>
    </div>
  </div>
);


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
      currentBet: 0
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
      winningHandDesc: ''
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

    const toCall = gameState.currentBet - player.currentBet;
    const actionRoll = Math.random();
    
    let action = 'FOLD';
    
    // Basic AI Personality Logic
    // 70% chance to check/call, 20% fold to aggression, 10% raise
    if (toCall === 0) {
      action = actionRoll > 0.8 ? 'RAISE' : 'CHECK';
    } else {
      if (actionRoll < 0.15) action = 'FOLD'; // 15% fold
      else if (actionRoll < 0.85) action = 'CALL'; // 70% call
      else action = 'RAISE'; // 15% raise
    }

    if (action === 'FOLD') {
      const newPlayers = [...gameState.players];
      newPlayers[gameState.currentPlayerIndex].isActive = false;
      setGameState(prev => prev ? ({...prev, players: newPlayers}) : null);
      nextTurn();
    } else if (action === 'CALL' || action === 'CHECK') {
       placeBet(toCall);
    } else if (action === 'RAISE') {
       // AI Raise logic
       const minRaise = gameState.minBet;
       // Random raise between min and 3x min
       const raiseAmt = minRaise * (1 + Math.floor(Math.random() * 2)); 
       placeBet(toCall + raiseAmt);
    }
  };

  const placeBet = (amount: number) => {
    if (!gameState) return;
    const pIndex = gameState.currentPlayerIndex;
    const player = gameState.players[pIndex];
    
    // Cap at stack
    const actualAmount = Math.min(amount, player.chips);
    
    const newPlayers = [...gameState.players];
    const p = newPlayers[pIndex];
    
    p.chips -= actualAmount;
    p.currentBet += actualAmount;
    if (p.chips === 0) p.isAllIn = true;

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
      lastRaiserIndex: newLastRaiser
    }) : null);

    // Defer next turn slightly for UI updates
    setTimeout(() => nextTurn(), 50);
  };

  const nextTurn = () => {
    setGameState(prev => {
      if (!prev) return null;
      
      let nextIndex = (prev.currentPlayerIndex + 1) % prev.players.length;
      let loopCount = 0;
      
      // Find next active player
      while ((!prev.players[nextIndex].isActive || prev.players[nextIndex].isAllIn) && loopCount < prev.players.length) {
         nextIndex = (nextIndex + 1) % prev.players.length;
         loopCount++;
      }

      const activePlayers = prev.players.filter(p => p.isActive);
      const activeNonAllIn = activePlayers.filter(p => !p.isAllIn);

      // WINNER Check 1: Everyone else folded
      if (activePlayers.length === 1) {
        return handleWinner(prev, activePlayers[0]);
      }
      
      // Phase End Check:
      if (activeNonAllIn.length < 2 && prev.currentBet > 0) {
         // Everyone else is all in or folded.
      }

      const playerToAct = prev.players[nextIndex];
      const isBetMatched = playerToAct.currentBet === prev.currentBet;

      let endPhase = false;

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
    
    let nextPhase = phase;
    let newCommunityCards = [...communityCards];
    const newDeck = [...deck];

    if (phase === GamePhase.PRE_FLOP) {
      newDeck.pop(); // Burn
      newCommunityCards.push(newDeck.pop()!, newDeck.pop()!, newDeck.pop()!);
      nextPhase = GamePhase.FLOP;
    } else if (phase === GamePhase.FLOP) {
      newDeck.pop();
      newCommunityCards.push(newDeck.pop()!);
      nextPhase = GamePhase.TURN;
    } else if (phase === GamePhase.TURN) {
      newDeck.pop();
      newCommunityCards.push(newDeck.pop()!);
      nextPhase = GamePhase.RIVER;
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

    return {
      ...state,
      phase: nextPhase,
      deck: newDeck,
      communityCards: newCommunityCards,
      players: nextPlayers,
      currentBet: 0,
      minBet: BIG_BLIND,
      currentPlayerIndex: firstActor,
      lastRaiserIndex: firstActor, // Reset aggressor for new street
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
      winners,
      winningHandDesc: bestHandDesc
    };
  };

  const handleWinner = (state: GameState, winner: Player): GameState => {
     const newPlayers = state.players.map(p => {
       if (p.id === winner.id) return { ...p, chips: p.chips + state.pot };
       return p;
     });
     return {
       ...state,
       players: newPlayers,
       phase: GamePhase.SHOWDOWN,
       pot: 0,
       winners: [winner],
       winningHandDesc: "All opponents folded"
     };
  };

  const handleHumanAction = (action: 'FOLD' | 'CHECK' | 'CALL' | 'RAISE', raiseAmt?: number) => {
    if (!gameState) return;
    const player = gameState.players[gameState.currentPlayerIndex];
    const toCall = gameState.currentBet - player.currentBet;

    if (action === 'FOLD') {
      const newPlayers = [...gameState.players];
      newPlayers[gameState.currentPlayerIndex].isActive = false;
      setGameState(prev => prev ? ({...prev, players: newPlayers}) : null);
      nextTurn();
    } else if (action === 'CHECK' || action === 'CALL') {
      placeBet(toCall);
    } else if (action === 'RAISE') {
      if (!showRaiseControl) {
        // Initialize slider values
        const minRaise = gameState.minBet + toCall;
        setRaiseAmount(minRaise);
        setShowRaiseControl(true);
        return;
      }
      
      const amountToBet = raiseAmt || raiseAmount;
      placeBet(amountToBet);
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

  // Positions for 8 players relative to center (Human is 0)
  // Index 0: Human (Bottom)
  // Index 1: Bottom Left
  // Index 2: Left
  // Index 3: Top Left
  // Index 4: Top
  // Index 5: Top Right
  // Index 6: Right
  // Index 7: Bottom Right
  const SEAT_STYLES = [
    "", // Human (handled separately)
    "bottom-[5%] left-[-2%] sm:bottom-4 sm:left-[-4rem]", // 1: SW
    "top-1/2 -translate-y-1/2 left-[-3%] sm:left-[-6rem]", // 2: W
    "top-[5%] left-[-2%] sm:top-4 sm:left-[-4rem]", // 3: NW
    "-top-16 left-1/2 -translate-x-1/2", // 4: N
    "top-[5%] right-[-2%] sm:top-4 sm:right-[-4rem]", // 5: NE
    "top-1/2 -translate-y-1/2 right-[-3%] sm:right-[-6rem]", // 6: E
    "bottom-[5%] right-[-2%] sm:bottom-4 sm:right-[-4rem]", // 7: SE
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
  const isHumanTurn = gameState?.players[gameState.currentPlayerIndex].isHuman;
  const humanHandDesc = human && gameState ? evaluateHand(human.hand, gameState.communityCards).description : "";
  
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
       <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white p-4">
         <h1 className="text-6xl font-black mb-4 text-transparent bg-clip-text bg-gradient-to-br from-emerald-400 to-blue-600">FOLD'EM</h1>
         <p className="text-xl text-slate-400 mb-8 max-w-md text-center">
           The Roguelite Poker Trainer.
         </p>
         <button 
           onClick={initGame}
           className="px-8 py-4 bg-emerald-600 rounded-full font-bold text-xl hover:bg-emerald-500 transition-all shadow-[0_0_20px_rgba(16,185,129,0.4)]"
         >
           START RUN ($40 Buy-in)
         </button>
         <p className="mt-4 text-slate-600 text-sm">Everyone starts with 1000 chips.</p>
       </div>
     );
  }
  
  if (gameState?.phase === GamePhase.GAME_OVER) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-4 animate-deal">
        <Skull size={64} className="text-red-500 mb-4" />
        <h1 className="text-6xl font-black mb-2 text-red-500">BUSTED</h1>
        <p className="text-xl text-slate-400 mb-8">You lost all your chips.</p>
        <button 
          onClick={initGame}
          className="px-8 py-4 bg-slate-800 border border-slate-600 rounded-full font-bold text-xl hover:bg-slate-700 transition-all"
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
    <div className="min-h-screen bg-slate-950 text-white overflow-hidden relative font-sans select-none flex items-center justify-center pb-32"> 
      {/* Changed layout: flex centered but with pb-32 to push table up */}
      
      {/* HUD Header */}
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start z-10 pointer-events-none">
        <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-700 pointer-events-auto">
          <h2 className="text-slate-400 text-xs font-bold uppercase tracking-wider">Pot</h2>
          <div className="text-2xl font-mono text-yellow-400 flex items-center gap-2">
            <Coins className="text-yellow-500" /> {gameState?.pot}
          </div>
          <div className="text-xs text-slate-500 mt-1">Blinds: {SMALL_BLIND}/{BIG_BLIND}</div>
        </div>
        
        {/* Coach Advice Bubble */}
        {(coachAdvice || isLoadingAdvice) && (
          <div className="max-w-xs bg-indigo-900/90 border border-indigo-500 p-4 rounded-xl shadow-2xl backdrop-blur-md pointer-events-auto animate-deal">
             <div className="flex items-center gap-2 mb-2 text-indigo-300 font-bold uppercase text-xs">
               <Brain size={16} /> AI Coach
             </div>
             {isLoadingAdvice ? (
               <div className="flex gap-2 items-center">
                 <RefreshCw className="animate-spin" size={16}/> Analyzing hand...
               </div>
             ) : (
               <>
                 <div className="font-bold text-white text-lg mb-1">{coachAdvice?.action}</div>
                 <p className="text-sm text-slate-200 leading-snug mb-2">{coachAdvice?.reasoning}</p>
                 <div className="flex gap-4 text-xs font-mono text-indigo-200">
                    <span>Win: {coachAdvice?.winProbability}</span>
                    {humanPerks.includes('odds_calc') && <span>Odds: {coachAdvice?.potOdds || 'N/A'}</span>}
                 </div>
               </>
             )}
          </div>
        )}
      </div>

      {/* Main Table Area */}
      {/* Table Felt */}
      <div className="relative w-[95vw] h-[60vh] md:w-[80vw] md:h-[70vh] bg-poker-green rounded-[100px] border-[16px] border-poker-dark shadow-2xl flex items-center justify-center">
          <div className="absolute inset-4 border-2 border-poker-felt rounded-[80px] opacity-30 pointer-events-none"></div>
          
          {/* Community Cards */}
          <div className="flex gap-2 sm:gap-4 z-10 min-h-[100px] items-center mb-12 sm:mb-20">
            {gameState?.communityCards.map((card, i) => (
              <Card key={card.id} card={card} className="animate-deal" />
            ))}
            {gameState?.communityCards.length === 0 && (
              <div className="text-poker-felt font-bold tracking-widest text-4xl opacity-50 select-none">
                FOLD'EM
              </div>
            )}
          </div>

          {/* Winner Overlay - Shows clearly who won */}
          {gameState?.phase === GamePhase.SHOWDOWN && gameState.winners && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-[80px] animate-deal">
              <div className="text-center p-6 bg-slate-900/90 border-2 border-yellow-500 rounded-2xl shadow-[0_0_50px_rgba(234,179,8,0.3)]">
                <div className="text-yellow-400 font-bold uppercase tracking-widest text-sm mb-2">Winner</div>
                <h2 className="text-4xl font-black text-white mb-2">
                  {gameState.winners.map(w => w.name).join(' & ')}
                </h2>
                <p className="text-xl text-emerald-400 font-mono mb-4">
                  +{gameState.players.find(p => p.id === gameState.winners![0].id)?.currentBet ? '??' : 'Pot'}
                </p>
                <div className="inline-block px-4 py-1 bg-slate-800 rounded-full text-slate-300 text-sm">
                  {gameState.winningHandDesc}
                </div>
              </div>
            </div>
          )}

          {/* Render Bots (Index 1-7) */}
          {gameState && gameState.players.slice(1).map((bot, index) => {
            // index 0 of this map is player[1], so offset is +1
            // The style array indices align with player indices (0 is human, 1 is bot 1, etc)
            return (
              <div key={bot.id} className={`absolute ${SEAT_STYLES[index + 1]}`}>
                <PlayerSpot 
                  player={bot} 
                  isDealer={gameState.dealerIndex === (index + 1)} 
                  isCurrentTurn={gameState.currentPlayerIndex === (index + 1)} 
                  cardsVisible={false} 
                  gamePhase={gameState.phase} 
                  isWinner={gameState.winners?.some(w => w.id === bot.id)} 
                />
              </div>
            );
          })}

          {/* Human (Index 0) */}
          <div className="absolute bottom-0 sm:bottom-2 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center"> 
            
            {/* PlayerSpot */}
            {gameState && human && (
              <PlayerSpot 
                player={human} 
                isDealer={gameState.dealerIndex === 0} 
                isCurrentTurn={gameState.currentPlayerIndex === 0} 
                cardsVisible={true} 
                gamePhase={gameState.phase}
                isWinner={gameState.winners?.some(w => w.id === human.id)}
              />
            )}

            {/* Stats HUD - Positioned to the right */}
            {human && gameState.phase !== GamePhase.SHOWDOWN && gameState.phase !== GamePhase.PRE_FLOP && (
              <div className="absolute left-[110%] bottom-20 sm:bottom-24 w-max pointer-events-none">
                 <StatsHUD 
                   handDesc={humanHandDesc}
                   potOdds={potOdds}
                   spr={spr}
                 />
              </div>
            )}
          </div>
          
          {/* Banter */}
          {banter && (
            <div className="absolute top-1/4 right-1/4 bg-white text-black p-2 rounded-xl rounded-bl-none text-xs font-bold animate-pulse-slow shadow-lg max-w-[120px]">
              {banter}
            </div>
          )}
      </div>

      {/* Raise Controls Overlay */}
      {showRaiseControl && human && renderRaiseControls(human)}

      {/* Control Panel (Sticky Bottom) */}
      <div className="absolute bottom-0 w-full bg-slate-900/95 border-t border-slate-800 p-4 pb-8 flex justify-center items-center gap-4 backdrop-blur-md z-30 transition-transform duration-300">
         
         {gameState?.phase === GamePhase.SHOWDOWN ? (
           <button 
             onClick={startNewHand} 
             className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-lg font-bold text-lg flex items-center gap-2 shadow-[0_0_20px_rgba(37,99,235,0.5)] animate-pulse"
           >
             Next Hand <TrendingUp size={20} />
           </button>
         ) : (
           <>
             {isHumanTurn ? (
               <div className="flex gap-2 sm:gap-4 items-center">
                  <button 
                    onClick={() => handleHumanAction('FOLD')}
                    className="bg-red-900/80 hover:bg-red-700 text-red-100 border border-red-700 px-6 py-3 rounded-lg font-bold uppercase tracking-wider"
                  >
                    Fold
                  </button>
                  <button 
                    onClick={() => handleHumanAction('CHECK')}
                    disabled={gameState!.currentBet > human!.currentBet}
                    className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 rounded-lg font-bold uppercase tracking-wider disabled:opacity-50"
                  >
                    Check
                  </button>
                  <button 
                    onClick={() => handleHumanAction('CALL')}
                    disabled={gameState!.currentBet <= human!.currentBet}
                    className="bg-emerald-700 hover:bg-emerald-600 text-white px-6 py-3 rounded-lg font-bold uppercase tracking-wider disabled:opacity-50 flex flex-col items-center leading-none"
                  >
                    <span>Call</span>
                    <span className="text-[10px] opacity-70 mt-1">${gameState!.currentBet - human!.currentBet}</span>
                  </button>
                  <button 
                    onClick={() => handleHumanAction('RAISE')}
                    className="bg-yellow-600 hover:bg-yellow-500 text-white px-6 py-3 rounded-lg font-bold uppercase tracking-wider"
                  >
                    Raise
                  </button>
                  
                  <div className="w-px h-10 bg-slate-700 mx-2"></div>
                  
                  <button 
                    onClick={getCoachHelp}
                    disabled={isLoadingAdvice}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-full shadow-lg border border-indigo-400"
                    title="Ask AI Coach"
                  >
                    <Brain size={24} />
                  </button>
               </div>
             ) : (
               <div className="text-slate-500 font-mono animate-pulse bg-slate-800/50 px-4 py-2 rounded-lg">
                 Opponents Thinking...
               </div>
             )}
           </>
         )}
      </div>
    </div>
  );
};

export default App;