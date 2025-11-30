import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';

// Example script demonstrating ai.models.generateContent with a tools config
// Usage: Set process.env.GENAI_KEY or replace the placeholder below with a key.

const apiKey = process.env.GENAI_KEY || '<YOUR_KEY_HERE>';
if (apiKey === '<YOUR_KEY_HERE>') {
  throw new Error('Please set GENAI_KEY environment variable or replace the placeholder with your API key.');
}
// Use v1 Live/Models API by default, override with GENAI_API_URL/GENAI_API_VERSION if needed
// Let the SDK choose the correct endpoint automatically — do not pass apiUrl/apiVersion.
import { createGeminiClientOptions } from '../gemini.config';
const ai = new GoogleGenAI(
  createGeminiClientOptions(apiKey) as any
);

const controlLightDeclaration: FunctionDeclaration = {
  name: 'controlLight',
  description: 'Set brightness and color temperature of a light.',
  parameters: {
    type: Type.OBJECT,
    description: 'Control parameters for a smart light',
    properties: {
      brightness: { type: Type.NUMBER, description: 'Light level from 0 to 100.' },
      colorTemperature: { type: Type.STRING, description: '`daylight`, `cool`, or `warm`.' },
    },
    required: ['brightness', 'colorTemperature'],
  },
};

async function run() {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      contents: 'Dim the lights so the room feels cozy and warm.',
      config: {
        tools: [{ functionDeclarations: [controlLightDeclaration] }]
      }
    });

    const responseText = (response as any).text || JSON.stringify(response);
    console.log('Response text (if any):', responseText);

    // If model invoked the tool, functionCalls (or a similar field) should be present — log it
    if ((response as any).functionCalls) {
      console.log(
        'Function calls:',
        JSON.stringify((response as any).functionCalls, null, 2)
      );
    }

  } catch (err) {
    console.error('Example generateContent failed', err);
  }
}

run();
