
import { GameState, Player, GamePhase, Card, HandHistoryEntry } from '../types';
import { createDeck, shuffleDeck, evaluateHand } from './poker';
import { STARTING_CHIPS, BIG_BLIND, SMALL_BLIND } from '../constants';

export class GameEngine {
  
  public static setupNewHand(currentPlayers: Player[], dealerIdx: number, handCount: number, currentHistory: HandHistoryEntry[]): GameState {
    const deck = shuffleDeck(createDeck());
    
    // Reset player round state
    const players = currentPlayers.map(p => ({
      ...p,
      hand: [],
      isActive: p.chips > 0,
      isAllIn: false,
      currentBet: 0,
      actionMessage: undefined
    }));

    // Rotate Dealer
    const nextDealer = (dealerIdx + 1) % players.length;
    
    // Determine Blinds
    let sbIndex = (nextDealer + 1) % players.length;
    let bbIndex = (nextDealer + 2) % players.length;

    // Heads up logic
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

    // Deal Cards
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
      lastRaiserIndex: bbIndex,
      roundLog: [`Hand #${handCount + 1} Started`],
      deckColor: 'blue',
      winners: [],
      winningHandDesc: '',
      lastPotSize: 0,
      handHistory: currentHistory,
      handCount: handCount + 1
    };
  }

  public static processPlayerAction(state: GameState, player: Player, amount: number, actionVerb: string, displayTotal?: number): GameState {
    const pIndex = state.players.findIndex(p => p.id === player.id);
    const actualAmount = Math.min(amount, player.chips);
    
    const newPlayers = [...state.players];
    const p = newPlayers[pIndex];
    
    p.chips -= actualAmount;
    p.currentBet += actualAmount;
    if (p.chips === 0) p.isAllIn = true;
    
    // Bubble Text
    const bubbleText = `${actionVerb.split(' ')[0]} ${displayTotal || actualAmount || ''}`.trim();
    p.actionMessage = bubbleText === "Checks" ? "Check" : bubbleText;

    // Log
    const logMsg = `${player.name} ${actionVerb.toLowerCase()} ${displayTotal || (actualAmount > 0 ? actualAmount : '')}`.trim();

    const newPot = state.pot + actualAmount;
    
    let newCurrentBet = state.currentBet;
    let newMinBet = state.minBet;
    let newLastRaiser = state.lastRaiserIndex;

    // Raise Logic
    if (p.currentBet > state.currentBet) {
      const raiseDiff = p.currentBet - state.currentBet;
      newCurrentBet = p.currentBet;
      newMinBet = Math.max(state.minBet, raiseDiff);
      newLastRaiser = pIndex;
    }

    return {
      ...state,
      players: newPlayers,
      pot: newPot,
      currentBet: newCurrentBet,
      minBet: newMinBet,
      lastRaiserIndex: newLastRaiser,
      roundLog: [...state.roundLog, logMsg]
    };
  }

  public static nextTurn(state: GameState): GameState {
    let nextIndex = (state.currentPlayerIndex + 1) % state.players.length;
    let loopCount = 0;
    
    // Find next active player
    while ((!state.players[nextIndex].isActive || state.players[nextIndex].isAllIn) && loopCount < state.players.length) {
       nextIndex = (nextIndex + 1) % state.players.length;
       loopCount++;
    }

    if (loopCount >= state.players.length) {
        return this.nextPhase(state);
    }

    const playerToAct = state.players[nextIndex];
    const isBetMatched = playerToAct.currentBet === state.currentBet;

    let endPhase = false;
    if (state.lastRaiserIndex === nextIndex && isBetMatched) {
        endPhase = true;
    }
    
    if (endPhase) {
       return this.nextPhase(state);
    }

    return {
      ...state,
      currentPlayerIndex: nextIndex
    };
  }

  public static nextPhase(state: GameState): GameState {
    const { phase, deck, communityCards, players } = state;
    
    const nextPlayers = players.map(p => ({ ...p, currentBet: 0 }));
    
    let nextGamePhase = phase;
    const newCommunityCards = [...communityCards];
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
      return this.handleShowdown({...state, players: nextPlayers});
    }

    // Find first actor (Left of Dealer)
    let firstActor = (state.dealerIndex + 1) % players.length;
    let safety = 0;
    while ((!nextPlayers[firstActor].isActive || nextPlayers[firstActor].isAllIn) && safety < 10) {
      firstActor = (firstActor + 1) % players.length;
      safety++;
    }

    const activeNonAllIn = nextPlayers.filter(p => p.isActive && !p.isAllIn);
    if (activeNonAllIn.length === 0 && nextGamePhase !== GamePhase.SHOWDOWN) {
         // Auto-deal next street if everyone is all-in
         return this.nextPhase({
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
      lastRaiserIndex: firstActor,
      roundLog: [...state.roundLog, `--- ${nextGamePhase} ---`]
    };
  }

  public static handleShowdown(state: GameState): GameState {
    const activePlayers = state.players.filter(p => p.isActive);
    let winners: Player[] = [];
    let bestHandDesc = "";

    if (activePlayers.length === 0) return state;

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

    // Add to history
    const historyEntry: HandHistoryEntry = {
        id: `hand_${state.handCount}`,
        handNumber: state.handCount,
        winnerNames: winners.map(w => w.name),
        winAmount: state.pot,
        winningHand: bestHandDesc,
        date: new Date().toLocaleTimeString()
    };

    return {
      ...state,
      players: newPlayers,
      phase: GamePhase.SHOWDOWN,
      pot: 0,
      lastPotSize: state.pot,
      winners,
      winningHandDesc: bestHandDesc,
      roundLog: [...state.roundLog, `Showdown! Winner: ${winners.map(w => w.name).join(', ')} (${bestHandDesc})`],
      handHistory: [...state.handHistory, historyEntry]
    };
  }
}
