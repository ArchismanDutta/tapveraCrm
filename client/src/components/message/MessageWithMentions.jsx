import React from 'react';

/**
 * MessageWithMentions Component - Displays message text with highlighted mentions
 *
 * Features:
 * - Parses @mentions in message text
 * - Highlights mentions with blue background
 * - Shows user info on hover
 *
 * @param {String} message - The message text containing @mentions
 * @param {Array} mentions - Array of mentioned users from DB [{user: {_id, name}, userModel}]
 * @param {String} currentUserId - Current user's ID to highlight self-mentions
 */
const MessageWithMentions = ({ message, mentions = [], currentUserId }) => {
  // Parse message and replace @mentions with styled spans
  const parseMessageWithMentions = () => {
    if (!mentions || mentions.length === 0) {
      return <span>{message}</span>;
    }

    // Create a regex pattern to match all @mentions
    const mentionPattern = /@(\w+(\s+\w+)*)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = mentionPattern.exec(message)) !== null) {
      // Add text before mention
      if (match.index > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`}>
            {message.slice(lastIndex, match.index)}
          </span>
        );
      }

      // Check if this mention matches any user in mentions array
      const mentionedName = match[1];
      const mentionedUser = mentions.find(m =>
        m.user?.name?.toLowerCase() === mentionedName.toLowerCase()
      );

      // Add highlighted mention
      const isCurrentUser = mentionedUser?.user?._id === currentUserId;
      parts.push(
        <span
          key={`mention-${match.index}`}
          className={`inline-block px-1.5 py-0.5 rounded ${
            isCurrentUser
              ? 'bg-yellow-200 text-yellow-900 font-semibold'
              : 'bg-blue-100 text-blue-700 font-medium'
          }`}
          title={mentionedUser?.user?.email || `@${mentionedName}`}
        >
          @{mentionedName}
        </span>
      );

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < message.length) {
      parts.push(
        <span key={`text-${lastIndex}`}>
          {message.slice(lastIndex)}
        </span>
      );
    }

    return parts.length > 0 ? parts : <span>{message}</span>;
  };

  return (
    <div className="message-with-mentions whitespace-pre-wrap break-words">
      {parseMessageWithMentions()}
    </div>
  );
};

export default MessageWithMentions;
