import { GoogleGenAI, Type, Modality } from "@google/genai";
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

// A 1x1 transparent PNG to use as a base for image generation with the editing model.
const BLANK_IMAGE_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

export const generateImage = async (prompt: string): Promise<string | null> => {
    console.log('Requesting image generation with flash model for prompt:', prompt);
    try {
        // We use the image editing model to "generate" an image by giving it a blank canvas
        // and a detailed prompt describing what to create. This is a creative way to use
        // a "free tier" model for image creation.
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: {
                parts: [
                    {
                        inlineData: {
                            data: BLANK_IMAGE_BASE64,
                            mimeType: 'image/png',
                        },
                    },
                    {
                        text: `Create this scene from scratch on this blank canvas: ${prompt}`,
                    },
                ],
            },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });

        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                const base64ImageBytes: string = part.inlineData.data;
                const mimeType = part.inlineData.mimeType;
                console.log('Image generated successfully via editing model.');
                return `data:${mimeType};base64,${base64ImageBytes}`;
            }
        }
        console.warn('Image generation call succeeded but no image part was found in response.');
        return null;
    } catch (error) {
        console.error('Image generation with flash model failed:', error);
        return null;
    }
};
