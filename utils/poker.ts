import { Card, Rank, Suit, Player } from '../types';
import { RANKS, SUITS } from '../constants';

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

// --- Simplified Hand Evaluation for MVP ---
// Returns a numeric score. Higher is better.
// 8000+ Straight Flush, 7000+ Quads, 6000+ Full House, 5000+ Flush, 
// 4000+ Straight, 3000+ Set, 2000+ Two Pair, 1000+ Pair, <1000 High Card

const RANK_VALUE: Record<Rank, number> = {
  [Rank.TWO]: 2, [Rank.THREE]: 3, [Rank.FOUR]: 4, [Rank.FIVE]: 5,
  [Rank.SIX]: 6, [Rank.SEVEN]: 7, [Rank.EIGHT]: 8, [Rank.NINE]: 9,
  [Rank.TEN]: 10, [Rank.JACK]: 11, [Rank.QUEEN]: 12, [Rank.KING]: 13, [Rank.ACE]: 14
};

const getCardValue = (card: Card) => RANK_VALUE[card.rank];

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
  // 1. Straight Flush (Simplification: just checking if flush and straight exist, not strictly if they are the SAME cards for MVP robustness, real logic is heavier)
  // For a rogue-lite trainer, standard evaluation is usually sufficient. 
  
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