#!/usr/bin/env node

/**
 * Server Verification Script
 * Checks that all routes and API endpoints are working correctly
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

const routes = [
  { path: '/', name: 'Home (Map View)' },
  { path: '/berlin', name: 'Berlin Programming' },
  { path: '/sf', name: 'SF Programming' },
  { path: '/data/database.json', name: 'Database JSON' },
];

function checkRoute(path, name) {
  return new Promise((resolve) => {
    const url = new URL(path, BASE_URL);
    const startTime = Date.now();
    
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const duration = Date.now() - startTime;
        resolve({
          name,
          path,
          status: res.statusCode,
          contentType: res.headers['content-type'] || 'unknown',
          size: data.length,
          duration,
          success: res.statusCode === 200
        });
      });
    }).on('error', (err) => {
      resolve({
        name,
        path,
        status: 0,
        error: err.message,
        success: false
      });
    });
  });
}

async function verifyServer() {
  console.log('🔍 Verifying dev server functionality...\n');
  
  const results = await Promise.all(
    routes.map(route => checkRoute(route.path, route.name))
  );
  
  console.log('Route Status:');
  console.log('─'.repeat(80));
  
  let allPassed = true;
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    const statusCode = result.status || 'ERROR';
    const size = result.size ? `(${(result.size / 1024).toFixed(2)} KB)` : '';
    const duration = result.duration ? `${result.duration}ms` : '';
    
    console.log(`${status} ${result.name.padEnd(25)} ${statusCode.toString().padStart(3)} ${size.padEnd(12)} ${duration}`);
    
    if (!result.success) {
      allPassed = false;
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    }
  });
  
  console.log('─'.repeat(80));
  console.log(`\n${allPassed ? '✅ All routes are working correctly!' : '❌ Some routes failed'}\n`);
  
  return allPassed;
}

verifyServer().then(success => {
  process.exit(success ? 0 : 1);
});
