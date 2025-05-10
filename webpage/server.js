const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 8080;
const DIRECTORY = __dirname;

// MIME types for different file extensions
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf'
};

// Create the server
const server = http.createServer((req, res) => {
    // Parse the request URL
    const parsedUrl = url.parse(req.url);
    let pathname = parsedUrl.pathname;
    
    // Default to index.html for root path
    if (pathname === '/') {
        pathname = '/index.html';
    }
    
    // Construct file path
    const filePath = path.join(DIRECTORY, pathname);
    
    // Get file extension
    const extname = path.extname(filePath).toLowerCase();
    
    // Determine content type
    const contentType = mimeTypes[extname] || 'application/octet-stream';
    
    // Read and serve the file
    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                // File not found
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 - File Not Found</h1>', 'utf-8');
            } else {
                // Server error
                res.writeHead(500);
                res.end('Server Error: ' + error.code, 'utf-8');
            }
        } else {
            // Success - serve the file
            res.writeHead(200, { 
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            });
            res.end(content, 'utf-8');
        }
    });
});

// Start the server
server.listen(PORT, () => {
    console.log('\x1b[32m%s\x1b[0m', '='.repeat(50));
    console.log('\x1b[32m%s\x1b[0m', '  AI TERMINAL SERVER v1.0.0');
    console.log('\x1b[32m%s\x1b[0m', `  Server running at http://localhost:${PORT}`);
    console.log('\x1b[32m%s\x1b[0m', `  Directory: ${DIRECTORY}`);
    console.log('\x1b[32m%s\x1b[0m', '  Press Ctrl+C to stop');
    console.log('\x1b[32m%s\x1b[0m', '='.repeat(50));
    console.log();
});

// Handle server errors
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error('\x1b[31m%s\x1b[0m', `Error: Port ${PORT} is already in use.`);
        console.error('Please close any other servers running on this port.');
    } else {
        console.error('\x1b[31m%s\x1b[0m', `Server error: ${error}`);
    }
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\x1b[31m%s\x1b[0m', 'Shutting down server...');
    server.close(() => {
        console.log('\x1b[31m%s\x1b[0m', 'Server stopped.');
        process.exit(0);
    });
});
