/**
 * AI-Powered Attendance Analytics Service
 * Uses OpenRouter API for deep insights
 */

const axios = require('axios');

class AIAnalyticsService {
  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY;
    this.model = process.env.OPENROUTER_MODEL || 'google/gemma-2-9b-it:free';
    this.baseURL = 'https://openrouter.ai/api/v1/chat/completions';
  }

  /**
   * Generate AI-powered insights from attendance analytics
   */
  async generateInsights(analysisData, employeeName = 'Employee') {
    if (!this.apiKey) {
      console.warn('OpenRouter API key not configured, skipping AI insights');
      return null;
    }

    try {
      const prompt = this.buildAnalysisPrompt(analysisData, employeeName);

      const response = await axios.post(
        this.baseURL,
        {
          model: this.model,
          messages: [
            {
              role: 'system',
              content: `You are an expert HR analytics assistant. Analyze attendance data and provide clear, actionable insights.

RULES:
1. Be direct and concise
2. Focus on actionable recommendations
3. Highlight critical issues first
4. Use bullet points for clarity
5. No markdown formatting or special tags
6. No thinking process or reasoning tags
7. Professional tone but conversational
8. Maximum 6-8 sentences

Output format:
Brief Assessment: [2-3 sentences]
Key Concerns: [2-3 bullet points if any issues]
Recommendations: [2-3 specific actions]`
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 500,
          temperature: 0.7
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:5173',
            'X-Title': 'TapveraCRM Attendance Analytics'
          },
          timeout: 15000
        }
      );

      let aiInsight = response.data.choices[0]?.message?.content;

      if (!aiInsight) {
        console.warn('No AI insight generated');
        return null;
      }

      // Clean up the response - remove thinking tags and unwanted formatting
      aiInsight = this.cleanAIResponse(aiInsight);

      return {
        insight: aiInsight,
        model: this.model,
        timestamp: new Date().toISOString(),
        confidence: this.calculateConfidence(analysisData)
      };

    } catch (error) {
      console.error('Error generating AI insights:', error.message);
      return null;
    }
  }

  /**
   * Clean AI response from unwanted tags and formatting
   */
  cleanAIResponse(text) {
    if (!text) return text;

    // Remove thinking tags and their content
    text = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
    text = text.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');

    // Remove other common tags
    text = text.replace(/<\/?[^>]+(>|$)/g, '');

    // Remove excessive newlines
    text = text.replace(/\n{3,}/g, '\n\n');

    // Trim whitespace
    text = text.trim();

    return text;
  }

  /**
   * Build comprehensive prompt for AI analysis
   */
  buildAnalysisPrompt(analysis, employeeName) {
    const { summary, latePatterns, burnoutSignals, punctualityTrend, alerts } = analysis;

    // Build a focused, structured prompt
    const criticalIssues = [];

    if (summary.riskLevel === 'critical' || summary.riskLevel === 'high') {
      criticalIssues.push(`HIGH RISK: Score ${summary.riskScore}/100`);
    }

    if (latePatterns.hasPattern && latePatterns.latePercentage > 20) {
      criticalIssues.push(`Late ${latePatterns.latePercentage}% of time (${latePatterns.lateDaysCount} days)`);
    }

    if (latePatterns.maxConsecutiveLate >= 3) {
      criticalIssues.push(`${latePatterns.maxConsecutiveLate} consecutive late days`);
    }

    if (burnoutSignals.hasBurnoutSignals) {
      criticalIssues.push(`Burnout signs: ${burnoutSignals.avgWeeklyOvertime}h overtime/week`);
    }

    if (punctualityTrend.hasData && punctualityTrend.isSignificantDrop) {
      criticalIssues.push(`Punctuality dropped ${Math.abs(punctualityTrend.percentageChange).toFixed(0)}%`);
    }

    return `Analyze attendance data for ${employeeName}:

DATA SUMMARY:
• ${summary.totalDays} days tracked | ${summary.lateDays} late (${summary.latePercentage}%)
• Avg ${summary.averageWorkHours}h/day | Punctuality ${summary.punctualityScore}%
• Risk: ${summary.riskLevel.toUpperCase()} (${summary.riskScore}/100)

${criticalIssues.length > 0 ? `CRITICAL ISSUES:\n${criticalIssues.map(i => `• ${i}`).join('\n')}` : 'Performance: Good - No critical issues'}

${latePatterns.mostLateDay ? `PATTERN: Most late on ${latePatterns.mostLateDay.day} (${latePatterns.mostLateDay.count}x), avg ${latePatterns.avgLateMinutes} min late` : ''}

${burnoutSignals.overtimeDaysCount > 0 ? `WORKLOAD: ${burnoutSignals.overtimeDaysCount} overtime days, ${burnoutSignals.skippedBreakDays} days minimal breaks` : ''}

${punctualityTrend.hasData ? `TREND: ${punctualityTrend.trendDirection} (${punctualityTrend.previousScore}% → ${punctualityTrend.currentScore}%)` : ''}

TOP ALERTS:
${alerts.slice(0, 2).map(a => `• ${a.title}`).join('\n') || '• No active alerts'}

Provide:
1. ASSESSMENT: What's the overall situation? (2 sentences max)
2. CONCERNS: What are the top 2-3 issues? (bullet points)
3. ACTIONS: What should management do? (2-3 specific steps)

Be direct and actionable. Focus on solutions.`;
  }

  /**
   * Calculate confidence score based on data quality
   */
  calculateConfidence(analysis) {
    const { summary } = analysis;

    let confidence = 100;

    // Reduce confidence if insufficient data
    if (summary.totalDays < 10) confidence -= 30;
    else if (summary.totalDays < 20) confidence -= 15;

    // Reduce confidence if risk score is very low (might indicate incomplete data)
    if (summary.riskScore < 5 && summary.totalDays < 15) confidence -= 20;

    return Math.max(50, confidence); // Minimum 50% confidence
  }

  /**
   * Analyze specific pattern with AI
   */
  async analyzePattern(patternType, patternData, employeeName) {
    if (!this.apiKey) {
      return null;
    }

    try {
      const prompt = this.buildPatternPrompt(patternType, patternData, employeeName);

      const response = await axios.post(
        this.baseURL,
        {
          model: this.model,
          messages: [
            {
              role: 'system',
              content: `You are an HR analytics expert. Analyze attendance patterns and provide brief, actionable insights.

RULES:
- Maximum 4-5 sentences
- Be direct and specific
- Focus on root causes and solutions
- No thinking tags or markdown
- Professional but conversational`
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 250,
          temperature: 0.6
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:5173',
            'X-Title': 'TapveraCRM Pattern Analysis'
          },
          timeout: 10000
        }
      );

      let result = response.data.choices[0]?.message?.content || null;

      // Clean response
      if (result) {
        result = this.cleanAIResponse(result);
      }

      return result;

    } catch (error) {
      console.error('Error analyzing pattern:', error.message);
      return null;
    }
  }

  /**
   * Build prompt for specific pattern analysis
   */
  buildPatternPrompt(patternType, patternData, employeeName) {
    switch (patternType) {
      case 'late_pattern':
        return `${employeeName}: Late ${patternData.count}x in ${patternData.period} days, avg ${patternData.avgMinutes} min late, mostly on ${patternData.mostLateDay}.

What's likely causing this pattern and what should be done? Be specific.`;

      case 'burnout':
        return `${employeeName}: ${patternData.overtimeDays} overtime days, ${patternData.avgWeeklyOvertime}h/week overtime, ${patternData.skippedBreaks} days with minimal breaks.

Is this burnout risk? What actions should management take immediately?`;

      case 'punctuality_drop':
        return `${employeeName}: Punctuality fell from ${patternData.previousScore}% to ${patternData.currentScore}% (${Math.abs(patternData.change)}% drop).

Why the sudden change? What should management investigate and do?`;

      default:
        return `${employeeName} attendance pattern analysis needed: ${JSON.stringify(patternData)}

What does this indicate and what actions are recommended?`;
    }
  }

  /**
   * Generate recommendations based on risk level
   */
  async generateRecommendations(riskLevel, alerts, employeeName) {
    if (!this.apiKey || alerts.length === 0) {
      return this.getDefaultRecommendations(riskLevel);
    }

    try {
      const topAlerts = alerts.slice(0, 3).map((a, i) => `${i + 1}. ${a.title}`).join('\n');

      const response = await axios.post(
        this.baseURL,
        {
          model: this.model,
          messages: [
            {
              role: 'system',
              content: `You are an HR advisor. Provide exactly 3 specific, actionable recommendations.

RULES:
- Each recommendation must be a concrete action
- Number them 1-3
- Keep each to 1-2 sentences
- Be specific (who, what, when)
- No thinking tags or markdown`
            },
            {
              role: 'user',
              content: `${employeeName} - Risk: ${riskLevel.toUpperCase()}

Issues:
${topAlerts}

Give 3 specific management actions to take now.`
            }
          ],
          max_tokens: 200,
          temperature: 0.7
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:5173',
            'X-Title': 'TapveraCRM Recommendations'
          },
          timeout: 10000
        }
      );

      let result = response.data.choices[0]?.message?.content;

      // Clean response
      if (result) {
        result = this.cleanAIResponse(result);
      }

      return result || this.getDefaultRecommendations(riskLevel);

    } catch (error) {
      console.error('Error generating recommendations:', error.message);
      return this.getDefaultRecommendations(riskLevel);
    }
  }

  /**
   * Get default recommendations if AI is unavailable
   */
  getDefaultRecommendations(riskLevel) {
    const recommendations = {
      low: [
        'Continue monitoring attendance patterns',
        'Maintain current work-life balance practices',
        'Recognize and reward consistent punctuality'
      ],
      medium: [
        'Schedule a check-in meeting to discuss attendance',
        'Review workload and identify potential issues',
        'Provide flexible working options if needed'
      ],
      high: [
        'Immediate one-on-one discussion required',
        'Assess for burnout and personal challenges',
        'Create an attendance improvement plan with specific goals'
      ],
      critical: [
        'Urgent intervention needed - schedule immediate meeting',
        'Consider temporary workload reduction',
        'Refer to HR for comprehensive support and resources'
      ]
    };

    return recommendations[riskLevel] || recommendations.medium;
  }
}

module.exports = new AIAnalyticsService();
