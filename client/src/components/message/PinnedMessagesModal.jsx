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
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-[#111b21] rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] flex flex-col border border-[#2a3942]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#2a3942]">
          <div className="flex items-center gap-3">
            <Pin className="w-5 h-5 text-[#00a884]" />
            <h2 className="text-xl font-semibold text-white">
              Pinned Messages ({pinnedMessages.length}/5)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#2a3942] rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#0b141a]">
          {loading ? (
            <div className="flex justify-center items-center h-full">
              <div className="w-8 h-8 border-4 border-[#25D366] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : pinnedMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Pin className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm">No pinned messages yet</p>
              <p className="text-xs mt-1">Admins can pin important messages (max 5)</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pinnedMessages.map((msg) => (
                <div
                  key={msg._id}
                  className="bg-[#202c33] border border-[#2a3942] rounded-lg p-4 hover:border-[#00a884] transition shadow-sm"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {msg.sentBy?.name || 'Unknown'}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(msg.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          onJumpToMessage(msg._id);
                          onClose();
                        }}
                        className="p-2 hover:bg-[#2a3942] rounded transition"
                        title="Jump to message"
                      >
                        <ExternalLink className="w-4 h-4 text-gray-400" />
                      </button>
                      <button
                        onClick={() => handleUnpin(msg._id)}
                        className="p-2 hover:bg-red-900/30 rounded transition"
                        title="Unpin message"
                      >
                        <Pin className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </div>
                  <div className="prose prose-sm max-w-none text-gray-200 prose-invert">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.message}
                    </ReactMarkdown>
                  </div>
                  <p className="text-xs text-gray-500 mt-3">
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
