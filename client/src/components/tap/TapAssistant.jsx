// components/tap/TapAssistant.jsx
// Tap - AI Assistant for Tapvera CRM

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './TapAssistant.css';

const TapAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [suggestions, setSuggestions] = useState([]);

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const synthRef = useRef(null);
  const inputRef = useRef(null);

  // Initialize Web Speech API
  useEffect(() => {
    // Speech Recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setMessage(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    // Speech Synthesis
    if ('speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
    }

    // Load suggestions
    loadSuggestions();

    // Welcome message
    setMessages([{
      type: 'assistant',
      content: '👋 Hi! I\'m Tap, your CRM agent.\n\nI can execute actions for you in real-time. Just tell me what you need!',
      timestamp: new Date().toISOString()
    }]);

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadSuggestions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${import.meta.env.VITE_API_BASE}/api/tap/suggestions`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setSuggestions(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    }
  };

  const toggleVoiceRecognition = () => {
    if (!recognitionRef.current) {
      alert('Voice recognition is not supported in your browser');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const speak = (text) => {
    if (!synthRef.current) return;

    // Cancel any ongoing speech
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    synthRef.current.speak(utterance);
  };

  const stopSpeaking = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
  };

  const sendMessage = async (text = message) => {
    if (!text.trim() || isLoading) return;

    const userMessage = {
      type: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setMessage('');
    setIsLoading(true);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE}/api/tap/chat`,
        { message: text.trim() },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        const responseData = response.data.data;

        const aiMessage = {
          type: 'assistant',
          content: responseData.response,
          action: responseData.action,
          executed: responseData.executed,
          success: responseData.success,
          resultCount: responseData.result ? (Array.isArray(responseData.result) ? responseData.result.length : 1) : 0,
          timestamp: responseData.timestamp
        };

        setMessages(prev => [...prev, aiMessage]);

        // Auto-speak response (without speaking data details)
        const spokenText = responseData.response.split('\n')[0]; // Speak only first line
        speak(spokenText);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = {
        type: 'error',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage();
  };

  const handleSuggestionClick = (suggestion) => {
    setMessage(suggestion);
    inputRef.current?.focus();
  };

  const clearHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${import.meta.env.VITE_API_BASE}/api/tap/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setMessages([{
        type: 'assistant',
        content: '🔄 History cleared. Ready to execute new commands!',
        timestamp: new Date().toISOString()
      }]);
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  };

  if (!isOpen) {
    return (
      <button
        className="tap-float-button"
        onClick={() => setIsOpen(true)}
        aria-label="Open Tap Assistant"
      >
        <span className="tap-icon">💬</span>
        <span className="tap-pulse"></span>
      </button>
    );
  }

  return (
    <div className={`tap-assistant ${isMinimized ? 'minimized' : ''}`}>
      {/* Header */}
      <div className="tap-header">
        <div className="tap-header-left">
          <div className="tap-avatar">T</div>
          <div className="tap-header-info">
            <h3>Tap</h3>
            <span className="tap-status">
              {isListening ? '🎤 Listening...' : isSpeaking ? '🔊 Speaking...' : '✨ Online'}
            </span>
          </div>
        </div>
        <div className="tap-header-actions">
          {isSpeaking && (
            <button
              className="tap-header-btn"
              onClick={stopSpeaking}
              title="Stop speaking"
            >
              🔇
            </button>
          )}
          <button
            className="tap-header-btn"
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? 'Maximize' : 'Minimize'}
          >
            {isMinimized ? '🔼' : '🔽'}
          </button>
          <button
            className="tap-header-btn"
            onClick={clearHistory}
            title="Clear conversation"
          >
            🗑️
          </button>
          <button
            className="tap-header-btn tap-close"
            onClick={() => setIsOpen(false)}
            title="Close"
          >
            ✕
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <div className="tap-messages">
            {messages.map((msg, index) => (
              <div key={index} className={`tap-message tap-message-${msg.type}`}>
                <div className="tap-message-content">
                  {/* Show execution badge */}
                  {msg.executed && msg.action && (
                    <div className="tap-execution-badge">
                      <span className="tap-badge-icon">{msg.success ? '⚡' : '⚠️'}</span>
                      <span className="tap-badge-text">
                        {msg.action.replace(/_/g, ' ').toLowerCase()}
                        {msg.resultCount > 0 && ` (${msg.resultCount})`}
                      </span>
                    </div>
                  )}

                  <div className="tap-message-text">
                    {msg.content}
                  </div>
                </div>
                <div className="tap-message-time">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="tap-message tap-message-assistant">
                <div className="tap-typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggestions */}
          {messages.length === 1 && suggestions.length > 0 && (
            <div className="tap-suggestions">
              <div className="tap-suggestions-label">Try asking:</div>
              <div className="tap-suggestions-list">
                {suggestions.slice(0, 3).map((suggestion, index) => (
                  <button
                    key={index}
                    className="tap-suggestion-chip"
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <form className="tap-input-form" onSubmit={handleSubmit}>
            <button
              type="button"
              className={`tap-voice-btn ${isListening ? 'listening' : ''}`}
              onClick={toggleVoiceRecognition}
              title={isListening ? 'Stop listening' : 'Start voice input'}
              disabled={isLoading}
            >
              {isListening ? '🎙️' : '🎤'}
            </button>

            <input
              ref={inputRef}
              type="text"
              className="tap-input"
              placeholder="Type or speak your message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={isLoading || isListening}
            />

            <button
              type="submit"
              className="tap-send-btn"
              disabled={!message.trim() || isLoading}
              title="Send message"
            >
              {isLoading ? '⏳' : '📤'}
            </button>
          </form>
        </>
      )}
    </div>
  );
};

export default TapAssistant;
