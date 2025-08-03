import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import storiesRouter from './routes/stories.js';
import { VoiceChatService } from './services/voice-chat.js';
import dotenv from 'dotenv';

dotenv.config();

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  dbName: "constellationDB",
})
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors(), express.json({ limit: '50mb' }));

const voiceChatService = new VoiceChatService();

wss.on('connection', async (ws) => {
  console.log('Client connected');
  let sessionId = null;

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'start_session':
          sessionId = await voiceChatService.createSession(ws);
          break;
          
        case 'audio_input':
          if (sessionId) {
            await voiceChatService.processAudioInput(sessionId, message.data);
          }
          break;
          
        case 'end_session':
          if (sessionId) {
            voiceChatService.closeSession(sessionId);
            sessionId = null;
          }
          break;
      }
    } catch (error) {
      console.error('WebSocket error:', error);
      ws.send(JSON.stringify({ type: 'error', message: error.message }));
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    if (sessionId) {
      voiceChatService.closeSession(sessionId);
    }
  });
});

// Existing routes
app.use('/api/stories', storiesRouter);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});