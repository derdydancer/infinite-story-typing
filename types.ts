export enum GameState {
  Waiting,
  Loading,
  Ready,
  Typing,
  Finished,
  GameOver
}

export interface Quest {
  id: number;
  description: string;
  points: number;
  state: 'active' | 'completed' | 'new' | 'failed';
}

export interface Stats {
  wpm: number;
  accuracy: number;
  charsTyped: number;
  mistakes: number;
  lives: number;
  flawlessStreak: number;
  score: number;
}

export interface StorySegment {
  id: number;
  prompt: string; // The original prompt text for this segment
  userInput: string; // The user's final input
  filledWord: string | null; // The word the user filled in, if any
}

export interface ImageEntity {
  name: string;
  description: string;
  isPresent: boolean;
}
