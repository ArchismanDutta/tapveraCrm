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
    <div className="sticky top-0 z-10 my-4 flex justify-center">
      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500 shadow-sm dark:border-white/10 dark:bg-[#374151] dark:text-[#9CA3AF]">
        {label}
      </span>
    </div>
  );
};

export default MessageDateSeparator;
