import React, { useState, useRef, useEffect } from 'react';
import { StylizedButton } from './StylizedButton';

export const VoiceChat = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState('Disconnected');
  
  const wsRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const connectToServer = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.hostname}:4000`;
    
    wsRef.current = new WebSocket(wsUrl);
    
    wsRef.current.onopen = () => {
      setIsConnected(true);
      setStatus('Connected');
      // Start session
      wsRef.current.send(JSON.stringify({ type: 'start_session' }));
    };
    
    wsRef.current.onmessage = (event) => {
      const message = JSON.parse(event.data);
      handleServerMessage(message);
    };
    
    wsRef.current.onclose = () => {
      setIsConnected(false);
      setStatus('Disconnected');
    };
    
    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setStatus('Connection Error');
    };
  };

  const handleServerMessage = async (message) => {
    switch (message.type) {
      case 'connected':
        setStatus('Ready to chat');
        break;
        
      case 'audio':
        await playAudioResponse(message.data);
        break;
        
      case 'turn_complete':
        setStatus('Response complete');
        break;
        
      case 'error':
        setStatus(`Error: ${message.message}`);
        break;
    }
  };

  const playAudioResponse = async (base64Audio) => {
    try {
      // Convert base64 to audio buffer
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Create audio context if needed
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: 24000
        });
      }
      
      // Convert PCM data to AudioBuffer
      const audioBuffer = audioContextRef.current.createBuffer(1, bytes.length / 2, 24000);
      const channelData = audioBuffer.getChannelData(0);
      
      // Convert Int16 PCM to Float32
      for (let i = 0; i < channelData.length; i++) {
        const sample = (bytes[i * 2] | (bytes[i * 2 + 1] << 8));
        channelData[i] = sample < 32768 ? sample / 32768 : (sample - 65536) / 32768;
      }
      
      // Play audio
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.start();
      
      setStatus('Playing response...');
    } catch (error) {
      console.error('Error playing audio:', error);
      setStatus('Audio playback error');
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });
      
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      audioChunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await sendAudioToServer(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorderRef.current.start(1000); // Collect data every second
      setIsRecording(true);
      setStatus('Recording...');
    } catch (error) {
      console.error('Error starting recording:', error);
      setStatus('Microphone access denied');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setStatus('Processing...');
    }
  };

  const sendAudioToServer = async (audioBlob) => {
  try {
    // Convert WebM to WAV using AudioContext
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Convert to PCM WAV format
    const wavBuffer = audioBufferToWav(audioBuffer);
    const base64Audio = arrayBufferToBase64(wavBuffer);
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'audio_input',
        data: base64Audio
      }));
    }
  } catch (error) {
    console.error('Error sending audio:', error);
    setStatus('Failed to send audio');
  }
};

// Helper function to convert AudioBuffer to WAV
const audioBufferToWav = (audioBuffer) => {
  const length = audioBuffer.length;
  const sampleRate = audioBuffer.sampleRate;
  const numberOfChannels = audioBuffer.numberOfChannels;
  
  // Create WAV header
  const buffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
  const view = new DataView(buffer);
  
  // WAV header
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length * numberOfChannels * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numberOfChannels * 2, true);
  view.setUint16(32, numberOfChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, length * numberOfChannels * 2, true);
  
  // Convert float samples to 16-bit PCM
  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]));
      view.setInt16(offset, sample * 0x7FFF, true);
      offset += 2;
    }
  }
  
  return buffer;
};

// Helper function to convert ArrayBuffer to base64
const arrayBufferToBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: 'end_session' }));
      wsRef.current.close();
    }
    setIsConnected(false);
    setIsRecording(false);
    setStatus('Disconnected');
  };

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h2>Voice Chat with Gemini</h2>
      <p>Status: {status}</p>
      
      <div style={{ margin: '1rem 0' }}>
        {!isConnected ? (
          <StylizedButton onClick={connectToServer}>
            Connect to Voice Chat
          </StylizedButton>
        ) : (
          <>
            {!isRecording ? (
              <StylizedButton onClick={startRecording}>
                🎤 Start Recording
              </StylizedButton>
            ) : (
              <StylizedButton onClick={stopRecording}>
                ⏹️ Stop Recording
              </StylizedButton>
            )}
            <br />
            <StylizedButton onClick={disconnect}>
              Disconnect
            </StylizedButton>
          </>
        )}
      </div>
    </div>
  );
};