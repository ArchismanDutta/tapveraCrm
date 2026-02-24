const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");
const CallRecording = require("../models/CallRecording");

class CallAnalysisService {
  constructor() {
    this.modelName = "gemini-1.5-flash";
  }

  isConfigured() {
    return !!process.env.GEMINI_API_KEY;
  }

  buildAnalysisPrompt() {
    return `You are an expert call analyst for a CRM system. Analyze this call recording and return a JSON object with the following structure:

{
  "transcription": "Full transcription of the call conversation...",
  "summary": "2-3 sentence summary of what was discussed, key decisions, and outcome.",
  "callOutcome": "One of: Interested, Not Interested, Follow Up Required, Deal Closed, Voicemail, No Answer, Wrong Number, Callback Scheduled, Information Provided, Complaint, Other",
  "clientSentiment": "One of: Very Positive, Positive, Neutral, Negative, Very Negative",
  "sentimentScore": 0.5,
  "promisesMade": [
    {
      "description": "What was promised",
      "promisedBy": "Agent or Client",
      "deadline": "When it should be done (if mentioned, otherwise empty string)"
    }
  ],
  "actionItems": [
    {
      "description": "What needs to be done next",
      "assignedTo": "Agent, Client, or Team",
      "priority": "Low, Medium, or High",
      "dueDate": "When (if mentioned, otherwise empty string)"
    }
  ],
  "keyTopics": ["topic1", "topic2"],
  "agentPerformanceScore": 75,
  "agentPerformanceNotes": "Brief notes on agent communication quality, professionalism, and effectiveness."
}

IMPORTANT RULES:
- sentimentScore is a float from -1.0 (very negative) to 1.0 (very positive)
- agentPerformanceScore is 0-100
- If the recording is too short, unclear, or just silence/voicemail, still provide your best assessment
- Return ONLY valid JSON, no markdown code fences, no additional text
- Identify ALL commitments, promises, follow-ups, and deadlines mentioned
- If no promises or action items were made, return empty arrays`;
  }

  parseGeminiResponse(responseText) {
    let cleaned = responseText
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    return JSON.parse(cleaned);
  }

  getMimeType(format) {
    const mimeTypes = {
      wav: "audio/wav",
      mp3: "audio/mpeg",
      gsm: "audio/x-gsm",
      ogg: "audio/ogg",
    };
    return mimeTypes[format] || "audio/wav";
  }

  async analyzeRecording(callRecordingId) {
    const recording = await CallRecording.findById(callRecordingId);
    if (!recording) {
      throw new Error(`CallRecording not found: ${callRecordingId}`);
    }

    // Update status to Processing
    recording.analysisStatus = "Processing";
    recording.processingAttempts += 1;
    recording.lastProcessingAttempt = new Date();
    await recording.save();

    try {
      // Determine audio file path
      let audioFilePath = null;
      let audioData = null;

      // Check if recording file is a local path
      if (
        recording.recordingFileUrl &&
        fs.existsSync(recording.recordingFileUrl)
      ) {
        audioFilePath = recording.recordingFileUrl;
        audioData = fs.readFileSync(audioFilePath);
      } else if (recording.recordingFileUrl) {
        // Download from URL
        const axios = require("axios");
        const response = await axios.get(recording.recordingFileUrl, {
          responseType: "arraybuffer",
          timeout: 60000,
        });
        audioData = Buffer.from(response.data);
      } else {
        throw new Error("No recording file URL available");
      }

      const base64Audio = audioData.toString("base64");
      const mimeType = this.getMimeType(recording.recordingFormat);

      // Send to Gemini
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: this.modelName });

      const result = await model.generateContent([
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Audio,
          },
        },
        { text: this.buildAnalysisPrompt() },
      ]);

      const responseText = result.response.text();
      const analysis = this.parseGeminiResponse(responseText);

      // Update recording with analysis results
      recording.transcription = analysis.transcription || "";
      recording.summary = analysis.summary || "";
      recording.callOutcome = analysis.callOutcome || "Other";
      recording.clientSentiment = analysis.clientSentiment || "Neutral";
      recording.sentimentScore =
        typeof analysis.sentimentScore === "number"
          ? analysis.sentimentScore
          : 0;
      recording.promisesMade = Array.isArray(analysis.promisesMade)
        ? analysis.promisesMade
        : [];
      recording.actionItems = Array.isArray(analysis.actionItems)
        ? analysis.actionItems
        : [];
      recording.keyTopics = Array.isArray(analysis.keyTopics)
        ? analysis.keyTopics
        : [];
      recording.agentPerformanceScore =
        typeof analysis.agentPerformanceScore === "number"
          ? analysis.agentPerformanceScore
          : null;
      recording.agentPerformanceNotes =
        analysis.agentPerformanceNotes || "";

      recording.analysisStatus = "Completed";
      recording.analysisCompletedAt = new Date();
      recording.analysisError = null;
      recording.geminiModelUsed = this.modelName;

      // Get token usage if available
      if (result.response.usageMetadata) {
        recording.geminiTokensUsed =
          (result.response.usageMetadata.promptTokenCount || 0) +
          (result.response.usageMetadata.candidatesTokenCount || 0);
      }

      await recording.save();

      console.log(
        `Analysis completed for ${recording.callRecordingId}`
      );
      return recording;
    } catch (error) {
      recording.analysisStatus = "Failed";
      recording.analysisError = error.message;
      await recording.save();

      console.error(
        `Analysis failed for ${recording.callRecordingId}:`,
        error.message
      );
      throw error;
    }
  }

  async processPendingRecordings(batchSize = 5) {
    if (!this.isConfigured()) {
      console.log("Gemini API not configured, skipping analysis");
      return { processed: 0, failed: 0, skipped: 0 };
    }

    // Find recordings that need processing
    const pendingRecordings = await CallRecording.find({
      $or: [
        { analysisStatus: "Pending" },
        {
          analysisStatus: "Failed",
          processingAttempts: { $lt: 3 },
        },
      ],
    })
      .sort({ createdAt: 1 })
      .limit(batchSize);

    if (pendingRecordings.length === 0) {
      console.log("No pending recordings to process");
      return { processed: 0, failed: 0, skipped: 0 };
    }

    let processed = 0;
    let failed = 0;

    for (const recording of pendingRecordings) {
      try {
        await this.analyzeRecording(recording._id);
        processed++;

        // Small delay between API calls to respect rate limits
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error) {
        failed++;
        console.error(
          `Failed to process ${recording.callRecordingId}:`,
          error.message
        );
      }
    }

    console.log(
      `Batch processing complete: ${processed} processed, ${failed} failed`
    );
    return {
      processed,
      failed,
      skipped: pendingRecordings.length - processed - failed,
    };
  }
}

module.exports = new CallAnalysisService();
