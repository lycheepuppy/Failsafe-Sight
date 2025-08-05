#!/bin/bash

echo "🚀 Deploying Failsafe LLM Guardrails Frontend to Vercel..."

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI is not installed. Please install it first:"
    echo "   npm install -g vercel"
    echo "   Then run: vercel login"
    exit 1
fi

# Check if user is logged in to Vercel
if ! vercel whoami &> /dev/null; then
    echo "❌ Not logged in to Vercel. Please run: vercel login"
    exit 1
fi

# Check if project exists, if not link it
if [ ! -f ".vercel/project.json" ]; then
    echo "📝 Linking to Vercel project..."
    vercel link
fi

# Set environment variables
echo "🔧 Setting up environment variables..."
echo "⚠️  Please provide your Railway backend URL when prompted:"
echo "   (e.g., https://your-backend-name.railway.app)"

# Deploy to Vercel
echo "🚀 Deploying to Vercel..."
vercel --prod

echo ""
echo "✅ Deployment complete!"
echo "🌐 Your frontend is now live on Vercel"
echo "📊 Check the Vercel dashboard for your deployment URL"
echo ""
echo "🔗 Don't forget to:"
echo "   1. Set VITE_API_URL environment variable in Vercel dashboard"
echo "   2. Point it to your Railway backend URL" 