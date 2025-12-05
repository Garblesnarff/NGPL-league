export enum Suit {
  HEARTS = '♥',
  DIAMONDS = '♦',
  CLUBS = '♣',
  SPADES = '♠'
}

export enum Rank {
  TWO = '2', THREE = '3', FOUR = '4', FIVE = '5', SIX = '6', SEVEN = '7',
  EIGHT = '8', NINE = '9', TEN = '10', JACK = 'J', QUEEN = 'Q', KING = 'K', ACE = 'A'
}

export interface Card {
  suit: Suit;
  rank: Rank;
  id: string; // Unique ID for React keys
}

export enum GamePhase {
  MENU = 'MENU',
  SHOP = 'SHOP',
  PRE_FLOP = 'PRE_FLOP',
  FLOP = 'FLOP',
  TURN = 'TURN',
  RIVER = 'RIVER',
  SHOWDOWN = 'SHOWDOWN',
  GAME_OVER = 'GAME_OVER'
}

export interface Player {
  id: string;
  name: string;
  chips: number;
  hand: Card[];
  isHuman: boolean;
  isActive: boolean; // Not folded
  isAllIn: boolean;
  currentBet: number;
  position: string; // "SB", "BB", "BTN", etc.
  personality?: string; // For AI generation context
  avatarSeed?: number;
}

export interface GameState {
  phase: GamePhase;
  pot: number;
  communityCards: Card[];
  deck: Card[];
  players: Player[];
  currentPlayerIndex: number;
  dealerIndex: number;
  minBet: number;
  currentBet: number; // The amount to call
  lastRaiserIndex: number | null;
  roundLog: string[];
  deckColor: string;
  winners?: Player[];         // NEW: Track who won the last hand
  winningHandDesc?: string;   // NEW: Description of winning hand (e.g. "Full House")
}

export interface Perk {
  id: string;
  name: string;
  description: string;
  cost: number;
  type: 'PASSIVE' | 'CONSUMABLE';
  effect: (state: GameState) => void;
}

export interface CoachAdvice {
  action: string;
  reasoning: string;
  winProbability?: string;
  potOdds?: string;
}