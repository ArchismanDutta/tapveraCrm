// routes/sheets.js - Updated with MongoDB integration
const express = require('express');
const router = express.Router();
const GoogleAuthService = require('../services/googleAuth');
const GoogleSheetsService = require('../services/googleSheets');
const GoogleToken = require('../models/GoogleToken');
const { ImportedSheet, RecentSheet } = require('../models/ImportedSheet');
const SheetActivity = require('../models/SheetActivity');
const User = require('../models/User');
const { protect } = require('../middlewares/authMiddleware');

// Helper function to convert column index to Excel column name (A, B, ..., Z, AA, AB, ...)
function getExcelColumnName(colIndex) {
  let columnName = '';
  while (colIndex >= 0) {
    columnName = String.fromCharCode(65 + (colIndex % 26)) + columnName;
    colIndex = Math.floor(colIndex / 26) - 1;
  }
  return columnName;
}

// Middleware to check if user is super admin
const requireSuperAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user || user.role !== 'super-admin') {
      return res.status(403).json({ error: 'Super admin access required' });
    }
    next();
  } catch (error) {
    res.status(500).json({ error: 'Authorization check failed' });
  }
};

// Get authentication status
router.get('/auth-status', protect, requireSuperAdmin, async (req, res) => {
  try {
    const token = await GoogleToken.findOne({ userId: req.user._id });
    const isAuthenticated = token && new Date(token.expiresAt) > new Date();
    
    res.json({ 
      authenticated: isAuthenticated,
      hasToken: !!token,
      expiresAt: token?.expiresAt
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Initiate Google OAuth
router.get('/auth', protect, requireSuperAdmin, (req, res) => {
  try {
    const authService = new GoogleAuthService();
    const authUrl = authService.getAuthUrl();
    res.json({ authUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Handle OAuth callback
router.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  
  try {
    const authService = new GoogleAuthService();
    const tokens = await authService.getTokens(code);
    
    // Calculate expiration time
    const expiresAt = new Date(Date.now() + (tokens.expiry_date || 3600 * 1000));
    
    // Store or update tokens in MongoDB
    await GoogleToken.findOneAndUpdate(
      { userId: req.user._id },
      {
        userId: req.user._id,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenType: tokens.token_type || 'Bearer',
        expiresAt: expiresAt,
        scope: tokens.scope ? tokens.scope.split(' ') : []
      },
      { upsert: true, new: true }
    );
    
    res.redirect(`${process.env.FRONTEND_URL}/admin/sheets?auth=success`);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/admin/sheets?auth=error`);
  }
});

// Get user's Google tokens
const getUserTokens = async (userId) => {
  const tokenDoc = await GoogleToken.findOne({ userId });
  if (!tokenDoc) return null;
  
  // Check if token is expired
  if (new Date(tokenDoc.expiresAt) <= new Date()) {
    // Try to refresh token
    try {
      const authService = new GoogleAuthService();
      authService.setCredentials({
        access_token: tokenDoc.accessToken,
        refresh_token: tokenDoc.refreshToken
      });
      
      const { credentials } = await authService.getAuthClient().refreshAccessToken();
      
      // Update tokens in database
      tokenDoc.accessToken = credentials.access_token;
      tokenDoc.expiresAt = new Date(credentials.expiry_date);
      await tokenDoc.save();
      
      return credentials;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return null;
    }
  }
  
  return {
    access_token: tokenDoc.accessToken,
    refresh_token: tokenDoc.refreshToken,
    token_type: tokenDoc.tokenType
  };
};

// Load sheet directly by URL (no authentication required for public sheets)
router.post('/load-url', protect, requireSuperAdmin, async (req, res) => {
  const { sheetUrl } = req.body;

  try {
    if (!sheetUrl || !sheetUrl.trim()) {
      return res.status(400).json({ error: 'Sheet URL is required' });
    }

    const sheetsService = new GoogleSheetsService();
    const sheetInfo = await sheetsService.getBasicSheetInfo(sheetUrl.trim());

    // Add to recent sheets
    await RecentSheet.findOneAndUpdate(
      { userId: req.user._id, url: sheetUrl.trim() },
      {
        userId: req.user._id,
        url: sheetUrl.trim(),
        title: sheetInfo.title,
        spreadsheetId: sheetInfo.spreadsheetId,
        lastAccessedAt: new Date()
      },
      { upsert: true, new: true }
    );

    // Keep only last 5 recent sheets
    const recentSheets = await RecentSheet.find({ userId: req.user._id })
      .sort({ lastAccessedAt: -1 })
      .skip(5);

    if (recentSheets.length > 0) {
      await RecentSheet.deleteMany({
        _id: { $in: recentSheets.map(s => s._id) }
      });
    }

    res.json({
      success: true,
      sheet: {
        spreadsheetId: sheetInfo.spreadsheetId,
        title: sheetInfo.title,
        url: sheetUrl.trim(),
        headers: sheetInfo.headers,
        totalRows: sheetInfo.totalRows,
        totalColumns: sheetInfo.totalColumns,
        data: sheetInfo.data,
        canEdit: sheetInfo.canEdit,
        isPublic: sheetInfo.isPublic
      }
    });
  } catch (error) {
    console.error('Load URL error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get recent sheets history
router.get('/recent', protect, requireSuperAdmin, async (req, res) => {
  try {
    const recentSheets = await RecentSheet.find({ userId: req.user._id })
      .sort({ lastAccessedAt: -1 })
      .limit(5);

    res.json({ recentSheets });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Load sheet from recent history
router.post('/load-recent/:recentId', protect, requireSuperAdmin, async (req, res) => {
  const { recentId } = req.params;

  try {
    const recentSheet = await RecentSheet.findOne({
      _id: recentId,
      userId: req.user._id
    });

    if (!recentSheet) {
      return res.status(404).json({ error: 'Recent sheet not found' });
    }

    const sheetsService = new GoogleSheetsService();
    const sheetInfo = await sheetsService.getBasicSheetInfo(recentSheet.url);

    // Update last accessed time
    recentSheet.lastAccessedAt = new Date();
    await recentSheet.save();

    res.json({
      success: true,
      sheet: {
        spreadsheetId: sheetInfo.spreadsheetId,
        title: sheetInfo.title,
        url: recentSheet.url,
        headers: sheetInfo.headers,
        totalRows: sheetInfo.totalRows,
        totalColumns: sheetInfo.totalColumns,
        data: sheetInfo.data,
        canEdit: sheetInfo.canEdit,
        isPublic: sheetInfo.isPublic
      }
    });
  } catch (error) {
    console.error('Load recent error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Import sheet by URL
router.post('/import', protect, requireSuperAdmin, async (req, res) => {
  const { sheetUrl, sheetName = 'Sheet1', range = 'A1:Z1000' } = req.body;
  
  try {
    const tokens = await getUserTokens(req.user._id);
    if (!tokens) {
      return res.status(401).json({ error: 'Not authenticated with Google' });
    }

    const authService = new GoogleAuthService();
    authService.setCredentials(tokens);
    
    const sheetsService = new GoogleSheetsService(authService.getAuthClient());
    const spreadsheetId = sheetsService.extractSpreadsheetId(sheetUrl);
    
    if (!spreadsheetId) {
      return res.status(400).json({ error: 'Invalid Google Sheets URL' });
    }

    // Check if sheet already imported
    const existingSheet = await ImportedSheet.findOne({ spreadsheetId });
    if (existingSheet) {
      return res.status(400).json({ error: 'Sheet already imported' });
    }

    // Check permissions
    const canEdit = await sheetsService.checkPermissions(spreadsheetId);
    
    // Get sheet metadata
    const metadata = await sheetsService.getSheetMetadata(spreadsheetId);
    
    // Read data to get headers and row count
    const data = await sheetsService.readSheet(spreadsheetId, range);
    const headers = data.length > 0 ? data[0] : [];
    
    // Save sheet to database
    const importedSheet = new ImportedSheet({
      userId: req.user._id,
      spreadsheetId,
      title: metadata.properties.title,
      url: sheetUrl,
      sheetName,
      range,
      headers,
      totalRows: data.length,
      totalColumns: headers.length,
      permissions: {
        canEdit,
        canView: true
      },
      metadata: {
        locale: metadata.properties.locale,
        timeZone: metadata.properties.timeZone,
        autoRecalc: metadata.properties.autoRecalc
      }
    });

    await importedSheet.save();

    // Log activity
    await new SheetActivity({
      sheetId: importedSheet._id,
      userId: req.user._id,
      action: 'import',
      details: {
        cellsUpdated: data.length * headers.length
      }
    }).save();

    res.json({
      success: true,
      sheet: {
        id: importedSheet._id,
        spreadsheetId,
        title: metadata.properties.title,
        headers,
        totalRows: data.length,
        canEdit,
        createdAt: importedSheet.createdAt
      }
    });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all imported sheets
router.get('/list', protect, requireSuperAdmin, async (req, res) => {
  try {
    const sheets = await ImportedSheet.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .select('spreadsheetId title url headers totalRows totalColumns lastSyncAt syncStatus permissions createdAt');
    
    res.json({ sheets });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get sheet data
router.get('/data/:sheetId', protect, requireSuperAdmin, async (req, res) => {
  const { sheetId } = req.params;
  const { page = 1, limit = 100 } = req.query;
  
  try {
    const sheet = await ImportedSheet.findOne({ 
      _id: sheetId, 
      userId: req.user._id 
    });
    
    if (!sheet) {
      return res.status(404).json({ error: 'Sheet not found' });
    }

    const tokens = await getUserTokens(req.user._id);
    if (!tokens) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const authService = new GoogleAuthService();
    authService.setCredentials(tokens);
    
    const sheetsService = new GoogleSheetsService(authService.getAuthClient());
    
    // Calculate range for pagination
    const startRow = (page - 1) * limit + 1;
    const endRow = startRow + limit - 1;
    const range = `${sheet.sheetName}!A${startRow}:Z${endRow}`;
    
    const data = await sheetsService.readSheet(sheet.spreadsheetId, range);
    
    // Update last sync time
    sheet.lastSyncAt = new Date();
    sheet.syncStatus = 'active';
    await sheet.save();
    
    res.json({ 
      data,
      sheet: {
        id: sheet._id,
        title: sheet.title,
        headers: sheet.headers,
        totalRows: sheet.totalRows,
        permissions: sheet.permissions
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalRows: sheet.totalRows,
        totalPages: Math.ceil(sheet.totalRows / limit)
      }
    });
  } catch (error) {
    console.error('Data fetch error:', error);
    
    // Update sheet status on error
    await ImportedSheet.findByIdAndUpdate(sheetId, {
      syncStatus: 'error',
      errorMessage: error.message
    });
    
    res.status(500).json({ error: error.message });
  }
});

// Update cell in public sheet (direct by URL and cell position)
router.put('/update-public-cell', protect, requireSuperAdmin, async (req, res) => {
  const { sheetUrl, rowIndex, colIndex, value } = req.body;

  try {
    if (!sheetUrl || rowIndex === undefined || colIndex === undefined) {
      return res.status(400).json({ error: 'Sheet URL, row index, and column index are required' });
    }

    const sheetsService = new GoogleSheetsService();
    const spreadsheetId = sheetsService.extractSpreadsheetId(sheetUrl);

    if (!spreadsheetId) {
      return res.status(400).json({ error: 'Invalid Google Sheets URL' });
    }

    // Convert row/col index to range (handle columns beyond Z)
    const column = getExcelColumnName(colIndex);
    const cellRange = `Sheet1!${column}${rowIndex + 1}`;

    console.log('📊 Cell range calculation:', {
      rowIndex,
      colIndex,
      column,
      cellRange,
      value
    });

    // Try authenticated editing first
    const tokens = await getUserTokens(req.user._id);
    if (tokens) {
      try {
        const authService = new GoogleAuthService();
        authService.setCredentials(tokens);

        const authenticatedSheetsService = new GoogleSheetsService(authService.getAuthClient());

        const result = await authenticatedSheetsService.updateCell(spreadsheetId, cellRange, value);

        return res.json({
          success: true,
          message: 'Cell updated in Google Sheet successfully!',
          result,
          method: 'authenticated'
        });
      } catch (authError) {
        console.log('Authenticated edit failed, trying alternative approach:', authError.message);
      }
    }

    // Try direct update using service account
    try {
      console.log('🚀 Route handler - attempting service account update:', {
        spreadsheetId,
        cellRange,
        value,
        sheetUrl
      });

      const result = await sheetsService.updatePublicCell(spreadsheetId, cellRange, value);

      console.log('✅ Route handler - service account update successful:', result);

      return res.json({
        success: true,
        message: 'Cell updated in Google Sheet successfully!',
        result,
        method: 'service_account'
      });
    } catch (directError) {
      console.error('❌ Route handler - service account edit failed:', directError.message);

      res.status(400).json({
        success: false,
        error: `Failed to update cell. Please share the Google Sheet with: ${process.env.GOOGLE_CLIENT_EMAIL} (Editor access)`,
        details: directError.message
      });
    }

  } catch (error) {
    console.error('Public cell update error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update cell data
router.put('/data/:sheetId', protect, requireSuperAdmin, async (req, res) => {
  const { sheetId } = req.params;
  const { range, value, rowIndex, colIndex } = req.body;
  
  try {
    const sheet = await ImportedSheet.findOne({ 
      _id: sheetId, 
      userId: req.user._id 
    });
    
    if (!sheet) {
      return res.status(404).json({ error: 'Sheet not found' });
    }

    if (!sheet.permissions.canEdit) {
      return res.status(403).json({ error: 'No edit permission for this sheet' });
    }

    const tokens = await getUserTokens(req.user._id);
    if (!tokens) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const authService = new GoogleAuthService();
    authService.setCredentials(tokens);
    
    const sheetsService = new GoogleSheetsService(authService.getAuthClient());
    
    // Determine range if not provided
    let cellRange = range;
    if (!cellRange && typeof rowIndex !== 'undefined' && typeof colIndex !== 'undefined') {
      const column = String.fromCharCode(65 + colIndex);
      cellRange = `${sheet.sheetName}!${column}${rowIndex + 1}`;
    }
    
    const result = await sheetsService.updateCell(sheet.spreadsheetId, cellRange, value);
    
    // Log activity
    await new SheetActivity({
      sheetId: sheet._id,
      userId: req.user._id,
      action: 'update_cell',
      details: {
        range: cellRange,
        newValue: value,
        cellsUpdated: 1
      }
    }).save();
    
    // Update last sync time
    sheet.lastSyncAt = new Date();
    await sheet.save();
    
    res.json({ 
      success: true, 
      result,
      range: cellRange,
      value 
    });
  } catch (error) {
    console.error('Cell update error:', error);
    
    // Log error activity
    await new SheetActivity({
      sheetId,
      userId: req.user._id,
      action: 'error',
      details: {
        errorMessage: error.message,
        range
      }
    }).save();
    
    res.status(500).json({ error: error.message });
  }
});

// Batch update cells
router.put('/data/:sheetId/batch', protect, requireSuperAdmin, async (req, res) => {
  const { sheetId } = req.params;
  const { updates } = req.body; // Array of {range, values}
  
  try {
    const sheet = await ImportedSheet.findOne({ 
      _id: sheetId, 
      userId: req.user._id 
    });
    
    if (!sheet) {
      return res.status(404).json({ error: 'Sheet not found' });
    }

    if (!sheet.permissions.canEdit) {
      return res.status(403).json({ error: 'No edit permission for this sheet' });
    }

    const tokens = await getUserTokens(req.user._id);
    if (!tokens) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const authService = new GoogleAuthService();
    authService.setCredentials(tokens);
    
    const sheetsService = new GoogleSheetsService(authService.getAuthClient());
    
    // Format updates for batch operation
    const batchUpdates = updates.map(update => ({
      range: `${sheet.sheetName}!${update.range}`,
      values: Array.isArray(update.values[0]) ? update.values : [update.values]
    }));
    
    const result = await sheetsService.batchUpdate(sheet.spreadsheetId, batchUpdates);
    
    // Log activity
    await new SheetActivity({
      sheetId: sheet._id,
      userId: req.user._id,
      action: 'batch_update',
      details: {
        cellsUpdated: updates.length
      }
    }).save();
    
    // Update last sync time
    sheet.lastSyncAt = new Date();
    await sheet.save();
    
    res.json({ 
      success: true, 
      result,
      updatedCells: updates.length
    });
  } catch (error) {
    console.error('Batch update error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete imported sheet
router.delete('/:sheetId', protect, requireSuperAdmin, async (req, res) => {
  const { sheetId } = req.params;
  
  try {
    const sheet = await ImportedSheet.findOneAndDelete({ 
      _id: sheetId, 
      userId: req.user._id 
    });
    
    if (!sheet) {
      return res.status(404).json({ error: 'Sheet not found' });
    }

    // Delete related activities
    await SheetActivity.deleteMany({ sheetId });
    
    res.json({ success: true, message: 'Sheet removed from CRM' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get sheet activity log
router.get('/:sheetId/activity', protect, requireSuperAdmin, async (req, res) => {
  const { sheetId } = req.params;
  const { page = 1, limit = 50 } = req.query;
  
  try {
    const activities = await SheetActivity.find({ sheetId })
      .populate('userId', 'name email')
      .sort({ timestamp: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await SheetActivity.countDocuments({ sheetId });
    
    res.json({
      activities,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;