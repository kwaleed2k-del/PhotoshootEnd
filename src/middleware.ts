/**
 * Note: This is a Next.js middleware file.
 * In Vite/Express setup, authentication should be handled in Express middleware or client-side routing.
 * This file is kept for reference but won't be used in Vite setup.
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const AUTH_ENABLED = process.env.AUTH_ENFORCE !== 'false';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const PROTECTED_PATTERNS = [/^\/dashboard(?:\/|$)/i, /^\/billing(?:\/|$)/i, /^\/admin(?:\/|$)/i];

// This middleware is not used in Vite setup
// Authentication is handled client-side or via Express middleware


