# AI Code Reviewer 🤖

An intelligent GitHub App integration that automatically reviews pull requests using AI workflows. This bot acts as a virtual team member providing comprehensive code reviews, interactive assistance, and maintaining code quality standards across your repositories.

## 🌟 Features

### 🔄 **Automatic PR Review Workflow**
- **Instant Analysis**: Automatically reviews every new pull request using AI agents
- **Multi-Agent System**: Specialized agents for security, performance, and code quality
- **Comprehensive Coverage**: Security vulnerabilities, performance bottlenecks, logic bugs
- **Draft PR Support**: Skips draft PRs, triggers review when marked "ready for review"

### 🤖 **Interactive Bot Assistant**
- **Natural Language**: Tag `@ai-code-reviewer` to ask questions about code
- **Context-Aware**: Understands full PR context and codebase
- **Real-time Responses**: Instant answers via PR comments
- **Smart Commands**: Supports help, review, explain, suggest, and more

### 🏗️ **Enterprise-Grade Architecture**
- **Clean Architecture**: Domain-driven service organization
- **GitHub App Only**: Secure app-based authentication (no personal tokens)
- **Scalable Design**: Proper separation of concerns and SOLID principles
- **Production Ready**: Singleton patterns, caching, and error handling

## 🏗️ Architecture

### **Service Organization**
```
src/
├── services/                    # Clean domain organization
│   ├── config/                 # Configuration management
│   │   ├── ConfigurationManager.ts
│   │   └── index.ts
│   ├── github/                 # GitHub API & service factory
│   │   ├── GitHubService.ts
│   │   ├── GitHubServiceFactory.ts
│   │   └── index.ts
│   ├── webhook/                # Webhook processing
│   │   ├── WebhookService.ts
│   │   └── index.ts
│   └── index.ts               # Main barrel export
├── controllers/               # HTTP layer
│   └── WebhookController.ts
├── workflows/                 # AI workflow orchestration
│   ├── code-reviewer-workflow.ts
│   └── interactive-pr-assistant-workflow.ts
├── routes/                    # Express routing
│   └── webhooks.ts
└── index.ts                   # Application entry point
```

### **Request Flow**
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   GitHub        │    │   Webhook        │    │   Webhook       │
│   Webhook       │───▶│   Controller     │───▶│   Service       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌────────▼────────┐              │
         │              │  GitHub Service │              │
         │              │     Factory     │              │
         │              └─────────────────┘              │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   PR Comments   │◀───│   AI Workflow    │◀───│   Service       │
│   & Reviews     │    │   Orchestration  │    │   Instances     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+** and npm/yarn
- **GitHub repository** with admin access
- **GitHub App** (we'll help you create this)
- **AI API access** (Google Gemini, Anthropic Claude, etc.)

### 1. Installation

```bash
# Clone the repository
git clone <your-repo>
cd gh-reviewer

# Install dependencies
npm install
```

### 2. GitHub App Setup

1. **Create a GitHub App**:
   - Go to [GitHub Developer Settings](https://github.com/settings/apps)
   - Click "New GitHub App"
   - Fill in basic information:
     - **App name**: `ai-code-reviewer` (or your preferred name)
     - **Homepage URL**: Your app URL or repository
     - **Webhook URL**: `https://your-domain.com/webhook` (use ngrok for local dev)

2. **Set Permissions**:
   ```
   Repository Permissions:
   ✅ Contents: Read
   ✅ Issues: Write  
   ✅ Metadata: Read
   ✅ Pull requests: Write
   
   Subscribe to Events:
   ✅ Pull request
   ✅ Issue comment
   ✅ Pull request review comment
   ✅ Installation
   ✅ Installation repositories
   ```

3. **Generate Keys**:
   - **App ID**: Note this number
   - **Private Key**: Generate and download the `.pem` file
   - **Webhook Secret**: Generate a secure random string

### 3. Environment Configuration

Create a `.env` file in your project root:

```env
# GitHub App Configuration (Required)
GITHUB_APP_ID=123456
GITHUB_PRIVATE_KEY_PATH=./path/to/your-app-private-key.pem
GITHUB_WEBHOOK_SECRET=your-webhook-secret-here
GITHUB_APP_NAME=ai-code-reviewer

# AI Configuration (Choose one)
# Google Gemini
GEMINI_API_KEY=your-gemini-api-key

# Anthropic Claude
ANTHROPIC_API_KEY=your-anthropic-api-key

# Server Configuration
PORT=3000
NODE_ENV=development
```

### 4. Install Your GitHub App

1. Go to your GitHub App settings
2. Click "Install App"
3. Select repositories to install on
4. The app will start receiving webhooks immediately

### 5. Run the Application

```bash
# Development mode with auto-reload
npm run dev

# You should see:
# 🔍 Debugging Environment Variables:
# { GITHUB_APP_ID: '✅ SET', GITHUB_PRIVATE_KEY_PATH: '✅ SET', ... }
# ✅ All required environment variables are set!
# 🚀 AI Code Reviewer server is running on port 3000
```

## 🎯 Usage

### Automatic PR Reviews

The bot automatically triggers on:

- **PR opened** → Full comprehensive review
- **PR updated** (new commits) → Incremental review of changes  
- **Draft → Ready for review** → Full review when ready
- **PR reopened** → Re-triggers full review

**Example Review Output:**
```markdown
👋 **AI Code Review Started**

📊 **PR Analysis:**
- **3** files changed (+127/-45)
- **2** files being reviewed

🤖 **Review Focus:**
- 🔒 Security & vulnerabilities
- ⚡ Performance & bottlenecks  
- 🎯 Logic bugs & code quality

💬 **Interactive Help:** 
Mention me with @ai-code-reviewer + your question for targeted analysis!

---

## 🔍 **Detailed Review**

### 🔒 **Security Analysis**
- No critical security issues found
- Consider input validation on line 42

### ⚡ **Performance Review**  
- Memory usage could be optimized in `processData()` function
- Consider caching expensive calculations

### 🎯 **Code Quality**
- Good separation of concerns
- Minor: Consider extracting magic numbers to constants
```

### Interactive Commands

Tag the bot in comments for targeted help:

```
@ai-code-reviewer help
@ai-code-reviewer review  
@ai-code-reviewer explain this function
@ai-code-reviewer suggest improvements for performance
@ai-code-reviewer security review this authentication logic
@ai-code-reviewer refactor suggestions
```

## 🔧 Development

### Local Development Setup

1. **Install ngrok for webhook testing**:
```bash
npm install -g ngrok
ngrok http 3000
# Use the ngrok URL in your GitHub App webhook settings
```

2. **Environment Variables**:
```bash
# Copy example environment file
cp .env.example .env
# Edit with your actual values
```

3. **Development Commands**:
```bash
npm run dev          # Development with hot reload
npm run build        # Build for production  
npm start           # Run production build
npm run lint        # Run ESLint
npm run lint:fix    # Fix linting issues
npm run type-check  # TypeScript type checking
```

### Code Organization Principles

Our architecture follows **Clean Architecture** and **SOLID principles**:

- **`services/config/`** - Environment and configuration management
- **`services/github/`** - GitHub API interactions and service factory
- **`services/webhook/`** - Webhook processing orchestration
- **`controllers/`** - HTTP request/response handling only
- **`workflows/`** - AI workflow orchestration and business logic
- **`routes/`** - Express routing definitions

### Adding New Features

```typescript
// Example: Adding a new service
// 1. Create in appropriate domain folder
src/services/your-domain/YourService.ts

// 2. Add to domain index
src/services/your-domain/index.ts

// 3. Export from main services
src/services/index.ts

// 4. Use clean imports
import { YourService } from '../services';
```

## 🚀 Deployment

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy built application  
COPY dist ./dist

# Copy private key (secure method)
COPY github-app-private-key.pem ./

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

### Environment Variables for Production

```env
NODE_ENV=production
PORT=3000

# GitHub App (Required)
GITHUB_APP_ID=your_app_id
GITHUB_PRIVATE_KEY_PATH=/app/github-app-private-key.pem
GITHUB_WEBHOOK_SECRET=your_webhook_secret
GITHUB_APP_NAME=ai-code-reviewer

# AI API Keys (At least one required)
GEMINI_API_KEY=your_gemini_key
ANTHROPIC_API_KEY=your_anthropic_key
```

### Platform Deployment

- **Railway**: Connect GitHub repo, add environment variables
- **Render**: Connect GitHub repo, configure build command: `npm run build`
- **Heroku**: Use included `Procfile`, configure environment variables
- **AWS/GCP**: Use Docker container with secure key management

## 🔒 Security & Best Practices

### Security Features

- ✅ **GitHub App Authentication** - More secure than personal tokens
- ✅ **Webhook Signature Verification** - Prevents unauthorized requests
- ✅ **Environment Variable Validation** - Fails fast on misconfiguration
- ✅ **No Code Storage** - Code analyzed in real-time, never stored
- ✅ **Per-Installation Isolation** - Each installation gets dedicated services

### Production Checklist

- [ ] GitHub App properly configured with minimal permissions
- [ ] Webhook secret is cryptographically secure (32+ chars)
- [ ] Private key file permissions are restricted (600)
- [ ] All environment variables are set in production
- [ ] HTTPS is enabled for webhook endpoint
- [ ] Error monitoring and logging configured

## 🛠️ Troubleshooting

### Common Issues

1. **Environment Variables Not Loading**:
```bash
# Check if .env file exists
ls -la .env

# Verify environment variables are set
npm run dev
# Look for: 🔍 Debugging Environment Variables:
```

2. **GitHub App Authentication Failed**:
```bash
# Verify App ID and private key path
# Check GitHub App installation status
# Ensure webhook URL is accessible
```

3. **Webhooks Not Received**:
```bash
# Verify webhook URL in GitHub App settings
# Check if ngrok is running (for local dev)
# Review GitHub webhook delivery logs
```

### Debug Mode

Enable debug logging:
```env
NODE_ENV=development
DEBUG=true
```

This will show detailed logs for:
- Environment variable loading
- GitHub service initialization  
- Webhook signature verification
- AI workflow execution

## 🤝 Contributing

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Follow** our code organization principles
4. **Add** tests for new functionality
5. **Ensure** all tests pass: `npm test`
6. **Submit** a pull request

### Code Standards

- Use **TypeScript** with strict mode
- Follow **Clean Architecture** patterns
- Implement **proper error handling**
- Add **JSDoc comments** for public methods
- Use **meaningful variable names**

## 📝 License

This project is licensed under the ISC License - see the LICENSE file for details.

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/your-repo/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-repo/discussions)
- **Documentation**: Check the `/docs` folder for detailed guides

---

**🚀 Ready to get started?** Follow the Quick Start guide above and have your AI code reviewer running in minutes!
