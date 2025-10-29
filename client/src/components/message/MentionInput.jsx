import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * MentionInput Component - WhatsApp-style @mention functionality
 *
 * Features:
 * - Detects @ symbol and shows user autocomplete dropdown
 * - Highlights mentions in the input
 * - Returns mentioned user IDs along with the message
 * - Keyboard navigation for dropdown (Arrow Up/Down, Enter)
 * - Click outside to close dropdown
 *
 * @param {Array} availableUsers - Array of users that can be mentioned [{_id, name, email}]
 * @param {Function} onSend - Callback with {message, mentionedUserIds}
 * @param {String} placeholder - Input placeholder text
 * @param {Boolean} disabled - Disable input
 */
const MentionInput = ({
  availableUsers = [],
  onSend,
  placeholder = "Type a message...",
  disabled = false
}) => {
  const [message, setMessage] = useState('');
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionPosition, setMentionPosition] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionedUsers, setMentionedUsers] = useState([]); // [{userId, userName, start, end}]

  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Filter users based on search
  const filteredUsers = availableUsers.filter(user =>
    user.name?.toLowerCase().includes(mentionSearch.toLowerCase()) ||
    user.email?.toLowerCase().includes(mentionSearch.toLowerCase())
  );

  // Handle text change
  const handleChange = (e) => {
    const text = e.target.value;
    const cursorPos = e.target.selectionStart;

    setMessage(text);

    // Check if @ was just typed
    const lastChar = text[cursorPos - 1];
    if (lastChar === '@') {
      setShowMentionDropdown(true);
      setMentionPosition(cursorPos);
      setMentionSearch('');
      setSelectedIndex(0);
      return;
    }

    // If mention dropdown is open, update search
    if (showMentionDropdown && mentionPosition !== null) {
      const searchText = text.slice(mentionPosition, cursorPos);

      // Check if user moved cursor away or deleted @
      if (cursorPos < mentionPosition || !text[mentionPosition - 1] || text[mentionPosition - 1] !== '@') {
        setShowMentionDropdown(false);
        setMentionPosition(null);
        setMentionSearch('');
      } else {
        setMentionSearch(searchText);
        setSelectedIndex(0);
      }
    }
  };

  // Insert mention
  const insertMention = (user) => {
    if (!mentionPosition) return;

    const beforeMention = message.slice(0, mentionPosition - 1);
    const afterMention = message.slice(inputRef.current.selectionStart);
    const mentionText = `@${user.name}`;
    const newMessage = beforeMention + mentionText + ' ' + afterMention;

    // Track this mention
    const newMention = {
      userId: user._id,
      userName: user.name,
      start: mentionPosition - 1,
      end: mentionPosition - 1 + mentionText.length
    };

    setMentionedUsers(prev => [...prev, newMention]);
    setMessage(newMessage);
    setShowMentionDropdown(false);
    setMentionPosition(null);
    setMentionSearch('');

    // Focus input and set cursor after mention
    setTimeout(() => {
      inputRef.current.focus();
      const newCursorPos = mentionPosition - 1 + mentionText.length + 1;
      inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (showMentionDropdown) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredUsers.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredUsers.length) % filteredUsers.length);
      } else if (e.key === 'Enter' && filteredUsers.length > 0) {
        e.preventDefault();
        insertMention(filteredUsers[selectedIndex]);
      } else if (e.key === 'Escape') {
        setShowMentionDropdown(false);
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Handle send
  const handleSend = () => {
    if (!message.trim()) return;

    // Extract unique user IDs from mentions
    const uniqueMentionedUserIds = [...new Set(mentionedUsers.map(m => m.userId))];

    onSend({
      message: message.trim(),
      mentionedUserIds: uniqueMentionedUserIds
    });

    // Reset state
    setMessage('');
    setMentionedUsers([]);
    setShowMentionDropdown(false);
    setMentionPosition(null);
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
          inputRef.current && !inputRef.current.contains(event.target)) {
        setShowMentionDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="mention-input-container relative w-full">
      <div className="flex items-end gap-2 bg-white border border-gray-300 rounded-lg p-2">
        <textarea
          ref={inputRef}
          value={message}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 resize-none border-none outline-none text-sm max-h-32 min-h-[40px] bg-transparent"
          rows={1}
          style={{
            height: 'auto',
            minHeight: '40px'
          }}
          onInput={(e) => {
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
          }}
        />

        <button
          onClick={handleSend}
          disabled={disabled || !message.trim()}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Send
        </button>
      </div>

      {/* Mention Dropdown */}
      {showMentionDropdown && filteredUsers.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute bottom-full mb-2 left-0 w-full max-w-sm bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto z-50"
        >
          <div className="p-2 text-xs text-gray-500 border-b">
            Select a user to mention
          </div>
          {filteredUsers.map((user, index) => (
            <div
              key={user._id}
              onClick={() => insertMention(user)}
              className={`p-3 cursor-pointer hover:bg-blue-50 flex items-center gap-3 ${
                index === selectedIndex ? 'bg-blue-100' : ''
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-semibold">
                {user.name?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">{user.name}</div>
                <div className="text-xs text-gray-500">{user.email}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mentioned Users Display */}
      {mentionedUsers.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {mentionedUsers.map((mention, index) => (
            <div
              key={index}
              className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs"
            >
              <span>@{mention.userName}</span>
              <button
                onClick={() => {
                  // Remove mention from message
                  const beforeMention = message.slice(0, mention.start);
                  const afterMention = message.slice(mention.end);
                  setMessage(beforeMention + afterMention);
                  setMentionedUsers(prev => prev.filter((_, i) => i !== index));
                }}
                className="hover:text-blue-900"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="text-xs text-gray-500 mt-1">
        Type @ to mention someone
      </div>
    </div>
  );
};

export default MentionInput;
