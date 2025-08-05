# FailSafe Sight - AI Guardrails Platform

Enterprise-grade AI guardrails that detect sophisticated fraud patterns, emotional manipulation, and boundary breaches before they impact your business operations.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm 8+
- OpenAI API key (optional, for AI analysis)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd failsafe-llm-guardrails
   ```

2. **Configure environment variables**
   ```bash
   # Copy the environment template
   cp backend/env.example backend/.env
   
   # Edit backend/.env and add your OpenAI API key
   OPENAI_API_KEY=your-actual-api-key-here
   ```

3. **Start the application**
   ```bash
   ./start.sh
   ```

The application will be available at:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **Health Check**: http://localhost:3000/health

## 🏗️ Architecture

### Backend (Node.js/Express)

```
backend/src/
├── config/           # Configuration management
├── controllers/      # HTTP request handlers
├── middleware/       # Express middleware
├── routes/          # API route definitions
├── services/        # Business logic services
├── utils/           # Utility functions
└── server.js        # Main server entry point
```

### Frontend (SvelteKit)

```
frontend/src/
├── routes/          # SvelteKit routes
├── components/      # Reusable components
├── stores/          # State management
└── app.html         # Main HTML template
```

## 🔧 Features

### Core Functionality

- **Multi-Layer Detection**: Business rules + Pattern analysis + AI analysis
- **Real-time Processing**: Sub-2 second response times
- **Caching**: Intelligent caching for improved performance
- **Rate Limiting**: Protection against abuse
- **Input Validation**: Comprehensive request validation
- **Security**: XSS protection, input sanitization, security headers

### Business Rules Engine

- **LBC-1**: Jailbreak Detection
- **LBC-2**: Loan Amount Limits
- **LBC-3**: Emotional Manipulation
- **LBC-4**: Document Verification Bypass
- **LBC-5**: Technical Exploits
- **LBC-6**: Boundary Breach Attempts
- **LBC-7**: Unverifiable Documentation

### AI Analysis

- **GPT-4 Integration**: Advanced fraud detection
- **Custom Prompts**: Configurable analysis instructions
- **Fallback Handling**: Graceful degradation when AI is unavailable

## 📡 API Reference

### Health Check
```http
GET /health
```

### Guardrail Check
```http
POST /v1/guardrails/check
Content-Type: application/json

{
  "input": "Customer loan request",
  "reasoning": "AI reasoning",
  "output": "AI decision",
  "customPrompt": "Optional custom instructions"
}
```

### Business Rules
```http
GET /v1/guardrails/rules
POST /v1/guardrails/rules
PUT /v1/guardrails/rules/:ruleId
```

### Cache Management
```http
GET /v1/guardrails/cache/stats
POST /v1/guardrails/cache/clear
```

## 🔒 Security Features

### Input Validation
- Request body validation using express-validator
- Input sanitization to prevent XSS attacks
- Length limits and type checking
- Custom validation rules for business logic

### Security Headers
- Helmet.js for security headers
- Content Security Policy (CSP)
- XSS Protection
- Frame Options

### Rate Limiting
- Configurable rate limits per IP
- 100 requests per 15 minutes by default
- Customizable time windows and limits

### CORS Configuration
- Configurable CORS origins
- Credential support
- Secure defaults

## ⚡ Performance Optimizations

### Caching
- In-memory caching with NodeCache
- Configurable TTL and size limits
- Cache statistics and monitoring
- Intelligent cache key generation

### Regex Optimization
- Pre-compiled regex patterns
- Error handling for invalid patterns
- Fallback to string matching

### Compression
- Gzip compression for all responses
- Reduced bandwidth usage
- Faster response times

## 🛠️ Configuration

### Environment Variables

```bash
# Server Configuration
PORT=3000
HOST=localhost
CORS_ORIGIN=http://localhost:5173

# OpenAI Configuration
OPENAI_API_KEY=your-api-key
OPENAI_MODEL=gpt-4
OPENAI_TEMPERATURE=0.1
OPENAI_MAX_TOKENS=500

# Business Rules
LOAN_LIMIT=3000
MIN_LOAN=50
SENSITIVITY_LEVEL=medium

# Cache Configuration
CACHE_ENABLED=true
CACHE_TTL=300
CACHE_MAX_SIZE=1000

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
ENABLE_REQUEST_LOGGING=true
```

## 📊 Monitoring & Logging

### Structured Logging
- JSON format logs
- Configurable log levels
- Request/response logging
- Performance metrics

### Health Checks
- Service status monitoring
- Memory usage tracking
- Uptime monitoring
- Dependency health checks

### Cache Statistics
- Hit/miss ratios
- Cache size monitoring
- Performance metrics
- Cache management endpoints

## 🧪 Testing

### Backend Tests
```bash
cd backend
npm test
npm run test:coverage
```

### Frontend Tests
```bash
cd frontend
npm run check
```

### Security Audit
```bash
cd backend
npm run security:audit
npm run security:fix
```

## 🚀 Deployment

### Production Setup

1. **Environment Configuration**
   ```bash
   NODE_ENV=production
   LOG_LEVEL=warn
   CACHE_ENABLED=true
   ```

2. **Security Considerations**
   - Use HTTPS in production
   - Configure proper CORS origins
   - Set up rate limiting
   - Enable request logging

3. **Performance Tuning**
   - Adjust cache settings
   - Configure rate limits
   - Monitor memory usage
   - Set up load balancing

## 🔧 Development

### Code Quality

- **ESLint**: Code linting and style enforcement
- **Prettier**: Code formatting
- **TypeScript**: Type checking (frontend)
- **Pre-commit hooks**: Automated quality checks

### Scripts

```bash
# Backend
npm run dev          # Development server
npm run test         # Run tests
npm run lint         # Lint code
npm run format       # Format code

# Frontend
npm run dev          # Development server
npm run build        # Build for production
npm run check        # Type checking
```

## 📈 Performance Benchmarks

- **Response Time**: < 2 seconds for typical requests
- **Throughput**: 100+ requests per minute per IP
- **Cache Hit Rate**: 60-80% for repeated requests
- **Memory Usage**: < 100MB for typical workloads

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- **Documentation**: See `/docs` directory
- **Issues**: GitHub Issues
- **Security**: security@failsafe.com

---

**FailSafe Sight** - See Everything. Miss Nothing. 🛡️ 