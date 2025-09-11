# My AI Site

A minimal 2-page AI chat site with automated GitHub integration for community summaries.

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

#### For Local Development:
Set environment variables:

```bash
export GITHUB_TOKEN="your_github_token_here"
export REPO_OWNER="your-github-username" 
export REPO_NAME="your-repository-name"
export OPENAI_API_KEY="your_openai_api_key_here"
```

#### For Vercel Deployment:
Set these environment variables in your Vercel dashboard:

- `GITHUB_TOKEN`: Your GitHub personal access token
- `REPO_OWNER`: Your GitHub username (e.g., "zanynik")
- `REPO_NAME`: Your repository name (e.g., "collabai")  
- `OPENAI_API_KEY`: Your OpenAI API key

**To get a GitHub token:**
1. Go to GitHub Settings > Developer settings > Personal access tokens
2. Generate a new token with `repo` permissions
3. Copy and use the token in the environment variable above

**To get an OpenAI API key:**
1. Go to https://platform.openai.com/api-keys
2. Create a new secret key
3. Copy and use the key in the environment variable above

### 3. Usage

#### Manual Summary Update
Call the update script with a new summary:

```bash
node updateSummary.js "Your new summary content here"
```

#### Using npm script
```bash
npm run update
```

#### Mock Update (for testing)
Run without arguments to test with mock data:

```bash
node updateSummary.js
```

## File Structure

```
my-ai-site/
├── api/
│   └── update-summary.js  # Vercel serverless function for GitHub updates
├── public/
│   ├── index.html      # Chat interface with real OpenAI integration
│   └── info.md         # Community summary page (auto-updated)
├── updateSummary.js    # GitHub integration script (for local use)
├── package.json        # Dependencies: @octokit/rest, openai
├── vercel.json         # Vercel deployment configuration
└── README.md          # This file
```

## How It Works

1. **Real AI Chat**: `public/index.html` uses OpenAI API for real chat conversations
2. **Smart Summarization**: Chat conversations are summarized using OpenAI and combined with existing summaries
3. **GitHub Integration**: `api/update-summary.js` serverless function updates `public/info.md` on GitHub
4. **Auto-Deploy**: Changes pushed to GitHub trigger automatic Vercel redeployment

## Features

- ✅ Real OpenAI chat integration
- ✅ Intelligent chat summarization
- ✅ Incremental summary updates (doesn't overwrite, but combines intelligently)
- ✅ Automatic GitHub commits and deployment
- ✅ Serverless architecture (no database needed)
- ✅ CORS-enabled API endpoints

## Next Steps

- Set up environment variables in Vercel dashboard
- Test the full flow: chat → summarize → GitHub update → redeploy
- Consider adding authentication for production use

## Requirements

- Node.js 14.0.0 or higher
- GitHub personal access token with repo permissions