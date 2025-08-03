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

// New: return live data for graph
router.get("/graph", async (req, res) => {
  try {
    const docs = await Story.find().lean();
    const nodes = docs.map(doc => ({
      id: doc.storyId,
      data: {
        alias: doc.alias,
        storyText: doc.storyText,
        insightText: doc.insightText,
        themes: doc.themes
        // you can inject a `topic` or other fields here if you store them
      }
    }));
    // simple empty links array for now
    const links = [];
    res.json({ nodes, links });
  } catch (err) {
    console.error("Error fetching graph data:", err);
    res.status(500).json({ error: "Failed to fetch graph data" });
  }
});

export default router;
