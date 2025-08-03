import { GoogleGenAI, Modality } from '@google/genai';
import { WebSocketServer } from 'ws';
import pkg from 'wavefile';
const { WaveFile } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is required');

const ai = new GoogleGenAI({ apiKey });
const model = "gemini-live-2.5-flash-preview";

const config = {
  responseModalities: [Modality.AUDIO],
  implementationApproach: 'SERVER_TO_SERVER',
  outputAudioTranscription: {},
  systemInstruction: `You are a supportive and empathetic AI assistant. Your role is to:
  - Listen carefully to what the user says
  - Ask thoughtful follow-up questions to encourage them to elaborate
  - Provide emotional support and validation
  - Help them feel heard and understood
  - Keep responses conversational, warm, and under 30 seconds
  - Always provide both audio and text responses
  - Use a caring, encouraging tone`
};

export class VoiceChatService {
  constructor() {
    this.sessions = new Map();
  }

  async createSession(websocket) {
    const sessionId = Date.now().toString();
    const session = await ai.live.connect({
      model,
      callbacks: {
        onopen: () => websocket.send(JSON.stringify({ type: 'connected' })),
        onmessage: (message) => this.handleGeminiMessage(sessionId, websocket, message),
        onerror: (error) => websocket.send(JSON.stringify({ type: 'error', message: error.message })),
        onclose: () => {}
      },
      config
    });

    this.sessions.set(sessionId, { session, websocket, transcriptBuffer: '' });
    return sessionId;
  }

  handleGeminiMessage(sessionId, websocket, message) {
    const sessionData = this.sessions.get(sessionId);
    if (!sessionData) return;

    if (message.setupComplete) {
      websocket.send(JSON.stringify({ type: 'setup_complete', message: 'ready' }));
      return;
    }

    if (message.serverContent) {
      if (message.serverContent.outputTranscription) {
        const text = message.serverContent.outputTranscription.text;
        sessionData.transcriptBuffer += text;
        websocket.send(JSON.stringify({ type: 'audio_transcription', text, speaker: 'constellation' }));
      }

      if (message.serverContent.outputAudioTranscription) {
        sessionData.transcriptBuffer += message.serverContent.outputAudioTranscription.text;
      }

      if (message.serverContent.modelTurn?.parts) {
        for (const part of message.serverContent.modelTurn.parts) {
          if (part.text) {
            websocket.send(JSON.stringify({ type: 'text_response', text: part.text }));
          }
          if (part.inlineData?.mimeType.includes('audio')) {
            websocket.send(JSON.stringify({
              type: 'audio',
              data: part.inlineData.data,
              mimeType: part.inlineData.mimeType
            }));
          }
        }
      }
      
      if (message.serverContent.generationComplete) {
        websocket.send(JSON.stringify({ type: 'generation_complete' }));
      }

      if (message.serverContent.turnComplete) {
        websocket.send(JSON.stringify({
          type: 'audio_transcription',
          text: sessionData.transcriptBuffer.trim(),
          speaker: 'constellation'
        }));
        websocket.send(JSON.stringify({
          type: 'text_response',
          text: sessionData.transcriptBuffer.trim(),
          speaker: 'constellation'
        }));
        websocket.send(JSON.stringify({ type: 'turn_complete' }));
        sessionData.transcriptBuffer = '';
      }
    }
  }

  async processAudioInput(sessionId, audioData) {
    const sessionData = this.sessions.get(sessionId);
    if (!sessionData) throw new Error('Session not found');

    try {
      console.log('🎤 Processing audio input for session:', sessionId);
      console.log('📦 Raw audio data size:', audioData.length);

      const wavBuffer = Buffer.from(audioData, 'base64');
      const pcmBuffer = wavBuffer.slice(44);
      const base64PCM = pcmBuffer.toString('base64');

      console.log('📤 Sending PCM audio to Gemini, size:', base64PCM.length);

      sessionData.session.sendRealtimeInput({
        audio: { data: base64PCM, mimeType: "audio/pcm;rate=16000" }
      });
      sessionData.session.sendRealtimeInput({ audioStreamEnd: true });

      console.log('✅ Audio sent to Gemini successfully');
    } catch (error) {
      console.error('❌ Audio processing error:', error);
      throw new Error('Failed to process audio input: ' + error.message);
    }
  }

  convertStereoToMono(wav) {
    if (wav.fmt.numChannels !== 2) return;
    
    const samples = wav.getSamples();
    const monoSamples = [];
    
    for (let i = 0; i < samples.length; i += 2) {
      const left = samples[i];
      const right = samples[i + 1];
      monoSamples.push(Math.round((left + right) / 2));
    }
    
    wav.fromScratch(1, wav.fmt.sampleRate, wav.fmt.bitsPerSample.toString(), monoSamples);
  }

  closeSession(sessionId) {
    const sessionData = this.sessions.get(sessionId);
    if (sessionData) {
      sessionData.session.close();
      this.sessions.delete(sessionId);
    }
  }
}