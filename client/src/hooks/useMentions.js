import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * useMentions Hook - Adds @mention functionality to any textarea
 *
 * Usage:
 * const { mentionProps, MentionDropdown, getMentionedUserIds, clearMentions } = useMentions(availableUsers);
 *
 * <textarea {...mentionProps} />
 * <MentionDropdown />
 */
export const useMentions = (availableUsers = []) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionPosition, setMentionPosition] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionedUsers, setMentionedUsers] = useState(new Set());
  const [cursorPos, setCursorPos] = useState(0);

  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Filter users based on search
  const filteredUsers = availableUsers.filter(user =>
    user.name?.toLowerCase().includes(mentionSearch.toLowerCase()) ||
    user.email?.toLowerCase().includes(mentionSearch.toLowerCase())
  );

  // Handle input change
  const handleInputChange = useCallback((value, selectionStart) => {
    setCursorPos(selectionStart);

    // Check if @ was just typed
    const lastChar = value[selectionStart - 1];
    if (lastChar === '@') {
      setShowDropdown(true);
      setMentionPosition(selectionStart);
      setMentionSearch('');
      setSelectedIndex(0);
      return;
    }

    // If dropdown is open, update search
    if (showDropdown && mentionPosition !== null) {
      const searchText = value.slice(mentionPosition, selectionStart);

      // Check if user moved cursor away or deleted @
      if (selectionStart < mentionPosition || !value[mentionPosition - 1] || value[mentionPosition - 1] !== '@') {
        setShowDropdown(false);
        setMentionPosition(null);
        setMentionSearch('');
      } else {
        setMentionSearch(searchText);
        setSelectedIndex(0);
      }
    }
  }, [showDropdown, mentionPosition]);

  // Insert mention into text
  const insertMention = useCallback((user, currentValue, onValueChange) => {
    if (!mentionPosition || !inputRef.current) return currentValue;

    const beforeMention = currentValue.slice(0, mentionPosition - 1);
    const afterMention = currentValue.slice(cursorPos);
    const mentionText = `@${user.name}`;
    const newValue = beforeMention + mentionText + ' ' + afterMention;

    // Track this user as mentioned
    setMentionedUsers(prev => new Set([...prev, user._id]));

    setShowDropdown(false);
    setMentionPosition(null);
    setMentionSearch('');

    // Notify value change
    if (onValueChange) {
      onValueChange(newValue);
    }

    // Set cursor after mention
    setTimeout(() => {
      if (inputRef.current) {
        const newCursorPos = mentionPosition - 1 + mentionText.length + 1;
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
        inputRef.current.focus();
      }
    }, 0);

    return newValue;
  }, [mentionPosition, cursorPos]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e, currentValue, onValueChange) => {
    if (showDropdown && filteredUsers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredUsers.length);
        return true; // Handled
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredUsers.length) % filteredUsers.length);
        return true; // Handled
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (filteredUsers[selectedIndex]) {
          e.preventDefault();
          insertMention(filteredUsers[selectedIndex], currentValue, onValueChange);
          return true; // Handled
        }
      } else if (e.key === 'Escape') {
        setShowDropdown(false);
        return true; // Handled
      }
    }
    return false; // Not handled
  }, [showDropdown, filteredUsers, selectedIndex, insertMention]);

  // Get mentioned user IDs
  const getMentionedUserIds = useCallback(() => {
    return Array.from(mentionedUsers);
  }, [mentionedUsers]);

  // Clear mentions
  const clearMentions = useCallback(() => {
    setMentionedUsers(new Set());
    setShowDropdown(false);
    setMentionPosition(null);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
          inputRef.current && !inputRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Dropdown component
  const MentionDropdown = useCallback(() => {
    if (!showDropdown || filteredUsers.length === 0) return null;

    return (
      <div
        ref={dropdownRef}
        className="absolute bottom-full mb-2 left-0 w-full max-w-sm bg-gray-800 border border-gray-600 rounded-lg shadow-xl max-h-60 overflow-y-auto z-50"
      >
        <div className="p-2 text-xs text-gray-400 border-b border-gray-700">
          @mention someone
        </div>
        {filteredUsers.map((user, index) => (
          <div
            key={user._id}
            onClick={() => {
              // This will be handled by parent passing current value
              const event = new CustomEvent('mention-select', { detail: user });
              window.dispatchEvent(event);
            }}
            className={`p-3 cursor-pointer hover:bg-gray-700 flex items-center gap-3 ${
              index === selectedIndex ? 'bg-gray-700' : ''
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-semibold">
              {user.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-200">{user.name}</div>
              <div className="text-xs text-gray-400">{user.email}</div>
            </div>
          </div>
        ))}
      </div>
    );
  }, [showDropdown, filteredUsers, selectedIndex]);

  return {
    inputRef,
    showDropdown,
    handleInputChange,
    handleKeyDown,
    insertMention,
    getMentionedUserIds,
    clearMentions,
    MentionDropdown,
    filteredUsers,
    selectedIndex,
  };
};

export default useMentions;
