// services/tapAIService.js
// AI Service for Tap - The CRM Assistant (Real Agent)

const enhancedNLP = require('../utils/enhancedNLP');

class TapAIService {
  constructor() {
    this.conversationHistory = new Map(); // userId -> messages[]
    this.maxHistoryLength = 10;

    // Intent patterns for direct action matching
    this.intentPatterns = this.buildIntentPatterns();

    // Enhanced NLP for fuzzy matching and synonym support
    this.nlp = enhancedNLP;
  }

  /**
   * Build intent recognition patterns
   */
  buildIntentPatterns() {
    return [
      // Task patterns - with smart extraction
      {
        pattern: /create\s+(?:a\s+)?task\s+for\s+(\w+(?:\s+\w+)?)\s+to\s+(.+?)(?:\s+by\s+(.+?))?(?:\s+with\s+(\w+)\s+priority)?$/i,
        action: 'CREATE_TASK',
        extractParams: (match) => ({
          assigneeName: match[1],
          title: match[2],
          dueDate: match[3] ? this.parseDate(match[3]) : null,
          priority: match[4] ? match[4].toLowerCase() : 'normal'
        })
      },
      {
        pattern: /create\s+(?:a\s+)?(\w+)\s+priority\s+task\s+(.+)/i,
        action: 'CREATE_TASK',
        extractParams: (match) => ({
          priority: match[1].toLowerCase(),
          title: match[2]
        })
      },
      { pattern: /create.*task/i, action: 'CREATE_TASK' },
      { pattern: /show.*tasks?|list.*tasks?|get.*tasks?|my tasks/i, action: 'GET_TASKS' },
      { pattern: /pending tasks?/i, action: 'GET_TASKS', params: { status: 'pending' } },
      { pattern: /completed tasks?/i, action: 'GET_TASKS', params: { status: 'completed' } },
      { pattern: /in[_\s]?progress tasks?/i, action: 'GET_TASKS', params: { status: 'in_progress' } },
      { pattern: /high priority tasks?/i, action: 'GET_TASKS', params: { priority: 'high' } },

      // Project patterns - with smart extraction
      {
        pattern: /create\s+(?:a\s+)?project\s+(?:called|named)?\s*(.+?)\s+for\s+(.+)/i,
        action: 'CREATE_PROJECT',
        extractParams: (match) => ({
          projectName: match[1],
          clientName: match[2]
        })
      },
      { pattern: /show.*projects?|list.*projects?|get.*projects?/i, action: 'GET_PROJECTS' },
      { pattern: /active projects?/i, action: 'GET_PROJECTS', params: { status: 'active' } },
      { pattern: /ongoing projects?/i, action: 'GET_PROJECTS', params: { status: 'ongoing' } },
      { pattern: /completed projects?/i, action: 'GET_PROJECTS', params: { status: 'completed' } },

      // Employee patterns - with filters
      { pattern: /show.*employees?|list.*employees?|get.*employees?|list.*team/i, action: 'GET_EMPLOYEES' },
      { pattern: /(\w+)\s+employees?/i, action: 'GET_EMPLOYEES', extractParams: (match) => ({ role: match[1].toLowerCase() }) },
      { pattern: /employees?\s+in\s+(.+)/i, action: 'GET_EMPLOYEES', extractParams: (match) => ({ department: match[1] }) },

      // Client patterns
      { pattern: /show.*clients?|list.*clients?|get.*clients?/i, action: 'GET_CLIENTS' },
      { pattern: /active clients?/i, action: 'GET_CLIENTS', params: { status: 'active' } },
      {
        pattern: /(?:create|add)\s+(?:a\s+)?client\s+(.+)/i,
        action: 'CREATE_CLIENT',
        extractParams: (match) => ({ clientName: match[1] })
      },

      // Attendance patterns
      { pattern: /my attendance|show.*attendance|check.*attendance/i, action: 'GET_ATTENDANCE' },
      { pattern: /attendance.*today/i, action: 'GET_ATTENDANCE', params: { date: new Date().toISOString().split('T')[0] } },
      { pattern: /attendance.*this\s+week/i, action: 'GET_ATTENDANCE', params: { limit: 7 } },
      { pattern: /attendance.*this\s+month/i, action: 'GET_ATTENDANCE', params: { limit: 30 } },

      // Leave patterns - with smart extraction
      {
        pattern: /(?:request|apply|take)\s+leave\s+from\s+(.+?)\s+to\s+(.+?)(?:\s+for\s+(.+))?/i,
        action: 'CREATE_LEAVE',
        extractParams: (match) => ({
          startDate: this.parseDate(match[1]),
          endDate: this.parseDate(match[2]),
          reason: match[3] || 'Personal'
        })
      },
      { pattern: /(?:request|apply)\s+(\w+)\s+leave/i, action: 'CREATE_LEAVE', extractParams: (match) => ({ leaveType: match[1] }) },
      { pattern: /my leaves?|show.*leaves?/i, action: 'GET_LEAVES' },
      { pattern: /pending leaves?/i, action: 'GET_LEAVES', params: { status: 'pending' } },

      // Analytics patterns
      { pattern: /analytics|statistics|stats|report/i, action: 'GET_ANALYTICS' },
    ];
  }

  /**
   * Parse natural date expressions
   */
  parseDate(dateStr) {
    if (!dateStr) return null;

    const today = new Date();
    const lowerStr = dateStr.toLowerCase().trim();

    // Relative dates
    if (lowerStr === 'today') return today.toISOString().split('T')[0];
    if (lowerStr === 'tomorrow') {
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      return tomorrow.toISOString().split('T')[0];
    }
    if (lowerStr.match(/next\s+week/)) {
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);
      return nextWeek.toISOString().split('T')[0];
    }
    if (lowerStr.match(/next\s+month/)) {
      const nextMonth = new Date(today);
      nextMonth.setMonth(today.getMonth() + 1);
      return nextMonth.toISOString().split('T')[0];
    }

    // Day names
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayMatch = lowerStr.match(new RegExp(`(${days.join('|')})`, 'i'));
    if (dayMatch) {
      const targetDay = days.indexOf(dayMatch[1].toLowerCase());
      const currentDay = today.getDay();
      let daysUntil = targetDay - currentDay;
      if (daysUntil <= 0) daysUntil += 7;
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + daysUntil);
      return targetDate.toISOString().split('T')[0];
    }

    // Try parsing as ISO date
    const parsedDate = new Date(dateStr);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate.toISOString().split('T')[0];
    }

    return null;
  }

  /**
   * Process user message as a real agent - parse intent and execute immediately
   */
  async processMessage(userId, message, userContext) {
    try {
      console.log(`🤖 Tap Agent processing: "${message}"`);

      // Parse intent from message
      const intent = this.parseIntent(message);

      if (!intent) {
        return {
          response: "I'm not sure what you want me to do. Try:\n• 'Show my tasks'\n• 'List all employees'\n• 'Create a task'\n• 'Get attendance'\n• 'Show projects'",
          executed: false,
          timestamp: new Date().toISOString()
        };
      }

      console.log(`📋 Detected intent: ${intent.action}`);

      // Execute the action immediately
      const result = await this.executeAction(
        intent.action,
        intent.parameters,
        userContext.user
      );

      // Format response based on result
      const response = this.formatResponse(intent.action, result, message);

      // Store in history
      this.addToHistory(userId, message, response);

      return {
        response,
        action: intent.action,
        executed: true,
        result: result.data,
        success: result.success,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Tap Agent error:', error);
      return {
        response: `Sorry, I encountered an error: ${error.message}`,
        executed: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Parse user intent from natural language with enhanced NLP
   */
  parseIntent(message) {
    console.log(`🧠 Enhanced NLP parsing: "${message}"`);

    // First, try traditional regex patterns for complex structured commands
    for (const pattern of this.intentPatterns) {
      const match = message.match(pattern.pattern);
      if (match) {
        let parameters = { ...pattern.params } || {};

        // Extract parameters using custom extractor if available
        if (pattern.extractParams && typeof pattern.extractParams === 'function') {
          const extracted = pattern.extractParams(match);
          parameters = { ...parameters, ...extracted };
        }

        console.log(`✅ Matched via regex: ${pattern.action}`);
        return {
          action: pattern.action,
          parameters,
          matches: match,
          originalMessage: message,
          confidence: 1.0,
          method: 'regex'
        };
      }
    }

    // If no regex match, use enhanced NLP with fuzzy matching
    console.log(`🔍 Trying fuzzy NLP matching...`);
    const entities = this.nlp.extractEntities(message);

    console.log('Extracted entities:', JSON.stringify(entities, null, 2));

    if (entities.intent && entities.entity) {
      const { intent, entity, priority, status } = entities;

      // Map intent + entity to action
      const action = this.mapIntentEntityToAction(
        intent.intent,
        entity.entity,
        message
      );

      if (action) {
        // Extract parameters using NLP
        const parameters = this.extractParametersNLP(message, {
          intent: intent.intent,
          entity: entity.entity,
          priority,
          status
        });

        const avgConfidence = (
          (intent.confidence || 0) +
          (entity.confidence || 0)
        ) / 2;

        console.log(`✅ Matched via NLP: ${action} (confidence: ${(avgConfidence * 100).toFixed(1)}%)`);

        return {
          action,
          parameters,
          originalMessage: message,
          confidence: avgConfidence,
          method: 'nlp',
          entities
        };
      }
    }

    // Try entity-only matching for simple commands
    if (entities.entity) {
      const simpleAction = this.mapEntityToAction(entities.entity.entity);
      if (simpleAction) {
        console.log(`✅ Matched via entity only: ${simpleAction}`);
        return {
          action: simpleAction,
          parameters: {},
          originalMessage: message,
          confidence: entities.entity.confidence,
          method: 'entity-only'
        };
      }
    }

    console.log(`❌ No match found`);
    return null;
  }

  /**
   * Map intent + entity combination to action
   */
  mapIntentEntityToAction(intent, entity, message) {
    const mapping = {
      'create-task': 'CREATE_TASK',
      'create-project': 'CREATE_PROJECT',
      'create-client': 'CREATE_CLIENT',
      'create-leave': 'CREATE_LEAVE',

      'view-task': 'GET_TASKS',
      'view-project': 'GET_PROJECTS',
      'view-employee': 'GET_EMPLOYEES',
      'view-client': 'GET_CLIENTS',
      'view-attendance': 'GET_ATTENDANCE',
      'view-leave': 'GET_LEAVES',
      'view-analytics': 'GET_ANALYTICS',

      'filter-task': 'GET_TASKS',
      'filter-project': 'GET_PROJECTS',
      'filter-employee': 'GET_EMPLOYEES',

      'update-task': 'UPDATE_TASK_STATUS',
      'assign-task': 'ASSIGN_TASK',

      'approve-leave': 'APPROVE_LEAVE',
      'reject-leave': 'REJECT_LEAVE',
    };

    const key = `${intent}-${entity}`;
    return mapping[key] || null;
  }

  /**
   * Map entity only to default action (show/list)
   */
  mapEntityToAction(entity) {
    const mapping = {
      'task': 'GET_TASKS',
      'project': 'GET_PROJECTS',
      'employee': 'GET_EMPLOYEES',
      'client': 'GET_CLIENTS',
      'attendance': 'GET_ATTENDANCE',
      'leave': 'GET_LEAVES',
      'analytics': 'GET_ANALYTICS',
    };
    return mapping[entity] || null;
  }

  /**
   * Extract parameters using enhanced NLP
   */
  extractParametersNLP(message, entities) {
    const params = {};

    // Extract priority
    if (entities.priority) {
      params.priority = entities.priority.value;
    }

    // Extract status
    if (entities.status) {
      params.status = entities.status.value;
    }

    // Extract title/name/description (text after the entity)
    const keywords = {
      'task': ['task', 'todo'],
      'project': ['project', 'proj'],
      'client': ['client', 'customer'],
      'leave': ['leave', 'vacation']
    };

    if (entities.entity && keywords[entities.entity]) {
      const extractedText = this.nlp.extractValue(
        message,
        keywords[entities.entity]
      );

      if (extractedText) {
        if (entities.entity === 'task') {
          params.title = extractedText;
        } else if (entities.entity === 'project') {
          params.projectName = extractedText;
        } else if (entities.entity === 'client') {
          params.clientName = extractedText;
        }
      }
    }

    // Extract dates
    const dateMatch = message.match(/by\s+(.+?)(?:\s+with|\s+$|$)/i);
    if (dateMatch) {
      params.dueDate = this.parseDate(dateMatch[1]);
    }

    // Extract "for" (assignee)
    const forMatch = message.match(/for\s+(\w+(?:\s+\w+)?)/i);
    if (forMatch) {
      params.assigneeName = forMatch[1];
    }

    return params;
  }

  /**
   * Format response based on action results
   */
  formatResponse(action, result, originalMessage) {
    if (!result.success) {
      return `❌ Failed to ${action.toLowerCase().replace('_', ' ')}: ${result.error || 'Unknown error'}`;
    }

    const data = result.data;

    switch (action) {
      case 'GET_TASKS':
        if (!data || data.length === 0) {
          return '📋 No tasks found.';
        }
        return `📋 Found ${data.length} task(s):\n\n${data.slice(0, 5).map((t, i) =>
          `${i + 1}. ${t.title}\n   Status: ${t.status}\n   Assigned to: ${t.assignedTo?.name || 'Unassigned'}`
        ).join('\n\n')}${data.length > 5 ? '\n\n...and more' : ''}`;

      case 'CREATE_TASK':
        return `✅ Task created successfully!\n\nTitle: ${data.title}\nAssigned to: ${data.assignedTo?.name || 'Unassigned'}\nPriority: ${data.priority}\nDue date: ${data.dueDate ? new Date(data.dueDate).toLocaleDateString() : 'Not set'}\nStatus: ${data.status}`;

      case 'CREATE_PROJECT':
        return `✅ Project created successfully!\n\nName: ${data.projectName}\nClient: ${data.client?.clientName || 'N/A'}\nPriority: ${data.priority}\nStatus: ${data.status}\nAssigned to: ${data.assignedTo?.length ? data.assignedTo.map(u => u.name).join(', ') : 'Unassigned'}`;

      case 'GET_PROJECTS':
        if (!data || data.length === 0) {
          return '📁 No projects found.';
        }
        return `📁 Found ${data.length} project(s):\n\n${data.slice(0, 5).map((p, i) =>
          `${i + 1}. ${p.projectName}\n   Status: ${p.status}\n   Client: ${p.client?.clientName || 'N/A'}`
        ).join('\n\n')}${data.length > 5 ? '\n\n...and more' : ''}`;

      case 'GET_EMPLOYEES':
        if (!data || data.length === 0) {
          return '👥 No employees found.';
        }
        return `👥 Found ${data.length} employee(s):\n\n${data.slice(0, 8).map((e, i) =>
          `${i + 1}. ${e.name}\n   Role: ${e.role}\n   Dept: ${e.department || 'N/A'}`
        ).join('\n\n')}${data.length > 8 ? '\n\n...and more' : ''}`;

      case 'CREATE_CLIENT':
        return `✅ Client created successfully!\n\nName: ${data.clientName}\nBusiness: ${data.businessName}\nEmail: ${data.email}\nStatus: ${data.status}`;

      case 'GET_CLIENTS':
        if (!data || data.length === 0) {
          return '🏢 No clients found.';
        }
        return `🏢 Found ${data.length} client(s):\n\n${data.slice(0, 5).map((c, i) =>
          `${i + 1}. ${c.clientName}\n   Business: ${c.businessName}\n   Status: ${c.status}`
        ).join('\n\n')}${data.length > 5 ? '\n\n...and more' : ''}`;

      case 'GET_ATTENDANCE':
        if (!data || data.length === 0) {
          return '📅 No attendance records found.';
        }
        // Check if it's user-specific or summary data
        if (data[0].status) {
          // User-specific attendance
          return `📅 Found ${data.length} attendance record(s):\n\n${data.slice(0, 5).map((a, i) =>
            `${i + 1}. Date: ${new Date(a.date).toLocaleDateString()}\n   Status: ${a.status}\n   Hours: ${((a.workDurationSeconds || 0) / 3600).toFixed(1)}h`
          ).join('\n\n')}${data.length > 5 ? '\n\n...and more' : ''}`;
        } else {
          // Summary attendance (admin view)
          return `📅 Found ${data.length} daily record(s):\n\n${data.slice(0, 5).map((a, i) =>
            `${i + 1}. Date: ${new Date(a.date).toLocaleDateString()}\n   Present: ${a.present}/${a.totalEmployees}\n   Absent: ${a.absent}, Late: ${a.late}`
          ).join('\n\n')}${data.length > 5 ? '\n\n...and more' : ''}`;
        }

      case 'CREATE_LEAVE':
        return `✅ Leave request submitted!\n\nType: ${data.leaveType}\nFrom: ${new Date(data.startDate).toLocaleDateString()}\nTo: ${new Date(data.endDate).toLocaleDateString()}\nStatus: ${data.status}`;

      case 'GET_LEAVES':
        if (!data || data.length === 0) {
          return '🌴 No leave records found.';
        }
        return `🌴 Found ${data.length} leave record(s):\n\n${data.slice(0, 5).map((l, i) =>
          `${i + 1}. Type: ${l.leaveType}\n   From: ${new Date(l.startDate).toLocaleDateString()} to ${new Date(l.endDate).toLocaleDateString()}\n   Status: ${l.status}`
        ).join('\n\n')}${data.length > 5 ? '\n\n...and more' : ''}`;

      case 'GET_ANALYTICS':
        const taskStats = data.tasks || [];
        const projectStats = data.projects || [];
        return `📊 Analytics:\n\nTasks:\n${taskStats.map(s => `• ${s._id}: ${s.count}`).join('\n')}\n\nProjects:\n${projectStats.map(s => `• ${s._id}: ${s.count}`).join('\n')}`;

      default:
        return `✅ Action completed: ${action}`;
    }
  }

  /**
   * Build system prompt with CRM context
   */
  buildSystemPrompt(userContext) {
    const { user, permissions, stats } = userContext;

    return `You are Tap, an intelligent AI assistant for Tapvera CRM.

Your personality:
- Professional, calm, and conversational
- Helpful and efficient
- Always confirm before important actions
- Context-aware and remembers conversation

Current user context:
- Name: ${user.name}
- Role: ${user.role}
- Email: ${user.email}

Available CRM actions you can perform:
1. CREATE_TASK - Create a new task
2. ASSIGN_TASK - Assign task to employee
3. UPDATE_TASK_STATUS - Update task status
4. GET_TASKS - Fetch tasks with filters
5. CREATE_PROJECT - Create new project
6. GET_PROJECTS - Fetch projects
7. GET_EMPLOYEES - List employees
8. CREATE_CLIENT - Add new client
9. GET_CLIENTS - List clients
10. GET_ATTENDANCE - Check attendance records
11. CREATE_LEAVE - Submit leave request
12. GET_ANALYTICS - Fetch analytics data

When you want to perform an action, format your response like this:

[ACTION: ACTION_NAME]
{
  "parameter1": "value1",
  "parameter2": "value2"
}
[/ACTION]

Always ask for confirmation before:
- Deleting anything
- Assigning tasks to others
- Changing critical data

Respond naturally and conversationally. Keep responses concise but complete.

If the user's request is unclear, ask clarifying questions.`;
  }

  /**
   * Extract action commands from AI response
   */
  extractActions(response) {
    const actions = [];
    const actionPattern = /\[ACTION:\s*(\w+)\]\s*({[\s\S]*?})\s*\[\/ACTION\]/gi;
    let match;

    while ((match = actionPattern.exec(response)) !== null) {
      try {
        const actionType = match[1];
        const parameters = JSON.parse(match[2]);
        actions.push({
          type: actionType,
          parameters: parameters
        });
      } catch (error) {
        console.error('Failed to parse action:', error);
      }
    }

    return actions;
  }

  /**
   * Get conversation history for user
   */
  getHistory(userId) {
    return this.conversationHistory.get(userId) || [];
  }

  /**
   * Add message to conversation history
   */
  addToHistory(userId, userMessage, aiResponse) {
    let history = this.conversationHistory.get(userId) || [];

    history.push(
      { role: 'user', content: userMessage },
      { role: 'assistant', content: aiResponse }
    );

    // Keep only last N messages
    if (history.length > this.maxHistoryLength * 2) {
      history = history.slice(-this.maxHistoryLength * 2);
    }

    this.conversationHistory.set(userId, history);
  }

  /**
   * Clear conversation history for user
   */
  clearHistory(userId) {
    this.conversationHistory.delete(userId);
  }

  /**
   * Execute CRM action based on action type
   */
  async executeAction(actionType, parameters, user) {
    try {
      switch (actionType) {
        case 'CREATE_TASK':
          return await this.createTask(parameters, user);

        case 'ASSIGN_TASK':
          return await this.assignTask(parameters, user);

        case 'UPDATE_TASK_STATUS':
          return await this.updateTaskStatus(parameters, user);

        case 'GET_TASKS':
          return await this.getTasks(parameters, user);

        case 'CREATE_PROJECT':
          return await this.createProject(parameters, user);

        case 'GET_PROJECTS':
          return await this.getProjects(parameters, user);

        case 'GET_EMPLOYEES':
          return await this.getEmployees(parameters, user);

        case 'CREATE_CLIENT':
          return await this.createClient(parameters, user);

        case 'GET_CLIENTS':
          return await this.getClients(parameters, user);

        case 'GET_ATTENDANCE':
          return await this.getAttendance(parameters, user);

        case 'CREATE_LEAVE':
          return await this.createLeave(parameters, user);

        case 'GET_LEAVES':
          return await this.getLeaves(parameters, user);

        case 'GET_ANALYTICS':
          return await this.getAnalytics(parameters, user);

        default:
          return { success: false, error: 'Unknown action type' };
      }
    } catch (error) {
      console.error(`Error executing action ${actionType}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Action implementations
  async createTask(params, user) {
    const Task = require('../models/Task');
    const User = require('../models/User');

    try {
      // Smart employee lookup if name is provided
      let assignedToId = params.assignedTo;

      if (params.assigneeName && !assignedToId) {
        // Try to find employee by name
        const nameParts = params.assigneeName.trim().split(/\s+/);
        const firstName = nameParts[0];
        const lastName = nameParts[1] || '';

        const query = {
          status: 'active',
          $or: [
            { name: new RegExp(params.assigneeName, 'i') },
            { name: new RegExp(firstName, 'i') },
            { email: new RegExp(params.assigneeName, 'i') }
          ]
        };

        const foundUser = await User.findOne(query);

        if (foundUser) {
          assignedToId = foundUser._id;
        } else {
          return {
            success: false,
            error: `Could not find employee "${params.assigneeName}". Please provide a valid employee name or ID.`
          };
        }
      }

      // Validate required fields
      if (!params.title) {
        return {
          success: false,
          error: 'Task title is required. Try: "Create a task to review proposal"'
        };
      }

      // Create task with smart defaults
      const task = await Task.create({
        title: params.title,
        description: params.description || `Task created by ${user.name}`,
        assignedTo: assignedToId || user._id, // Assign to self if no assignee
        assignedBy: user._id,
        priority: params.priority || 'normal',
        dueDate: params.dueDate,
        project: params.project,
        status: 'pending'
      });

      // Populate for response
      const populatedTask = await Task.findById(task._id)
        .populate('assignedTo', 'name email')
        .populate('assignedBy', 'name');

      return { success: true, data: populatedTask };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create task: ${error.message}`
      };
    }
  }

  async assignTask(params, user) {
    const Task = require('../models/Task');
    const task = await Task.findByIdAndUpdate(
      params.taskId,
      { assignedTo: params.employeeId },
      { new: true }
    );
    return { success: true, data: task };
  }

  async updateTaskStatus(params, user) {
    const Task = require('../models/Task');
    const task = await Task.findByIdAndUpdate(
      params.taskId,
      { status: params.status },
      { new: true }
    );
    return { success: true, data: task };
  }

  async getTasks(params, user) {
    const Task = require('../models/Task');
    const query = {};

    if (params.status) query.status = params.status;
    if (params.assignedTo) query.assignedTo = params.assignedTo;
    if (params.priority) query.priority = params.priority;

    // Role-based filtering
    if (user.role === 'employee') {
      query.assignedTo = user._id;
    }

    const tasks = await Task.find(query)
      .populate('assignedTo', 'name email')
      .populate('assignedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(params.limit || 20);

    return { success: true, data: tasks };
  }

  async createProject(params, user) {
    const Project = require('../models/Project');
    const Client = require('../models/Client');
    const User = require('../models/User');

    try {
      // Smart client lookup if name is provided
      let clientId = params.client;

      if (params.clientName && !clientId) {
        const foundClient = await Client.findOne({
          $or: [
            { clientName: new RegExp(params.clientName, 'i') },
            { businessName: new RegExp(params.clientName, 'i') }
          ]
        });

        if (foundClient) {
          clientId = foundClient._id;
        } else {
          return {
            success: false,
            error: `Could not find client "${params.clientName}". Create the client first or provide a valid client ID.`
          };
        }
      }

      // Smart employee lookup for assignedTo
      let assignedToIds = params.assignedTo || [];

      if (params.assigneeNames && Array.isArray(params.assigneeNames)) {
        for (const name of params.assigneeNames) {
          const foundUser = await User.findOne({
            status: 'active',
            $or: [
              { name: new RegExp(name, 'i') },
              { email: new RegExp(name, 'i') }
            ]
          });
          if (foundUser) {
            assignedToIds.push(foundUser._id);
          }
        }
      }

      // Validate required fields
      if (!params.projectName) {
        return {
          success: false,
          error: 'Project name is required. Try: "Create project Website Redesign for Acme Corp"'
        };
      }

      const project = await Project.create({
        projectName: params.projectName,
        type: params.type || 'General',
        assignedTo: assignedToIds,
        client: clientId,
        startDate: params.startDate || new Date(),
        endDate: params.endDate,
        description: params.description || `Project created by ${user.name}`,
        priority: params.priority || 'Medium',
        status: 'new',
        createdBy: user._id
      });

      // Populate for response
      const populatedProject = await Project.findById(project._id)
        .populate('client', 'clientName businessName')
        .populate('assignedTo', 'name email')
        .populate('createdBy', 'name');

      return { success: true, data: populatedProject };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create project: ${error.message}`
      };
    }
  }

  async getProjects(params, user) {
    const Project = require('../models/Project');
    const query = {};

    if (params.status) query.status = params.status;
    if (params.client) query.client = params.client;

    if (user.role === 'employee') {
      query.assignedTo = user._id;
    }

    const projects = await Project.find(query)
      .populate('assignedTo', 'name email')
      .populate('client', 'clientName businessName')
      .sort({ createdAt: -1 })
      .limit(params.limit || 20);

    return { success: true, data: projects };
  }

  async getEmployees(params, user) {
    const User = require('../models/User');
    const query = { status: 'active' };

    if (params.role) query.role = params.role;
    if (params.department) query.department = params.department;

    const employees = await User.find(query)
      .select('name email role designation department employeeId')
      .sort({ name: 1 });

    return { success: true, data: employees };
  }

  async createClient(params, user) {
    const Client = require('../models/Client');

    try {
      // Validate required fields
      const clientName = params.clientName || params.name;

      if (!clientName) {
        return {
          success: false,
          error: 'Client name is required. Try: "Create client Acme Corporation"'
        };
      }

      // Check if client already exists
      const existingClient = await Client.findOne({
        $or: [
          { clientName: new RegExp(`^${clientName}$`, 'i') },
          { email: params.email }
        ].filter(Boolean)
      });

      if (existingClient) {
        return {
          success: false,
          error: `Client "${clientName}" already exists!`
        };
      }

      // Generate email if not provided
      const email = params.email || `${clientName.toLowerCase().replace(/\s+/g, '.')}@client.temp`;

      const client = await Client.create({
        clientName: clientName,
        businessName: params.businessName || clientName,
        email: email,
        phone: params.phone,
        address: params.address,
        password: params.password || Math.random().toString(36).slice(-10),
        status: 'active'
      });

      return { success: true, data: client };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create client: ${error.message}`
      };
    }
  }

  async getClients(params, user) {
    const Client = require('../models/Client');
    const query = {};

    if (params.status) query.status = params.status;

    const clients = await Client.find(query)
      .select('clientName businessName email status createdAt')
      .sort({ createdAt: -1 })
      .limit(params.limit || 20);

    return { success: true, data: clients };
  }

  async getAttendance(params, user) {
    const AttendanceRecord = require('../models/AttendanceRecord');
    const query = {};

    // Date filter
    if (params.date) {
      query.date = new Date(params.date);
    }

    // Fetch attendance records
    const records = await AttendanceRecord.find(query)
      .populate('employees.userId', 'name email employeeId')
      .sort({ date: -1 })
      .limit(params.limit || 30);

    // Filter for specific user if needed
    let userRecords = [];
    const targetUserId = params.userId || (user.role === 'employee' ? user._id : null);

    if (targetUserId) {
      // Filter to show only specific user's attendance
      for (const record of records) {
        const userAttendance = record.employees.find(
          emp => emp.userId && emp.userId._id.toString() === targetUserId.toString()
        );
        if (userAttendance) {
          userRecords.push({
            date: record.date,
            status: userAttendance.calculated.status,
            workDurationSeconds: userAttendance.calculated.totalWorkSeconds,
            arrivalTime: userAttendance.calculated.arrivalTime,
            departureTime: userAttendance.calculated.departureTime,
            user: userAttendance.userId
          });
        }
      }
      return { success: true, data: userRecords };
    } else {
      // Admin viewing all - return summary
      const summaryRecords = records.map(record => ({
        date: record.date,
        totalEmployees: record.dailyStats.totalEmployees,
        present: record.dailyStats.present,
        absent: record.dailyStats.absent,
        late: record.dailyStats.late
      }));
      return { success: true, data: summaryRecords };
    }
  }

  async createLeave(params, user) {
    const Leave = require('../models/Leave');
    const leave = await Leave.create({
      employeeId: user._id,
      leaveType: params.type,
      startDate: params.startDate,
      endDate: params.endDate,
      reason: params.reason,
      status: 'pending'
    });
    return { success: true, data: leave };
  }

  async getLeaves(params, user) {
    const Leave = require('../models/Leave');
    const query = {};

    // Role-based filtering
    if (user.role === 'employee') {
      query.employeeId = user._id;
    }

    if (params.status) query.status = params.status;

    const leaves = await Leave.find(query)
      .populate('employeeId', 'name email')
      .sort({ createdAt: -1 })
      .limit(params.limit || 20);

    return { success: true, data: leaves };
  }

  async getAnalytics(params, user) {
    // Basic analytics implementation
    const Task = require('../models/Task');
    const Project = require('../models/Project');

    const [taskStats, projectStats] = await Promise.all([
      Task.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Project.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ])
    ]);

    return {
      success: true,
      data: {
        tasks: taskStats,
        projects: projectStats
      }
    };
  }
}

// Export singleton instance
module.exports = new TapAIService();
