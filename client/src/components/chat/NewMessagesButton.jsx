import React from 'react';
import { ArrowDown } from 'lucide-react';

const NewMessagesButton = ({ count, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-24 right-8 bg-[#00a884] hover:bg-[#008f6f] text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 transition-all hover:scale-105 z-10"
    >
      <ArrowDown className="w-4 h-4" />
      <span className="text-sm font-medium">
        {count > 0 ? `${count} new message${count !== 1 ? 's' : ''}` : 'Scroll to bottom'}
      </span>
    </button>
  );
};

export default NewMessagesButton;
