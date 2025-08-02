// src/StoryForm.js
import React, { useState } from "react";
import axios from "axios";
import { StylizedButton } from "./StylizedButton";

const themeList = (themes) => {
  return (
    <div className="mt-4">
      <h3 className="font-semibold">Top 3 Themes:</h3>
      <ul className="list-disc list-inside">
        {themes.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </div>
  );
};

export default function StoryForm() {
  const [text, setText] = useState("");
  const [themes, setThemes] = useState([]);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const { data } = await axios.post("/api/stories", { text });
      setThemes(data.themes);
      setError("");
    } catch {
      setError("Failed to summarize. Try again.");
    }
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          width: "100%",
        }}
      >
        <h1>Talk To Me</h1>
      </div>
      <form onSubmit={handleSubmit}>
        <div
          style={{ display: "flex", justifyContent: "center", width: "100%" }}
        >
          <textarea
            rows={6}
            style={{
              border: "1px solid #D1D5DB",
              padding: "1rem",
              borderRadius: "0.5rem",
              boxShadow: "0 1px 2px 0 rgba(0,0,0,0.05)",
              backgroundColor: "#F9FAFB",
              outline: "none",
              fontSize: "1rem",
              resize: "none",
              transition: "box-shadow 0.2s, border-color 0.2s",
              display: "block",
              width: "70vw",
              minWidth: "300px",
              maxWidth: "600px",
              boxSizing: "border-box",
              textAlign: "center",
            }}
            placeholder="How are you, really?"
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
          />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "1rem",
            marginTop: "1rem",
          }}
        >
          <StylizedButton>Summarize Thoughts</StylizedButton>
          <StylizedButton type="searchButton">Find Similar</StylizedButton>
        </div>
      </form>
      <div>
        {error && <p>{error}</p>}
        {themes.length > 0 && themeList(themes)}
      </div>
    </div>
  );
}
