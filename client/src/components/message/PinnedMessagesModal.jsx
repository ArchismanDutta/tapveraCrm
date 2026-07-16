import React, { useState, useEffect } from 'react';
import { X, Pin, ExternalLink } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import API from '../../api';

const PinnedMessagesModal = ({ projectId, onClose, onJumpToMessage }) => {
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPinnedMessages();
  }, [projectId]);

  const fetchPinnedMessages = async () => {
    try {
      setLoading(true);
      const res = await API.get(`/api/projects/${projectId}/messages/pinned`);
      setPinnedMessages(res.data);
    } catch (error) {
      console.error('Error fetching pinned messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnpin = async (messageId) => {
    try {
      await API.delete(`/api/projects/${projectId}/messages/${messageId}/pin`);
      setPinnedMessages(prev => prev.filter(m => m._id !== messageId));
    } catch (error) {
      console.error('Error unpinning message:', error);
      alert('Failed to unpin message');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 dark:border-[#2a3942] dark:bg-[#111b21] dark:shadow-black/40"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 p-6 dark:border-[#2a3942]">
          <div className="flex items-center gap-3">
            <Pin className="h-5 w-5 text-teal-500 dark:text-[#00a884]" />
            <h2 className="text-xl font-semibold text-slate-950 dark:text-white">
              Pinned Messages ({pinnedMessages.length}/5)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-[#2a3942]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-slate-50 p-6 dark:bg-[#0b141a]">
          {loading ? (
            <div className="flex justify-center items-center h-full">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-500/30 border-t-teal-500"></div>
            </div>
          ) : pinnedMessages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-slate-500 dark:text-gray-400">
              <Pin className="mb-3 h-12 w-12 opacity-50" />
              <p className="text-sm">No pinned messages yet</p>
              <p className="text-xs mt-1">Admins can pin important messages (max 5)</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pinnedMessages.map((msg) => (
                <div
                  key={msg._id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-teal-300 dark:border-[#2a3942] dark:bg-[#202c33] dark:hover:border-[#00a884]"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium text-slate-950 dark:text-white">
                        {msg.sentBy?.name || 'Unknown'}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-gray-400">
                        {new Date(msg.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          onJumpToMessage(msg._id);
                          onClose();
                        }}
                        className="rounded p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-[#2a3942]"
                        title="Jump to message"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleUnpin(msg._id)}
                        className="rounded p-2 transition hover:bg-red-50 dark:hover:bg-red-900/30"
                        title="Unpin message"
                      >
                        <Pin className="h-4 w-4 text-red-500 dark:text-red-400" />
                      </button>
                    </div>
                  </div>
                  <div className="prose prose-slate prose-sm max-w-none text-slate-700 dark:prose-invert dark:text-gray-200">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.message}
                    </ReactMarkdown>
                  </div>
                  <p className="mt-3 text-xs text-slate-500 dark:text-gray-500">
                    Pinned by {msg.pinnedBy?.name} on{' '}
                    {new Date(msg.pinnedAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PinnedMessagesModal;
