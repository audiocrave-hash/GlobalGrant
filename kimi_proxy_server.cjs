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
const KIMI_MODEL = 'kimi-k2.6';
const PORT = 3000;

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
        // Health check endpoint
        res.writeHead(200);
        res.end(JSON.stringify({ status: 'ok', server: 'Kimi Proxy', version: '1.0' }));

    } else if (req.url === '/') {
        // Welcome page
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Kimi Proxy Server</title>
                <style>
                    body { font-family: sans-serif; padding: 40px; background: #f5f5f5; }
                    .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    h1 { color: #667eea; }
                    .status { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 12px; border-radius: 4px; }
                    .code { background: #f4f4f4; padding: 10px; border-radius: 4px; font-family: monospace; margin: 10px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>✅ Kimi API Proxy Server</h1>
                    <div class="status">
                        <strong>✓ Server is running on http://localhost:3000</strong>
                    </div>
                    <h2>What This Does:</h2>
                    <p>This server acts as a bridge between your browser and the Kimi API, solving CORS issues.</p>
                    
                    <h2>The HTML Files Will:</h2>
                    <ul>
                        <li>✓ Auto-detect this proxy server</li>
                        <li>✓ Send requests through this server</li>
                        <li>✓ Bypass CORS restrictions</li>
                        <li>✓ Work properly without errors</li>
                    </ul>

                    <h2>Keep This Window Open:</h2>
                    <p>Leave this server running while you use the HTML files. When done, you can close this window.</p>

                    <h2>Endpoints:</h2>
                    <div class="code">
                        POST /api/generate — Forward requests to Kimi API<br>
                        GET /health — Server status check<br>
                        GET / — This page
                    </div>

                    <h2>Ready to Use:</h2>
                    <p>Open <strong>rotary_simple_test.html</strong> or <strong>rotary_ai_proposal_writer.html</strong> now. They'll work with this proxy! 🚀</p>
                </div>
            </body>
            </html>
        `);

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
╔═══════════════════════════════════════════════════════════════╗
║          🚀 Kimi API Proxy Server Started                    ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  ✓ Server running on: http://localhost:${PORT}                ║
║  ✓ API Key: ${KIMI_API_KEY.substring(0, 10)}...               ║
║                                                               ║
║  📝 Next Steps:                                              ║
║  1. Open rotary_simple_test.html in your browser            ║
║  2. It will auto-detect this proxy server                   ║
║  3. Click "Generate Overview"                               ║
║  4. Watch Kimi generate your proposal text! ✨              ║
║                                                               ║
║  ⚠️  Keep this window open while using the HTML files        ║
║  👋 To stop the server, press Ctrl+C                         ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
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
