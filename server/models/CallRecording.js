const mongoose = require("mongoose");

const callRecordingSchema = new mongoose.Schema(
  {
    callRecordingId: {
      type: String,
      unique: true,
      uppercase: true,
      trim: true,
    },

    // Vicidial Metadata
    vicidialId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    vicidialRecordingUrl: {
      type: String,
      trim: true,
    },
    vicidialCampaign: {
      type: String,
      trim: true,
    },
    vicidialListId: {
      type: String,
      trim: true,
    },

    // Call Details
    agentUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    agentVicidialId: {
      type: String,
      trim: true,
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
    },
    callDate: {
      type: Date,
      required: true,
    },
    callDurationSeconds: {
      type: Number,
      default: 0,
    },
    callDirection: {
      type: String,
      enum: ["Inbound", "Outbound"],
      default: "Outbound",
    },
    callDisposition: {
      type: String,
      trim: true,
    },

    // Recording File
    recordingFileUrl: {
      type: String,
      trim: true,
    },
    recordingFileSize: {
      type: Number,
      default: 0,
    },
    recordingFormat: {
      type: String,
      enum: ["wav", "mp3", "gsm", "ogg"],
      default: "wav",
    },

    // AI Analysis Status
    analysisStatus: {
      type: String,
      enum: ["Pending", "Processing", "Completed", "Failed", "Skipped"],
      default: "Pending",
    },
    analysisError: {
      type: String,
      trim: true,
    },
    analysisCompletedAt: {
      type: Date,
    },

    // Transcription
    transcription: {
      type: String,
    },

    // AI-Generated Insights
    summary: {
      type: String,
    },
    callOutcome: {
      type: String,
      enum: [
        "Interested",
        "Not Interested",
        "Follow Up Required",
        "Deal Closed",
        "Voicemail",
        "No Answer",
        "Wrong Number",
        "Callback Scheduled",
        "Information Provided",
        "Complaint",
        "Other",
      ],
    },
    clientSentiment: {
      type: String,
      enum: [
        "Very Positive",
        "Positive",
        "Neutral",
        "Negative",
        "Very Negative",
      ],
    },
    sentimentScore: {
      type: Number,
      min: -1,
      max: 1,
    },
    promisesMade: [
      {
        description: { type: String, trim: true },
        promisedBy: {
          type: String,
          enum: ["Agent", "Client"],
          default: "Agent",
        },
        deadline: { type: String, trim: true },
      },
    ],
    actionItems: [
      {
        description: { type: String, trim: true },
        assignedTo: {
          type: String,
          enum: ["Agent", "Client", "Team"],
          default: "Agent",
        },
        priority: {
          type: String,
          enum: ["Low", "Medium", "High"],
          default: "Medium",
        },
        dueDate: { type: String, trim: true },
      },
    ],
    keyTopics: [
      {
        type: String,
        trim: true,
      },
    ],
    agentPerformanceScore: {
      type: Number,
      min: 0,
      max: 100,
    },
    agentPerformanceNotes: {
      type: String,
      trim: true,
    },

    // Entity Linking
    linkedLead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
    },
    linkedCallback: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Callback",
    },

    // Processing Tracking
    processingAttempts: {
      type: Number,
      default: 0,
    },
    lastProcessingAttempt: {
      type: Date,
    },
    geminiModelUsed: {
      type: String,
      trim: true,
    },
    geminiTokensUsed: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
callRecordingSchema.index({ agentUser: 1, callDate: -1 });
callRecordingSchema.index({ analysisStatus: 1, createdAt: 1 });
callRecordingSchema.index({ phoneNumber: 1 });
callRecordingSchema.index({ linkedLead: 1 });
callRecordingSchema.index({ linkedCallback: 1 });
callRecordingSchema.index({ createdAt: -1 });

// Auto-generate callRecordingId before saving
callRecordingSchema.pre("save", async function (next) {
  if (!this.callRecordingId) {
    const count = await mongoose.model("CallRecording").countDocuments();
    this.callRecordingId = `CALL${String(count + 1).padStart(6, "0")}`;
  }
  next();
});

module.exports = mongoose.model("CallRecording", callRecordingSchema);
