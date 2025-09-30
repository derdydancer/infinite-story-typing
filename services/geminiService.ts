import { GoogleGenAI, Type } from "@google/genai";
import type { Quest } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  // In a real app, you might want to show a more user-friendly error
  // but for this environment, throwing an error is sufficient.
  console.error("API_KEY environment variable not set. The app will not function.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });

export const generateStorySegment = async (storyHistory: string[], isFlawless: boolean): Promise<string> => {
  console.log('Generating new story segment...');
  let prompt: string;

  if (storyHistory.length === 0) {
    prompt = "Write the first sentence of a new story (5-15 words).";
  } else {
    const fullStory = storyHistory.join(" ");
    const lastTypedSentence = storyHistory[storyHistory.length - 1];
    
    // Check if there were actual typos by comparing the last typed sentence to its prompt
    // This logic resides in App.tsx now, so we can simplify here. We'll trust the isFlawless flag.
    const hasTypos = !isFlawless && storyHistory.length > 0;


    if (isFlawless) {
      // Flawless typing, reward with a blank.
      prompt = `
Continue the following story. For the next sentence, leave one important Noun blank using "___" as a placeholder.

Story so far:
"${fullStory}"

Generate the next short sentence (5-15 words) with one blank Noun. Return only the sentence.
`;
    } else if (hasTypos) {
      // Typing had mistakes, incorporate them.
      prompt = `
Continue the following story. The last sentence was typed by a user and contains typos. Creatively incorporate the typos into the story's continuation by interpreting them as meaningful.

Story so far:
"${fullStory}"

User's last sentence (with typos):
"${lastTypedSentence}"

Generate the next short sentence (5-15 words) of the story. Return only the sentence.
`;
    } else {
       // No typos, just continue the story normally.
       prompt = `
Continue the following story.

Story so far:
"${fullStory}"

Generate the next short sentence (5-15 words). Return only the sentence.`;
    }
  }
  
  console.log('Prompt sent to Gemini:', prompt);

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
          temperature: 0.8,
          topP: 0.9,
      }
    });
    
    console.log('Raw response from Gemini:', response);
    let text = response.text.trim();
    if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
      text = text.substring(1, text.length - 1);
    }
    console.log('Cleaned text from AI:', text);
    return text;
  } catch (error) {
    console.error("Gemini API call failed:", error);
    return "The old machine sputtered and died. The story ends here... for now. (API Error)";
  }
};

const questSchema = {
  type: Type.OBJECT,
  properties: {
    description: { type: Type.STRING, description: "A very short quest description, 1-7 words long." },
    points: { type: Type.INTEGER },
  },
  required: ['description', 'points'],
};

export const generateInitialQuests = async (storySoFar: string): Promise<Omit<Quest, 'id' | 'state'>[]> => {
  console.log('Generating initial quests...');
  const prompt = `Based on the beginning of this story, generate 3 creative quests.
Each quest description must be very short (1-7 words), and start with an emoji.
For each quest, provide a description and a point value between 5 and 20.
The quests need to be challenging, they should NOT just be the next logical step such as "enter the room", but something different such as "avoid the room". 
The quests need to be varied, such that they take the story in wildly different direction. Even changing the whole tone or trajectory of the story.
The quests must be tangibloe and clear. Not "Find the source of the silence", but instead "Grab someone by the neck".
Story:
"${storySoFar}"

Generate 3 quests.`;
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            quests: {
              type: Type.ARRAY,
              items: questSchema,
            },
          },
        },
      },
    });

    const json = JSON.parse(response.text);
    console.log('Generated initial quests:', json.quests);
    return json.quests || [];
  } catch (error) {
    console.error("Gemini API call for initial quests failed:", error);
    return [];
  }
};


export const evaluateQuests = async (storySoFar: string, activeQuests: Quest[]): Promise<{ completedQuestIds: number[], failedQuestIds: number[] }> => {
    console.log('Evaluating quests...');
    const fallback = { completedQuestIds: [], failedQuestIds: [] };
    if (activeQuests.length === 0) return fallback;

    const prompt = `Based on the story provided, determine which quests are completed and which are failed.
- A quest is COMPLETED if the last sentence of the story explicitly states it has happened.
- A quest is FAILED if the last sentence of the story WITHOUT A DOUBT makes it impossible or irrelevant. 

Story:
"${storySoFar}"

Active Quests (with their IDs):
${activeQuests.map(q => `- ID ${q.id}: ${q.description}`).join('\n')}

Return a JSON object containing two arrays of integer IDs: "completedQuestIds" and "failedQuestIds".`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        completedQuestIds: {
                            type: Type.ARRAY,
                            items: { type: Type.INTEGER }
                        },
                        failedQuestIds: {
                            type: Type.ARRAY,
                            items: { type: Type.INTEGER }
                        }
                    }
                }
            }
        });
        const json = JSON.parse(response.text);
        console.log('Quest evaluation response:', json);
        return { completedQuestIds: json.completedQuestIds || [], failedQuestIds: json.failedQuestIds || [] };
    } catch(error) {
        console.error("Gemini API call for quest evaluation failed:", error);
        return fallback;
    }
}


export const generateReplacementQuest = async (storySoFar: string, existingQuests: Quest[]): Promise<Omit<Quest, 'id' | 'state'> | null> => {
    console.log('Generating replacement quest...');
    const prompt = `Based on the story so far, generate ONE new, creative quest.
Each quest description must be very short (1-7 words), and start with an emoji.
For each quest, provide a description and a point value between 5 and 20.
The quests need to be challenging, they should NOT just be the next logical step such as "enter the room", but something different such as "avoid the room". 
The quests need to be varied, such that they take the story in wildly different direction. Even changing the whole tone or trajectory of the story.
The quests must be tangibloe and clear. Not "Find the source of the silence", but instead "Grab someone by the neck".
Avoid generating quests similar to the ones already listed.

Story:
"${storySoFar}"

Existing Quests:
${existingQuests.map(q => `- ${q.description}`).join('\n')}

Generate one new quest.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: questSchema,
            }
        });
        const json = JSON.parse(response.text);
        console.log('Generated replacement quest:', json);
        return json;
    } catch (error) {
        console.error("Gemini API call for replacement quest failed:", error);
        return null;
    }
};