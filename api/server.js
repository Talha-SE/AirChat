// This file imports and re-exports the main server.js functionality
// to make it compatible with Vercel's serverless functions

// Import the core Express app from the main server file
const { app } = require('../server');

// Export the Express app for Vercel serverless functions
module.exports = app;
