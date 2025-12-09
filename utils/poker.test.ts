import { evaluateHand, gradeStartingHand, determineWinner } from './poker';
import { Card, Suit, Rank, Player } from '../types';

declare var describe: any;
declare var test: any;

// Mock Card Helper
const c = (rank: Rank, suit: Suit): Card => ({ rank, suit, id: `${rank}${suit}` });

describe('Poker Logic Tests', () => {

  test('gradeStartingHand: AA should be S tier', () => {
    const hand = [c(Rank.ACE, Suit.SPADES), c(Rank.ACE, Suit.HEARTS)];
    const result = gradeStartingHand(hand);
    if (result.grade !== 'S') throw new Error(`Expected Grade S for AA, got ${result.grade}`);
  });

  test('gradeStartingHand: 72o should be F tier', () => {
    const hand = [c(Rank.SEVEN, Suit.CLUBS), c(Rank.TWO, Suit.HEARTS)];
    const result = gradeStartingHand(hand);
    if (result.grade !== 'F') throw new Error(`Expected Grade F for 72o, got ${result.grade}`);
  });

  test('evaluateHand: Flush detection', () => {
    const hole = [c(Rank.TWO, Suit.HEARTS), c(Rank.THREE, Suit.HEARTS)];
    const comm = [
        c(Rank.FIVE, Suit.HEARTS),
        c(Rank.NINE, Suit.HEARTS),
        c(Rank.KING, Suit.HEARTS),
        c(Rank.ACE, Suit.SPADES),
        c(Rank.FOUR, Suit.CLUBS)
    ];
    const result = evaluateHand(hole, comm);
    if (result.description !== "Flush") throw new Error(`Expected Flush, got ${result.description}`);
  });

  test('evaluateHand: Full House detection', () => {
    const hole = [c(Rank.KING, Suit.HEARTS), c(Rank.KING, Suit.CLUBS)];
    const comm = [
        c(Rank.FIVE, Suit.HEARTS),
        c(Rank.FIVE, Suit.CLUBS),
        c(Rank.FIVE, Suit.SPADES),
        c(Rank.TWO, Suit.SPADES),
        c(Rank.THREE, Suit.CLUBS)
    ];
    // K K 5 5 5 -> Full House
    const result = evaluateHand(hole, comm);
    if (result.description !== "Full House") throw new Error(`Expected Full House, got ${result.description}`);
  });

  test('determineWinner: High score wins', () => {
    const player1: Player = {
        id: '1', name: 'P1', chips: 100, hand: [c(Rank.ACE, Suit.SPADES), c(Rank.KING, Suit.SPADES)],
        isActive: true, isHuman: false, isAllIn: false, currentBet: 0, position: 'BTN'
    };
    const player2: Player = {
        id: '2', name: 'P2', chips: 100, hand: [c(Rank.TWO, Suit.CLUBS), c(Rank.THREE, Suit.HEARTS)],
        isActive: true, isHuman: false, isAllIn: false, currentBet: 0, position: 'SB'
    };
    
    // Board: 5 6 7 8 9 (Straight on board? No wait.)
    // Board: A A 2 2 4
    const comm = [c(Rank.ACE, Suit.HEARTS), c(Rank.ACE, Suit.CLUBS), c(Rank.TWO, Suit.DIAMONDS), c(Rank.TWO, Suit.SPADES), c(Rank.FOUR, Suit.HEARTS)];
    
    // P1: A A A K 2 -> Full House (A over 2)
    // P2: A A 2 2 2 -> Full House (2 over A) -> Actually wait.
    // P1 Full House: Aces full of 2s.
    // P2 Full House: Aces full of 2s.
    // Wait P1 has K kicker for the aces? No full house is 5 cards.
    // P1: A A A 2 2.
    // P2: A A 2 2 2.
    // P1 wins because Aces > 2s for the trip part.
    
    const winners = determineWinner([player1, player2], comm);
    if (winners.length !== 1 || winners[0].id !== '1') throw new Error('Player 1 should win with better Full House');
  });

});