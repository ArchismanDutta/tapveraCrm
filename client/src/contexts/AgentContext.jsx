// AgentContext.jsx
// React Context for managing autonomous agent state

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AgentController from '../services/AgentController';
import UIAutomationService from '../services/UIAutomationService';

const AgentContext = createContext();

export const useAgent = () => {
  const context = useContext(AgentContext);
  if (!context) {
    throw new Error('useAgent must be used within AgentProvider');
  }
  return context;
};

export const AgentProvider = ({ children }) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentCommand, setCurrentCommand] = useState('');
  const [executionProgress, setExecutionProgress] = useState(null);
  const [executionHistory, setExecutionHistory] = useState([]);
  const [recognition, setRecognition] = useState(null);

  // Initialize UI Automation Service with navigate function
  useEffect(() => {
    UIAutomationService.setNavigate(navigate);
  }, [navigate]);

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognitionInstance = new SpeechRecognition();

      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = false;
      recognitionInstance.lang = 'en-US';

      recognitionInstance.onstart = () => {
        setIsListening(true);
      };

      recognitionInstance.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setCurrentCommand(transcript);
        setIsListening(false);

        // Auto-execute the command
        executeCommand(transcript);
      };

      recognitionInstance.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionInstance.onend = () => {
        setIsListening(false);
      };

      setRecognition(recognitionInstance);
    }
  }, []);

  // Toggle agent panel
  const toggleAgent = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  // Start voice recognition
  const startListening = useCallback(() => {
    if (recognition && !isListening) {
      try {
        recognition.start();
      } catch (error) {
        console.error('Error starting recognition:', error);
      }
    }
  }, [recognition, isListening]);

  // Stop voice recognition
  const stopListening = useCallback(() => {
    if (recognition && isListening) {
      recognition.stop();
    }
  }, [recognition, isListening]);

  // Speak text using Web Speech API
  const speak = useCallback((text) => {
    if ('speechSynthesis' in window) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    }
  }, []);

  // Stop speaking
  const stopSpeaking = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  // Execute a command
  const executeCommand = useCallback(async (command) => {
    if (!command || !command.trim()) {
      return;
    }

    setIsExecuting(true);
    setExecutionProgress(null);

    const startTime = Date.now();

    try {
      // Speak confirmation
      speak(`Executing: ${command}`);

      // Execute the command
      const result = await AgentController.executeCommand(command, (progress) => {
        setExecutionProgress(progress);
      });

      const duration = Date.now() - startTime;

      // Add to history
      const historyEntry = {
        id: Date.now(),
        command,
        result,
        timestamp: new Date().toISOString(),
        duration
      };

      setExecutionHistory(prev => [historyEntry, ...prev.slice(0, 9)]);

      // Speak result
      if (result.success) {
        speak(`Done! ${result.workflow} completed successfully.`);
      } else {
        speak(`Failed: ${result.error}`);
      }

    } catch (error) {
      console.error('Command execution error:', error);
      speak(`Error: ${error.message}`);

      const historyEntry = {
        id: Date.now(),
        command,
        result: { success: false, error: error.message },
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime
      };

      setExecutionHistory(prev => [historyEntry, ...prev.slice(0, 9)]);
    } finally {
      setIsExecuting(false);
      setExecutionProgress(null);
    }
  }, [speak]);

  // Execute command by text input
  const executeTextCommand = useCallback((command) => {
    setCurrentCommand(command);
    executeCommand(command);
  }, [executeCommand]);

  // Clear history
  const clearHistory = useCallback(() => {
    setExecutionHistory([]);
  }, []);

  // Get suggestions based on user role
  const getSuggestions = useCallback(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return AgentController.getSuggestions(user.role || 'employee');
  }, []);

  const value = {
    // State
    isOpen,
    isListening,
    isSpeaking,
    isExecuting,
    currentCommand,
    executionProgress,
    executionHistory,

    // Actions
    toggleAgent,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    executeCommand: executeTextCommand,
    clearHistory,
    getSuggestions,

    // Setters
    setCurrentCommand,
  };

  return (
    <AgentContext.Provider value={value}>
      {children}
    </AgentContext.Provider>
  );
};
