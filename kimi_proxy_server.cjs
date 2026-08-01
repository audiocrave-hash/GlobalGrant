/**
 * Kimi API Proxy Server
 * 
 * Run this on your computer to enable Kimi API access from the browser HTML files
 * 
 * Installation:
 * 1. Install Node.js from nodejs.org (if not already installed)
 * 2. Open terminal/command prompt
 * 3. Navigate to the folder with this file
 * 4. Run: node kimi_proxy_server.js
 * 5. You'll see: "Server running on http://localhost:3000"
 * 6. Keep this window open while using the HTML files
 * 
 * Usage:
 * The HTML files will automatically detect the proxy server
 * If it's running on port 3000, requests go through the proxy
 * If it's not running, requests go direct to Kimi (may fail due to CORS)
 */

const http = require('http');
const https = require('https');
const url = require('url');

// The key is read from the environment, or from kimi_api_key.txt beside this
// file. Never hardcode it here — this file is committed.
const KIMI_API_KEY = (process.env.KIMI_API_KEY || readKeyFile()).trim();

function readKeyFile() {
    try {
        return require('fs').readFileSync(require('path').join(__dirname, 'kimi_api_key.txt'), 'utf8');
    } catch (e) {
        console.error('\n❌ No API key found.\n');
        console.error('   Set KIMI_API_KEY, or put your key in kimi_api_key.txt next to this file.');
        console.error('   Get one at https://platform.kimi.ai/console/api-keys\n');
        process.exit(1);
    }
}
const KIMI_ENDPOINT = 'https://api.moonshot.ai/v1/chat/completions';
const KIMI_MODEL = 'kimi-k2.7-code-highspeed';
// Railway (and most hosts) hand the port in via the environment.
const PORT = process.env.PORT || 3000;

// Static files this server will hand out. Anything not listed is a 404, so a
// stray path can never read kimi_api_key.txt or any other file on disk.
const STATIC = {
    '/': ['index.html', 'text/html; charset=utf-8'],
    '/index.html': ['index.html', 'text/html; charset=utf-8'],
    '/kimi_diagnostics.html': ['kimi_diagnostics.html', 'text/html; charset=utf-8']
};

function serveStatic(route, res) {
    const [file, type] = STATIC[route];
    require('fs').readFile(require('path').join(__dirname, file), (err, buf) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not found');
            return;
        }
        res.writeHead(200, { 'Content-Type': type });
        res.end(buf);
    });
}

// Create HTTP server that accepts POST requests
const server = http.createServer((req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Content-Type', 'application/json');

    // Handle OPTIONS (preflight)
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Handle POST requests to /api/generate
    if (req.method === 'POST' && req.url === '/api/generate') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            try {
                const payload = JSON.parse(body);
                console.log(`📤 Received request: ${payload.messages[0]?.content?.substring(0, 50)}...`);

                // Forward to Kimi API
                forwardToKimi(payload, res);

            } catch (e) {
                console.error('❌ Error parsing request:', e.message);
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Invalid request format' }));
            }
        });

    } else if (req.url === '/health') {
        // Health check endpoint — also how the page decides whether a proxy is
        // in front of it, so the "server" field matters.
        res.writeHead(200);
        res.end(JSON.stringify({ status: 'ok', server: 'Kimi Proxy', version: '1.0' }));

    } else if (req.method === 'GET' && STATIC[req.url.split('?')[0]]) {
        serveStatic(req.url.split('?')[0], res);

    } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Endpoint not found' }));
    }
});

// Forward request to Kimi API
function forwardToKimi(payload, res) {
    // The platform.kimi.ai models are named kimi-*, not moonshot-v1-*,
    // and they only accept temperature 1.
    payload.model = KIMI_MODEL;
    payload.temperature = 1;
    // These models spend tokens on reasoning before the answer; too small a
    // budget comes back with finish_reason "length" and empty content.
    payload.max_tokens = Math.max(payload.max_tokens || 0, 8000);

    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${KIMI_API_KEY}`
        }
    };

    const req = https.request(KIMI_ENDPOINT, options, (kimiRes) => {
        // Streamed replies are piped straight through, unbuffered, so text
        // reaches the page as it is written rather than minutes later.
        if (payload.stream && kimiRes.statusCode === 200) {
            console.log('✅ Kimi streaming…');
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no'
            });
            kimiRes.pipe(res);
            return;
        }

        let responseData = '';

        kimiRes.on('data', chunk => {
            responseData += chunk;
        });

        kimiRes.on('end', () => {
            console.log(`✅ Kimi responded with status ${kimiRes.statusCode}`);

            res.writeHead(kimiRes.statusCode, { 'Content-Type': 'application/json' });
            res.end(responseData);
        });
    });

    req.on('error', (e) => {
        console.error('❌ Kimi API Error:', e.message);
        res.writeHead(500);
        res.end(JSON.stringify({ error: `Kimi API error: ${e.message}` }));
    });

    req.write(JSON.stringify(payload));
    req.end();
}

// Start server
server.listen(PORT, () => {
    console.log(`
🚀 Rotary proposal generator running on port ${PORT}
   Key: ${KIMI_API_KEY.substring(0, 10)}…  Model: ${KIMI_MODEL}

   Open http://localhost:${PORT}/ and click "Generate Overview".
   The page is served from here, so no separate static server is needed.
   Ctrl+C to stop.
`);
});

// Handle shutdown gracefully
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down proxy server...');
    server.close(() => {
        console.log('✓ Server stopped');
        process.exit(0);
    });
});
