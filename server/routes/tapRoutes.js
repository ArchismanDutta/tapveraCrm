// routes/tapRoutes.js
// API routes for Tap AI Assistant

const express = require('express');
const router = express.Router();
const tapAIService = require('../services/tapAIService');
const { protect } = require('../middlewares/authMiddleware');

/**
 * @route   POST /api/tap/chat
 * @desc    Send message to Tap assistant
 * @access  Private
 */
router.post('/chat', protect, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    // Build user context
    const userContext = {
      user: {
        _id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role
      },
      permissions: {
        canCreateTasks: ['admin', 'super-admin'].includes(req.user.role),
        canAssignTasks: ['admin', 'super-admin'].includes(req.user.role),
        canViewAllProjects: ['admin', 'super-admin', 'hr'].includes(req.user.role)
      }
    };

    // Process message with AI
    const result = await tapAIService.processMessage(
      req.user._id.toString(),
      message,
      userContext
    );

    // Execute any actions if present
    if (result.actions && result.actions.length > 0) {
      const actionResults = [];

      for (const action of result.actions) {
        const actionResult = await tapAIService.executeAction(
          action.type,
          action.parameters,
          req.user
        );
        actionResults.push({
          action: action.type,
          ...actionResult
        });
      }

      result.actionResults = actionResults;
    }

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Tap chat error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process message',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/tap/execute
 * @desc    Execute a specific CRM action
 * @access  Private
 */
router.post('/execute', protect, async (req, res) => {
  try {
    const { actionType, parameters } = req.body;

    if (!actionType) {
      return res.status(400).json({
        success: false,
        error: 'Action type is required'
      });
    }

    const result = await tapAIService.executeAction(
      actionType,
      parameters || {},
      req.user
    );

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Tap execute error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute action',
      message: error.message
    });
  }
});

/**
 * @route   DELETE /api/tap/history
 * @desc    Clear conversation history
 * @access  Private
 */
router.delete('/history', protect, async (req, res) => {
  try {
    tapAIService.clearHistory(req.user._id.toString());

    res.json({
      success: true,
      message: 'Conversation history cleared'
    });

  } catch (error) {
    console.error('Tap history clear error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear history',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/tap/status
 * @desc    Check Tap assistant status
 * @access  Private
 */
router.get('/status', protect, async (req, res) => {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.OPENROUTER_MODEL;

    res.json({
      success: true,
      data: {
        available: !!apiKey,
        model: model || 'Not configured',
        user: {
          name: req.user.name,
          role: req.user.role
        },
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Tap status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check status',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/tap/suggestions
 * @desc    Get suggested commands based on user role
 * @access  Private
 */
router.get('/suggestions', protect, async (req, res) => {
  try {
    const suggestions = [];

    // Common suggestions for all users
    suggestions.push(
      'Show me my tasks',
      'What\'s my schedule today?',
      'Get my attendance summary'
    );

    // Role-based suggestions
    if (['admin', 'super-admin'].includes(req.user.role)) {
      suggestions.push(
        'Create a new task for John',
        'Show all pending projects',
        'List all employees',
        'Get team analytics'
      );
    }

    if (req.user.role === 'employee') {
      suggestions.push(
        'Request leave for next week',
        'Update my task status',
        'Show my projects'
      );
    }

    res.json({
      success: true,
      data: suggestions
    });

  } catch (error) {
    console.error('Tap suggestions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get suggestions',
      message: error.message
    });
  }
});

module.exports = router;
