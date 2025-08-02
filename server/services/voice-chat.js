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
const model = "gemini-live-2.5-flash-preview";  // half-cascade audio model

const config = {
  responseModalities: [Modality.AUDIO],               // audio only
  implementationApproach: 'SERVER_TO_SERVER',         // server-to-server mode
  outputAudioTranscription: {},      // request text of audio output
  // realtimeInputConfig: {                             // disable auto VAD to capture full utterance
  //   automaticActivityDetection: {
  //     disabled: true
  //   }
  // },
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
      model: model,
      callbacks: {
        onopen: () => {
          console.log(`Gemini session opened for ${sessionId}`);
          websocket.send(JSON.stringify({ type: 'connected' }));
        },
        onmessage: (message) => {
          this.handleGeminiMessage(sessionId, websocket, message);
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
          console.log(event);
        },
      },
      config: config,
    });

    this.sessions.set(sessionId, { session, websocket, transcriptBuffer: '' });
    return sessionId;
  }

  handleGeminiMessage(sessionId, websocket, message) {
    // find our session data
    const sessionData = this.sessions.get(sessionId);
    if (!sessionData) return;

    console.log('🤖 Gemini message received:', {
      type: typeof message,
      hasData: !!message.data,
      hasServerContent: !!message.serverContent,
      hasCandidates: !!message.candidates,
      hasSetupComplete: !!message.setupComplete
    });

    if (message.setupComplete) {
      console.log('✅ Gemini setup complete');
      websocket.send(JSON.stringify({ 
        type: 'setup_complete',
        message: 'Gemini is ready for audio input'
      }));
      return;
    }

    if (message.serverContent) {
      // handle Google’s plain outputTranscription (text of audio input)
      if (message.serverContent.outputTranscription) {
        const text = message.serverContent.outputTranscription.text;
        sessionData.transcriptBuffer += text;
        websocket.send(JSON.stringify({
          type: 'audio_transcription',
          text,
          speaker: 'constellation'
        }));
      }

      // buffer partial transcription
      if (message.serverContent.outputAudioTranscription) {
        sessionData.transcriptBuffer += message.serverContent.outputAudioTranscription.text;
      }

      if (message.serverContent.modelTurn?.parts) {
        const parts = message.serverContent.modelTurn.parts;
        
        for (const part of parts) {
          // Handle text response
          if (part.text) {
            console.log('📝 Gemini text response:', part.text);
            websocket.send(JSON.stringify({
              type: 'text_response',
              text: part.text
            }));
          }
          
          // Handle audio response (inline data)
          if (part.inlineData && part.inlineData.mimeType && part.inlineData.mimeType.includes('audio')) {
            console.log('🔊 Gemini audio response received:', {
              length: part.inlineData.data.length,
              mimeType: part.inlineData.mimeType
            });
            
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
        // emit full transcription for frontend display
        websocket.send(JSON.stringify({
          type: 'audio_transcription',
          text: sessionData.transcriptBuffer.trim(),
          speaker: 'constellation'
        }));
        // then emit the AI bot response text
        websocket.send(JSON.stringify({
          type: 'text_response',
          text: sessionData.transcriptBuffer.trim(),
          speaker: 'constellation'
        }));
        // signal end of turn
        websocket.send(JSON.stringify({ type: 'turn_complete' }));
        sessionData.transcriptBuffer = '';
      }
    }

    console.log('🔍 Full message structure:', JSON.stringify(message, null, 2));

    // console.log(message.outputTranscription);
}

async processAudioInput(sessionId, audioData) {
  const sessionData = this.sessions.get(sessionId);
  if (!sessionData) throw new Error('Session not found');

  try {
    console.log('🎤 Processing audio input for session:', sessionId);
    console.log('📦 Raw audio data size:', audioData.length);

    // Decode incoming base64 WAV file
    const wavBuffer = Buffer.from(audioData, 'base64');
    // Strip WAV header (44 bytes) to get raw PCM
    const pcmBuffer = wavBuffer.slice(44);
    const base64PCM = pcmBuffer.toString('base64');

    console.log('📤 Sending PCM audio to Gemini, size:', base64PCM.length);

    // Send raw PCM via the stored session
    sessionData.session.sendRealtimeInput({
      audio: { data: base64PCM, mimeType: "audio/pcm;rate=16000" }
    });
    // Notify server that the audio stream has ended, forcing a model response
    sessionData.session.sendRealtimeInput({ audioStreamEnd: true });

    console.log('✅ Audio sent to Gemini successfully');
  } catch (error) {
    console.error('❌ Audio processing error:', error);
    throw new Error('Failed to process audio input: ' + error.message);
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