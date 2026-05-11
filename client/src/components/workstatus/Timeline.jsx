// src/components/workstatus/Timeline.jsx
import React from "react";
import timeUtils from "../../utils/timeUtils";

// Helper: format ISO timestamp to "hh:mm AM/PM" using Option C (UTC extraction)
export const formatLocalTime = (isoString) => {
  if (!isoString) return "--";
  try {
    // CRITICAL: Use timeUtils.formatTime which extracts UTC components
    // This is Option C approach - timestamps are stored as local time in UTC format
    return timeUtils.formatTime(isoString);
  } catch (error) {
    console.error("Error formatting time:", error);
    return "--";
  }
};

// Event type to color mapping
const getEventTypeColor = (type) => {
  const eventType = type.toLowerCase();
  if (eventType.includes("punch in")) return "from-green-500 to-emerald-500";
  if (eventType.includes("punch out")) return "from-red-500 to-pink-500";
  if (eventType.includes("break")) return "from-orange-500 to-amber-500";
  if (eventType.includes("resume")) return "from-blue-500 to-cyan-500";
  return "from-purple-500 to-indigo-500";
};

// Event type to icon mapping
const getEventIcon = (type) => {
  const eventType = type.toLowerCase();

  if (eventType.includes("punch in")) {
    return (
      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414 1.414L10.586 9.5 9.293 10.793a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414z"
          clipRule="evenodd"
        />
      </svg>
    );
  }

  if (eventType.includes("punch out")) {
    return (
      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-10.293a1 1 0 00-1.414-1.414L9 9.586 6.707 7.293a1 1 0 00-1.414 1.414L8.586 12l-3.293 3.293a1 1 0 001.414 1.414L10 13.414l3.293 3.293a1 1 0 001.414-1.414L11.414 12l3.293-3.293z"
          clipRule="evenodd"
        />
      </svg>
    );
  }

  if (eventType.includes("break")) {
    return (
      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
          clipRule="evenodd"
        />
      </svg>
    );
  }

  if (eventType.includes("resume")) {
    return (
      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
          clipRule="evenodd"
        />
      </svg>
    );
  }

  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
        clipRule="evenodd"
      />
    </svg>
  );
};

const Timeline = ({ timeline = [] }) => {
  // Validate and filter timeline data
  const validTimeline = timeline.filter((item) => {
    return (
      item && item.type && item.time && !isNaN(new Date(item.time).getTime())
    );
  });

  // Sort timeline by time (most recent first)
  const sortedTimeline = validTimeline.slice().sort((a, b) => {
    try {
      return new Date(b.time) - new Date(a.time);
    } catch (error) {
      console.error("Error sorting timeline:", error);
      return 0;
    }
  });

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-lg shadow-xl p-3 transition-all h-full flex flex-col max-h-[300px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-white">Timeline</h3>
        <div className="w-6 h-6 bg-gradient-to-r from-indigo-500 to-purple-500 rounded flex items-center justify-center">
          <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
        </div>
      </div>

      {/* Timeline Content */}
      {sortedTimeline.length === 0 ? (
        <div className="text-center py-6 flex-1 flex items-center justify-center">
          <p className="text-slate-400 text-xs">No events yet</p>
        </div>
      ) : (
        <div className="space-y-1.5 flex-1 overflow-y-auto min-h-0">
          {sortedTimeline.map((item, index) => {
            try {
              return (
                <div
                  key={`${item.time}-${index}`}
                  className="flex items-center justify-between bg-slate-900/40 hover:bg-slate-900/60 border border-slate-700/30 p-2 rounded transition-all"
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 bg-gradient-to-r ${getEventTypeColor(item.type)} rounded flex items-center justify-center text-white`}>
                      {getEventIcon(item.type)}
                    </div>
                    <p className="text-xs font-medium text-white">{item.type}</p>
                  </div>
                  <p className="font-mono font-bold text-white text-xs">{formatLocalTime(item.time)}</p>
                </div>
              );
            } catch (error) {
              console.error("Error rendering timeline item:", error, item);
              return null;
            }
          })}
        </div>
      )}
    </div>
  );
};

export default Timeline;
