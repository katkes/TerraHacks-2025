import { GoogleGenAI, Modality } from '@google/genai';
import { WebSocketServer } from 'ws';
import pkg from 'wavefile';
const { WaveFile } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error('GEMINI_API_KEY environment variable is required');
}

const ai = new GoogleGenAI({ apiKey });
const model = "gemini-2.5-flash-preview-native-audio-dialog";

const config = {
  responseModalities: [Modality.AUDIO], 
  systemInstruction: "You are a helpful assistant. Keep responses conversational and under 30 seconds."
};

export class VoiceChatService {
  constructor() {
    this.sessions = new Map();
  }

  async createSession(websocket) {
    const sessionId = Date.now().toString();
    
    const session = await ai.live.connect({
      model: model,
      callbacks: {
        onopen: () => {
          console.log(`Gemini session opened for ${sessionId}`);
          websocket.send(JSON.stringify({ type: 'connected' }));
        },
        onmessage: (message) => {
          this.handleGeminiMessage(websocket, message);
        },
        onerror: (error) => {
          console.error('Gemini error:', error);
          websocket.send(JSON.stringify({ 
            type: 'error', 
            message: error.message 
          }));
        },
        onclose: (event) => {
          console.log('Gemini session closed:', event.reason);
        },
      },
      config: config,
    });

    this.sessions.set(sessionId, { session, websocket });
    return sessionId;
  }

  handleGeminiMessage(websocket, message) {
    if (message.data) {
      // Audio response from Gemini
      websocket.send(JSON.stringify({
        type: 'audio',
        data: message.data,
        mimeType: 'audio/pcm;rate=24000'
      }));
    }
    
    if (message.serverContent?.turnComplete) {
      websocket.send(JSON.stringify({ type: 'turn_complete' }));
    }
  }

  async processAudioInput(sessionId, audioData) {
    const sessionData = this.sessions.get(sessionId);
    if (!sessionData) {
      throw new Error('Session not found');
    }

    try {
      // Create WaveFile instance
      const wav = new WaveFile();
      
      // Load the WAV data
      wav.fromBuffer(Buffer.from(audioData, 'base64'));
      
      // Check current format
      console.log('Original format:', {
        sampleRate: wav.fmt.sampleRate,
        bitDepth: wav.fmt.bitsPerSample,
        channels: wav.fmt.numChannels
      });
      
      // Convert to the required format for Gemini
      // Check what methods are available and use them appropriately
      if (wav.fmt.sampleRate !== 16000) {
        // Try different method names that might exist
        if (typeof wav.toSampleRate === 'function') {
          wav.toSampleRate(16000);
        } else if (typeof wav.fromSampleRate === 'function') {
          wav.fromSampleRate(wav.fmt.sampleRate, 16000);
        }
      }
      
      if (wav.fmt.bitsPerSample !== 16) {
        if (typeof wav.toBitDepth === 'function') {
          wav.toBitDepth('16');
        } else if (typeof wav.fromBitDepth === 'function') {
          wav.fromBitDepth(wav.fmt.bitsPerSample.toString(), '16');
        }
      }
      
      if (wav.fmt.numChannels !== 1) {
        // Convert to mono manually since toMono() doesn't exist
        if (wav.fmt.numChannels === 2) {
          this.convertStereoToMono(wav);
        }
      }
      
      const base64Audio = wav.toBase64();

      sessionData.session.sendRealtimeInput({
        audio: {
          data: base64Audio,
          mimeType: "audio/pcm;rate=16000"
        }
      });
    } catch (error) {
      console.error('Audio processing error:', error);
      // If wavefile processing fails, try to send the original data
      sessionData.session.sendRealtimeInput({
        audio: {
          data: audioData,
          mimeType: "audio/wav"
        }
      });
    }
  }

  // Helper method to convert stereo to mono
  convertStereoToMono(wav) {
    if (wav.fmt.numChannels !== 2) return;
    
    const samples = wav.getSamples();
    const monoSamples = [];
    
    // Average left and right channels
    for (let i = 0; i < samples.length; i += 2) {
      const left = samples[i];
      const right = samples[i + 1];
      monoSamples.push(Math.round((left + right) / 2));
    }
    
    // Update the WAV file
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