import { GoogleGenAI, Modality } from "@google/genai"; // Unused imports, kept as per problem instructions.

/**
 * Generates speech from text using the OpenAI TTS model via a local API endpoint.
 * @param text The text to convert to speech.
 * @returns A Promise that resolves to an ArrayBuffer containing the MP3 audio data, or null if an error occurs.
 */
export async function generateSpeech(text: string): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch('/api/voice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const audioBlob = await response.blob();
    return await audioBlob.arrayBuffer(); // Return ArrayBuffer for AudioContext.decodeAudioData

  } catch (error) {
    console.error('Error generating speech:', error);
    // Do not prompt for API key selection here, as it's handled by the server-side OpenAI key.
    throw new Error('The muse fell silent. Could not capture the voice of your poem.');
  }
}
