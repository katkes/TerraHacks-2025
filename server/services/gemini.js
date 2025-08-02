import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error('GEMINI_API_KEY environment variable is required');
}

const ai = new GoogleGenAI({ apiKey });

export async function summarizeThemes(text) {
  try {
    const prompt = `
      Extract the top 3 most prominent themes from this story.
      Return a JSON array of strings, e.g. ["love","adventure","loss"].

      Story:
      """${text}"""
    `;
    
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash", // Updated model name
      contents: [{ role: "user", parts: [{ text: prompt }] }], // Fixed contents format
    });
    
    // Extract the text from the response
    const result = response.candidates[0].content.parts[0].text;
    console.log('Generated themes:', result);
    
    // Parse and return the JSON array
    return JSON.parse(result);
  } catch (error) {
    console.error('Error in summarizeThemes:', error);
    throw new Error('Failed to generate themes');
  }
}