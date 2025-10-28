/**
 * AI Analytics Service - Frontend
 * Calls backend AI analytics API for enhanced insights
 */

import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

class AIAnalyticsService {
  constructor() {
    this.token = localStorage.getItem('token');
    this.apiClient = axios.create({
      baseURL: API_BASE,
      timeout: 20000 // AI calls may take longer
    });

    // Add auth interceptor
    this.apiClient.interceptors.request.use((config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  /**
   * Get AI-generated insights from analysis data
   */
  async getAIInsights(analysisData, employeeName) {
    try {
      console.log('🤖 Requesting AI insights from backend...');

      const response = await this.apiClient.post('/api/ai-analytics/insights', {
        analysisData,
        employeeName
      });

      if (response.data.success && response.data.data) {
        console.log('✅ AI insights received');
        return {
          ...response.data.data,
          source: 'ai'
        };
      }

      return null;
    } catch (error) {
      console.warn('AI insights not available:', error.message);
      return null;
    }
  }

  /**
   * Analyze specific pattern with AI
   */
  async analyzePattern(patternType, patternData, employeeName) {
    try {
      console.log(`🤖 Requesting AI pattern analysis: ${patternType}`);

      const response = await this.apiClient.post('/api/ai-analytics/pattern-analysis', {
        patternType,
        patternData,
        employeeName
      });

      if (response.data.success && response.data.data) {
        console.log('✅ Pattern analysis received');
        return response.data.data.analysis;
      }

      return null;
    } catch (error) {
      console.warn('Pattern analysis not available:', error.message);
      return null;
    }
  }

  /**
   * Get AI recommendations based on risk level
   */
  async getRecommendations(riskLevel, alerts, employeeName) {
    try {
      console.log(`🤖 Requesting AI recommendations for ${riskLevel} risk`);

      const response = await this.apiClient.post('/api/ai-analytics/recommendations', {
        riskLevel,
        alerts,
        employeeName
      });

      if (response.data.success && response.data.data) {
        console.log('✅ Recommendations received');
        return response.data.data.recommendations;
      }

      return null;
    } catch (error) {
      console.warn('Recommendations not available:', error.message);
      return null;
    }
  }

  /**
   * Check if AI analytics is available
   */
  async checkStatus() {
    try {
      const response = await this.apiClient.get('/api/ai-analytics/status');

      if (response.data.success) {
        return response.data.data;
      }

      return { available: false };
    } catch (error) {
      console.warn('Could not check AI status:', error.message);
      return { available: false };
    }
  }

  /**
   * Enhance local analysis with AI insights
   */
  async enhanceAnalysis(localAnalysis, employeeName) {
    try {
      // Get AI insights in parallel with status check
      const [insights, status] = await Promise.all([
        this.getAIInsights(localAnalysis, employeeName),
        this.checkStatus()
      ]);

      if (!insights) {
        return {
          ...localAnalysis,
          aiEnhanced: false,
          aiAvailable: status.available
        };
      }

      // Merge AI insights with local analysis
      return {
        ...localAnalysis,
        aiEnhanced: true,
        aiAvailable: true,
        aiInsights: {
          assessment: insights.insight,
          model: insights.model,
          confidence: insights.confidence,
          timestamp: insights.timestamp
        },
        // Keep all original data
        insights: [
          ...localAnalysis.insights,
          {
            type: 'ai',
            message: insights.insight,
            icon: '🤖'
          }
        ]
      };
    } catch (error) {
      console.error('Error enhancing analysis with AI:', error);
      return {
        ...localAnalysis,
        aiEnhanced: false,
        aiAvailable: false
      };
    }
  }
}

export default new AIAnalyticsService();
