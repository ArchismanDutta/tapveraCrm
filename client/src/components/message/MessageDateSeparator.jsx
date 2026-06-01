import React from 'react';

/**
 * Date separator showing "Today", "Yesterday", or formatted date
 */
const MessageDateSeparator = ({ date }) => {
  const now = new Date();
  const messageDate = new Date(date);
  let label;

  const isToday = now.toDateString() === messageDate.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = yesterday.toDateString() === messageDate.toDateString();

  if (isToday) {
    label = 'Today';
  } else if (isYesterday) {
    label = 'Yesterday';
  } else {
    label = messageDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: messageDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  }

  return (
    <div className="flex justify-center my-4 sticky top-0 z-10">
      <span className="bg-[#374151] text-[#9CA3AF] rounded-full px-3 py-1 text-xs font-medium shadow-sm">
        {label}
      </span>
    </div>
  );
};

export default MessageDateSeparator;
