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
  "Cody",
  "Rob",
  "Devin",
  "Noah",
  "Pat",
  "Cody A"
];

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