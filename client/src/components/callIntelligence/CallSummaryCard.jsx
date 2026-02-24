import React, { useState, useEffect } from "react";
import {
  PhoneCall,
  Calendar,
  Timer,
  Target,
  ListChecks,
  ThumbsUp,
  ThumbsDown,
  Minus,
  ExternalLink,
  MessageSquare,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const CallSummaryCard = ({ phoneNumber, leadId, callbackId }) => {
  const navigate = useNavigate();
  const [recording, setRecording] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSummary();
  }, [phoneNumber, leadId, callbackId]);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");

      let url = null;
      if (leadId) {
        url = `${API_BASE}/api/call-intelligence/lead/${leadId}`;
      } else if (callbackId) {
        url = `${API_BASE}/api/call-intelligence/callback/${callbackId}`;
      } else if (phoneNumber) {
        const cleanPhone = phoneNumber.replace(/[^\d+]/g, "");
        if (cleanPhone) {
          url = `${API_BASE}/api/call-intelligence/phone-summary/${encodeURIComponent(cleanPhone)}`;
        }
      }

      if (!url) {
        setLoading(false);
        return;
      }

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (data.success) {
        // Handle both array and single object responses
        if (Array.isArray(data.data)) {
          setRecording(data.data.length > 0 ? data.data[0] : null);
        } else {
          setRecording(data.data);
        }
      }
    } catch (error) {
      console.error("Error fetching call summary:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getSentimentIcon = (sentiment) => {
    switch (sentiment) {
      case "Very Positive":
      case "Positive":
        return <ThumbsUp size={12} className="text-green-400" />;
      case "Negative":
      case "Very Negative":
        return <ThumbsDown size={12} className="text-red-400" />;
      default:
        return <Minus size={12} className="text-gray-400" />;
    }
  };

  const getSentimentBorderColor = (sentiment) => {
    switch (sentiment) {
      case "Very Positive":
      case "Positive":
        return "border-l-green-500";
      case "Negative":
      case "Very Negative":
        return "border-l-red-500";
      default:
        return "border-l-gray-500";
    }
  };

  const getOutcomeColor = (outcome) => {
    switch (outcome) {
      case "Interested":
      case "Deal Closed":
        return "text-green-400";
      case "Follow Up Required":
      case "Callback Scheduled":
        return "text-blue-400";
      case "Not Interested":
      case "Wrong Number":
        return "text-red-400";
      default:
        return "text-gray-400";
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-800/30 rounded-lg p-3 animate-pulse">
        <div className="h-3 bg-slate-700 rounded w-1/3 mb-2"></div>
        <div className="h-3 bg-slate-700 rounded w-2/3"></div>
      </div>
    );
  }

  if (!recording) {
    return (
      <div className="bg-slate-800/30 rounded-lg p-3 text-center">
        <p className="text-gray-500 text-xs">No call recordings found</p>
      </div>
    );
  }

  return (
    <div
      className={`bg-slate-800/40 rounded-lg p-3 border-l-2 ${getSentimentBorderColor(recording.clientSentiment)}`}
    >
      {/* Header Row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <PhoneCall size={11} className="text-cyan-400" />
            Last Call
          </span>
          <span className="flex items-center gap-1">
            <Calendar size={11} />
            {formatDate(recording.callDate)}
          </span>
          <span className="flex items-center gap-1">
            <Timer size={11} />
            {formatDuration(recording.callDurationSeconds)}
          </span>
        </div>
        <button
          onClick={() => navigate("/call-intelligence")}
          className="text-cyan-400 hover:text-cyan-300 transition-colors"
          title="View Full Analysis"
        >
          <ExternalLink size={14} />
        </button>
      </div>

      {/* Summary */}
      {recording.summary && (
        <p className="text-xs text-gray-300 mb-2 line-clamp-2">
          {recording.summary}
        </p>
      )}

      {/* Tags Row */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {recording.callOutcome && (
          <span className={`flex items-center gap-1 ${getOutcomeColor(recording.callOutcome)}`}>
            <Target size={11} />
            {recording.callOutcome}
          </span>
        )}
        {recording.clientSentiment && (
          <span className="flex items-center gap-1 text-gray-400">
            {getSentimentIcon(recording.clientSentiment)}
            {recording.clientSentiment}
          </span>
        )}
        {recording.promisesMade?.length > 0 && (
          <span className="flex items-center gap-1 text-yellow-400">
            <ListChecks size={11} />
            {recording.promisesMade.length} promise{recording.promisesMade.length > 1 ? "s" : ""}
          </span>
        )}
        {recording.actionItems?.length > 0 && (
          <span className="flex items-center gap-1 text-blue-400">
            <MessageSquare size={11} />
            {recording.actionItems.length} action item{recording.actionItems.length > 1 ? "s" : ""}
          </span>
        )}
      </div>
    </div>
  );
};

export default CallSummaryCard;
