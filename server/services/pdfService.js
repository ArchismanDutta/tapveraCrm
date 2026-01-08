const { chromium } = require("playwright");
const ejs = require("ejs");
const fs = require("fs");
const path = require("path");

class PDFService {
  constructor() {
    this.browser = null;
  }

  /**
   * Generate project report PDF
   * @param {Object} reportData - All data needed for the report
   * @returns {Buffer} PDF buffer
   */
  async generateProjectReport(reportData) {
    try {
      // Debug: Log data types being passed to template
      console.log("=== PDF Service Debug ===");
      console.log("Keywords count:", reportData.keywords?.length || 0);
      console.log("Keywords sample:", reportData.keywords?.[0]);
      console.log("Velocity insights type:", typeof reportData.velocityInsights);
      console.log("Velocity summary:", reportData.velocityInsights?.summary);

      // Check for any promises in the data
      const dataStr = JSON.stringify(reportData, (key, value) => {
        if (value && typeof value.then === 'function') {
          console.error(`WARNING: Found promise at key "${key}"`);
          return '[PROMISE FOUND]';
        }
        return value;
      });

      if (dataStr.includes('[PROMISE FOUND]')) {
        console.error("CRITICAL: Promises still exist in data!");
      }

      // Render HTML from EJS template
      const templatePath = path.join(
        __dirname,
        "../views/pdf/project-report.ejs"
      );
      const html = await this.renderTemplate(templatePath, reportData);

      // DEBUG: Save HTML to file for inspection
      const fs = require('fs');
      const debugHtmlPath = path.join(__dirname, '../debug-report.html');
      fs.writeFileSync(debugHtmlPath, html, 'utf8');
      console.log('DEBUG: HTML saved to', debugHtmlPath);

      // Check for [object Promise] in HTML
      if (html.includes('[object Promise]')) {
        console.error('ERROR: HTML contains [object Promise]!');
        // Find where it appears
        const lines = html.split('\n');
        lines.forEach((line, index) => {
          if (line.includes('[object Promise]')) {
            console.error(`Line ${index + 1}: ${line.substring(0, 100)}`);
          }
        });
      }

      // Convert HTML to PDF
      const pdfBuffer = await this.htmlToPDF(html);

      return pdfBuffer;
    } catch (error) {
      console.error("Error generating project report:", error);
      throw new Error(`Failed to generate PDF: ${error.message}`);
    }
  }

  /**
   * Render EJS template to HTML
   * @param {string} templatePath - Path to EJS template file
   * @param {Object} data - Data to pass to template
   * @returns {string} Rendered HTML
   */
  async renderTemplate(templatePath, data) {
    try {
      // DO NOT use async: true - it makes includes return promises!
      const html = await ejs.renderFile(templatePath, data);
      return html;
    } catch (error) {
      console.error("Template rendering failed:", error);
      throw new Error(`Template error: ${error.message}`);
    }
  }

  /**
   * Convert HTML to PDF using Playwright
   * @param {string} html - HTML content
   * @param {Object} options - PDF options
   * @returns {Buffer} PDF buffer
   */
  async htmlToPDF(html, options = {}) {
    let browser = null;
    try {
      // Default PDF options
      const pdfOptions = {
        format: "A4",
        printBackground: true,
        displayHeaderFooter: false,
        margin: {
          top: "20mm",
          right: "15mm",
          bottom: "20mm",
          left: "15mm",
        },
        preferCSSPageSize: true,
        ...options,
      };

      // Launch browser
      browser = await chromium.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
        ],
      });

      // Create page
      const context = await browser.newContext();
      const page = await context.newPage();

      // Set content and wait for load
      await page.setContent(html, {
        waitUntil: "networkidle",
        timeout: 30000,
      });

      // Generate PDF
      const pdfBuffer = await page.pdf(pdfOptions);

      return pdfBuffer;
    } catch (error) {
      console.error("PDF generation failed:", error);
      throw new Error(`Rendering error: ${error.message}`);
    } finally {
      // Always close browser
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Convert image file to base64 data URI
   * @param {string} imagePath - Path to image file
   * @returns {string|null} Base64 data URI or null if error
   */
  imageToBase64(imagePath) {
    try {
      // Check if file exists
      if (!fs.existsSync(imagePath)) {
        console.warn(`Image not found: ${imagePath}`);
        return null;
      }

      // Read file
      const imageBuffer = fs.readFileSync(imagePath);

      // Determine MIME type from extension
      const ext = path.extname(imagePath).toLowerCase();
      let mimeType = "image/jpeg";

      if (ext === ".png") {
        mimeType = "image/png";
      } else if (ext === ".jpg" || ext === ".jpeg") {
        mimeType = "image/jpeg";
      } else if (ext === ".gif") {
        mimeType = "image/gif";
      } else if (ext === ".webp") {
        mimeType = "image/webp";
      }

      // Convert to base64
      const base64Image = imageBuffer.toString("base64");

      // Return data URI
      return `data:${mimeType};base64,${base64Image}`;
    } catch (error) {
      console.error("Error converting image to base64:", error);
      return null;
    }
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

module.exports = PDFService;
