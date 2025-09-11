# My AI Site

A minimal 2-page AI chat site with automated GitHub integration for community summaries.

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

Set your GitHub token as an environment variable:

```bash
export GITHUB_TOKEN="your_github_token_here"
export REPO_OWNER="your-github-username"
export REPO_NAME="your-repository-name"
```

**To get a GitHub token:**
1. Go to GitHub Settings > Developer settings > Personal access tokens
2. Generate a new token with `repo` permissions
3. Copy and use the token in the environment variable above

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
├── public/
│   ├── index.html      # Chat interface with mock AI responses
│   └── info.md         # Community summary page (auto-updated)
├── updateSummary.js    # GitHub integration script
├── package.json        # Dependencies and scripts
├── vercel.json         # Vercel deployment configuration
└── README.md          # This file
```

## How It Works

1. **Chat Interface**: `public/index.html` provides a simple chat UI with mock responses
2. **Summary Updates**: `updateSummary.js` uses GitHub API to update `public/info.md`
3. **Auto-Deploy**: Changes pushed to GitHub trigger automatic redeployment (configured in your hosting platform like Vercel)

## Next Steps

- Replace mock AI responses with real API calls
- Integrate the `updateSummary.js` function with the chat interface
- Deploy to Vercel or similar platform for automatic updates

## Requirements

- Node.js 14.0.0 or higher
- GitHub personal access token with repo permissions