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
      Return ONLY a JSON array of strings, e.g. ["love","adventure","loss"].
      Do not include any markdown formatting or code blocks.

      Story:
      """${text}"""
    `;
    
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
    
    let result = response.candidates[0].content.parts[0].text;
    console.log('Raw response:', result);
    
    result = result.trim();
    
    if (result.startsWith('```json') || result.startsWith('```')) {
      result = result.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    
    result = result.replace(/`/g, '');
    
    console.log('Cleaned result:', result);
    
    return JSON.parse(result);
  } catch (error) {
    console.error('Error in summarizeThemes:', error);
    console.error('Failed to parse result:', result);
    throw new Error('Failed to generate themes');
  }
}