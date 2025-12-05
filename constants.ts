import { Rank, Suit, Perk } from './types';

export const STARTING_CHIPS = 1000; // $40 buy-in equivalent representation
export const BIG_BLIND = 20;
export const SMALL_BLIND = 10;

export const RANKS: Rank[] = [
  Rank.TWO, Rank.THREE, Rank.FOUR, Rank.FIVE, Rank.SIX, Rank.SEVEN,
  Rank.EIGHT, Rank.NINE, Rank.TEN, Rank.JACK, Rank.QUEEN, Rank.KING, Rank.ACE
];

export const SUITS: Suit[] = [
  Suit.HEARTS, Suit.DIAMONDS, Suit.CLUBS, Suit.SPADES
];

export const AVATAR_URL = (seed: number) => `https://picsum.photos/seed/${seed}/100/100`;

export const FRIEND_NAMES = [
  "Nick",
  "Devin",
  "Cody A",
  "Cody",
  "Pat",
  "Noah",
  "Rob"
];

// 0.0 - 1.0 scales
export interface BotPersonality {
  vpip: number;      // Voluntarily Put Money In Pot (Looseness). High = plays many hands.
  aggression: number; // Tendency to Raise vs Call. High = Raises often.
  bluff: number;     // Tendency to bet with weak hands.
  label: string;
}

export const BOT_PROFILES: Record<string, BotPersonality> = {
  "Nick": { vpip: 0.15, aggression: 0.8, bluff: 0.2, label: "Tight-Aggressive" },
  "Devin": { vpip: 0.50, aggression: 0.9, bluff: 0.8, label: "Wild Card" },
  "Cody A": { vpip: 0.05, aggression: 0.2, bluff: 0.0, label: "The Rock" },
  "Cody": { vpip: 0.60, aggression: 0.6, bluff: 0.6, label: "Loose Cannon" },
  "Pat": { vpip: 0.30, aggression: 0.4, bluff: 0.3, label: "Rookie" },
  "Noah": { vpip: 0.80, aggression: 0.1, bluff: 0.1, label: "Calling Station" },
  "Rob": { vpip: 0.90, aggression: 0.9, bluff: 0.9, label: "Maniac" },
};

export const INITIAL_PERKS: Perk[] = [
  {
    id: 'odds_calc',
    name: 'Odds Calculator',
    description: 'Permanently displays simple pot odds during your turn.',
    cost: 150,
    type: 'PASSIVE',
    effect: () => {} // Handled in UI logic
  },
  {
    id: 'tight_image',
    name: 'Tight Table Image',
    description: 'Opponents fold 20% more often to your raises.',
    cost: 300,
    type: 'PASSIVE',
    effect: () => {} // Logic would go in AI decision making
  },
  {
    id: 'shark_glasses',
    name: 'Shark Glasses',
    description: 'Reveals one random opponent card if you reach the River.',
    cost: 500,
    type: 'PASSIVE',
    effect: () => {}
  }
];

export const AI_PERSONALITIES = [
  "Conservative Rock",
  "Loose Cannon",
  "Calling Station",
  "Aggressive Maniac"
];