const { google } = require('googleapis');
const axios = require('axios');

class GoogleSheetsService {
  constructor(authClient = null) {
    if (authClient) {
      this.sheets = google.sheets({ version: 'v4', auth: authClient });
      this.drive = google.drive({ version: 'v3', auth: authClient });
    } else {
      // Default: use service account from env
      const auth = new google.auth.JWT(
        process.env.GOOGLE_CLIENT_EMAIL,
        null,
        process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.readonly']
      );

      this.sheets = google.sheets({ version: 'v4', auth });
      this.drive = google.drive({ version: 'v3', auth });
    }
  }

  // Extract spreadsheet ID from URL
  extractSpreadsheetId(url) {
    const match = url.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  }

  // Convert Google Sheets URL to CSV export URL
  getCsvExportUrl(spreadsheetId, sheetId = 0) {
    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${sheetId}`;
  }

  // Check if sheet is publicly accessible
  async isPublicSheet(spreadsheetId) {
    try {
      const csvUrl = this.getCsvExportUrl(spreadsheetId);
      const response = await axios.head(csvUrl, { timeout: 5000 });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  // Read data from public sheet using CSV export
  async readPublicSheet(spreadsheetId, sheetId = 0) {
    try {
      const csvUrl = this.getCsvExportUrl(spreadsheetId, sheetId);
      const response = await axios.get(csvUrl, { timeout: 10000 });

      if (response.status !== 200) {
        throw new Error('Sheet is not publicly accessible');
      }

      return this.parseCsvData(response.data);
    } catch (error) {
      if (error.response?.status === 403) {
        throw new Error('Sheet is not publicly accessible. Please ensure it is shared as "Anyone with the link can edit"');
      }
      throw new Error(`Failed to read public sheet: ${error.message}`);
    }
  }

  // Parse CSV data to array format
  parseCsvData(csvString) {
    const lines = csvString.split('\n');
    const result = [];

    for (let line of lines) {
      if (line.trim()) {
        const row = this.parseCsvLine(line);
        result.push(row);
      }
    }

    return result;
  }

  // Parse individual CSV line handling quoted values
  parseCsvLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current);
    return result;
  }

  // Get sheet metadata
  async getSheetMetadata(spreadsheetId) {
    try {
      const response = await this.sheets.spreadsheets.get({ spreadsheetId });
      return response.data;
    } catch (error) {
      if (error.code === 403) {
        throw new Error('Sheet access denied. Ensure the sheet is shared publicly or service account has access.');
      }
      throw new Error(`Failed to get sheet metadata: ${error.message}`);
    }
  }

  // Read data from sheet (authenticated)
  async readSheet(spreadsheetId, range = 'A1:Z1000') {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });
      return response.data.values || [];
    } catch (error) {
      throw new Error(`Failed to read sheet: ${error.message}`);
    }
  }

  // Update single cell (authenticated)
  async updateCell(spreadsheetId, range, value) {
    try {
      const response = await this.sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        resource: {
          values: [[value]],
        },
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to update cell: ${error.message}`);
    }
  }

  // Batch update multiple cells (authenticated)
  async batchUpdate(spreadsheetId, updates) {
    try {
      const response = await this.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        resource: {
          valueInputOption: 'RAW',
          data: updates,
        },
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to batch update: ${error.message}`);
    }
  }

  // Check if user/service account has edit access
  async checkPermissions(spreadsheetId) {
    try {
      const response = await this.drive.files.get({
        fileId: spreadsheetId,
        fields: 'permissions,capabilities',
      });
      return response.data.capabilities?.canEdit || false;
    } catch (error) {
      return false;
    }
  }

  // Update cell using service account
  async updatePublicCell(spreadsheetId, range, value) {
    try {
      console.log('🔄 Attempting to update cell:', { spreadsheetId, range, value });

      const response = await this.sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        resource: {
          values: [[value]],
        },
      });

      console.log('✅ Google Sheets API response:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Service account update error:', {
        message: error.message,
        code: error.code,
        status: error.status,
        details: error.details || error.response?.data,
      });

      if (error.code === 403) {
        throw new Error(
          `Sheet editing access denied. Please share the sheet with: ${process.env.GOOGLE_CLIENT_EMAIL} (Editor access)`
        );
      }
      if (error.code === 404) {
        throw new Error('Sheet not found. Please check the spreadsheet ID is correct.');
      }
      if (error.code === 400) {
        throw new Error(`Invalid request: ${error.message}. Check the range format: ${range}`);
      }
      throw new Error(`Failed to update cell: ${error.message}`);
    }
  }

  // Get basic sheet info from URL without auth
  async getBasicSheetInfo(url) {
    const spreadsheetId = this.extractSpreadsheetId(url);
    if (!spreadsheetId) {
      throw new Error('Invalid Google Sheets URL');
    }

    try {
      const isPublic = await this.isPublicSheet(spreadsheetId);
      if (!isPublic) {
        throw new Error('Sheet is not publicly accessible. Please ensure it is shared as "Anyone with the link can edit"');
      }

      const data = await this.readPublicSheet(spreadsheetId);
      const headers = data.length > 0 ? data[0] : [];

      return {
        spreadsheetId,
        title: `Sheet ${spreadsheetId.substring(0, 8)}...`,
        headers,
        totalRows: data.length,
        totalColumns: headers.length,
        data: data.slice(0, 100),
        isPublic: true,
        canEdit: true,
      };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = GoogleSheetsService;
