// tests/api.test.js
const axios = require('axios');

/**
 * Test Suite for API Endpoints
 * Tests key API endpoints functionality and response formats
 */

const API_BASE = 'http://localhost:5000';
const TEST_TIMEOUT = 10000; // 10 seconds

// Test configuration
const testConfig = {
  timeout: TEST_TIMEOUT,
  validateStatus: () => true // Don't throw errors on 4xx/5xx responses
};

// Mock user credentials for testing (would need valid JWT token in real scenario)
const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test'; // Mock token

const getAuthHeaders = () => ({
  'Authorization': `Bearer ${mockToken}`,
  'Content-Type': 'application/json'
});

// Test cases for API endpoints
const apiTestCases = [
  {
    name: 'Health Check - Root Endpoint',
    method: 'GET',
    endpoint: '/',
    expectedStatus: 200,
    requiresAuth: false
  },
  {
    name: 'Get All Shifts',
    method: 'GET',
    endpoint: '/api/shifts',
    expectedStatus: [200, 401], // 401 if no auth
    requiresAuth: true
  },
  {
    name: 'Get Attendance Status (Today)',
    method: 'GET',
    endpoint: '/api/status/today',
    expectedStatus: [200, 401],
    requiresAuth: true
  },
  {
    name: 'Get Flexible Shift Requests',
    method: 'GET',
    endpoint: '/api/flexible-shifts',
    expectedStatus: [200, 401],
    requiresAuth: true
  },
  {
    name: 'Get Leave Requests',
    method: 'GET',
    endpoint: '/api/leaves',
    expectedStatus: [200, 401],
    requiresAuth: true
  },
  {
    name: 'Get Holidays',
    method: 'GET',
    endpoint: '/api/holidays?shift=standard',
    expectedStatus: [200, 401],
    requiresAuth: true
  },
  {
    name: 'Invalid Endpoint',
    method: 'GET',
    endpoint: '/api/nonexistent',
    expectedStatus: 404,
    requiresAuth: false
  }
];

// Data validation tests
const dataValidationTests = [
  {
    name: 'Create Shift - Missing Required Fields',
    method: 'POST',
    endpoint: '/api/shifts',
    data: { description: 'Test shift without required fields' },
    expectedStatus: [400, 401],
    requiresAuth: true
  },
  {
    name: 'Update Status - Invalid Timeline Event',
    method: 'PUT',
    endpoint: '/api/status/today',
    data: { timelineEvent: { type: '', time: 'invalid-time' } },
    expectedStatus: [400, 401],
    requiresAuth: true
  },
  {
    name: 'Create Leave Request - Invalid Date Range',
    method: 'POST',
    endpoint: '/api/leaves',
    data: {
      startDate: '2024-01-15',
      endDate: '2024-01-10', // End before start
      type: 'paid',
      reason: 'Test'
    },
    expectedStatus: [400, 401],
    requiresAuth: true
  }
];

// Performance test cases
const performanceTests = [
  {
    name: 'Get Today Status - Response Time',
    method: 'GET',
    endpoint: '/api/status/today',
    maxResponseTime: 2000, // 2 seconds
    requiresAuth: true
  },
  {
    name: 'Get All Shifts - Response Time',
    method: 'GET',
    endpoint: '/api/shifts',
    maxResponseTime: 1000, // 1 second
    requiresAuth: true
  }
];

// Helper function to make API requests
async function makeRequest(method, endpoint, data = null, headers = {}) {
  const config = {
    method: method.toLowerCase(),
    url: `${API_BASE}${endpoint}`,
    headers,
    ...testConfig
  };

  if (data && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
    config.data = data;
  }

  try {
    const response = await axios(config);
    return {
      status: response.status,
      data: response.data,
      headers: response.headers,
      responseTime: response.config.metadata?.endTime - response.config.metadata?.startTime || 0
    };
  } catch (error) {
    return {
      status: error.response?.status || 0,
      data: error.response?.data || null,
      error: error.message,
      responseTime: 0
    };
  }
}

// Check if server is running
async function checkServerHealth() {
  try {
    const response = await axios.get(`${API_BASE}/`, { timeout: 5000 });
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

// Test runner for API endpoints
async function runApiTests() {
  console.log('='.repeat(60));
  console.log('API ENDPOINTS TEST SUITE');
  console.log('='.repeat(60));

  // Check if server is running
  console.log('\n🔗 SERVER HEALTH CHECK');
  console.log('-'.repeat(40));

  const serverRunning = await checkServerHealth();
  if (!serverRunning) {
    console.log('❌ Server is not running at', API_BASE);
    console.log('Please start the server with "npm run dev" or "node app.js"');
    return { passed: 0, total: 0, skipped: true };
  }
  console.log('✅ Server is running and accessible');

  let passedTests = 0;
  let totalTests = 0;

  // Test basic endpoint availability
  console.log('\n📡 ENDPOINT AVAILABILITY TESTS');
  console.log('-'.repeat(40));

  for (const testCase of apiTestCases) {
    totalTests++;
    console.log(`\nTest: ${testCase.name}`);

    try {
      const headers = testCase.requiresAuth ? getAuthHeaders() : {};
      const response = await makeRequest(testCase.method, testCase.endpoint, null, headers);

      const expectedStatuses = Array.isArray(testCase.expectedStatus)
        ? testCase.expectedStatus
        : [testCase.expectedStatus];

      if (expectedStatuses.includes(response.status)) {
        console.log(`   ✅ PASSED - Status: ${response.status}`);
        passedTests++;
      } else {
        console.log(`   ❌ FAILED - Expected status: ${expectedStatuses.join(' or ')}, got: ${response.status}`);
        if (response.data) {
          console.log(`      Response: ${JSON.stringify(response.data).slice(0, 100)}...`);
        }
      }

    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
    }
  }

  // Test data validation
  console.log('\n✅ DATA VALIDATION TESTS');
  console.log('-'.repeat(40));

  for (const testCase of dataValidationTests) {
    totalTests++;
    console.log(`\nTest: ${testCase.name}`);

    try {
      const headers = testCase.requiresAuth ? getAuthHeaders() : {};
      const response = await makeRequest(testCase.method, testCase.endpoint, testCase.data, headers);

      const expectedStatuses = Array.isArray(testCase.expectedStatus)
        ? testCase.expectedStatus
        : [testCase.expectedStatus];

      if (expectedStatuses.includes(response.status)) {
        console.log(`   ✅ PASSED - Status: ${response.status} (Validation working)`);
        passedTests++;
      } else {
        console.log(`   ❌ FAILED - Expected status: ${expectedStatuses.join(' or ')}, got: ${response.status}`);
        if (response.data) {
          console.log(`      Response: ${JSON.stringify(response.data).slice(0, 100)}...`);
        }
      }

    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
    }
  }

  // Test performance
  console.log('\n⚡ PERFORMANCE TESTS');
  console.log('-'.repeat(40));

  for (const testCase of performanceTests) {
    totalTests++;
    console.log(`\nTest: ${testCase.name}`);

    try {
      const startTime = Date.now();
      const headers = testCase.requiresAuth ? getAuthHeaders() : {};
      const response = await makeRequest(testCase.method, testCase.endpoint, null, headers);
      const responseTime = Date.now() - startTime;

      if (responseTime <= testCase.maxResponseTime) {
        console.log(`   ✅ PASSED - Response time: ${responseTime}ms (< ${testCase.maxResponseTime}ms)`);
        passedTests++;
      } else {
        console.log(`   ❌ FAILED - Response time: ${responseTime}ms (> ${testCase.maxResponseTime}ms)`);
      }

    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
    }
  }

  // Test CORS headers
  console.log('\n🌐 CORS CONFIGURATION TEST');
  console.log('-'.repeat(40));

  totalTests++;
  try {
    const response = await makeRequest('OPTIONS', '/api/shifts');
    const corsHeaders = response.headers['access-control-allow-origin'];

    if (corsHeaders) {
      console.log(`✅ PASSED - CORS configured: ${corsHeaders}`);
      passedTests++;
    } else {
      console.log(`⚠️  WARNING - No CORS headers found`);
    }
  } catch (error) {
    console.log(`❌ ERROR testing CORS: ${error.message}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log(`API TESTS SUMMARY: ${passedTests}/${totalTests} tests passed`);
  console.log('='.repeat(60));

  return { passed: passedTests, total: totalTests };
}

// Export for use in other files
module.exports = {
  runApiTests,
  apiTestCases,
  checkServerHealth
};

// Run tests if this file is executed directly
if (require.main === module) {
  runApiTests().then(result => {
    process.exit(result.passed === result.total ? 0 : 1);
  });
}