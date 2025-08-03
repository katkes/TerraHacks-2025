import express from "express";
import crypto from "crypto";
import Story from "../models/story.js";
import { summarizeInput } from "../services/gemini.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: "Story text is required" });
    }

    const { summary, themes } = await summarizeInput(text);

    res.json({ summary, themes });
  } catch (err) {
    console.error("Error processing story:", err);
    res.status(500).json({ error: "Failed to process story: " + err.message });
  }
});

router.post("/create", async (req, res) => {
  try {
    const { storyText, summary, themes } = req.body;
    const storyId = `STORY-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const alias   = "Kesh"; 
    const newStory = await Story.create({
      storyId,
      alias,
      storyText,
      insightText: summary,
      themes,
    });
    res.json(newStory);
  } catch (err) {
    console.error("Error creating story:", err);
    res.status(500).json({ error: "Failed to save story" });
  }
});

export default router;
