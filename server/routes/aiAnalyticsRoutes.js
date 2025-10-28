const express = require('express');
const router = express.Router();
const aiAnalyticsService = require('../services/aiAnalyticsService');
const { protect, authorize } = require('../middlewares/authMiddleware');

/**
 * @route   POST /api/ai-analytics/insights
 * @desc    Generate AI insights from attendance analysis data
 * @access  Private (SuperAdmin, Admin)
 */
router.post('/insights', protect, authorize('super-admin', 'admin'), async (req, res) => {
  try {
    const { analysisData, employeeName } = req.body;

    if (!analysisData) {
      return res.status(400).json({
        success: false,
        message: 'Analysis data is required'
      });
    }

    console.log(`🤖 Generating AI insights for ${employeeName || 'employee'}`);

    const insights = await aiAnalyticsService.generateInsights(analysisData, employeeName);

    if (!insights) {
      return res.status(200).json({
        success: true,
        message: 'AI insights not available',
        data: null
      });
    }

    res.json({
      success: true,
      data: insights
    });

  } catch (error) {
    console.error('Error in AI insights route:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate AI insights',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/ai-analytics/pattern-analysis
 * @desc    Analyze specific attendance pattern
 * @access  Private (SuperAdmin, Admin)
 */
router.post('/pattern-analysis', protect, authorize('super-admin', 'admin'), async (req, res) => {
  try {
    const { patternType, patternData, employeeName } = req.body;

    if (!patternType || !patternData) {
      return res.status(400).json({
        success: false,
        message: 'Pattern type and data are required'
      });
    }

    console.log(`🤖 Analyzing ${patternType} pattern for ${employeeName || 'employee'}`);

    const analysis = await aiAnalyticsService.analyzePattern(patternType, patternData, employeeName);

    if (!analysis) {
      return res.status(200).json({
        success: true,
        message: 'Pattern analysis not available',
        data: null
      });
    }

    res.json({
      success: true,
      data: {
        analysis,
        patternType,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error in pattern analysis route:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze pattern',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/ai-analytics/recommendations
 * @desc    Generate AI recommendations based on risk level
 * @access  Private (SuperAdmin, Admin)
 */
router.post('/recommendations', protect, authorize('super-admin', 'admin'), async (req, res) => {
  try {
    const { riskLevel, alerts, employeeName } = req.body;

    if (!riskLevel) {
      return res.status(400).json({
        success: false,
        message: 'Risk level is required'
      });
    }

    console.log(`🤖 Generating recommendations for ${riskLevel} risk level`);

    const recommendations = await aiAnalyticsService.generateRecommendations(
      riskLevel,
      alerts || [],
      employeeName
    );

    res.json({
      success: true,
      data: {
        recommendations,
        riskLevel,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error in recommendations route:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate recommendations',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/ai-analytics/status
 * @desc    Check AI analytics service status
 * @access  Private (SuperAdmin, Admin)
 */
router.get('/status', protect, authorize('super-admin', 'admin'), async (req, res) => {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.OPENROUTER_MODEL;

    res.json({
      success: true,
      data: {
        available: !!apiKey,
        model: model || 'Not configured',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error checking AI status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check AI status',
      error: error.message
    });
  }
});

module.exports = router;
