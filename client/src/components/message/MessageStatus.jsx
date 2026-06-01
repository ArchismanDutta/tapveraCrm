import React from 'react';
import { Check, Clock, AlertTriangle } from 'lucide-react';

/**
 * Message status indicator (checkmarks for sent/delivered/read)
 * Only shown on messages sent by current user
 */
const MessageStatus = ({ status }) => {
  if (!status || status === 'sending') {
    return (
      <Clock className="w-4 h-4 text-gray-400 animate-spin" />
    );
  }

  if (status === 'failed') {
    return (
      <AlertTriangle className="w-4 h-4 text-red-400" title="Failed to send" />
    );
  }

  if (status === 'sent') {
    return (
      <Check className="w-4 h-4 text-gray-400" title="Sent" />
    );
  }

  if (status === 'delivered') {
    return (
      <div className="flex -space-x-1" title="Delivered">
        <Check className="w-4 h-4 text-gray-400" />
        <Check className="w-4 h-4 text-gray-400" />
      </div>
    );
  }

  if (status === 'read') {
    return (
      <div className="flex -space-x-1" title="Read">
        <Check className="w-4 h-4 text-blue-400" />
        <Check className="w-4 h-4 text-blue-400" />
      </div>
    );
  }

  return null;
};

export default MessageStatus;
