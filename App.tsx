import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameState } from './types';
import type { Stats, StorySegment, Quest, ImageEntity } from './types';
import { 
  generateStorySegment,
  generateInitialQuests,
  evaluateQuests,
  generateReplacementQuest,
} from './services/geminiService';
import {
  updateEntities,
  generateImagePrompt,
  generateImage,
} from './services/imageService';
import Header from './components/Header';
import StatsDisplay from './components/StatsDisplay';
import TypingArea from './components/TypingArea';
import LoadingSpinner from './components/LoadingSpinner';
import StoryHistory from './components/StoryHistory';
import QuestsDisplay from './components/QuestsDisplay';
import FloatingPoints from './components/FloatingPoints';
import ImageViewer from './components/ImageViewer';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.Waiting);
  const [promptText, setPromptText] = useState<string>('');
  const [userInput, setUserInput] = useState<string>('');
  const [storyHistory, setStoryHistory] = useState<StorySegment[]>([]);
  const [stats, setStats] = useState<Stats>({ wpm: 0, accuracy: 100, charsTyped: 0, mistakes: 0, lives: 3, flawlessStreak: 0, score: 0 });
  const [quests, setQuests] = useState<Quest[]>([]);
  const [floatingPoints, setFloatingPoints] = useState<{ points: number, id: number }>({ points: 0, id: 0 });

  // State for fill-in-the-blank feature
  const [blankIndex, setBlankIndex] = useState<number | null>(null);
  const [promptBeforeBlank, setPromptBeforeBlank] = useState<string>('');
  const [promptAfterBlank, setPromptAfterBlank] = useState<string>('');
  
  // State for image generation
  const [characters, setCharacters] = useState<ImageEntity[]>([]);
  const [locations, setLocations] = useState<ImageEntity[]>([]);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [isImageLoading, setIsImageLoading] = useState<boolean>(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef<number | null>(null);
  const totalCharsTypedRef = useRef<number>(0);
  const totalMistakesRef = useRef<number>(0);
  const mistakesAtSegmentStart = useRef<number>(0);
  const filledWordRef = useRef<string | null>(null);
  const finalPromptRef = useRef<string>('');
  const isEvaluatingQuests = useRef(false);

  // Log game state changes for easier debugging
  useEffect(() => {
    console.log(`%cGame State changed to: ${GameState[gameState]}`, 'color: #22d3ee; font-weight: bold;');
  }, [gameState]);

  // Effect to check for game over condition
  useEffect(() => {
    if (stats.lives <= 0 && gameState !== GameState.Waiting && gameState !== GameState.GameOver) {
      console.log("--- GAME OVER ---");
      setGameState(GameState.GameOver);
    }
  }, [stats.lives, gameState]);

  const processQuestUpdates = useCallback(async (storySoFarText: string) => {
    if (isEvaluatingQuests.current) return;
    
    const activeQuests = quests.filter(q => q.state === 'active');
    if (activeQuests.length === 0) return;

    isEvaluatingQuests.current = true;
    
    try {
      const { completedQuestIds, failedQuestIds } = await evaluateQuests(storySoFarText, activeQuests);
      const allAffectedIds = [...completedQuestIds, ...failedQuestIds];

      if (allAffectedIds.length > 0) {
        let pointsScored = 0;
        const updatedQuests = quests.map(q => {
          if (completedQuestIds.includes(q.id)) {
            pointsScored += q.points;
            return { ...q, state: 'completed' as const };
          }
          if (failedQuestIds.includes(q.id)) {
            return { ...q, state: 'failed' as const };
          }
          return q;
        });

        setQuests(updatedQuests);

        if (pointsScored > 0) {
          setStats(prev => ({ ...prev, score: prev.score + pointsScored }));
          setFloatingPoints({ points: pointsScored, id: Date.now() });
        }

        // Replace completed and failed quests
        allAffectedIds.forEach(async (id) => {
          const replacement = await generateReplacementQuest(storySoFarText, updatedQuests);
          if (replacement) {
            const newQuest: Quest = {
              ...replacement,
              id: Date.now() + Math.random(),
              state: 'new',
            };
            setQuests(prevQuests => [...prevQuests.filter(q => q.id !== id), newQuest]);
          } else {
             setQuests(prevQuests => prevQuests.filter(q => q.id !== id));
          }
        });
      }
    } catch (error) {
      console.error("Error during quest evaluation process:", error);
    } finally {
      isEvaluatingQuests.current = false;
    }
  }, [quests]);

  const startNewSegment = useCallback(async (currentHistory: StorySegment[]) => {
    const mistakesThisSegment = totalMistakesRef.current - mistakesAtSegmentStart.current;
    
    // For the very first segment, it's not considered a flawless "round"
    const isFlawlessForPrompt = currentHistory.length > 0 && mistakesThisSegment === 0;

    console.log('Starting new segment. Flawless round:', isFlawlessForPrompt);
    setGameState(GameState.Loading);
    setUserInput('');
    startTimeRef.current = null;
    setBlankIndex(null);
    filledWordRef.current = null;
    mistakesAtSegmentStart.current = totalMistakesRef.current;
  
    try {
      const historyText = currentHistory.map(s => s.userInput);
      // Determine if there are actual typos to send to the AI
      const lastSegment = currentHistory[currentHistory.length - 1];
      const hadTypos = lastSegment && lastSegment.userInput !== lastSegment.prompt;
      
      const newSegment = await generateStorySegment(historyText, isFlawlessForPrompt && !hadTypos);
      console.log('New segment received:', newSegment);
      
      if (currentHistory.length === 0) {
        generateInitialQuests(newSegment).then(newQuestsData => {
            const initialQuests: Quest[] = newQuestsData.map((q, i) => ({
                ...q,
                id: Date.now() + i,
                state: 'new'
            }));
            setQuests(initialQuests);
        });
      }
      
      finalPromptRef.current = newSegment;
      const blankIdx = newSegment.indexOf('___');

      if (blankIdx !== -1) {
        console.log('Fill-in-the-blank detected at index:', blankIdx);
        setBlankIndex(blankIdx);
        setPromptBeforeBlank(newSegment.substring(0, blankIdx));
        setPromptAfterBlank(newSegment.substring(blankIdx + 3));
      }

      setPromptText(newSegment);
      setGameState(GameState.Ready);
    } catch (error) {
      console.error("Failed to start new segment:", error);
      setPromptText("Error loading story. Please try refreshing.");
      setGameState(GameState.Waiting);
    }
  }, []);

  useEffect(() => {
    const newQuests = quests.filter(q => q.state === 'new');
    if (newQuests.length > 0) {
      const timer = setTimeout(() => {
        setQuests(prev => prev.map(q => (q.state === 'new' ? { ...q, state: 'active' } : q)));
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [quests]);

  useEffect(() => {
    if (gameState === GameState.Ready && inputRef.current) {
      console.log('Focusing input field.');
      inputRef.current.focus();
    }
  }, [gameState]);

  const updateAndGenerateImage = useCallback(async (storySoFar: string, latestSegment: string) => {
    if (!storySoFar) return;
    setIsImageLoading(true);

    try {
      // 1. Update entities
      const updated = await updateEntities(storySoFar, characters, locations);
      setCharacters(updated.characters);
      setLocations(updated.locations);
      
      const presentCharacters = updated.characters.filter(c => c.isPresent);
      const presentLocations = updated.locations.filter(l => l.isPresent);
      
      // Only generate an image if there's something to show
      if (presentCharacters.length > 0 || presentLocations.length > 0) {
        // 2. Generate prompt
        const imagePrompt = await generateImagePrompt(latestSegment, presentCharacters, presentLocations);
        
        // 3. Generate image
        if (imagePrompt) {
          const imageUrl = await generateImage(imagePrompt);
          if (imageUrl) {
            setCurrentImageUrl(imageUrl);
          }
        }
      }
    } catch (error) {
      console.error("Image generation pipeline failed:", error);
    } finally {
      setIsImageLoading(false);
    }
  }, [characters, locations]);

  useEffect(() => {
    if (gameState === GameState.Finished) {
      console.log('Segment finished. Appending to history.');
      
      const mistakesThisSegment = totalMistakesRef.current - mistakesAtSegmentStart.current;
      const wasFlawless = mistakesThisSegment === 0;
      
      console.log(`Segment completed. Mistakes this segment: ${mistakesThisSegment}. Flawless: ${wasFlawless}`);

      if (wasFlawless) {
        setStats(prev => {
          const newStreak = prev.flawlessStreak + 1;
          const newLives = newStreak >= 3 ? Math.min(5, prev.lives + 1) : prev.lives;
          if (newLives > prev.lives) console.log(`Life gained! Streak: ${newStreak}, New life total: ${newLives}`);
          return { ...prev, flawlessStreak: newStreak, lives: newLives };
        });
      } else {
        setStats(prev => ({ ...prev, flawlessStreak: 0 }));
      }
      
      const newSegment: StorySegment = {
        id: Date.now(),
        prompt: finalPromptRef.current,
        userInput: userInput,
        filledWord: filledWordRef.current,
      };

      const newHistory = [...storyHistory, newSegment];
      console.log('Updating story history. New length:', newHistory.length);
      setStoryHistory(newHistory);

      const fullStoryText = newHistory.map(s => s.userInput).join(' ');
      processQuestUpdates(fullStoryText);
      
      updateAndGenerateImage(fullStoryText, newSegment.userInput);
      
      startNewSegment(newHistory);
    }
  }, [gameState, storyHistory, userInput, startNewSegment, processQuestUpdates, updateAndGenerateImage]);

  const calculateStats = useCallback(() => {
    if (startTimeRef.current === null) return;
    
    const elapsedTime = (Date.now() - startTimeRef.current) / 1000 / 60;
    if (elapsedTime <= 0) return;

    const grossWpm = (totalCharsTypedRef.current / 5) / elapsedTime;

    const accuracy = totalCharsTypedRef.current > 0 
      ? Math.max(0, ((totalCharsTypedRef.current - totalMistakesRef.current) / totalCharsTypedRef.current) * 100)
      : 100;

    setStats(prev => ({
      ...prev,
      wpm: isNaN(grossWpm) ? 0 : grossWpm,
      accuracy: isNaN(accuracy) ? 100 : accuracy,
      charsTyped: totalCharsTypedRef.current,
      mistakes: totalMistakesRef.current
    }));
  }, []);
  
  useEffect(() => {
      if (gameState === GameState.Typing) {
          const interval = setInterval(calculateStats, 1000);
          return () => clearInterval(interval);
      }
  }, [gameState, calculateStats]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    if (gameState === GameState.Finished || gameState === GameState.Loading || gameState === GameState.GameOver) return;
    
    if (gameState === GameState.Ready && value.length > 0) {
      setGameState(GameState.Typing);
      if (!startTimeRef.current) {
        console.log('Timer started.');
        startTimeRef.current = Date.now();
      }
    }

    let finalPrompt = promptText;
    let finalInput = value;

    if (blankIndex !== null && value.length >= blankIndex) {
        const wordBeingTyped = value.substring(blankIndex);

        // Case: Finished with a space
        if (wordBeingTyped.endsWith(' ') && wordBeingTyped.trim().length > 0) {
            const finalWord = wordBeingTyped.trim();
            console.log('Blank word finished:', finalWord);
            filledWordRef.current = finalWord;
            finalPrompt = promptBeforeBlank + finalWord + promptAfterBlank;
            finalPromptRef.current = finalPrompt;
            
            // If punctuation follows, don't insert a space, let user type it.
            const isPunctuationNext = promptAfterBlank.length > 0 && /[.,!?;:]/.test(promptAfterBlank[0]);
            finalInput = promptBeforeBlank + finalWord + (isPunctuationNext ? '' : ' ');
            
            setPromptText(finalPrompt);
            setBlankIndex(null);
            console.log('Exited fill-in-the-blank mode.');
        } 
        // Case: Finished with punctuation
        else if (!wordBeingTyped.includes(' ') && promptAfterBlank.length > 0 && wordBeingTyped.endsWith(promptAfterBlank[0])) {
            const finalWord = wordBeingTyped.slice(0, -1);
            if (finalWord.length > 0) {
                console.log('Blank word finished via punctuation:', finalWord);
                filledWordRef.current = finalWord;
                finalPrompt = promptBeforeBlank + finalWord + promptAfterBlank;
                finalPromptRef.current = finalPrompt;
                finalInput = value; // Value includes the punctuation
                
                setPromptText(finalPrompt);
                setBlankIndex(null);
            }
        }
        // Case: Still typing in the blank
        else if (!wordBeingTyped.includes(' ')) {
             finalPrompt = promptBeforeBlank + wordBeingTyped + promptAfterBlank;
             setPromptText(finalPrompt);
        }
    }
    
    if (finalInput.length > finalPrompt.length) {
        if (userInput.length < finalPrompt.length) {
          setUserInput(finalPrompt);
          setGameState(GameState.Finished);
        }
        return;
    }

    if (finalInput.length > userInput.length) {
        totalCharsTypedRef.current++;
        if (finalInput.slice(-1) !== finalPrompt[finalInput.length - 1]) {
            totalMistakesRef.current++;
            console.log('Mistake detected. New total:', totalMistakesRef.current);
            setStats(prev => ({...prev, lives: prev.lives - 1, mistakes: totalMistakesRef.current }));
        }
    }

    setUserInput(finalInput);

    if (finalInput.length === finalPrompt.length) {
      calculateStats();
      setGameState(GameState.Finished);
    }
  };
  
  const handleStartClick = () => {
    console.log('--- NEW GAME STARTED ---');
    setStoryHistory([]);
    setStats({ wpm: 0, accuracy: 100, charsTyped: 0, mistakes: 0, lives: 3, flawlessStreak: 0, score: 0 });
    setQuests([]);
    setCharacters([]);
    setLocations([]);
    setCurrentImageUrl(null);
    setIsImageLoading(false);
    totalCharsTypedRef.current = 0;
    totalMistakesRef.current = 0;
    startTimeRef.current = null;
    filledWordRef.current = null;
    startNewSegment([]);
  }
  
  const renderGameArea = () => {
      switch(gameState) {
          case GameState.Waiting:
              return (
                  <div className="text-center">
                      <button 
                          onClick={handleStartClick}
                          className="bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold py-3 px-8 rounded-lg text-xl transition-transform transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-cyan-300"
                          aria-label="Start a new game"
                      >
                          Start Typing
                      </button>
                  </div>
              );
          case GameState.GameOver:
              return (
                 <div className="text-center bg-slate-800 p-8 rounded-lg">
                    <h2 className="text-4xl font-bold text-rose-500 mb-2">Game Over</h2>
                    <p className="text-slate-400 mb-6">You've run out of lives. Better luck next time!</p>
                    <button 
                        onClick={handleStartClick}
                        className="bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold py-3 px-8 rounded-lg text-xl transition-transform transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-cyan-300"
                        aria-label="Play again"
                    >
                        Play Again
                    </button>
                </div>
              );
          case GameState.Loading:
              return <LoadingSpinner />;
          case GameState.Ready:
          case GameState.Typing:
          case GameState.Finished:
              return (
                <div onClick={() => inputRef.current?.focus()} className="cursor-text" role="textbox" tabIndex={0} onFocus={() => inputRef.current?.focus()}>
                  <TypingArea prompt={promptText} userInput={userInput} />
                  <input
                      ref={inputRef}
                      type="text"
                      value={userInput}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                      className="absolute w-px h-px p-0 m-[-1px] border-0 overflow-hidden"
                      style={{ clip: 'rect(0, 0, 0, 0)'}}
                      autoFocus
                      onBlur={() => { if (gameState === GameState.Typing || gameState === GameState.Ready) inputRef.current?.focus() }}
                      aria-label="Type the story here"
                  />
                </div>
              );
          default:
            return null;
      }
  }

  return (
    <div className="min-h-screen flex flex-col items-center p-4 sm:p-8 pt-8 md:pt-16 selection:bg-cyan-400/30">
      <div className="w-full max-w-7xl">
        <Header />
        <div className="relative w-full max-w-5xl mx-auto">
          <StatsDisplay stats={stats} />
          <FloatingPoints points={floatingPoints.points} id={floatingPoints.id} />
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-4">
            <div className="lg:col-span-2">
                 <StoryHistory history={storyHistory} />
                 {renderGameArea()}
                 {(gameState === GameState.Typing || gameState === GameState.Ready) &&
                  <div className="text-center mt-6 text-slate-500">
                    <p>Click the text box or start typing to play.</p>
                  </div>
                }
            </div>
            <div className="lg:col-span-1 row-start-1 lg:row-start-auto">
                <ImageViewer imageUrl={currentImageUrl} isLoading={isImageLoading} />
                <QuestsDisplay quests={quests} />
            </div>
        </div>
      </div>
    </div>
  );
};

export default App;
