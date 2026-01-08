const Project = require("../models/Project");
const KeywordRank = require("../models/KeywordRank");
const BlogUpdate = require("../models/BlogUpdate");
const Backlink = require("../models/Backlink");
const Screenshot = require("../models/Screenshot");
const PDFService = require("./pdfService");
const path = require("path");
const fs = require("fs");

class ReportDataService {
  constructor() {
    this.pdfService = new PDFService();
  }

  /**
   * Recursively resolve all promises in an object/array
   * DEPRECATED: Causes memory issues with Mongoose circular references
   * Keeping for reference but NOT USED
   */
  // async resolvePromises(obj) {
  //   // This function causes heap out of memory errors
  //   // with Mongoose documents due to circular references
  //   // DO NOT USE
  // }

  /**
   * Gather all data needed for project report
   * @param {string} projectId - Project ID
   * @returns {Object} Complete report data
   */
  async gatherProjectReportData(projectId) {
    try {
      // Fetch project with populated clients
      const project = await Project.findById(projectId).populate(
        "clients",
        "businessName clientName name email phone"
      );

      if (!project) {
        throw new Error("Project not found");
      }

      // Fetch keywords - DO NOT use resolvePromises (causes memory issues)
      let keywords = await KeywordRank.getProjectKeywords(projectId, true);

      // Log to debug
      console.log("Keywords fetched:", keywords.length);

      // Fetch velocity insights - DO NOT use resolvePromises (causes memory issues)
      let velocityInsights = await KeywordRank.getVelocityInsights(projectId);

      // Log to debug
      console.log("Velocity insights fetched");

      // Fetch blog updates
      const blogs = await BlogUpdate.find({
        project: projectId,
        isActive: true,
      })
        .populate("addedBy", "name")
        .sort({ publishedDate: -1 });

      // Fetch backlinks
      const backlinks = await Backlink.find({
        project: projectId,
        isActive: true,
      })
        .populate("addedBy", "name")
        .sort({ createdAt: -1 });

      // Fetch screenshots
      const screenshots = await Screenshot.find({
        project: projectId,
        isActive: true,
      })
        .populate("uploadedBy", "name")
        .sort({ createdAt: -1 });

      // Convert logo to base64
      const logoPath = path.join(__dirname, "..", "assets", "tapvera.png");
      const logo = this.pdfService.imageToBase64(logoPath);

      // Convert screenshot images to base64
      const screenshotsWithBase64 = screenshots.map((screenshot) => {
        const screenshotPath = path.join(__dirname, "..", screenshot.imageUrl);
        const imageBase64 = this.pdfService.imageToBase64(screenshotPath);

        return {
          ...screenshot.toObject(),
          imageBase64,
        };
      });

      // Format keyword data
      const formattedKeywords = this.formatKeywordData(keywords);
      console.log("Formatted keywords sample:", formattedKeywords[0]);

      // Format velocity data
      const formattedVelocity = this.formatVelocityData(velocityInsights);
      console.log("Formatted velocity summary:", formattedVelocity?.summary);

      // Serialize blogs to plain objects with complete JSON serialization
      const serializedBlogs = JSON.parse(JSON.stringify(
        blogs.map((blog) => {
          const blogObj = blog.toObject ? blog.toObject() : blog;
          return {
            title: blogObj.title || "Untitled",
            url: blogObj.url || "",
            publishedDate: blogObj.publishedDate,
            addedBy: blogObj.addedBy ? {
              name: blogObj.addedBy.name || "Unknown",
            } : null,
          };
        })
      ));

      // Serialize backlinks to plain objects with complete JSON serialization
      const serializedBacklinks = JSON.parse(JSON.stringify(
        backlinks.map((backlink) => {
          const backlinkObj = backlink.toObject ? backlink.toObject() : backlink;
          return {
            platform: backlinkObj.platform || "",
            url: backlinkObj.url || "",
            category: backlinkObj.category || "Others",
            notes: backlinkObj.notes || "",
            createdAt: backlinkObj.createdAt,
          };
        })
      ));

      // Prepare complete report data
      const reportData = {
        project: {
          projectName: project.projectName || "Untitled Project",
          type: Array.isArray(project.type) ? project.type : [],
          status: project.status || "active",
          startDate: project.startDate,
          endDate: project.endDate,
          description: project.description || "",
          clients: Array.isArray(project.clients) ? project.clients.map(c => ({
            businessName: c.businessName || "",
            clientName: c.clientName || "",
            name: c.name || "",
            email: c.email || "",
            phone: c.phone || "",
          })) : [],
        },
        keywords: formattedKeywords,
        velocityInsights: formattedVelocity,
        blogs: serializedBlogs,
        backlinks: serializedBacklinks,
        screenshots: screenshotsWithBase64,
        logo,
        generatedDate: new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
      };

      console.log("Final data prepared successfully");
      return reportData;
    } catch (error) {
      console.error("Error gathering report data:", error);
      throw new Error(`Data aggregation failed: ${error.message}`);
    }
  }

  /**
   * Format keyword data for template
   * @param {Array} keywords - Raw keyword data
   * @returns {Array} Formatted keywords
   */
  formatKeywordData(keywords) {
    if (!keywords || !Array.isArray(keywords)) {
      return [];
    }

    return keywords.map((keyword) => {
      // COMPLETE serialization - convert to JSON and back to strip ALL functions/getters
      let keywordObj;
      try {
        if (keyword.toObject) {
          const mongooseObj = keyword.toObject({
            virtuals: true,
            getters: true,
            versionKey: false,
          });
          // Deep clone via JSON to remove any remaining functions/getters
          keywordObj = JSON.parse(JSON.stringify(mongooseObj));
        } else {
          keywordObj = JSON.parse(JSON.stringify(keyword));
        }
      } catch (error) {
        console.error("Error serializing keyword:", error);
        keywordObj = {};
      }

      // Extract rank values safely
      const getCurrentRank = () => {
        if (!keywordObj.currentRank) return null;
        const rank = keywordObj.currentRank.rank;
        return rank !== undefined && rank !== null ? { rank: Number(rank) } : null;
      };

      const getPreviousRank = () => {
        if (!keywordObj.previousRank) return null;
        const rank = keywordObj.previousRank.rank;
        return rank !== undefined && rank !== null ? { rank: Number(rank) } : null;
      };

      const getPastRank = () => {
        if (!keywordObj.pastRank) return null;
        const rank = keywordObj.pastRank.rank;
        return rank !== undefined && rank !== null ? { rank: Number(rank) } : null;
      };

      return {
        keyword: String(keywordObj.keyword || "N/A"),
        pastRank: getPastRank(),
        previousRank: getPreviousRank(),
        currentRank: getCurrentRank(),
        rankTrend: String(keywordObj.rankTrend || "no-change"),
      };
    });
  }

  /**
   * Format velocity data for template
   * @param {Object} velocityInsights - Raw velocity data
   * @returns {Object} Formatted velocity data
   */
  formatVelocityData(velocityInsights) {
    if (!velocityInsights) {
      return null;
    }

    // COMPLETE serialization - convert to JSON and back
    let insights;
    try {
      insights = JSON.parse(JSON.stringify(velocityInsights));
    } catch (error) {
      console.error("Error serializing velocity insights:", error);
      return null;
    }

    // Helper to serialize velocity arrays
    const serializeVelocityArray = (arr) => {
      if (!arr || !Array.isArray(arr)) return [];

      return arr.map((item) => {
        return {
          keyword: String(item.keyword || ""),
          currentRank: item.currentRank !== undefined && item.currentRank !== null
            ? Number(item.currentRank)
            : null,
          velocity7Day: item.velocity7Day ? {
            change: Number(item.velocity7Day.change || 0),
            daysAnalyzed: Number(item.velocity7Day.daysAnalyzed || 7),
            isFallback: Boolean(item.velocity7Day.isFallback || false),
          } : { change: 0, daysAnalyzed: 7, isFallback: false },
        };
      });
    };

    return {
      summary: {
        totalKeywords: Number(insights.summary?.totalKeywords || 0),
        improving: Number(insights.summary?.improving || 0),
        declining: Number(insights.summary?.declining || 0),
        stagnant: Number(insights.summary?.stagnant || 0),
        averageVelocity7Day: Number(insights.summary?.averageVelocity7Day || 0),
        averageVelocity30Day: Number(insights.summary?.averageVelocity30Day || 0),
      },
      fastestImprovements: serializeVelocityArray(insights.fastestImprovements),
      rapidDeclines: serializeVelocityArray(insights.rapidDeclines),
      stagnantKeywords: Array.isArray(insights.stagnantKeywords)
        ? insights.stagnantKeywords.map(k => String(k))
        : [],
    };
  }

  /**
   * Format date for display
   * @param {Date|string} date - Date to format
   * @returns {string} Formatted date string
   */
  formatDate(date) {
    if (!date) return "N/A";

    try {
      return new Date(date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch (error) {
      return "N/A";
    }
  }
}

module.exports = ReportDataService;
