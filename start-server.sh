#!/bin/bash
# Simple HTTP Server for Development

echo "🚀 Starting Maviya Constructions Development Server..."
echo "📍 Server will run at: http://localhost:8000"
echo "🌐 Open this URL in your browser: http://localhost:8000/login.html"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

python3 -m http.server 8000
