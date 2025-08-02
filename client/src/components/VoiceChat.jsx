import React, { useState, useRef, useEffect } from 'react';

export const VoiceChat = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState('Disconnected');
  const [conversation, setConversation] = useState([]);
  const [currentTranscript, setCurrentTranscript] = useState('');
  
  const wsRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const queueTimeRef = useRef(0);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      
      recognitionRef.current.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }
        
        if (finalTranscript) {
          setCurrentTranscript(finalTranscript);
          setConversation(prev => [...prev, {
            type: 'user',
            content: finalTranscript,
            timestamp: new Date().toLocaleTimeString()
          }]);
        } else {
          setCurrentTranscript(interimTranscript);
        }
      };
    }
  }, []);

  const connectToServer = async () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
        queueTimeRef.current = audioContextRef.current.currentTime;
      }
      if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();
      
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.hostname}:4000`;
      wsRef.current = new WebSocket(wsUrl);
    
      wsRef.current.onopen = () => {
        setIsConnected(true);
        setStatus('🔌 Connected to server');
        wsRef.current.send(JSON.stringify({
          type: 'start_session',
          config: {
            model: 'gemini-live-2.5-flash-preview',
            responseModalities: ['AUDIO'],
            implementationApproach: 'SERVER_TO_SERVER',
            outputAudioTranscription: {}
          }
        }));
      };
    
      wsRef.current.onmessage = (event) => handleServerMessage(JSON.parse(event.data));
      wsRef.current.onclose = () => { setIsConnected(false); setStatus('Disconnected'); };
      wsRef.current.onerror = () => setStatus('Connection Error');
    } catch {
      setStatus('❌ Connection failed');
    }
  };

  const playAudioResponse = async (base64Audio, mimeType = 'audio/pcm;rate=16000') => {
    try {
      if (!base64Audio) { setStatus('❌ No audio data'); return; }
      if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
      if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();
      
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      const sampleRate = mimeType.includes('rate=24000') ? 24000 : 16000;
      let offset = 0;
      if (bytes.length > 44 && String.fromCharCode(...bytes.slice(0,4)) === 'RIFF') offset = 44;
      const numSamples = (bytes.length - offset) / 2;
      const audioBuffer = audioContextRef.current.createBuffer(1, numSamples, sampleRate);
      const channelData = audioBuffer.getChannelData(0);
      const dataView = new DataView(bytes.buffer, offset);
      for (let i = 0; i < numSamples; i++) {
        channelData[i] = dataView.getInt16(i*2, true) / 32768.0;
      }

      const ctx = audioContextRef.current;
      const startTime = Math.max(ctx.currentTime, queueTimeRef.current);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = (sampleRate / ctx.sampleRate) * 1.2;
      const gainNode = ctx.createGain();
      gainNode.gain.value = 2.0;
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      source.start(startTime);
      queueTimeRef.current = startTime + audioBuffer.duration;
      setStatus('🎵 Playing Gemini response...');
      source.onended = () => {
        if (ctx.currentTime >= queueTimeRef.current) setStatus('🟢 Ready for next input');
      };
    } catch (error) {
      setStatus('❌ Audio playback error: ' + error.message);
    }
  };

  const startRecording = async () => {
    try {
      if (recognitionRef.current) {
        recognitionRef.current.start();
        setCurrentTranscript('');
      }
      
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
      
      mediaRecorderRef.current.start(1000);
      setIsRecording(true);
      setStatus('🎤 Recording... (speak now)');
    } catch (error) {
      console.error('Error starting recording:', error);
      setStatus('❌ Microphone access denied');
    }
  };

  const handleServerMessage = async (message) => {
    console.log('📨 Server message:', message);
    
    switch (message.type) {
      case 'connected':
        setStatus('🔌 Connected to server');
        break;
        
      case 'setup_complete':
        setStatus('🟢 Ready to chat');
        if (audioContextRef.current) {
          queueTimeRef.current = audioContextRef.current.currentTime;
        }
        break;
        
      case 'text_response':
        console.log('📝 Text response from Gemini:', message.text);
        setConversation(prev => [...prev, {
          type: 'ai',
          content: message.text,
          speaker: message.speaker || 'gemini',
          timestamp: new Date().toLocaleTimeString()
        }]);
        setStatus(`💬 Gemini responded`);
        break;
        
      case 'audio':
        console.log('🔊 Audio response received, length:', message.data?.length);
        setStatus('🎵 Playing response...');
        await playAudioResponse(message.data, message.mimeType);
        break;
        
      case 'audio_transcription':
        break;
        
      case 'generation_complete':
        console.log('✅ Generation complete');
        break;
        
      case 'turn_complete':
        console.log('✅ Turn complete');
        setStatus('🟢 Ready for next input');
        if (audioContextRef.current) {
          queueTimeRef.current = audioContextRef.current.currentTime;
        }
        break;
        
      case 'error':
        console.error('❌ Server error:', message.message);
        setStatus(`❌ Error: ${message.message}`);
        break;
        
      default:
        console.log('❓ Unknown message type:', message.type, message);
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setStatus('⏳ Processing audio...');
      console.log('🛑 Recording stopped, processing...');
    }
  };

  const sendAudioToServer = async (audioBlob) => {
    try {
      console.log('📤 Converting and sending audio to server, size:', audioBlob.size);
      
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const targetSampleRate = 16000;
      const resampledBuffer = await resampleAudioBuffer(audioBuffer, targetSampleRate);
      
      const wavBuffer = audioBufferToWav(resampledBuffer);
      const base64Audio = arrayBufferToBase64(wavBuffer);
      
      console.log('📦 Converted audio size:', base64Audio.length);
      
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'audio_input',
          data: base64Audio
        }));
        console.log('✅ Audio sent to server');
        setStatus('🤖 Waiting for Gemini response...');
      } else {
        console.error('❌ WebSocket not connected');
        setStatus('❌ Connection lost');
      }
    } catch (error) {
      console.error('❌ Error sending audio:', error);
      console.error('❌ Detailed error:', error.message, error.stack); 
      setStatus('❌ Failed to send audio');
    }
  };

  const resampleAudioBuffer = async (audioBuffer, targetSampleRate) => {
    if (audioBuffer.sampleRate === targetSampleRate) {
      return audioBuffer;
    }
    
    const offlineContext = new OfflineAudioContext(
      1, // mono
      Math.round(audioBuffer.duration * targetSampleRate),
      targetSampleRate
    );
    
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineContext.destination);
    source.start();
    
    return await offlineContext.startRendering();
  };

  const audioBufferToWav = (audioBuffer) => {
    const length = audioBuffer.length;
    const sampleRate = audioBuffer.sampleRate;
    const numberOfChannels = 1; // Force mono
    
    const buffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(buffer);
    
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * 2, true);
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
    view.setUint32(40, length * 2, true);
    
    let offset = 44;
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      view.setInt16(offset, sample * 0x7FFF, true);
      offset += 2;
    }
    
    return buffer;
  };

  const arrayBufferToBase64 = (buffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
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

  const testAudioPlayback = async () => {
    try {
      setStatus('🧪 Testing audio...');
      
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: 16000
        });
      }
      
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      const duration = 1;
      const frequency = 440;
      const sampleRate = audioContextRef.current.sampleRate;
      
      const audioBuffer = audioContextRef.current.createBuffer(1, sampleRate * duration, sampleRate);
      const channelData = audioBuffer.getChannelData(0);
      
      for (let i = 0; i < channelData.length; i++) {
        channelData[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.1;
      }
      
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.start();
      
      console.log('🔊 Test tone playing');
      setStatus('🎵 Playing test tone...');
      
      source.onended = () => {
        setStatus('✅ Audio test complete');
        console.log('🔊 Test tone finished');
      };
    } catch (error) {
      console.error('❌ Audio test failed:', error);
      setStatus('❌ Audio test failed: ' + error.message);
    }
  };

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h2>🎙️ Voice Chat with Gemini</h2>
      <p>Status: {status}</p>
      
      {currentTranscript && (
        <div style={{ 
          margin: '1rem 0', 
          padding: '1rem', 
          backgroundColor: '#f0f0f0', 
          borderRadius: '8px',
          fontStyle: 'italic'
        }}>
          <strong>You're saying:</strong> {currentTranscript}
        </div>
      )}
      
      <div style={{ 
        margin: '1rem 0', 
        maxHeight: '300px', 
        overflowY: 'auto', 
        border: '1px solid #ccc', 
        padding: '1rem',
        textAlign: 'left',
        backgroundColor: '#fafafa'
      }}>
        <h3>💬 Conversation:</h3>
        {conversation.length === 0 ? (
          <p style={{ fontStyle: 'italic', color: '#666' }}>No conversation yet...</p>
        ) : (
          conversation.map((msg, index) => (
            <div key={index} style={{ 
              margin: '0.5rem 0', 
              padding: '0.5rem',
              backgroundColor: msg.type === 'ai' ? '#e3f2fd' : '#f3e5f5',
              borderRadius: '8px'
            }}>
            <strong>
              {msg.type === 'ai'
                ? (msg.speaker === 'constellation' ? '🪐 Constellation' : '🤖 AI')
                : '👤 You'} ({msg.timestamp}):
            </strong>
            <br />
            {msg.content}
          </div>
        ))
        )}
      </div>
      
      <div style={{ margin: '1rem 0' }}>
        {!isConnected ? (
          <button onClick={connectToServer} style={{ padding: '1rem 2rem', fontSize: '1.2rem' }}>
            🔌 Connect to Voice Chat
          </button>
        ) : (
          <>
            {!isRecording ? (
              <button 
                onClick={startRecording} 
                style={{ 
                  padding: '1rem 2rem', 
                  fontSize: '1.2rem', 
                  backgroundColor: '#4CAF50', 
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                🎤 Start Recording
              </button>
            ) : (
              <button 
                onClick={stopRecording}
                style={{ 
                  padding: '1rem 2rem', 
                  fontSize: '1.2rem', 
                  backgroundColor: '#f44336', 
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                ⏹️ Stop Recording
              </button>
            )}
            <br />
            <button 
              onClick={disconnect} 
              style={{ 
                padding: '0.5rem 1rem', 
                marginTop: '1rem',
                backgroundColor: '#ff9800',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              🔌 Disconnect
            </button>
          </>
        )}
      </div>

      {isConnected && (
        <div style={{ 
          margin: '1rem 0', 
          padding: '0.5rem', 
          backgroundColor: '#f9f9f9', 
          fontSize: '0.8rem',
          textAlign: 'left'
        }}>
          <strong>🔧 Audio Debug:</strong><br />
          Audio Context: {audioContextRef.current?.state || 'Not initialized'}<br />
          Sample Rate: {audioContextRef.current?.sampleRate || 'Unknown'}<br />
          Last Audio: {conversation.filter(msg => msg.type === 'ai').length > 0 ? 'Received' : 'None'}
        </div>
      )}
    </div>
  );
};