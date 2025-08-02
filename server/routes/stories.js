import express from 'express';
import Story from '../models/Story.js';
import { summarizeThemes } from '../services/gemini.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { text } = req.body;
    const themes = await summarizeThemes(text);

    const story = new Story({ text, themes });
    await story.save();

    res.json({ id: story._id, themes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process story.' });
  }
});

export default router;
