const axios = require("axios");
const fs = require("fs");
const path = require("path");
const CallRecording = require("../models/CallRecording");
const User = require("../models/User");
const Lead = require("../models/Lead");

class VicidialService {
  constructor() {
    this.tempDir = path.join(__dirname, "../uploads/call-recordings-temp");
  }

  isConfigured() {
    return !!(
      process.env.VICIDIAL_SERVER_URL &&
      process.env.VICIDIAL_API_USER &&
      process.env.VICIDIAL_API_PASS
    );
  }

  ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Fetch recent recordings from Vicidial's non_agent_api.php
   * Uses the recording_lookup function with date range
   */
  async fetchRecentRecordings(hoursBack = 4) {
    const serverUrl = process.env.VICIDIAL_SERVER_URL;
    const apiUser = process.env.VICIDIAL_API_USER;
    const apiPass = process.env.VICIDIAL_API_PASS;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - hoursBack * 60 * 60 * 1000);

    const formatDate = (d) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;

    try {
      const response = await axios.get(
        `${serverUrl.replace(/\/+$/, "")}/non_agent_api.php`,
        {
          params: {
            source: "crmintegration",
            user: apiUser,
            pass: apiPass,
            function: "recording_lookup",
            stage: "date_range",
            date: formatDate(startDate),
            end_date: formatDate(endDate),
          },
          timeout: 30000,
        }
      );

      return this.parseRecordingResponse(response.data);
    } catch (error) {
      console.error("Error fetching recordings from Vicidial:", error.message);
      throw error;
    }
  }

  /**
   * Parse Vicidial API response into structured recording objects
   * Vicidial returns pipe-delimited data
   */
  parseRecordingResponse(data) {
    if (!data || typeof data !== "string") return [];

    const recordings = [];
    const lines = data.split("\n").filter((line) => line.trim());

    for (const line of lines) {
      // Skip header or error lines
      if (
        line.startsWith("ERROR") ||
        line.startsWith("NOTICE") ||
        line.startsWith("SUCCESS")
      ) {
        continue;
      }

      const parts = line.split("|");
      if (parts.length >= 6) {
        recordings.push({
          recordingId: parts[0]?.trim(),
          agentVicidialId: parts[1]?.trim(),
          callDate: parts[2]?.trim(),
          durationSeconds: parseInt(parts[3]?.trim()) || 0,
          phoneNumber: parts[4]?.trim(),
          recordingUrl: parts[5]?.trim(),
          campaign: parts[6]?.trim() || "",
          listId: parts[7]?.trim() || "",
          disposition: parts[8]?.trim() || "",
          direction: parts[9]?.trim() || "Outbound",
        });
      }
    }

    return recordings;
  }

  /**
   * Download a recording file from Vicidial to temp storage
   */
  async downloadRecording(recordingUrl, filename) {
    this.ensureTempDir();

    const filePath = path.join(this.tempDir, filename);

    try {
      const response = await axios.get(recordingUrl, {
        responseType: "stream",
        timeout: 120000,
      });

      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on("finish", () => resolve(filePath));
        writer.on("error", reject);
      });
    } catch (error) {
      console.error(`Error downloading recording ${filename}:`, error.message);
      throw error;
    }
  }

  /**
   * Map Vicidial agent ID to CRM User
   * Matches by vicidialAgentId field on User model, or by name
   */
  async mapAgentToUser(vicidialAgentId) {
    if (!vicidialAgentId) return null;

    // Try matching by vicidialAgentId field
    let user = await User.findOne({
      vicidialAgentId: vicidialAgentId,
    }).select("_id name");

    if (user) return user._id;

    // Fallback: try matching by name (case-insensitive)
    user = await User.findOne({
      name: { $regex: new RegExp(`^${vicidialAgentId}$`, "i") },
    }).select("_id name");

    return user ? user._id : null;
  }

  /**
   * Auto-link recording to a Lead by phone number match
   */
  async autoLinkToLead(phoneNumber) {
    if (!phoneNumber) return null;

    // Clean phone number for matching
    const cleanPhone = phoneNumber.replace(/[^\d+]/g, "");

    const lead = await Lead.findOne({
      $or: [
        { phone: cleanPhone },
        { phone: phoneNumber },
        { alternatePhone: cleanPhone },
        { alternatePhone: phoneNumber },
      ],
    }).select("_id");

    return lead ? lead._id : null;
  }

  /**
   * Main sync function - called by cron job
   * Fetches new recordings from Vicidial and creates CallRecording documents
   */
  async syncRecordings() {
    if (!this.isConfigured()) {
      console.log("Vicidial not configured, skipping sync");
      return { synced: 0, skipped: 0, errors: 0 };
    }

    let synced = 0;
    let skipped = 0;
    let errors = 0;

    try {
      const recordings = await this.fetchRecentRecordings(4);
      console.log(`Found ${recordings.length} recordings from Vicidial`);

      for (const rec of recordings) {
        try {
          // Check if already synced
          const exists = await CallRecording.findOne({
            vicidialId: rec.recordingId,
          });
          if (exists) {
            skipped++;
            continue;
          }

          // Map agent to CRM user
          const agentUserId = await this.mapAgentToUser(rec.agentVicidialId);
          if (!agentUserId) {
            console.warn(
              `No CRM user found for Vicidial agent: ${rec.agentVicidialId}`
            );
            errors++;
            continue;
          }

          // Auto-link to lead
          const linkedLeadId = await this.autoLinkToLead(rec.phoneNumber);

          // Determine recording format from URL
          let format = "wav";
          if (rec.recordingUrl) {
            const ext = path.extname(rec.recordingUrl).toLowerCase().slice(1);
            if (["wav", "mp3", "gsm", "ogg"].includes(ext)) {
              format = ext;
            }
          }

          // Build recording URL
          const serverUrl = process.env.VICIDIAL_SERVER_URL;
          const fullRecordingUrl = rec.recordingUrl?.startsWith("http")
            ? rec.recordingUrl
            : `${serverUrl}${rec.recordingUrl}`;

          // Create CallRecording document
          const callRecording = new CallRecording({
            vicidialId: rec.recordingId,
            vicidialRecordingUrl: fullRecordingUrl,
            vicidialCampaign: rec.campaign,
            vicidialListId: rec.listId,
            agentUser: agentUserId,
            agentVicidialId: rec.agentVicidialId,
            phoneNumber: rec.phoneNumber,
            callDate: new Date(rec.callDate),
            callDurationSeconds: rec.durationSeconds,
            callDirection:
              rec.direction === "IN" || rec.direction === "Inbound"
                ? "Inbound"
                : "Outbound",
            callDisposition: rec.disposition,
            recordingFileUrl: fullRecordingUrl,
            recordingFormat: format,
            analysisStatus: "Pending",
            linkedLead: linkedLeadId,
          });

          await callRecording.save();
          synced++;
        } catch (error) {
          console.error(
            `Error syncing recording ${rec.recordingId}:`,
            error.message
          );
          errors++;
        }
      }
    } catch (error) {
      console.error("Error during Vicidial sync:", error.message);
      errors++;
    }

    console.log(
      `Vicidial sync complete: ${synced} synced, ${skipped} skipped, ${errors} errors`
    );
    return { synced, skipped, errors };
  }

  /**
   * Clean up temp recording files
   */
  cleanupTempFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error(`Error cleaning up temp file ${filePath}:`, error.message);
    }
  }
}

module.exports = new VicidialService();
