import React from 'react';

/**
 * Typing indicator showing "{Name} is typing..." with bouncing dots
 */
const TypingIndicator = ({ typingUsers }) => {
  if (!typingUsers || typingUsers.length === 0) {
    return null;
  }

  // Show max 3 users typing
  const displayUsers = typingUsers.slice(0, 3);
  const names = displayUsers.map(u => u.userName).join(', ');

  return (
    <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 dark:border-[#2a3942] dark:bg-[#202c33]">
      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-gray-300">
        <span>{names} {typingUsers.length === 1 ? 'is' : 'are'} typing</span>
        <div className="flex gap-1">
          <span
            className="h-2 w-2 animate-bounce rounded-full bg-teal-500"
            style={{ animationDelay: '0ms', animationDuration: '1.4s' }}
          />
          <span
            className="h-2 w-2 animate-bounce rounded-full bg-teal-500"
            style={{ animationDelay: '200ms', animationDuration: '1.4s' }}
          />
          <span
            className="h-2 w-2 animate-bounce rounded-full bg-teal-500"
            style={{ animationDelay: '400ms', animationDuration: '1.4s' }}
          />
        </div>
      </div>
    </div>
  );
};

export default TypingIndicator;
