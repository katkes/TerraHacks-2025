import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';

dotenv.config();
const ai = new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY});

export async function summarizeThemes(text) {
  const prompt = `
    Extract the top 3 most prominent themes from this story.
    Return a JSON array of strings, e.g. ["love","adventure","loss"].

    Story:
    """${text}"""
  `;
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });
  console.log(response.text);
}
