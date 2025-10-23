import { useState, useEffect, useMemo, useCallback } from 'react';

/**
 * Hook for intelligent message suggestions based on chat history
 * Provides autocomplete and smart reply features
 */
const useMessageSuggestions = (conversationId, recentMessages = []) => {
  const [messageHistory, setMessageHistory] = useState([]);
  const [frequentPhrases, setFrequentPhrases] = useState([]);

  // Common professional phrases and quick replies
  const quickReplies = [
    "Thank you!",
    "Sounds good!",
    "I agree",
    "Let me check and get back to you",
    "That makes sense",
    "Good point",
    "I'll take care of it",
    "Done!",
    "Working on it",
    "Will update you soon",
    "Got it, thanks!",
    "Perfect!",
    "Understood",
    "Sure, no problem",
    "Looking into it now",
  ];

  // Task-related suggestions
  const taskSuggestions = [
    "Can you please update me on the status of",
    "When is the deadline for",
    "I've completed the task",
    "Need help with",
    "Could you review",
    "Please assign me to",
    "Updated the task status to",
    "Blocked by",
  ];

  // Project-related suggestions
  const projectSuggestions = [
    "The project is progressing well",
    "We need to discuss",
    "Budget update:",
    "Timeline adjustment needed for",
    "Client feedback:",
    "Next milestone:",
    "Risk identified:",
    "Meeting scheduled for",
  ];

  // Load message history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('message_history');
      if (stored) {
        const parsed = JSON.parse(stored);
        setMessageHistory(parsed.slice(0, 1000)); // Keep last 1000 messages
      }
    } catch (error) {
      console.error('Error loading message history:', error);
    }
  }, []);

  // Save new messages to history
  useEffect(() => {
    if (recentMessages && recentMessages.length > 0) {
      const newMessages = recentMessages
        .filter(msg => msg.text && msg.text.trim().length > 0)
        .map(msg => msg.text.trim());

      if (newMessages.length > 0) {
        setMessageHistory(prev => {
          const updated = [...new Set([...newMessages, ...prev])].slice(0, 1000);
          try {
            localStorage.setItem('message_history', JSON.stringify(updated));
          } catch (error) {
            console.error('Error saving message history:', error);
          }
          return updated;
        });
      }
    }
  }, [recentMessages]);

  // Analyze message patterns and extract frequent phrases
  useEffect(() => {
    if (messageHistory.length > 0) {
      // Count phrase frequency
      const phraseCount = {};
      messageHistory.forEach(msg => {
        const words = msg.toLowerCase().split(' ');
        // Extract 2-4 word phrases
        for (let len = 2; len <= Math.min(4, words.length); len++) {
          for (let i = 0; i <= words.length - len; i++) {
            const phrase = words.slice(i, i + len).join(' ');
            if (phrase.length > 5) { // Minimum phrase length
              phraseCount[phrase] = (phraseCount[phrase] || 0) + 1;
            }
          }
        }
      });

      // Get top phrases (used at least 3 times)
      const frequent = Object.entries(phraseCount)
        .filter(([_, count]) => count >= 3)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([phrase]) => phrase);

      setFrequentPhrases(frequent);
    }
  }, [messageHistory]);

  // Get suggestions based on current input
  const getSuggestions = useCallback((input, limit = 10) => {
    if (!input || input.trim().length < 2) {
      return [];
    }

    const inputLower = input.toLowerCase().trim();
    const suggestions = [];

    // 1. Match from message history (exact start match)
    const historyMatches = messageHistory
      .filter(msg => msg.toLowerCase().startsWith(inputLower))
      .slice(0, 5);

    suggestions.push(...historyMatches.map(text => ({
      text,
      type: 'history',
      score: 10
    })));

    // 2. Match from quick replies
    const quickMatches = quickReplies
      .filter(phrase => phrase.toLowerCase().includes(inputLower))
      .slice(0, 3);

    suggestions.push(...quickMatches.map(text => ({
      text,
      type: 'quick',
      score: 8
    })));

    // 3. Match from task suggestions
    const taskMatches = taskSuggestions
      .filter(phrase => phrase.toLowerCase().includes(inputLower))
      .slice(0, 3);

    suggestions.push(...taskMatches.map(text => ({
      text,
      type: 'task',
      score: 7
    })));

    // 4. Match from project suggestions
    const projectMatches = projectSuggestions
      .filter(phrase => phrase.toLowerCase().includes(inputLower))
      .slice(0, 3);

    suggestions.push(...projectMatches.map(text => ({
      text,
      type: 'project',
      score: 6
    })));

    // 5. Match from frequent phrases
    const frequentMatches = frequentPhrases
      .filter(phrase => phrase.includes(inputLower))
      .map(phrase => {
        // Try to construct a complete sentence
        const matchIndex = phrase.indexOf(inputLower);
        if (matchIndex === 0) {
          return phrase;
        }
        return null;
      })
      .filter(Boolean)
      .slice(0, 3);

    suggestions.push(...frequentMatches.map(text => ({
      text,
      type: 'frequent',
      score: 5
    })));

    // Remove duplicates and sort by score
    const unique = suggestions
      .filter((item, index, self) =>
        index === self.findIndex(t => t.text.toLowerCase() === item.text.toLowerCase())
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return unique;
  }, [messageHistory, frequentPhrases]);

  // Get context-aware quick replies based on last message
  const getQuickReplies = useCallback((lastMessage) => {
    if (!lastMessage) return quickReplies.slice(0, 3);

    const msgLower = lastMessage.toLowerCase();

    // Question patterns
    if (msgLower.includes('?') || msgLower.includes('can you') || msgLower.includes('could you')) {
      return [
        "Yes, I can help with that",
        "Let me check and get back to you",
        "Sure, give me a moment"
      ];
    }

    // Thanks patterns
    if (msgLower.includes('thank') || msgLower.includes('thanks')) {
      return [
        "You're welcome!",
        "Happy to help!",
        "Anytime!"
      ];
    }

    // Task completion patterns
    if (msgLower.includes('done') || msgLower.includes('completed') || msgLower.includes('finished')) {
      return [
        "Great work!",
        "Thank you for the update",
        "Perfect, moving forward"
      ];
    }

    // Urgent/help patterns
    if (msgLower.includes('urgent') || msgLower.includes('help') || msgLower.includes('issue')) {
      return [
        "Looking into it now",
        "I'll prioritize this",
        "On it!"
      ];
    }

    // Default quick replies
    return quickReplies.slice(0, 3);
  }, []);

  return {
    getSuggestions,
    getQuickReplies,
    quickReplies,
    messageHistory
  };
};

export default useMessageSuggestions;
