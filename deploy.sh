#!/bin/bash

echo "🚀 Failsafe LLM Guardrails - Complete Deployment"
echo "=================================================="
echo ""

# Check if code is in a git repository
if [ ! -d ".git" ]; then
    echo "❌ This directory is not a git repository."
    echo "Please initialize git and push to GitHub first:"
    echo "   git init"
    echo "   git add ."
    echo "   git commit -m 'Initial commit'"
    echo "   git remote add origin https://github.com/yourusername/your-repo.git"
    echo "   git push -u origin main"
    exit 1
fi

echo "✅ Git repository detected"
echo ""

# Check if user has the required tools
echo "🔧 Checking prerequisites..."

# Check Railway CLI
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Installing..."
    npm install -g @railway/cli
else
    echo "✅ Railway CLI found"
fi

# Check Vercel CLI
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
else
    echo "✅ Vercel CLI found"
fi

echo ""
echo "📋 Deployment Options:"
echo "1. Deploy Backend to Railway"
echo "2. Deploy Frontend to Vercel"
echo "3. Deploy Both (Recommended)"
echo "4. Exit"
echo ""

read -p "Choose an option (1-4): " choice

case $choice in
    1)
        echo "🚀 Deploying Backend to Railway..."
        cd backend
        ./deploy-railway.sh
        ;;
    2)
        echo "🎨 Deploying Frontend to Vercel..."
        cd frontend
        ./deploy-vercel.sh
        ;;
    3)
        echo "🚀 Deploying Backend to Railway..."
        cd backend
        ./deploy-railway.sh
        
        echo ""
        echo "🎨 Deploying Frontend to Vercel..."
        cd ../frontend
        ./deploy-vercel.sh
        
        echo ""
        echo "🎉 Both deployments completed!"
        echo "📋 Next steps:"
        echo "   1. Set your OpenAI API key in Railway dashboard"
        echo "   2. Set VITE_API_URL in Vercel dashboard to point to your Railway backend"
        echo "   3. Test your deployed application"
        ;;
    4)
        echo "👋 Goodbye!"
        exit 0
        ;;
    *)
        echo "❌ Invalid option. Please choose 1-4."
        exit 1
        ;;
esac

echo ""
echo "📖 For detailed instructions, see DEPLOYMENT.md" 