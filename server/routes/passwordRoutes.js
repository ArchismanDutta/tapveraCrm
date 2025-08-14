const express = require('express');
const router = express.Router();
const { forgotPassword, resetPassword } = require('../controllers/passwordController');

// Forgot password request
router.post('/forgot-password', forgotPassword);

// Reset password process
router.post('/reset-password/:userId/:token', resetPassword);

module.exports = router;
