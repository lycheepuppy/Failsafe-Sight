#!/bin/bash

echo "🚀 Starting Failsafe LLM Guardrails (Refactored)..."
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ and try again."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Check for .env file in backend
if [ ! -f "backend/.env" ]; then
    echo "⚠️  No .env file found in backend directory."
    echo "📝 Creating .env file from template..."
    if [ -f "backend/env.example" ]; then
        cp backend/env.example backend/.env
        echo "✅ Created .env file from template"
        echo "⚠️  Please update backend/.env with your OpenAI API key before starting"
    else
        echo "❌ No env.example template found"
        exit 1
    fi
fi

# Start backend server
echo "📡 Starting backend server..."
cd backend

# Install dependencies if node_modules doesn't exist or package.json is newer
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install backend dependencies"
        exit 1
    fi
fi

# Check if .env file has OpenAI API key
if grep -q "your-openai-api-key-here" .env; then
    echo "⚠️  Warning: OpenAI API key not configured in .env file"
    echo "   AI analysis will be disabled. Update backend/.env to enable it."
fi

# Start backend
node src/server.js &
BACKEND_PID=$!
echo "Backend server started with PID: $BACKEND_PID"

# Wait a moment for backend to start
sleep 3

# Check if backend is running
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "❌ Backend failed to start"
    exit 1
fi

# Test backend health
echo "🏥 Testing backend health..."
if curl -s http://localhost:3000/health > /dev/null; then
    echo "✅ Backend is running on http://localhost:3000"
else
    echo "⚠️  Backend started but health check failed"
fi

# Start frontend server
echo "🎨 Starting frontend server..."
cd ../frontend

# Install dependencies if node_modules doesn't exist or package.json is newer
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install --force
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install frontend dependencies"
        kill $BACKEND_PID 2>/dev/null
        exit 1
    fi
fi

# Start frontend
npm run dev &
FRONTEND_PID=$!
echo "Frontend server started with PID: $FRONTEND_PID"

# Wait a moment for frontend to start
sleep 5

# Check if frontend is running
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo "❌ Frontend failed to start"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

# Test frontend
echo "🎨 Testing frontend..."
if curl -s http://localhost:5173 > /dev/null; then
    echo "✅ Frontend is running on http://localhost:5173"
else
    echo "⚠️  Frontend started but may not be fully ready"
fi

echo ""
echo "🎉 Failsafe LLM Guardrails is now running!"
echo ""
echo "📡 Backend API: http://localhost:3000"
echo "🎨 Frontend UI: http://localhost:5173"
echo "🏥 Health Check: http://localhost:3000/health"
echo "📊 Cache Stats: http://localhost:3000/v1/guardrails/cache/stats"
echo ""
echo "Press Ctrl+C to stop both servers"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down servers..."
    
    if kill -0 $BACKEND_PID 2>/dev/null; then
        echo "Stopping backend server (PID: $BACKEND_PID)..."
        kill $BACKEND_PID
    fi
    
    if kill -0 $FRONTEND_PID 2>/dev/null; then
        echo "Stopping frontend server (PID: $FRONTEND_PID)..."
        kill $FRONTEND_PID
    fi
    
    echo "✅ All servers stopped"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Wait for user to stop
wait 