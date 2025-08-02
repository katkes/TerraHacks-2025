import express from 'express';
import { summarizeThemes } from '../services/gemini.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Story text is required' });
    }
    
    const themes = await summarizeThemes(text);

    // Generate a simple ID or remove if not needed
    const id = Date.now().toString();
    
    res.json({ id, themes });
  } catch (err) {
    console.error('Error processing story:', err);
    res.status(500).json({ error: 'Failed to process story: ' + err.message });
  }
});

export default router;