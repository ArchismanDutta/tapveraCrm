import React, { useState, useRef, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import { AtSign, Users } from 'lucide-react';
import { findMentions, mentionCandidates } from '../../utils/mentions';

/**
 * MentionInput - A textarea with @ mention autocomplete functionality
 *
 * Features:
 * - Detects @ symbol and shows user dropdown
 * - Filters users based on typed text after @
 * - Keyboard navigation (Arrow keys, Enter, Escape)
 * - Click to select user
 * - Tracks mentioned users for backend submission
 * - Supports multiline text
 *
 * Props:
 * @param {string} value - Current textarea value
 * @param {function} onChange - Callback when value changes (value, mentionedUsers)
 * @param {array} users - Array of users to mention [{_id, name, email}]
 * @param {string} placeholder - Placeholder text
 * @param {number} rows - Number of textarea rows (default: 3)
 * @param {string} className - Additional CSS classes
 * @param {boolean} disabled - Disable input
 * @param {function} onKeyDown - Additional keydown handler
 */
const MentionInput = forwardRef(({
  value,
  onChange,
  users = [],
  placeholder = "Type @ to mention someone...",
  rows = 3,
  className = "",
  disabled = false,
  onKeyDown,
  currentUserId,
}, ref) => {
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [mentionedUsers, setMentionedUsers] = useState([]); // Track mentioned users
  const textareaRef = useRef(null);
  const dropdownRef = useRef(null);

  // Expose textarea ref to parent component
  useImperativeHandle(ref, () => textareaRef.current);

  // @everyone first, then the members, minus yourself — mentioning yourself
  // notifies nobody, so offering it is just a way to waste a click.
  const candidates = useMemo(
    () => mentionCandidates(users, currentUserId),
    [users, currentUserId]
  );

  const filteredUsers = useMemo(
    () =>
      candidates.filter((user) =>
        user.name?.toLowerCase().includes(mentionSearch.toLowerCase())
      ),
    [candidates, mentionSearch]
  );

  // Detect @ symbol and show dropdown
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setShowMentionDropdown(false);
      return;
    }

    if (!value) {
      setShowMentionDropdown(false);
      return;
    }

    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPos);

    // Find the last @ before cursor
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    // If no @ found, hide dropdown
    if (lastAtIndex === -1) {
      setShowMentionDropdown(false);
      return;
    }

    // Check if @ is at start or preceded by whitespace
    const charBeforeAt = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' ';

    if (charBeforeAt === ' ' || charBeforeAt === '\n' || lastAtIndex === 0) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);

      // Only show dropdown if there's no space after @ and it's recent
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        setMentionSearch(textAfterAt);
        setShowMentionDropdown(true);
        setSelectedMentionIndex(0);
        return;
      }
    }

    // Hide dropdown if conditions not met
    setShowMentionDropdown(false);
  }, [value, cursorPosition, users]);

  // Handle mention selection
  const insertMention = (user) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPos);
    const textAfterCursor = value.substring(cursorPos);

    // Find the @ symbol position
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const beforeAt = value.substring(0, lastAtIndex);
      const mentionText = `@${user.name} `;
      const newValue = beforeAt + mentionText + textAfterCursor;

      // Update mentioned users list
      const updatedMentionedUsers = [...mentionedUsers];
      if (!updatedMentionedUsers.find(u => u._id === user._id)) {
        updatedMentionedUsers.push(user);
      }
      setMentionedUsers(updatedMentionedUsers);

      // Call onChange with new value and mentioned users
      onChange(newValue, updatedMentionedUsers);

      // Set cursor position after mention
      setTimeout(() => {
        const newCursorPos = beforeAt.length + mentionText.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();
      }, 0);
    }

    setShowMentionDropdown(false);
    setMentionSearch('');
  };

  // Handle keyboard navigation in dropdown
  const handleKeyDown = (e) => {
    if (showMentionDropdown && filteredUsers.length > 0) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedMentionIndex((prev) =>
            prev < filteredUsers.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedMentionIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;
        case 'Enter':
          if (!e.shiftKey) {
            e.preventDefault();
            insertMention(filteredUsers[selectedMentionIndex]);
            return;
          }
          break;
        case 'Escape':
          e.preventDefault();
          setShowMentionDropdown(false);
          break;
        default:
          break;
      }
    }

    // Call parent's onKeyDown if provided
    if (onKeyDown) {
      onKeyDown(e);
    }
  };

  // Update cursor position on selection change
  const handleSelectionChange = () => {
    if (textareaRef.current) {
      setCursorPosition(textareaRef.current.selectionStart);
    }
  };

  // Handle input change
  const handleChange = (e) => {
    const newValue = e.target.value;

    // Update cursor position immediately
    setCursorPosition(e.target.selectionStart);

    // Re-derive the mention list from the text on every keystroke, so deleting
    // part of a name un-mentions that person — the behaviour people expect from
    // WhatsApp and Slack.
    //
    // The matching lives in utils/mentions.js. It used to be a greedy regex
    // here, which swallowed the rest of the sentence into the name and dropped
    // the mention entirely unless it happened to be the last thing typed.
    const mentionsInText = findMentions(newValue, candidates);

    setMentionedUsers(mentionsInText);
    onChange(newValue, mentionsInText);
  };

  // Scroll selected item into view
  useEffect(() => {
    if (dropdownRef.current && showMentionDropdown) {
      const selectedElement = dropdownRef.current.querySelector(`[data-index="${selectedMentionIndex}"]`);
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedMentionIndex, showMentionDropdown]);

  // Calculate dropdown position (show below input, smart positioning)
  const [dropdownPosition, setDropdownPosition] = useState('bottom');

  const getDropdownStyle = () => {
    if (dropdownPosition === 'top') {
      return {
        bottom: '100%',
        left: 0,
        right: 0,
        marginBottom: '0.25rem',
      };
    }
    return {
      top: '100%',
      left: 0,
      right: 0,
      marginTop: '0.25rem',
    };
  };

  // Check if dropdown should appear above or below
  useEffect(() => {
    if (showMentionDropdown && textareaRef.current) {
      const textarea = textareaRef.current;
      const rect = textarea.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      // If less than 300px below, show above
      if (spaceBelow < 300 && spaceAbove > spaceBelow) {
        setDropdownPosition('top');
      } else {
        setDropdownPosition('bottom');
      }
    }
  }, [showMentionDropdown]);

  // Auto-resize the textarea to its content height, capped at ~5 lines
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showMentionDropdown &&
          dropdownRef.current &&
          !dropdownRef.current.contains(event.target) &&
          textareaRef.current &&
          !textareaRef.current.contains(event.target)) {
        setShowMentionDropdown(false);
      }
    };

    if (showMentionDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showMentionDropdown]);

  return (
    <div className="relative w-full">
      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onKeyUp={handleSelectionChange}
        onSelect={handleSelectionChange}
        onClick={handleSelectionChange}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        // ─── `block` IS LOAD-BEARING ───
        // A textarea is `inline-block` by default, so it sits on the text
        // baseline and leaves ~7px of descender space beneath it inside its
        // wrapper. In the chat composers that wrapper is a flex item next to
        // two 44px buttons: the wrapper measured 51px while the input itself
        // was 44px, so centring the row put the input about 3.5px above the
        // buttons. The composer looked subtly crooked and nothing in the
        // Tailwind classes explained why. `block` removes the baseline gap and
        // the wrapper collapses to the input's real height.
        //
        // ─── COLOURS ARE THE CALLER'S ───
        // This used to hardcode `border-gray-300` and `focus:ring-blue-500`.
        // Both callers pass their own border and focus colours, so the
        // hardcoded ones were duplicate utilities in the same class attribute —
        // and which one wins is decided by Tailwind's output order, not by the
        // order they're written here. That made the project composer render a
        // BLUE focus ring against its teal send button. Structural utilities
        // stay; anything visual comes from `className`.
        className={`block w-full resize-none border px-3 py-2 focus:border-transparent focus:ring-2 ${className}`}
      />

      {/* Mention Dropdown */}
      {showMentionDropdown && (
        <div
          ref={dropdownRef}
          style={getDropdownStyle()}
          className="absolute z-[9999] w-full sm:max-w-xs bg-white border border-gray-300 rounded-lg shadow-2xl max-h-48 sm:max-h-64 overflow-y-auto"
        >
          <div className="px-2 py-1.5 bg-gray-50 border-b border-gray-200 flex items-center gap-1.5 sticky top-0 z-10">
            <AtSign size={12} className="text-gray-500 flex-shrink-0" />
            <span className="text-[10px] sm:text-xs text-gray-600 font-medium">
              Mention {filteredUsers.length > 0 && `(${filteredUsers.length})`}
            </span>
          </div>

          {filteredUsers.length > 0 ? (
            filteredUsers.map((user, index) => (
              <div
                key={user._id}
                data-index={index}
                onClick={() => insertMention(user)}
                className={`px-2 sm:px-3 py-1.5 sm:py-2 cursor-pointer transition-colors ${
                  index === selectedMentionIndex
                    ? 'bg-blue-100 border-l-2 sm:border-l-4 border-blue-500'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div
                    className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-white text-xs sm:text-sm font-semibold flex-shrink-0 ${
                      user.isEveryone
                        ? "bg-gradient-to-br from-amber-400 to-orange-500"
                        : "bg-gradient-to-br from-blue-400 to-purple-500"
                    }`}
                  >
                    {user.isEveryone ? (
                      <Users size={14} />
                    ) : (
                      user.name?.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                      {user.isEveryone ? "everyone" : user.name}
                    </div>
                    {user.isEveryone ? (
                      // Says how many people this will actually ping, so nobody
                      // fires it into a 40-person group by accident.
                      <div className="text-[10px] sm:text-xs text-amber-700 truncate">
                        Notify all {Math.max(candidates.length - 1, 0)} members
                      </div>
                    ) : (
                      user.email && (
                        <div className="text-[10px] sm:text-xs text-gray-500 truncate hidden sm:block">
                          {user.email}
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="px-3 py-3 text-center text-xs text-gray-500">
              {users.length === 0 ? 'No users available to mention' : 'No users match your search'}
            </div>
          )}
        </div>
      )}

    </div>
  );
});

export default MentionInput;
