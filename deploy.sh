#!/bin/bash

# Enhanced deployment script for Failsafe LLM Guardrails
# Supports multiple deployment targets and environments

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    log "🔧 Checking prerequisites..."
    
    # Check if we're in a git repository
    if [ ! -d ".git" ]; then
        error "This directory is not a git repository. Please initialize git first."
    fi
    
    # Check for required tools
    local missing_tools=()
    
    if ! command -v node &> /dev/null; then
        missing_tools+=("Node.js")
    fi
    
    if ! command -v npm &> /dev/null; then
        missing_tools+=("npm")
    fi
    
    if ! command -v git &> /dev/null; then
        missing_tools+=("git")
    fi
    
    # Check Railway CLI
    if ! command -v railway &> /dev/null; then
        warn "Railway CLI not found. Installing..."
        npm install -g @railway/cli
    fi
    
    # Check Vercel CLI
    if ! command -v vercel &> /dev/null; then
        warn "Vercel CLI not found. Installing..."
        npm install -g vercel
    fi
    
    # Check Docker (optional)
    if ! command -v docker &> /dev/null; then
        warn "Docker not found. Docker deployment will be skipped."
    fi
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        error "Missing required tools: ${missing_tools[*]}"
    fi
    
    log "✅ Prerequisites check completed"
}

# Run tests
run_tests() {
    log "🧪 Running tests..."
    
    # Backend tests
    if [ -d "$BACKEND_DIR" ]; then
        cd "$BACKEND_DIR"
        if npm test; then
            log "✅ Backend tests passed"
        else
            error "Backend tests failed"
        fi
        cd "$PROJECT_ROOT"
    fi
    
    # Frontend tests (if available)
    if [ -d "$FRONTEND_DIR" ] && [ -f "$FRONTEND_DIR/package.json" ]; then
        cd "$FRONTEND_DIR"
        if npm run check 2>/dev/null; then
            log "✅ Frontend checks passed"
        else
            warn "Frontend checks failed or not configured"
        fi
        cd "$PROJECT_ROOT"
    fi
}

# Health check
run_health_check() {
    log "🏥 Running health checks..."
    
    if [ -d "$BACKEND_DIR" ]; then
        cd "$BACKEND_DIR"
        if npm run health:check; then
            log "✅ Health checks passed"
        else
            warn "Health checks failed or not configured"
        fi
        cd "$PROJECT_ROOT"
    fi
}

# Performance test
run_performance_test() {
    log "🚀 Running performance tests..."
    
    if [ -d "$BACKEND_DIR" ]; then
        cd "$BACKEND_DIR"
        if npm run performance:test; then
            log "✅ Performance tests completed"
        else
            warn "Performance tests failed or not configured"
        fi
        cd "$PROJECT_ROOT"
    fi
}

# Deploy backend to Railway
deploy_backend() {
    log "🚀 Deploying Backend to Railway..."
    
    if [ ! -d "$BACKEND_DIR" ]; then
        error "Backend directory not found"
    fi
    
    cd "$BACKEND_DIR"
    
    # Check if Railway project is configured
    if ! railway status &> /dev/null; then
        warn "Railway project not configured. Please run 'railway login' and 'railway init' first."
        return 1
    fi
    
    # Deploy using Railway CLI
    if railway up; then
        log "✅ Backend deployed successfully to Railway"
        
        # Get the deployment URL
        local backend_url=$(railway status --json | grep -o '"url":"[^"]*"' | cut -d'"' -f4)
        if [ -n "$backend_url" ]; then
            log "🌐 Backend URL: $backend_url"
            echo "$backend_url" > "$PROJECT_ROOT/.backend-url"
        fi
    else
        error "Backend deployment failed"
    fi
    
    cd "$PROJECT_ROOT"
}

# Deploy frontend to Vercel
deploy_frontend() {
    log "🎨 Deploying Frontend to Vercel..."
    
    if [ ! -d "$FRONTEND_DIR" ]; then
        error "Frontend directory not found"
    fi
    
    cd "$FRONTEND_DIR"
    
    # Check if Vercel project is configured
    if [ ! -f ".vercel/project.json" ]; then
        warn "Vercel project not configured. Please run 'vercel' first to set up the project."
        return 1
    fi
    
    # Get backend URL for environment variable
    local backend_url=""
    if [ -f "$PROJECT_ROOT/.backend-url" ]; then
        backend_url=$(cat "$PROJECT_ROOT/.backend-url")
    fi
    
    # Deploy using Vercel CLI
    if vercel --prod; then
        log "✅ Frontend deployed successfully to Vercel"
        
        # Set environment variable if backend URL is available
        if [ -n "$backend_url" ]; then
            log "🔧 Setting VITE_API_URL environment variable..."
            vercel env add VITE_API_URL production <<< "$backend_url" || warn "Failed to set VITE_API_URL"
        fi
    else
        error "Frontend deployment failed"
    fi
    
    cd "$PROJECT_ROOT"
}

# Deploy using Docker
deploy_docker() {
    log "🐳 Deploying with Docker..."
    
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed"
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed"
    fi
    
    # Build and start services
    if docker-compose --profile production up -d --build; then
        log "✅ Docker deployment completed"
        log "🌐 Application available at: http://localhost"
        log "📊 Backend API available at: http://localhost:3000"
    else
        error "Docker deployment failed"
    fi
}

# Deploy with monitoring
deploy_with_monitoring() {
    log "📊 Deploying with monitoring stack..."
    
    if ! command -v docker &> /dev/null; then
        error "Docker is required for monitoring deployment"
    fi
    
    # Start monitoring services
    if docker-compose --profile production --profile monitoring up -d --build; then
        log "✅ Deployment with monitoring completed"
        log "🌐 Application available at: http://localhost"
        log "📊 Prometheus available at: http://localhost:9090"
        log "📈 Grafana available at: http://localhost:3001 (admin/admin)"
    else
        error "Monitoring deployment failed"
    fi
}

# Main deployment function
main() {
    echo "🚀 Failsafe LLM Guardrails - Enhanced Deployment"
    echo "=================================================="
    echo ""
    
    # Check prerequisites
    check_prerequisites
    
    # Show deployment options
    echo "📋 Deployment Options:"
    echo "1. Deploy Backend to Railway"
    echo "2. Deploy Frontend to Vercel"
    echo "3. Deploy Both (Recommended)"
    echo "4. Deploy with Docker"
    echo "5. Deploy with Monitoring"
    echo "6. Run Tests Only"
    echo "7. Run Health Checks"
    echo "8. Run Performance Tests"
    echo "9. Exit"
    echo ""
    
    read -p "Choose an option (1-9): " choice
    
    case $choice in
        1)
            deploy_backend
            ;;
        2)
            deploy_frontend
            ;;
        3)
            deploy_backend
            echo ""
            deploy_frontend
            echo ""
            log "🎉 Both deployments completed!"
            log "📋 Next steps:"
            log "   1. Set your OpenAI API key in Railway dashboard"
            log "   2. Verify VITE_API_URL is set in Vercel dashboard"
            log "   3. Test your deployed application"
            ;;
        4)
            deploy_docker
            ;;
        5)
            deploy_with_monitoring
            ;;
        6)
            run_tests
            ;;
        7)
            run_health_check
            ;;
        8)
            run_performance_test
            ;;
        9)
            log "👋 Goodbye!"
            exit 0
            ;;
        *)
            error "Invalid option. Please choose 1-9."
            ;;
    esac
    
    echo ""
    log "📖 For detailed instructions, see DEPLOYMENT.md"
}

# Run main function
main "$@" 