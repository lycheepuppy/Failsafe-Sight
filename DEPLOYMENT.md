# 🚀 Deployment Guide - Failsafe LLM Guardrails

This guide will help you deploy your Failsafe LLM Guardrails project to Railway (backend) and Vercel (frontend).

## 📋 Prerequisites

1. **GitHub Account** - Your code should be in a GitHub repository
2. **Railway Account** - Sign up at [railway.app](https://railway.app)
3. **Vercel Account** - Sign up at [vercel.com](https://vercel.com)
4. **OpenAI API Key** - Your existing API key

## 🔧 Backend Deployment (Railway)

### Step 1: Install Railway CLI
```bash
npm install -g @railway/cli
```

### Step 2: Login to Railway
```bash
railway login
```

### Step 3: Deploy Backend
```bash
cd backend
./deploy-railway.sh
```

### Step 4: Set OpenAI API Key
After deployment, set your OpenAI API key in Railway:
```bash
railway variables set OPENAI_API_KEY=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
```

### Step 5: Get Backend URL
Your backend will be available at: `https://your-project-name.railway.app`

## 🎨 Frontend Deployment (Vercel)

### Step 1: Install Vercel CLI
```bash
npm install -g vercel
```

### Step 2: Login to Vercel
```bash
vercel login
```

### Step 3: Deploy Frontend
```bash
cd frontend
./deploy-vercel.sh
```

### Step 4: Configure Environment Variables
In your Vercel dashboard:
1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add: `VITE_API_URL` = `https://your-backend-name.railway.app`

## 🔗 Manual Deployment Steps

### Railway Backend (Alternative)
1. Go to [railway.app](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repository
5. Set the root directory to `backend`
6. Add environment variables in the Railway dashboard

### Vercel Frontend (Alternative)
1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your GitHub repository
4. Set the root directory to `frontend`
5. Configure build settings:
   - Build Command: `npm run build`
   - Output Directory: `.svelte-kit/output`
6. Add environment variable `VITE_API_URL`

## 🌐 Environment Variables

### Backend (Railway)
```env
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
CORS_ORIGIN=*
OPENAI_API_KEY=your-api-key-here
LOG_LEVEL=info
CACHE_ENABLED=true
CACHE_TTL=300
CACHE_MAX_SIZE=1000
REQUEST_TIMEOUT=30000
LOAN_LIMIT=3000
MIN_LOAN=50
SENSITIVITY_LEVEL=medium
```

### Frontend (Vercel)
```env
VITE_API_URL=https://your-backend-name.railway.app
```

## 🔍 Testing Your Deployment

### Backend Health Check
```bash
curl https://your-backend-name.railway.app/health
```

### Frontend Test
Visit your Vercel URL and test the guardrails functionality.

### API Test
```bash
curl -X POST https://your-backend-name.railway.app/v1/guardrails/check \
  -H "Content-Type: application/json" \
  -d '{
    "input": "User wants to transfer $5000",
    "reasoning": "High-value transfer request",
    "output": "Transfer approved"
  }'
```

## 🛠️ Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure `CORS_ORIGIN` is set to `*` or your Vercel domain
2. **API Key Issues**: Verify your OpenAI API key is set in Railway
3. **Build Failures**: Check that all dependencies are in `package.json`
4. **Environment Variables**: Ensure all required variables are set

### Logs
- **Railway**: Check logs in Railway dashboard
- **Vercel**: Check build logs in Vercel dashboard

## 📊 Monitoring

### Railway Dashboard
- Monitor backend performance
- View logs and errors
- Check resource usage

### Vercel Dashboard
- Monitor frontend performance
- View analytics
- Check deployment status

## 🔄 Continuous Deployment

Both Railway and Vercel support automatic deployments:
- Push to your main branch
- Automatic deployment will trigger
- No manual intervention needed

## 🎉 Success!

Once deployed, your Failsafe LLM Guardrails will be available at:
- **Frontend**: `https://your-project.vercel.app`
- **Backend**: `https://your-project.railway.app`

Your AI-powered fraud detection system is now live and ready for production use! 