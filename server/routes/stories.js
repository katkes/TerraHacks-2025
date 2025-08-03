import express from "express";
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

export default router;
