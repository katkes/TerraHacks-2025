// src/StoryForm.js
import React, { useState } from 'react';
import axios from 'axios';

export default function StoryForm() {
  const [text, setText]     = useState('');
  const [themes, setThemes] = useState([]);
  const [error, setError]   = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      const { data } = await axios.post('/api/stories', { text });
      setThemes(data.themes);
      setError('');
    } catch {
      setError('Failed to summarize. Try again.');
    }
  };

  return (
    <div className="p-4 max-w-lg mx-auto">
      <form onSubmit={handleSubmit} className="space-y-4">
        <textarea
          rows={6}
          className="w-full border p-2 rounded"
          placeholder="Type your story…"
          value={text}
          onChange={e => setText(e.target.value)}
          required
        />
        <button className="px-4 py-2 bg-blue-600 text-white rounded">
          Summarize Themes
        </button>
      </form>
      {error && <p className="text-red-600 mt-2">{error}</p>}
      {themes.length > 0 && (
        <div className="mt-4">
          <h3 className="font-semibold">Top 3 Themes:</h3>
          <ul className="list-disc list-inside">
            {themes.map((t,i) => <li key={i}>{t}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
