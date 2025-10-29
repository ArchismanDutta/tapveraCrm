// TapAgent.jsx
// Autonomous UI-controlling agent component

import React, { useState, useRef, useEffect } from 'react';
import { useAgent } from '../../contexts/AgentContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Send,
  X,
  Sparkles,
  Activity,
  CheckCircle,
  XCircle,
  Trash2,
  Zap,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import './TapAgent.css';

const TapAgent = () => {
  const {
    isOpen,
    isListening,
    isSpeaking,
    isExecuting,
    currentCommand,
    executionProgress,
    executionHistory,
    toggleAgent,
    startListening,
    stopListening,
    stopSpeaking,
    executeCommand,
    clearHistory,
    getSuggestions,
    setCurrentCommand
  } = useAgent();

  const [inputValue, setInputValue] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const inputRef = useRef(null);

  const suggestions = getSuggestions();

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim() && !isExecuting) {
      executeCommand(inputValue);
      setInputValue('');
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    executeCommand(suggestion);
    setShowSuggestions(false);
  };

  const handleVoiceToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <>
      {/* Floating Button */}
      <motion.button
        className="tap-agent-fab"
        onClick={toggleAgent}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        animate={{
          boxShadow: isExecuting
            ? '0 0 30px rgba(255, 128, 0, 0.6)'
            : '0 4px 20px rgba(0, 0, 0, 0.3)'
        }}
      >
        <Bot className="tap-agent-fab-icon" />
        {isExecuting && (
          <motion.div
            className="tap-agent-fab-pulse"
            animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}
      </motion.button>

      {/* Agent Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="tap-agent-panel"
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            {/* Header */}
            <div className="tap-agent-header">
              <div className="tap-agent-header-left">
                <Bot className="tap-agent-header-icon" />
                <div>
                  <h3 className="tap-agent-title">Tap Agent</h3>
                  <p className="tap-agent-subtitle">
                    {isExecuting ? (
                      <span className="tap-agent-status-executing">
                        <Activity className="tap-agent-status-icon" />
                        Executing...
                      </span>
                    ) : isListening ? (
                      <span className="tap-agent-status-listening">
                        <Mic className="tap-agent-status-icon" />
                        Listening...
                      </span>
                    ) : isSpeaking ? (
                      <span className="tap-agent-status-speaking">
                        <Volume2 className="tap-agent-status-icon" />
                        Speaking...
                      </span>
                    ) : (
                      <span className="tap-agent-status-online">
                        <Sparkles className="tap-agent-status-icon" />
                        Ready to assist
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <button onClick={toggleAgent} className="tap-agent-close-btn">
                <X size={20} />
              </button>
            </div>

            {/* Execution Progress */}
            <AnimatePresence>
              {executionProgress && (
                <motion.div
                  className="tap-agent-progress"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <div className="tap-agent-progress-header">
                    <Zap className="tap-agent-progress-icon" />
                    <span>
                      Step {executionProgress.currentStep} of {executionProgress.totalSteps}
                    </span>
                  </div>
                  <div className="tap-agent-progress-bar">
                    <motion.div
                      className="tap-agent-progress-fill"
                      initial={{ width: 0 }}
                      animate={{
                        width: `${(executionProgress.currentStep / executionProgress.totalSteps) * 100}%`
                      }}
                    />
                  </div>
                  <p className="tap-agent-progress-text">
                    {executionProgress.stepDescription}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Content */}
            <div className="tap-agent-content">
              {/* Current Command */}
              {currentCommand && (
                <div className="tap-agent-current-command">
                  <p className="tap-agent-command-label">Current Command:</p>
                  <p className="tap-agent-command-text">{currentCommand}</p>
                </div>
              )}

              {/* Suggestions */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="tap-agent-suggestions">
                  <div
                    className="tap-agent-suggestions-header"
                    onClick={() => setShowSuggestions(!showSuggestions)}
                  >
                    <p className="tap-agent-suggestions-title">Suggested Commands</p>
                    {showSuggestions ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                  <AnimatePresence>
                    {showSuggestions && (
                      <motion.div
                        className="tap-agent-suggestions-list"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        {suggestions.map((suggestion, index) => (
                          <motion.button
                            key={index}
                            className="tap-agent-suggestion-btn"
                            onClick={() => handleSuggestionClick(suggestion)}
                            disabled={isExecuting}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <Sparkles size={14} />
                            {suggestion}
                          </motion.button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* History */}
              {executionHistory.length > 0 && (
                <div className="tap-agent-history">
                  <div className="tap-agent-history-header">
                    <p className="tap-agent-history-title">
                      Execution History ({executionHistory.length})
                    </p>
                    <button
                      onClick={clearHistory}
                      className="tap-agent-history-clear"
                      title="Clear history"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="tap-agent-history-list">
                    {executionHistory.map((entry) => (
                      <motion.div
                        key={entry.id}
                        className={`tap-agent-history-item ${
                          entry.result.success ? 'success' : 'error'
                        }`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                      >
                        <div className="tap-agent-history-item-header">
                          {entry.result.success ? (
                            <CheckCircle className="tap-agent-history-icon" size={16} />
                          ) : (
                            <XCircle className="tap-agent-history-icon" size={16} />
                          )}
                          <span className="tap-agent-history-command">{entry.command}</span>
                        </div>
                        <p className="tap-agent-history-result">
                          {entry.result.success
                            ? entry.result.workflow
                            : entry.result.error}
                        </p>
                        <p className="tap-agent-history-time">
                          {new Date(entry.timestamp).toLocaleTimeString()} •{' '}
                          {entry.duration}ms
                        </p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Input Footer */}
            <div className="tap-agent-footer">
              <form onSubmit={handleSubmit} className="tap-agent-input-form">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={
                    isListening
                      ? 'Listening...'
                      : isExecuting
                      ? 'Executing...'
                      : 'Type a command...'
                  }
                  className="tap-agent-input"
                  disabled={isExecuting || isListening}
                />

                {/* Voice Button */}
                <button
                  type="button"
                  onClick={handleVoiceToggle}
                  className={`tap-agent-voice-btn ${isListening ? 'listening' : ''}`}
                  disabled={isExecuting}
                  title={isListening ? 'Stop listening' : 'Start voice input'}
                >
                  {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                </button>

                {/* Speaker Button */}
                <button
                  type="button"
                  onClick={stopSpeaking}
                  className={`tap-agent-speaker-btn ${isSpeaking ? 'speaking' : ''}`}
                  disabled={!isSpeaking}
                  title={isSpeaking ? 'Stop speaking' : 'Voice output'}
                >
                  {isSpeaking ? <Volume2 size={20} /> : <VolumeX size={20} />}
                </button>

                {/* Send Button */}
                <button
                  type="submit"
                  className="tap-agent-send-btn"
                  disabled={!inputValue.trim() || isExecuting}
                  title="Execute command"
                >
                  <Send size={20} />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default TapAgent;
