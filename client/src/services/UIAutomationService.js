// UIAutomationService.js
// Service for programmatically controlling the UI

class UIAutomationService {
  constructor() {
    this.navigate = null; // Will be set from React Router's useNavigate
    this.currentWorkflow = null;
    this.isExecuting = false;
  }

  /**
   * Set the navigation function from React Router
   */
  setNavigate(navigateFn) {
    this.navigate = navigateFn;
  }

  /**
   * Navigate to a specific route
   */
  async navigateToPage(path) {
    if (!this.navigate) {
      throw new Error('Navigation not initialized');
    }

    return new Promise((resolve) => {
      this.navigate(path);
      // Wait for navigation to complete
      setTimeout(() => {
        resolve({ success: true, action: 'navigate', path });
      }, 500);
    });
  }

  /**
   * Fill a form field by selector or name
   */
  async fillFormField(selector, value) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        let input;

        // Try different selector strategies
        if (selector.startsWith('#') || selector.startsWith('.') || selector.startsWith('[')) {
          input = document.querySelector(selector);
        } else {
          // Try by name, id, or placeholder
          input = document.querySelector(`[name="${selector}"]`) ||
                  document.querySelector(`#${selector}`) ||
                  document.querySelector(`[placeholder*="${selector}"]`);
        }

        if (!input) {
          reject(new Error(`Field not found: ${selector}`));
          return;
        }

        // Handle different input types
        if (input.tagName === 'SELECT') {
          // Select dropdown
          const option = Array.from(input.options).find(
            opt => opt.value === value || opt.text.toLowerCase().includes(value.toLowerCase())
          );
          if (option) {
            input.value = option.value;
          } else {
            input.value = value;
          }
        } else if (input.type === 'checkbox' || input.type === 'radio') {
          input.checked = value === true || value === 'true' || value === 'on';
        } else if (input.type === 'date') {
          input.value = value;
        } else {
          // Text input, textarea, etc.
          input.value = value;
        }

        // Trigger React's onChange event
        const event = new Event('input', { bubbles: true });
        input.dispatchEvent(event);

        // Also trigger change event
        const changeEvent = new Event('change', { bubbles: true });
        input.dispatchEvent(changeEvent);

        resolve({ success: true, action: 'fill', selector, value });
      }, 100);
    });
  }

  /**
   * Click a button or element
   */
  async clickElement(selector) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        let element;

        // Try standard CSS selector first
        if (selector.startsWith('#') || selector.startsWith('.') || selector.startsWith('[')) {
          element = document.querySelector(selector);
        } else {
          // Check if it's a comma-separated list of selectors
          if (selector.includes(',')) {
            // Try each selector in the comma-separated list
            const selectors = selector.split(',').map(s => s.trim());
            for (const sel of selectors) {
              // Skip pseudo-selectors like :has-text() which aren't valid CSS
              if (sel.includes(':has-text(')) continue;

              try {
                element = document.querySelector(sel);
                if (element) break;
              } catch (e) {
                // Invalid selector, continue to next
                continue;
              }
            }
          }

          // If still not found, try to find button by text content
          if (!element) {
            const buttons = Array.from(document.querySelectorAll('button'));
            element = buttons.find(btn =>
              btn.textContent.toLowerCase().includes(selector.toLowerCase())
            );
          }
        }

        if (!element) {
          reject(new Error(`Element not found: ${selector}`));
          return;
        }

        element.click();
        resolve({ success: true, action: 'click', selector });
      }, 100);
    });
  }

  /**
   * Wait for element to appear
   */
  async waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const checkElement = () => {
        const element = document.querySelector(selector);

        if (element) {
          resolve({ success: true, action: 'wait', selector });
        } else if (Date.now() - startTime > timeout) {
          reject(new Error(`Element not found after ${timeout}ms: ${selector}`));
        } else {
          setTimeout(checkElement, 100);
        }
      };

      checkElement();
    });
  }

  /**
   * Wait for a specific duration
   */
  async wait(ms) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true, action: 'wait', duration: ms });
      }, ms);
    });
  }

  /**
   * Get text content from element
   */
  async getElementText(selector) {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);

      if (!element) {
        reject(new Error(`Element not found: ${selector}`));
        return;
      }

      resolve({
        success: true,
        action: 'getText',
        selector,
        text: element.textContent.trim()
      });
    });
  }

  /**
   * Check if element exists
   */
  elementExists(selector) {
    return !!document.querySelector(selector);
  }

  /**
   * Find employee by name (helper for task assignment)
   */
  async findEmployeeByName(name) {
    const API = (await import('../api')).default;
    try {
      const response = await API.get('/api/users');
      const users = response.data;

      const found = users.find(user =>
        user.name.toLowerCase().includes(name.toLowerCase())
      );

      if (found) {
        return { success: true, employee: found };
      } else {
        return { success: false, error: `Employee "${name}" not found` };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Find client by name
   */
  async findClientByName(name) {
    const API = (await import('../api')).default;
    try {
      const response = await API.get('/api/clients');
      const clients = response.data.clients || response.data;

      const found = clients.find(client =>
        client.clientName.toLowerCase().includes(name.toLowerCase()) ||
        client.businessName.toLowerCase().includes(name.toLowerCase())
      );

      if (found) {
        return { success: true, client: found };
      } else {
        return { success: false, error: `Client "${name}" not found` };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute a complete workflow
   */
  async executeWorkflow(workflow, onProgress) {
    this.isExecuting = true;
    this.currentWorkflow = workflow;
    const results = [];

    try {
      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];

        // Notify progress
        if (onProgress) {
          onProgress({
            currentStep: i + 1,
            totalSteps: workflow.steps.length,
            stepDescription: step.description,
            action: step.action
          });
        }

        // Execute step
        let result;
        switch (step.action) {
          case 'navigate':
            result = await this.navigateToPage(step.path);
            break;

          case 'fill':
            result = await this.fillFormField(step.selector, step.value);
            break;

          case 'click':
            result = await this.clickElement(step.selector);
            break;

          case 'wait':
            result = await this.wait(step.duration);
            break;

          case 'waitForElement':
            result = await this.waitForElement(step.selector, step.timeout);
            break;

          case 'findEmployee':
            result = await this.findEmployeeByName(step.name);
            if (result.success && step.saveAs) {
              workflow.context = workflow.context || {};
              workflow.context[step.saveAs] = result.employee;
            }
            break;

          case 'findClient':
            result = await this.findClientByName(step.name);
            if (result.success && step.saveAs) {
              workflow.context = workflow.context || {};
              workflow.context[step.saveAs] = result.client;
            }
            break;

          case 'custom':
            // Execute custom function
            if (step.execute && typeof step.execute === 'function') {
              result = await step.execute(workflow.context);
            }
            break;

          default:
            throw new Error(`Unknown action: ${step.action}`);
        }

        results.push({
          step: i + 1,
          description: step.description,
          result
        });

        // Stop if step failed and workflow is not set to continue on error
        if (!result.success && !workflow.continueOnError) {
          throw new Error(`Step ${i + 1} failed: ${result.error}`);
        }
      }

      this.isExecuting = false;
      this.currentWorkflow = null;

      return {
        success: true,
        workflow: workflow.name,
        results
      };

    } catch (error) {
      this.isExecuting = false;
      this.currentWorkflow = null;

      return {
        success: false,
        workflow: workflow.name,
        error: error.message,
        results
      };
    }
  }

  /**
   * Stop current workflow execution
   */
  stopWorkflow() {
    this.isExecuting = false;
    this.currentWorkflow = null;
  }
}

// Export singleton
export default new UIAutomationService();
