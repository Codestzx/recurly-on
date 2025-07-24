# AI Code Reviewer 🤖

An intelligent GitHub integration that automatically reviews pull requests using Google's Gemini AI. This bot acts as a virtual team member that can provide code reviews, answer questions, and maintain code quality standards across your repositories.

## 🌟 Features

### Automatic PR Review

- **Instant Analysis**: Automatically reviews every new pull request
- **Code Quality Assessment**: Identifies potential bugs, security issues, and code smells
- **Best Practices**: Suggests improvements following industry standards
- **Diff Analysis**: Focuses review on actual code changes

### Interactive Bot Functionality

- **Tag to Ask**: Use `@ai-reviewer` to ask specific questions about code
- **Context-Aware**: Understands the full codebase context
- **Real-time Responses**: Get instant answers to code-related questions
- **Multi-language Support**: Works with TypeScript, JavaScript, Python, and more

### Powered by Gemini AI

- **Advanced Understanding**: Leverages Google's Gemini for deep code comprehension
- **Natural Language**: Provides human-like explanations and suggestions
- **Learning Capability**: Adapts to your team's coding patterns and preferences

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   GitHub        │    │   AI Reviewer    │    │   Gemini AI     │
│   Webhooks      │───▶│   Service        │───▶│   API           │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌────────▼────────┐              │
         │              │  Code Analysis  │              │
         │              │  & Review Gen   │              │
         │              └─────────────────┘              │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   PR Comments   │◀───│   Response       │◀───│   AI Response   │
│   & Reviews     │    │   Handler        │    │   Processing    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm/yarn
- GitHub repository with admin access
- Google Cloud Platform account with Gemini API access
- ngrok or similar tool for local development (optional)

### Installation

1. **Clone and setup the project:**

```bash
git clone <your-repo>
cd gh-reviewer
npm install
```

2. **Install dependencies:**

```bash
npm install @octokit/rest @google/generative-ai express dotenv
npm install -D @types/node @types/express typescript ts-node nodemon
```

3. **Environment Configuration:**
   Create a `.env` file:

```env
# GitHub Configuration
GITHUB_TOKEN=your_github_personal_access_token
GITHUB_WEBHOOK_SECRET=your_webhook_secret
GITHUB_APP_ID=your_github_app_id (optional)
GITHUB_PRIVATE_KEY=path_to_private_key.pem (optional)

# Gemini AI Configuration
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-1.5-pro

# Server Configuration
PORT=3000
NODE_ENV=development

# Review Configuration
MAX_FILE_SIZE=50000
EXCLUDED_FILES=package-lock.json,yarn.lock,*.min.js
REVIEW_LANGUAGE=english
```

## ⚙️ Configuration

### GitHub Setup

1. **Create a GitHub App** (Recommended):

   - Go to GitHub Settings > Developer settings > GitHub Apps
   - Create a new GitHub App with these permissions:
     - Repository permissions:
       - Contents: Read
       - Issues: Write
       - Metadata: Read
       - Pull requests: Write
     - Subscribe to events:
       - Pull request
       - Issue comment
       - Pull request review comment

2. **Or use Personal Access Token**:

   - Create a token with `repo` and `write:discussion` scopes

3. **Setup Webhook**:
   - URL: `https://your-domain.com/webhook`
   - Content type: `application/json`
   - Events: Pull requests, Issue comments

### Gemini AI Setup

1. **Get API Key**:

   - Go to [Google AI Studio](https://aistudio.google.com/)
   - Create a new API key
   - Add it to your `.env` file

2. **Configure Model**:
   - Default: `gemini-1.5-pro` (recommended)
   - Alternative: `gemini-1.5-flash` (faster, lower cost)

## 🎯 Usage

### Automatic PR Reviews

Once configured, the bot will automatically:

1. **Trigger on PR Creation/Update**
2. **Analyze Code Changes**
3. **Generate Review Comments**
4. **Post Feedback** directly on the PR

Example review comment:

````
🤖 AI Code Review

**Security Issue Found:**
Line 15: Potential SQL injection vulnerability. Consider using parameterized queries.

**Suggestion:**
```typescript
// Instead of:
const query = `SELECT * FROM users WHERE id = ${userId}`;

// Use:
const query = 'SELECT * FROM users WHERE id = ?';
const result = await db.query(query, [userId]);
````

**Performance Improvement:**
Consider adding memoization to the `calculateExpensiveValue` function to avoid redundant calculations.

```

### Interactive Commands

Tag the bot in PR comments to ask questions:

```

@ai-reviewer explain this regex pattern on line 42
@ai-reviewer suggest better error handling for this function
@ai-reviewer is this the best approach for handling async operations?
@ai-reviewer security review this authentication logic

````

### Custom Review Prompts

Create `.ai-reviewer.yml` in your repository root:

```yaml
review:
  focus:
    - security
    - performance
    - maintainability
  exclude_files:
    - "*.test.ts"
    - "migrations/*"
  custom_rules:
    - "Check for proper TypeScript types"
    - "Ensure all functions have JSDoc comments"
    - "Verify error handling patterns"

prompts:
  security: "Focus specifically on security vulnerabilities and best practices"
  performance: "Analyze for performance bottlenecks and optimization opportunities"
````

## 🔧 Development

### Project Structure

```
gh-reviewer/
├── src/
│   ├── index.ts              # Main server entry point
│   ├── services/
│   │   ├── github.ts         # GitHub API interactions
│   │   ├── gemini.ts         # Gemini AI integration
│   │   └── reviewer.ts       # Core review logic
│   ├── handlers/
│   │   ├── webhook.ts        # GitHub webhook handler
│   │   └── commands.ts       # Interactive command handler
│   ├── utils/
│   │   ├── parser.ts         # Code parsing utilities
│   │   └── formatter.ts      # Response formatting
│   └── types/
│       └── index.ts          # TypeScript type definitions
├── config/
│   └── prompts.ts           # AI prompts and templates
├── tests/
└── docs/
```

### Running Locally

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm run build
npm start

# Run tests
npm test
```

### Testing Webhooks Locally

```bash
# Install ngrok
npm install -g ngrok

# Expose local server
ngrok http 3000

# Use the ngrok URL in your GitHub webhook configuration
```

## 🚀 Deployment

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

### Environment Variables for Production

```env
NODE_ENV=production
PORT=3000
GITHUB_TOKEN=your_production_token
GEMINI_API_KEY=your_production_api_key
# ... other production configs
```

### Platform-Specific Deployment

- **Heroku**: Use the included `Procfile`
- **AWS Lambda**: Configure with serverless framework
- **Google Cloud Run**: Use the included `Dockerfile`
- **Railway/Render**: Connect directly to your GitHub repo

## 📊 Monitoring & Analytics

### Built-in Metrics

- Review response times
- API usage statistics
- Error rates and types
- User interaction patterns

### Logging

The service includes structured logging for:

- Webhook events
- AI API calls
- Review generation
- Error tracking

## 🔒 Security & Privacy

### Data Handling

- **No Code Storage**: Code is analyzed in real-time, not stored
- **Secure API Keys**: All credentials encrypted and secured
- **Privacy Compliant**: Configurable to work with private repositories
- **Audit Trail**: Complete logging of all bot actions

### Best Practices

- Regular token rotation
- Webhook signature verification
- Rate limiting implementation
- Input sanitization

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📝 License

This project is licensed under the ISC License - see the LICENSE file for details.

## 🆘 Support

- **Documentation**: Check our [wiki](link-to-wiki)
- **Issues**: Report bugs on [GitHub Issues](link-to-issues)
- **Discussions**: Join our [GitHub Discussions](link-to-discussions)

## 🗺️ Roadmap

- [ ] **Multi-LLM Support**: Add support for OpenAI GPT, Claude, etc.
- [ ] **Custom Rule Engine**: Visual rule builder for team-specific requirements
- [ ] **Integration Marketplace**: Pre-built integrations for popular frameworks
- [ ] **Analytics Dashboard**: Detailed insights into code quality trends
- [ ] **Slack/Teams Integration**: Notifications and commands via chat platforms
- [ ] **Auto-fix Suggestions**: AI-powered code fixes for common issues

---

**Built with ❤️ for developers, by developers**
