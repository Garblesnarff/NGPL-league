import { GoogleGenAI } from "@google/genai";
import { CoachAdvice, Player, Card, GamePhase } from '../types';

// Safely retrieve API Key
const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const getPokerAdvice = async (
  playerHand: Card[],
  board: Card[],
  potSize: number,
  betToCall: number,
  myStack: number,
  phase: GamePhase,
  opponents: Player[]
): Promise<CoachAdvice> => {
  if (!apiKey) {
    return {
      action: "Error",
      reasoning: "API Key missing. Please configure process.env.API_KEY.",
      winProbability: "Unknown"
    };
  }

  const activeOpponents = opponents.filter(o => o.isActive && !o.isHuman).length;
  const handStr = playerHand.map(c => `${c.rank}${c.suit}`).join(',');
  const boardStr = board.map(c => `${c.rank}${c.suit}`).join(',');

  const prompt = `
    You are a world-class poker coach (channeling the wisdom of legends like Doyle Brunson, Daniel Negreanu, and Phil Ivey).
    Analyze the current Texas Hold'em situation and provide the best move.
    
    Context:
    - Player Hand: [${handStr}]
    - Community Cards (Board): [${boardStr}]
    - Pot Size: ${potSize} chips
    - Cost to Call: ${betToCall} chips
    - Player Stack: ${myStack} chips
    - Active Opponents: ${activeOpponents}
    - Game Phase: ${phase}
    
    Provide the response in strict JSON format with the following keys:
    - action: "FOLD", "CHECK", "CALL", or "RAISE"
    - reasoning: A short, witty, 2-sentence explanation. Try to channel the wisdom of poker legends or cite specific concepts like 'Gap Theory', 'Implied Odds', or 'Position' where relevant.
    - winProbability: An estimated percentage string (e.g., "45%").
    - potOdds: The pot odds expressed as a ratio (e.g., "3:1") if applicable.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    const advice = JSON.parse(text) as CoachAdvice;
    return advice;

  } catch (error) {
    console.error("Gemini API Error:", error);
    return {
      action: "Thinking...",
      reasoning: "The coach is pondering the orb. (API Error)",
      winProbability: "??%"
    };
  }
};

export const generateOpponentBanter = async (situation: string): Promise<string> => {
    if (!apiKey) return "Let's play!";
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Generate a short, funny poker table banter line for a casual home game. Situation: ${situation}. Max 10 words.`,
        });
        return response.text || "Check!";
    } catch (e) {
        return "Your turn.";
    }
}