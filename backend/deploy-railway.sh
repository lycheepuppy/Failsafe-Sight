#!/bin/bash

echo "🚀 Deploying Failsafe LLM Guardrails Backend to Railway..."

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI is not installed. Please install it first:"
    echo "   npm install -g @railway/cli"
    echo "   Then run: railway login"
    exit 1
fi

# Check if user is logged in to Railway
if ! railway whoami &> /dev/null; then
    echo "❌ Not logged in to Railway. Please run: railway login"
    exit 1
fi

# Check if project exists, if not create it
if ! railway project &> /dev/null; then
    echo "📝 Creating new Railway project..."
    railway project create --name "failsafe-llm-guardrails-backend"
fi

# Set environment variables
echo "🔧 Setting up environment variables..."
railway variables set NODE_ENV=production
railway variables set PORT=3000
railway variables set HOST=0.0.0.0
railway variables set CORS_ORIGIN="*"
railway variables set LOG_LEVEL=info
railway variables set LOG_FORMAT=json
railway variables set ENABLE_REQUEST_LOGGING=true
railway variables set CACHE_ENABLED=true
railway variables set CACHE_TTL=300
railway variables set CACHE_MAX_SIZE=1000
railway variables set REQUEST_TIMEOUT=30000
railway variables set LOAN_LIMIT=3000
railway variables set MIN_LOAN=50
railway variables set SENSITIVITY_LEVEL=medium

# Set OpenAI API key (user will need to provide this)
echo "⚠️  Please set your OpenAI API key:"
echo "   railway variables set OPENAI_API_KEY=your-api-key-here"
echo ""

# Deploy to Railway
echo "🚀 Deploying to Railway..."
railway up

echo ""
echo "✅ Deployment complete!"
echo "🌐 Your backend is now live on Railway"
echo "📊 Check the Railway dashboard for your deployment URL" 