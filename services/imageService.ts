import { GoogleGenAI, Type } from "@google/genai";
import type { ImageEntity } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error("API_KEY environment variable not set for image service.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });

const imageEntitySchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    description: { type: Type.STRING, description: "A detailed physical description suitable for an image prompt." },
    isPresent: { type: Type.BOOLEAN, description: "True if the entity is active in the last two sentences of the story." },
  },
  required: ['name', 'description', 'isPresent'],
};

const entitiesSchema = {
  type: Type.OBJECT,
  properties: {
    characters: {
      type: Type.ARRAY,
      items: imageEntitySchema,
    },
    locations: {
      type: Type.ARRAY,
      items: imageEntitySchema,
    },
  },
};

export const updateEntities = async (
  storySoFar: string,
  characters: ImageEntity[],
  locations: ImageEntity[]
): Promise<{ characters: ImageEntity[]; locations: ImageEntity[] }> => {
  console.log('Updating image generation entities...');
  const fallback = { characters, locations };

  const prompt = `Analyze the story to identify all characters and locations.
- Update descriptions for existing entities if new details are revealed in the story.
- Add any new entities discovered.
- Maintain existing descriptions if no new information is available.
- For each entity, provide a detailed physical description suitable for an image generation prompt.
- Set 'isPresent' to true if the entity is mentioned or seems physically present in the LAST TWO sentences of the story, otherwise false.

Story so far:
"${storySoFar}"

Existing Characters:
${JSON.stringify(characters)}

Existing Locations:
${JSON.stringify(locations)}

Return a JSON object with two keys: "characters" and "locations", containing updated arrays of all entities identified so far.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: entitiesSchema,
      },
    });
    const json = JSON.parse(response.text);
    console.log('Updated entities:', json);
    return {
        characters: json.characters || [],
        locations: json.locations || []
    };
  } catch (error) {
    console.error("Gemini API call for updating entities failed:", error);
    return fallback;
  }
};


export const generateImagePrompt = async (
    latestSegment: string,
    presentCharacters: ImageEntity[],
    presentLocations: ImageEntity[]
): Promise<string> => {
    console.log('Generating image prompt...');
    const fallback = 'A mysterious scene from a story, digital painting.';

    const locationString = presentLocations.map(l => `${l.name}: ${l.description}`).join('\n');

    const prompt = `Based on the latest story action and the described entities, create a visually rich and artistic prompt for an image generation model.

- Focus on the action in the "Latest Story Segment".
- Only include characters and locations that are currently present.
- Describe a single, coherent scene from the perspective of an observer.
- The prompt should be a comma-separated list of descriptive phrases.
- Start with the main subject, then add details about the setting and atmosphere.
- End with a style descriptor, like: "dramatic cinematic lighting, fantasy art, digital painting, hyperdetailed, epic composition".

Latest Story Segment:
"${latestSegment}"

Present Characters:
${JSON.stringify(presentCharacters)}

Present Location(s):
${locationString}

Generate the image prompt. Return only the prompt string.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        const text = response.text.trim();
        console.log('Generated image prompt:', text);
        return text;
    } catch (error) {
        console.error("Gemini API call for image prompt generation failed:", error);
        return fallback;
    }
}

export const generateImage = async (prompt: string): Promise<string | null> => {
    console.log('Requesting image generation for prompt:', prompt);
    try {
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: {
              numberOfImages: 1,
              outputMimeType: 'image/jpeg',
              aspectRatio: '16:9',
            },
        });

        if (response.generatedImages && response.generatedImages.length > 0) {
            const base64ImageBytes = response.generatedImages[0].image.imageBytes;
            console.log('Image generated successfully.');
            return `data:image/jpeg;base64,${base64ImageBytes}`;
        }
        return null;
    } catch (error) {
        console.error('Image generation failed:', error);
        return null;
    }
};
