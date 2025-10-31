// AgentController.js
// The brain of the autonomous agent - parses commands and creates workflows

import UIAutomationService from './UIAutomationService';
import enhancedNLP from '../utils/enhancedNLP';

class AgentController {
  constructor() {
    this.intentPatterns = this.buildIntentPatterns();
    this.workflows = this.buildWorkflows();
    this.nlp = enhancedNLP;
  }

  /**
   * Build intent recognition patterns
   */
  buildIntentPatterns() {
    return [
      // Navigation commands
      { pattern: /(?:open|go to|navigate to|show me)\s+(?:the\s+)?dashboard/i, intent: 'NAVIGATE_DASHBOARD' },
      { pattern: /(?:open|go to|navigate to|show me)\s+(?:the\s+)?tasks?\s+page/i, intent: 'NAVIGATE_TASKS' },
      { pattern: /(?:open|go to|navigate to|show me)\s+(?:the\s+)?projects?\s+page/i, intent: 'NAVIGATE_PROJECTS' },
      { pattern: /(?:open|go to|navigate to|show me)\s+(?:the\s+)?leaves?\s+page/i, intent: 'NAVIGATE_LEAVES' },
      { pattern: /(?:open|go to|navigate to|show me)\s+(?:the\s+)?clients?\s+page/i, intent: 'NAVIGATE_CLIENTS' },
      { pattern: /(?:open|go to|navigate to|show me)\s+(?:the\s+)?admin\s+tasks?/i, intent: 'NAVIGATE_ADMIN_TASKS' },
      { pattern: /(?:open|go to|navigate to|show me)\s+(?:the\s+)?(?:leave\s+)?approvals?/i, intent: 'NAVIGATE_LEAVE_APPROVALS' },
      { pattern: /(?:open|go to|navigate to|show me)\s+(?:the\s+)?attendance/i, intent: 'NAVIGATE_ATTENDANCE' },
      { pattern: /(?:open|go to|navigate to|show me)\s+(?:my\s+)?profile/i, intent: 'NAVIGATE_PROFILE' },
      { pattern: /(?:open|go to|navigate to|show me)\s+(?:the\s+)?directory/i, intent: 'NAVIGATE_DIRECTORY' },

      // Task creation patterns
      {
        pattern: /create\s+(?:a\s+)?task\s+for\s+(\w+(?:\s+\w+)?)\s+to\s+(.+?)(?:\s+(?:by|due|before)\s+(.+?))?(?:\s+with\s+(\w+)\s+priority)?$/i,
        intent: 'CREATE_TASK',
        extractParams: (match) => ({
          assigneeName: match[1],
          title: match[2],
          dueDate: match[3] ? this.parseDate(match[3]) : null,
          priority: match[4] ? match[4].toLowerCase() : 'medium'
        })
      },
      {
        pattern: /create\s+(?:a\s+)?(\w+)\s+priority\s+task\s+(.+?)\s+for\s+(\w+(?:\s+\w+)?)/i,
        intent: 'CREATE_TASK',
        extractParams: (match) => ({
          priority: match[1].toLowerCase(),
          title: match[2],
          assigneeName: match[3]
        })
      },
      {
        pattern: /create\s+(?:a\s+)?(?:new\s+)?task\s+(?:for\s+)?(\w+(?:\s+\w+)?)/i,
        intent: 'CREATE_TASK',
        extractParams: (match) => ({
          assigneeName: match[1],
          title: `Task for ${match[1]}`,
          priority: 'medium'
        })
      },
      { pattern: /create\s+(?:a\s+)?(?:new\s+)?task/i, intent: 'CREATE_TASK' },

      // Leave approval patterns
      {
        pattern: /approve\s+(?:the\s+)?(?:leave\s+)?request\s+(?:for\s+)?(\w+(?:\s+\w+)?)/i,
        intent: 'APPROVE_LEAVE',
        extractParams: (match) => ({
          employeeName: match[1]
        })
      },
      {
        pattern: /approve\s+(?:the\s+)?(?:first|next|pending)\s+leave\s+request/i,
        intent: 'APPROVE_FIRST_LEAVE'
      },
      { pattern: /approve\s+(?:all\s+)?pending\s+leaves?/i, intent: 'APPROVE_ALL_LEAVES' },

      // Leave rejection patterns
      {
        pattern: /reject\s+(?:the\s+)?(?:leave\s+)?request\s+(?:for\s+)?(\w+(?:\s+\w+)?)/i,
        intent: 'REJECT_LEAVE',
        extractParams: (match) => ({
          employeeName: match[1]
        })
      },

      // Project creation patterns
      {
        pattern: /create\s+(?:a\s+)?project\s+(?:called|named)?\s*(.+?)\s+for\s+(?:client\s+)?(.+)/i,
        intent: 'CREATE_PROJECT',
        extractParams: (match) => ({
          projectName: match[1],
          clientName: match[2]
        })
      },
      { pattern: /create\s+(?:a\s+)?(?:new\s+)?project/i, intent: 'CREATE_PROJECT' },

      // Client creation patterns
      {
        pattern: /(?:create|add)\s+(?:a\s+)?(?:new\s+)?client\s+(?:called|named)?\s*(.+)/i,
        intent: 'CREATE_CLIENT',
        extractParams: (match) => ({
          clientName: match[1]
        })
      },

      // Mark attendance
      { pattern: /mark\s+(?:my\s+)?attendance|check\s+in|clock\s+in/i, intent: 'MARK_ATTENDANCE' },

      // View/List commands
      { pattern: /(?:show|list|view)\s+(?:all\s+)?(?:my\s+)?tasks?/i, intent: 'VIEW_TASKS' },
      { pattern: /(?:show|list|view)\s+(?:all\s+)?projects?/i, intent: 'VIEW_PROJECTS' },
      { pattern: /(?:show|list|view)\s+(?:all\s+)?clients?/i, intent: 'VIEW_CLIENTS' },
      { pattern: /(?:show|list|view)\s+pending\s+leaves?/i, intent: 'VIEW_PENDING_LEAVES' },
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
   * Parse user command into intent and parameters with enhanced NLP
   */
  parseCommand(command) {
    console.log(`🧠 Enhanced NLP parsing command: "${command}"`);

    // First, try exact regex patterns for structured commands
    for (const pattern of this.intentPatterns) {
      const match = command.match(pattern.pattern);
      if (match) {
        let parameters = {};

        if (pattern.extractParams && typeof pattern.extractParams === 'function') {
          parameters = pattern.extractParams(match);
        }

        console.log(`✅ Matched via regex: ${pattern.intent}`);
        return {
          intent: pattern.intent,
          parameters,
          originalCommand: command,
          confidence: 1.0,
          method: 'regex'
        };
      }
    }

    // If no regex match, use enhanced NLP with fuzzy matching
    console.log(`🔍 Trying fuzzy NLP matching...`);
    const entities = this.nlp.extractEntities(command);

    console.log('Extracted entities:', entities);

    // Try to map entities to intent
    if (entities.intent && entities.page) {
      const intent = this.mapEntitiesToIntent(entities, command);

      if (intent) {
        const parameters = this.extractParametersNLP(command, entities);

        const avgConfidence = (
          (entities.intent.confidence || 0) +
          (entities.page.confidence || 0)
        ) / 2;

        console.log(`✅ Matched via NLP: ${intent} (confidence: ${(avgConfidence * 100).toFixed(1)}%)`);

        return {
          intent,
          parameters,
          originalCommand: command,
          confidence: avgConfidence,
          method: 'nlp',
          entities
        };
      }
    }

    // Try page-only navigation
    if (entities.page) {
      const intent = this.mapPageToNavigationIntent(entities.page.page);
      if (intent) {
        console.log(`✅ Matched via page navigation: ${intent}`);
        return {
          intent,
          parameters: {},
          originalCommand: command,
          confidence: entities.page.confidence,
          method: 'page-only'
        };
      }
    }

    console.log(`❌ No match found for command`);
    return null;
  }

  /**
   * Map entities to intent
   */
  mapEntitiesToIntent(entities, command) {
    const intent = entities.intent?.intent;
    const page = entities.page?.page;

    // Navigation intents
    if (intent === 'navigate' || intent === 'view') {
      const navMapping = {
        'dashboard': 'NAVIGATE_DASHBOARD',
        'tasks': 'NAVIGATE_TASKS',
        'projects': 'NAVIGATE_PROJECTS',
        'leaves': 'NAVIGATE_LEAVES',
        'clients': 'NAVIGATE_CLIENTS',
        'employees': 'NAVIGATE_DIRECTORY',
        'attendance': 'NAVIGATE_ATTENDANCE',
      };
      return navMapping[page] || null;
    }

    // Creation intents
    if (intent === 'create') {
      const createMapping = {
        'tasks': 'CREATE_TASK',
        'projects': 'CREATE_PROJECT',
        'clients': 'CREATE_CLIENT',
      };
      return createMapping[page] || null;
    }

    // Approval/Rejection intents
    if (intent === 'approve') {
      if (page === 'leaves' || command.toLowerCase().includes('leave')) {
        return 'APPROVE_LEAVE';
      }
    }

    if (intent === 'reject') {
      if (page === 'leaves' || command.toLowerCase().includes('leave')) {
        return 'REJECT_LEAVE';
      }
    }

    // Filter intents
    if (intent === 'filter' || intent === 'view') {
      const viewMapping = {
        'tasks': 'VIEW_TASKS',
        'projects': 'VIEW_PROJECTS',
        'clients': 'VIEW_CLIENTS',
        'leaves': 'VIEW_PENDING_LEAVES',
      };
      return viewMapping[page] || null;
    }

    return null;
  }

  /**
   * Map page to navigation intent
   */
  mapPageToNavigationIntent(page) {
    const mapping = {
      'dashboard': 'NAVIGATE_DASHBOARD',
      'tasks': 'NAVIGATE_TASKS',
      'projects': 'NAVIGATE_PROJECTS',
      'leaves': 'NAVIGATE_LEAVES',
      'clients': 'NAVIGATE_CLIENTS',
      'employees': 'NAVIGATE_DIRECTORY',
      'attendance': 'NAVIGATE_ATTENDANCE',
    };
    return mapping[page] || null;
  }

  /**
   * Extract parameters using enhanced NLP
   */
  extractParametersNLP(command, entities) {
    const params = {};

    // Extract priority
    if (entities.priority) {
      params.priority = entities.priority.value;
    }

    // Extract status
    if (entities.status) {
      params.status = entities.status.value;
    }

    // Extract employee name
    const employeeName = this.nlp.extractEmployeeName(command);
    if (employeeName) {
      params.assigneeName = employeeName;
      params.employeeName = employeeName;
    }

    // Extract task title
    if (entities.page?.page === 'tasks') {
      const taskTitle = this.nlp.extractTaskTitle(command);
      if (taskTitle) {
        params.title = taskTitle;
      }
    }

    // Extract dates
    const dateMatch = command.match(/(?:by|due|before)\s+(.+?)(?:\s+with|\s+for|\s+$|$)/i);
    if (dateMatch) {
      params.dueDate = this.parseDate(dateMatch[1]);
    }

    return params;
  }

  /**
   * Build workflow definitions
   */
  buildWorkflows() {
    return {
      // Navigation workflows
      NAVIGATE_DASHBOARD: {
        name: 'Navigate to Dashboard',
        steps: [
          { action: 'navigate', path: '/dashboard', description: 'Opening dashboard' }
        ]
      },

      NAVIGATE_TASKS: {
        name: 'Navigate to Tasks',
        steps: [
          { action: 'navigate', path: '/tasks', description: 'Opening tasks page' }
        ]
      },

      NAVIGATE_PROJECTS: {
        name: 'Navigate to Projects',
        steps: [
          { action: 'navigate', path: '/projects', description: 'Opening projects page' }
        ]
      },

      NAVIGATE_LEAVES: {
        name: 'Navigate to Leaves',
        steps: [
          { action: 'navigate', path: '/leaves', description: 'Opening leaves page' }
        ]
      },

      NAVIGATE_CLIENTS: {
        name: 'Navigate to Clients',
        steps: [
          { action: 'navigate', path: '/clients', description: 'Opening clients page' }
        ]
      },

      NAVIGATE_ADMIN_TASKS: {
        name: 'Navigate to Admin Tasks',
        steps: [
          { action: 'navigate', path: '/admin/tasks', description: 'Opening admin tasks page' }
        ]
      },

      NAVIGATE_LEAVE_APPROVALS: {
        name: 'Navigate to Leave Approvals',
        steps: [
          { action: 'navigate', path: '/admin/leaves', description: 'Opening leave approvals page' }
        ]
      },

      NAVIGATE_ATTENDANCE: {
        name: 'Navigate to Attendance',
        steps: [
          { action: 'navigate', path: '/attendance', description: 'Opening attendance page' }
        ]
      },

      NAVIGATE_PROFILE: {
        name: 'Navigate to Profile',
        steps: [
          { action: 'navigate', path: '/profile', description: 'Opening your profile' }
        ]
      },

      NAVIGATE_DIRECTORY: {
        name: 'Navigate to Directory',
        steps: [
          { action: 'navigate', path: '/directory', description: 'Opening employee directory' }
        ]
      },

      // Task creation workflow
      CREATE_TASK: {
        name: 'Create New Task',
        steps: [
          { action: 'navigate', path: '/admin/tasks', description: 'Navigating to admin tasks page' },
          { action: 'wait', duration: 1000, description: 'Waiting for page to load' },
          // Form is already visible on the page, no button click needed
          // Form will be filled dynamically based on parameters
        ],
        continueOnError: false
      },

      // Leave approval workflow
      APPROVE_FIRST_LEAVE: {
        name: 'Approve First Pending Leave',
        steps: [
          { action: 'navigate', path: '/admin/leaves', description: 'Navigating to leave approvals' },
          { action: 'wait', duration: 1000, description: 'Waiting for leave requests to load' },
          { action: 'click', selector: '[class*="approve"]:first, button:has-text("Approve"):first', description: 'Clicking first Approve button' },
          { action: 'wait', duration: 500, description: 'Processing approval' },
        ],
        continueOnError: false
      },

      // Project creation workflow
      CREATE_PROJECT: {
        name: 'Create New Project',
        steps: [
          { action: 'navigate', path: '/projects', description: 'Navigating to projects page' },
          { action: 'wait', duration: 800, description: 'Waiting for page to load' },
          { action: 'click', selector: 'button:has-text("Add Project"), [class*="add"]', description: 'Clicking Add Project button' },
          { action: 'wait', duration: 500, description: 'Waiting for form to appear' },
        ],
        continueOnError: false
      },

      // Client creation workflow
      CREATE_CLIENT: {
        name: 'Create New Client',
        steps: [
          { action: 'navigate', path: '/clients', description: 'Navigating to clients page' },
          { action: 'wait', duration: 800, description: 'Waiting for page to load' },
          { action: 'click', selector: 'button:has-text("Add Client"), [class*="add"]', description: 'Clicking Add Client button' },
          { action: 'wait', duration: 500, description: 'Waiting for form to appear' },
        ],
        continueOnError: false
      },

      // View workflows (just navigation)
      VIEW_TASKS: {
        name: 'View Tasks',
        steps: [
          { action: 'navigate', path: '/tasks', description: 'Opening tasks page' }
        ]
      },

      VIEW_PROJECTS: {
        name: 'View Projects',
        steps: [
          { action: 'navigate', path: '/projects', description: 'Opening projects page' }
        ]
      },

      VIEW_CLIENTS: {
        name: 'View Clients',
        steps: [
          { action: 'navigate', path: '/clients', description: 'Opening clients page' }
        ]
      },

      VIEW_PENDING_LEAVES: {
        name: 'View Pending Leaves',
        steps: [
          { action: 'navigate', path: '/admin/leaves', description: 'Opening leave approvals page' }
        ]
      },
    };
  }

  /**
   * Execute a command
   */
  async executeCommand(command, onProgress) {
    const parsed = this.parseCommand(command);

    if (!parsed) {
      return {
        success: false,
        error: 'I don\'t understand that command. Try: "Open tasks page" or "Create a task for John"'
      };
    }

    const workflow = this.workflows[parsed.intent];

    if (!workflow) {
      return {
        success: false,
        error: `No workflow defined for intent: ${parsed.intent}`
      };
    }

    // Clone workflow to avoid modifying the original
    const workflowInstance = JSON.parse(JSON.stringify(workflow));
    workflowInstance.context = { parameters: parsed.parameters };

    // Add dynamic steps based on parameters
    if (parsed.intent === 'CREATE_TASK' && parsed.parameters) {
      // Add steps to fill task form
      if (parsed.parameters.title) {
        workflowInstance.steps.push({
          action: 'custom',
          description: `Entering task title: "${parsed.parameters.title}"`,
          execute: async (context) => {
            try {
              // Find the title input - look for text input with placeholder about task title
              const titleInput = document.querySelector('[placeholder="Enter task title"]') ||
                                document.querySelector('input[type="text"]');

              if (!titleInput) {
                return { success: false, error: 'Task title input field not found' };
              }

              titleInput.value = context.parameters.title;
              titleInput.dispatchEvent(new Event('input', { bubbles: true }));
              titleInput.dispatchEvent(new Event('change', { bubbles: true }));

              console.log(`Title set to: ${context.parameters.title}`);
              return { success: true };
            } catch (error) {
              return { success: false, error: error.message };
            }
          }
        });
      }

      if (parsed.parameters.assigneeName) {
        // First find the employee to get their ID
        workflowInstance.steps.push({
          action: 'findEmployee',
          name: parsed.parameters.assigneeName,
          saveAs: 'assignee',
          description: `Finding employee: ${parsed.parameters.assigneeName}`
        });

        // Then use custom action to handle the custom dropdown
        const customStep = {
          action: 'custom',
          description: `Assigning task to ${parsed.parameters.assigneeName}`,
          execute: async (context) => {
            if (!context.assignee) {
              return { success: false, error: 'Employee not found in system' };
            }

            // Helper function to wait for element
            const waitForElement = (selector, timeout = 2000) => {
              return new Promise((resolve, reject) => {
                const startTime = Date.now();
                const checkInterval = setInterval(() => {
                  const element = document.querySelector(selector);
                  if (element) {
                    clearInterval(checkInterval);
                    resolve(element);
                  } else if (Date.now() - startTime > timeout) {
                    clearInterval(checkInterval);
                    reject(new Error(`Timeout waiting for ${selector}`));
                  }
                }, 100);
              });
            };

            try {
              // Find the dropdown trigger - it's a div with the commonInputClasses that contains "Select users"
              const dropdowns = Array.from(document.querySelectorAll('div'));
              const dropdown = dropdowns.find(div => {
                const text = div.textContent.trim();
                return (text === 'Select users...' || text.includes('user(s) selected')) &&
                       div.className.includes('cursor-pointer');
              });

              if (!dropdown) {
                return { success: false, error: 'User selection dropdown not found on page' };
              }

              // Click to open dropdown
              dropdown.click();
              console.log('Dropdown clicked, waiting for options...');

              // Wait for the dropdown menu to appear
              await new Promise(resolve => setTimeout(resolve, 500));

              // Find the search input in the dropdown and type the user's name
              const searchInput = document.querySelector('input[placeholder="Search users..."]');
              if (searchInput) {
                searchInput.value = context.assignee.name;
                searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                searchInput.dispatchEvent(new Event('change', { bubbles: true }));

                // Wait for filter to apply
                await new Promise(resolve => setTimeout(resolve, 300));
              }

              // Find all labels in the dropdown
              const labels = Array.from(document.querySelectorAll('label'));
              console.log(`Found ${labels.length} labels total`);

              // Find the label containing the user's name
              const userLabel = labels.find(label => {
                const labelText = label.textContent.trim().toLowerCase();
                const userName = context.assignee.name.toLowerCase();
                // Check for exact match or if the label contains the name
                return labelText === userName || labelText.includes(userName);
              });

              if (!userLabel) {
                // Log all available labels for debugging
                const availableLabels = labels.map(l => l.textContent.trim()).filter(t => t.length > 0);
                console.log('Available labels:', availableLabels);
                return {
                  success: false,
                  error: `User "${context.assignee.name}" not found in dropdown. Available users: ${availableLabels.join(', ')}`
                };
              }

              // Find the checkbox within this label
              const checkbox = userLabel.querySelector('input[type="checkbox"]');

              if (!checkbox) {
                return { success: false, error: `Checkbox not found for ${context.assignee.name}` };
              }

              // Click the checkbox if it's not already checked
              if (!checkbox.checked) {
                checkbox.click();
                console.log(`Checkbox clicked for ${context.assignee.name}`);
              }

              // Wait for the selection to register
              await new Promise(resolve => setTimeout(resolve, 300));

              // Close dropdown by clicking outside
              document.body.click();

              return { success: true };
            } catch (error) {
              return { success: false, error: error.message };
            }
          }
        };

        workflowInstance.steps.push(customStep);
      }

      if (parsed.parameters.dueDate) {
        workflowInstance.steps.push({
          action: 'custom',
          description: `Setting due date: ${parsed.parameters.dueDate}`,
          execute: async (context) => {
            try {
              // Find the date picker input
              const dateInput = document.querySelector('.react-datepicker__input-container input') ||
                               document.querySelector('[placeholder="Select due date"]') ||
                               document.querySelector('input[type="text"][placeholder*="date" i]');

              if (!dateInput) {
                return { success: false, error: 'Due date input field not found' };
              }

              const dueDate = context.parameters.dueDate;
              dateInput.value = dueDate;
              dateInput.dispatchEvent(new Event('input', { bubbles: true }));
              dateInput.dispatchEvent(new Event('change', { bubbles: true }));

              // Also try triggering focus/blur for React DatePicker
              dateInput.dispatchEvent(new Event('focus', { bubbles: true }));
              dateInput.dispatchEvent(new Event('blur', { bubbles: true }));

              console.log(`Due date set to: ${dueDate}`);
              return { success: true };
            } catch (error) {
              return { success: false, error: error.message };
            }
          }
        });
      }

      if (parsed.parameters.priority) {
        workflowInstance.steps.push({
          action: 'custom',
          description: `Setting priority: ${parsed.parameters.priority}`,
          execute: async (context) => {
            try {
              // Find the priority select by looking for one with priority options
              const selects = Array.from(document.querySelectorAll('select'));
              const prioritySelect = selects.find(select => {
                const options = Array.from(select.options).map(o => o.text.toLowerCase());
                return options.includes('low') && options.includes('medium') && options.includes('high');
              });

              if (!prioritySelect) {
                return { success: false, error: 'Priority dropdown not found' };
              }

              // Find the option that matches the priority value
              const priority = context.parameters.priority;
              const priorityCapitalized = priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase();

              const option = Array.from(prioritySelect.options).find(
                opt => opt.value.toLowerCase() === priority.toLowerCase() ||
                       opt.text.toLowerCase() === priority.toLowerCase()
              );

              if (option) {
                prioritySelect.value = option.value;
              } else {
                // Try setting directly with capitalized value
                prioritySelect.value = priorityCapitalized;
              }

              // Trigger change events
              prioritySelect.dispatchEvent(new Event('input', { bubbles: true }));
              prioritySelect.dispatchEvent(new Event('change', { bubbles: true }));

              console.log(`Priority set to: ${prioritySelect.value}`);
              return { success: true };
            } catch (error) {
              return { success: false, error: error.message };
            }
          }
        });
      }

      // Add submit step
      workflowInstance.steps.push({
        action: 'custom',
        description: 'Submitting task form',
        execute: async (context) => {
          try {
            // Wait a bit before submitting to ensure all fields are set
            await new Promise(resolve => setTimeout(resolve, 300));

            // Find the submit button
            const submitButton = document.querySelector('button[type="submit"]') ||
                                Array.from(document.querySelectorAll('button')).find(btn =>
                                  btn.textContent.toLowerCase().includes('create task')
                                );

            if (!submitButton) {
              return { success: false, error: 'Submit button not found' };
            }

            // Click the button
            submitButton.click();
            console.log('Task form submitted');

            // Wait for submission to process
            await new Promise(resolve => setTimeout(resolve, 500));

            return { success: true };
          } catch (error) {
            return { success: false, error: error.message };
          }
        }
      });
    }

    // Execute the workflow
    return await UIAutomationService.executeWorkflow(workflowInstance, onProgress);
  }

  /**
   * Get suggested commands based on user role
   */
  getSuggestions(userRole) {
    const common = [
      'Open dashboard',
      'Show my tasks',
      'Open attendance',
      'Go to profile'
    ];

    const admin = [
      'Create a task for John to review proposal',
      'Approve first leave request',
      'Open admin tasks',
      'Show all projects',
      'Create a project for Acme Corp'
    ];

    const employee = [
      'Show my tasks',
      'Mark my attendance',
      'Open leaves page',
      'View my profile'
    ];

    if (userRole === 'admin' || userRole === 'super-admin') {
      return [...common, ...admin];
    } else if (userRole === 'hr') {
      return [...common, 'Approve leave request', 'Show pending leaves'];
    } else {
      return [...common, ...employee];
    }
  }
}

// Export singleton
export default new AgentController();
