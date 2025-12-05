import { Card, Rank, Suit, Player, GameState, GamePhase } from '../types';
import { RANKS, SUITS, BOT_PROFILES } from '../constants';

export const createDeck = (): Card[] => {
  const deck: Card[] = [];
  SUITS.forEach(suit => {
    RANKS.forEach(rank => {
      deck.push({ suit, rank, id: `${rank}${suit}` });
    });
  });
  return deck;
};

export const shuffleDeck = (deck: Card[]): Card[] => {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
};

const RANK_VALUE: Record<Rank, number> = {
  [Rank.TWO]: 2, [Rank.THREE]: 3, [Rank.FOUR]: 4, [Rank.FIVE]: 5,
  [Rank.SIX]: 6, [Rank.SEVEN]: 7, [Rank.EIGHT]: 8, [Rank.NINE]: 9,
  [Rank.TEN]: 10, [Rank.JACK]: 11, [Rank.QUEEN]: 12, [Rank.KING]: 13, [Rank.ACE]: 14
};

const getCardValue = (card: Card) => RANK_VALUE[card.rank];

// --- Hand Grading Logic (Chen Formula Simplified) ---
export const gradeStartingHand = (hand: Card[]): { score: number, grade: string, tip: string } => {
  if (hand.length !== 2) return { score: 0, grade: '?', tip: 'Wait for deal' };

  let score = 0;
  
  // Sort high to low
  const c1 = getCardValue(hand[0]) >= getCardValue(hand[1]) ? hand[0] : hand[1];
  const c2 = getCardValue(hand[0]) >= getCardValue(hand[1]) ? hand[1] : hand[0];
  
  const v1 = getCardValue(c1);
  const v2 = getCardValue(c2);

  // 1. High Card Points
  if (v1 === 14) score += 10; // A
  else if (v1 === 13) score += 8; // K
  else if (v1 === 12) score += 7; // Q
  else if (v1 === 11) score += 6; // J
  else score += (v1 / 2);

  // 2. Pairs
  if (v1 === v2) {
    score *= 2; 
    if (score < 5) score = 5; // Minimum for pair (22)
  }

  // 3. Suited
  if (c1.suit === c2.suit) score += 2;

  // 4. Closeness (Gaps)
  const gap = v1 - v2;
  if (gap === 1) score += 1; // Connector
  else if (gap === 2) score -= 1;
  else if (gap === 3) score -= 2;
  else if (gap === 4) score -= 4;
  else if (gap >= 5) score -= 5;

  // 5. Connector bonus (simplified)
  if (gap <= 1 && v1 < 12 && c1.suit === c2.suit) score += 1; 

  score = Math.ceil(score);

  // Determine Grade
  let grade = 'F';
  let tip = "Trash. Fold immediately.";

  if (score >= 20) { grade = 'S'; tip = "Monster. Raise big."; } // AA, KK
  else if (score >= 15) { grade = 'A'; tip = "Premium. 3-bet territory."; } // QQ, AKs, JJ
  else if (score >= 10) { grade = 'B'; tip = "Strong. Playable from any position."; } // TT, AQs, KQs
  else if (score >= 7) { grade = 'C'; tip = "Marginal. Careful out of position."; } // 88, JTs, AT
  else if (score >= 5) { grade = 'D'; tip = "Speculative. Fold unless on Button."; } // 22-66, Suited Connectors
  else { grade = 'F'; tip = "Garbage. Do not play."; }

  return { score, grade, tip };
};

export const evaluateHand = (holeCards: Card[], communityCards: Card[]): { score: number, description: string } => {
  const allCards = [...holeCards, ...communityCards];
  if (allCards.length === 0) return { score: 0, description: "Waiting" };
  
  // Sort by value descending
  allCards.sort((a, b) => getCardValue(b) - getCardValue(a));

  const values = allCards.map(c => getCardValue(c));
  const suits = allCards.map(c => c.suit);
  
  // Frequency map
  const counts: Record<number, number> = {};
  values.forEach(v => counts[v] = (counts[v] || 0) + 1);
  
  const distinctValues = Object.keys(counts).map(Number).sort((a, b) => b - a);
  
  // Check Flush
  const suitCounts: Record<string, number> = {};
  suits.forEach(s => suitCounts[s] = (suitCounts[s] || 0) + 1);
  const flushSuit = Object.keys(suitCounts).find(s => suitCounts[s] >= 5);
  
  let isFlush = false;
  let flushCards: number[] = [];
  if (flushSuit) {
    isFlush = true;
    flushCards = allCards.filter(c => c.suit === flushSuit).map(c => getCardValue(c));
  }

  // Check Straight
  const uniqueSorted = Array.from(new Set(values));
  let straightHigh = 0;
  let consecutive = 0;
  for (let i = 0; i < uniqueSorted.length - 1; i++) {
    if (uniqueSorted[i] - uniqueSorted[i+1] === 1) {
      consecutive++;
      if (consecutive >= 4) straightHigh = uniqueSorted[i - 3];
    } else {
      consecutive = 0;
    }
  }
  // Wheel (A-5)
  if (!straightHigh && uniqueSorted.includes(14) && uniqueSorted.includes(2) && uniqueSorted.includes(3) && uniqueSorted.includes(4) && uniqueSorted.includes(5)) {
    straightHigh = 5;
  }

  // Detect Hands
  // 1. Straight Flush (Simplification: just checking if flush and straight exist)
  
  // 2. Four of a Kind
  for (const v of distinctValues) if (counts[v] === 4) return { score: 7000 + v, description: "Four of a Kind" };
  
  // 3. Full House
  let three = 0, two = 0;
  for (const v of distinctValues) {
    if (counts[v] === 3 && three === 0) three = v;
    else if (counts[v] >= 2 && two === 0) two = v;
  }
  if (three && two) return { score: 6000 + three * 10 + two, description: "Full House" };
  
  // 4. Flush
  if (isFlush) return { score: 5000 + flushCards[0], description: "Flush" };
  
  // 5. Straight
  if (straightHigh) return { score: 4000 + straightHigh, description: "Straight" };
  
  // 6. Three of a Kind
  if (three) return { score: 3000 + three, description: "Three of a Kind" };
  
  // 7. Two Pair
  let pairs = [];
  for (const v of distinctValues) if (counts[v] === 2) pairs.push(v);
  if (pairs.length >= 2) return { score: 2000 + pairs[0] * 10 + pairs[1], description: "Two Pair" };
  
  // 8. Pair
  if (pairs.length === 1) return { score: 1000 + pairs[0], description: "Pair" };
  
  // 9. High Card
  return { score: values[0], description: "High Card" };
};

export const determineWinner = (players: Player[], communityCards: Card[]): Player[] => {
  const activePlayers = players.filter(p => p.isActive);
  if (activePlayers.length === 0) return [];
  if (activePlayers.length === 1) return [activePlayers[0]];

  let bestScore = -1;
  let winners: Player[] = [];

  activePlayers.forEach(p => {
    const { score } = evaluateHand(p.hand, communityCards);
    if (score > bestScore) {
      bestScore = score;
      winners = [p];
    } else if (score === bestScore) {
      winners.push(p);
    }
  });

  return winners;
};

// --- Bot Decision Logic ---
export const getBotDecision = (player: Player, gameState: GameState): { action: 'FOLD' | 'CALL' | 'CHECK' | 'RAISE', amount?: number } => {
  const profile = BOT_PROFILES[player.name] || { vpip: 0.5, aggression: 0.5, bluff: 0.1, label: "Unknown" };
  const toCall = gameState.currentBet - player.currentBet;
  const isCheck = toCall === 0;

  // 1. Evaluate Hand Strength
  let strength = 0; // 0.0 to 1.0 (Approximate)

  if (gameState.phase === GamePhase.PRE_FLOP) {
    const { score } = gradeStartingHand(player.hand);
    // Normalize preflop score: 0-25 => 0-1
    strength = Math.min(score, 25) / 25;
  } else {
    const { score } = evaluateHand(player.hand, gameState.communityCards);
    // Normalize postflop score: <1000 (High Card) to 7000 (Quads)
    if (score < 1000) strength = 0.1 + (score / 1500); // High card: 0.1 - 0.2
    else if (score < 2000) strength = 0.4 + ((score - 1000) / 1000) * 0.2; // Pair: 0.4 - 0.6
    else if (score < 3000) strength = 0.7; // Two Pair
    else if (score < 4000) strength = 0.8; // Trips
    else strength = 0.95; // Straight+
  }

  // 2. Adjust Strength with Personality (Bluff factor)
  // Bluffy players perceive their hand as stronger randomly
  if (Math.random() < profile.bluff) {
    strength += 0.3; // "I like this hand" (delusion or bluff)
  }

  // 3. Decision Matrix
  
  // PRE-FLOP logic
  if (gameState.phase === GamePhase.PRE_FLOP) {
    const vpipRoll = Math.random();
    // If not meeting VPIP threshold and active bet > BB, mostly fold.
    // If it's a check (BB option), always check.
    if (!isCheck && strength < 0.3 && vpipRoll > profile.vpip) {
      return { action: 'FOLD' };
    }
  } 
  // POST-FLOP logic
  else {
     // If facing a bet and hand is weak
     if (!isCheck && strength < 0.3 && Math.random() > profile.bluff) {
        return { action: 'FOLD' };
     }
  }

  // If we are here, we are playing. Raise or Call?
  const raiseRoll = Math.random();
  const canAffordRaise = player.chips > toCall + gameState.minBet;

  if (canAffordRaise && raiseRoll < profile.aggression && strength > 0.4) {
      const raiseAmt = Math.max(gameState.minBet, Math.floor(gameState.pot * (0.5 + Math.random())));
      return { action: 'RAISE', amount: raiseAmt };
  }

  return { action: isCheck ? 'CHECK' : 'CALL' };
};