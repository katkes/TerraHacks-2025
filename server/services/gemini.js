import { TextServiceClient } from '@google/generative-ai';
const client = new TextServiceClient();

export async function summarizeThemes(text) {
  const prompt = `
    Extract the top 3 most prominent themes from this story.
    Return a JSON array of strings, e.g. ["love","adventure","loss"].

    Story:
    """${text}"""
  `;
  const [resp] = await client.generateText({
    model: 'models/text-bison-001',
    prompt: { text: prompt.trim() },
    temperature: 0.2,
    maxOutputTokens: 128
  });

  try {
    return JSON.parse(resp.text);
  } catch {
    return resp.text
      .replace(/[\[\]"']/g, '')
      .split(/,|\n/)
      .map(s => s.trim())
      .filter(Boolean)
      .slice(0, 3);
  }
}
