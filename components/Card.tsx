import React from 'react';
import { Card as CardType, Suit } from '../types';

interface CardProps {
  card: CardType | null; // Null means face down
  hidden?: boolean;
  className?: string;
  tiny?: boolean;
}

const Card: React.FC<CardProps> = ({ card, hidden, className = '', tiny = false }) => {
  if (hidden || !card) {
    return (
      <div 
        className={`
          ${tiny ? 'w-8 h-12' : 'w-16 h-24 sm:w-20 sm:h-28'} 
          bg-indigo-900 border-2 border-indigo-400 rounded-lg shadow-md 
          flex items-center justify-center 
          bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]
          ${className}
        `}
      >
        <div className="w-full h-full opacity-20 bg-indigo-500 rounded-md"></div>
      </div>
    );
  }

  const isRed = card.suit === Suit.HEARTS || card.suit === Suit.DIAMONDS;

  return (
    <div 
      className={`
        ${tiny ? 'w-8 h-12 text-xs' : 'w-16 h-24 sm:w-20 sm:h-28 text-lg sm:text-2xl'}
        bg-white rounded-lg shadow-xl border border-gray-300
        flex flex-col items-center justify-between p-1 select-none
        transform hover:-translate-y-2 transition-transform duration-200
        ${className}
      `}
    >
      <div className={`self-start font-bold leading-none ${isRed ? 'text-red-600' : 'text-slate-900'}`}>
        {card.rank}
        <div className="text-[0.6em]">{card.suit}</div>
      </div>
      
      <div className={`text-2xl sm:text-4xl ${isRed ? 'text-red-600' : 'text-slate-900'}`}>
        {card.suit}
      </div>

      <div className={`self-end font-bold leading-none rotate-180 ${isRed ? 'text-red-600' : 'text-slate-900'}`}>
        {card.rank}
        <div className="text-[0.6em]">{card.suit}</div>
      </div>
    </div>
  );
};

export default Card;