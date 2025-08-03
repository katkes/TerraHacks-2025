import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("GEMINI_API_KEY environment variable is required");
}

const ai = new GoogleGenAI({ apiKey });

export async function summarizeInput(text) {
  try {
    const prompt = `
      Return an object with a "summary" key and a "themes" key.
      The value to the "summary" key should be a summary of the Story.
      The value to the "themes" key should be an array of the top 3 most prominent themes in the Story.
      Note: the "themes" value should ONLY a JSON array of strings, e.g. ["love","adventure","loss"], 
      do not include any markdown formatting or code blocks.

      Story:
      """${text}"""
    `;

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
    console.log("Raw response:", JSON.stringify(response, null, 2));

    let result = response.candidates[0].content.parts[0].text;
    console.log("Raw result:", result);

    result = result.trim();

    if (result.startsWith("```json") || result.startsWith("```")) {
      result = result.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    result = result.replace(/`/g, "");

    console.log("Cleaned result:", result);

    return JSON.parse(result);
  } catch (error) {
    console.error("Error in summarizeInput:", error);
    console.error("Failed to parse result:", result);
    throw new Error("Failed to generate themes");
  }
}
