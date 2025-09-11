const { Octokit } = require('@octokit/rest');
const fs = require('fs').promises;
const path = require('path');

// Initialize Octokit with GitHub token
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

// Configuration - update these with your repo details
const REPO_OWNER = process.env.REPO_OWNER || 'your-username';
const REPO_NAME = process.env.REPO_NAME || 'your-repo-name';
const FILE_PATH = 'public/info.md';
const COMMIT_MESSAGE = 'update summary';

/**
 * Updates the info.md file with new summary content and commits to GitHub
 * @param {string} newSummary - The new summary content to write to info.md
 */
async function updateSummary(newSummary) {
  try {
    console.log('Starting summary update process...');
    
    // Validate required environment variables
    if (!process.env.GITHUB_TOKEN) {
      throw new Error('GITHUB_TOKEN environment variable is required');
    }
    
    // Get current file SHA for update
    let currentSha;
    try {
      const { data: currentFile } = await octokit.rest.repos.getContent({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path: FILE_PATH,
      });
      currentSha = currentFile.sha;
      console.log('Found existing file, SHA:', currentSha);
    } catch (error) {
      if (error.status === 404) {
        console.log('File does not exist, creating new file');
        currentSha = null;
      } else {
        throw error;
      }
    }
    
    // Encode content to base64
    const contentEncoded = Buffer.from(newSummary).toString('base64');
    
    // Update or create the file
    const updateParams = {
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: FILE_PATH,
      message: COMMIT_MESSAGE,
      content: contentEncoded,
    };
    
    if (currentSha) {
      updateParams.sha = currentSha;
    }
    
    const { data: result } = await octokit.rest.repos.createOrUpdateFileContents(updateParams);
    
    console.log('Successfully updated summary!');
    console.log('Commit SHA:', result.commit.sha);
    console.log('Commit URL:', result.commit.html_url);
    
    return {
      success: true,
      commitSha: result.commit.sha,
      commitUrl: result.commit.html_url,
    };
    
  } catch (error) {
    console.error('Error updating summary:', error.message);
    throw error;
  }
}

/**
 * Mock function to simulate receiving a new summary
 * In a real implementation, this would be called by your chat application
 */
function mockSummaryUpdate() {
  const timestamp = new Date().toISOString();
  const mockSummary = `# Community Summary

This page contains summaries of past chats.

## Latest Update - ${timestamp}

### Recent Chat Summary
- User discussed AI capabilities and limitations
- Bot provided helpful responses about various topics
- Conversation included questions about technology and future trends

### Key Topics
- Artificial Intelligence
- Technology trends
- User assistance

---

*Last updated: ${timestamp}*
*This page is automatically updated when chat summaries are submitted.*`;

  return updateSummary(mockSummary);
}

// Export functions for use in other modules
module.exports = {
  updateSummary,
  mockSummaryUpdate,
};

// Command line usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Running mock summary update...');
    mockSummaryUpdate()
      .then(result => {
        console.log('Mock update completed successfully:', result);
        process.exit(0);
      })
      .catch(error => {
        console.error('Mock update failed:', error.message);
        process.exit(1);
      });
  } else {
    const newSummary = args.join(' ');
    console.log('Updating summary with provided content...');
    updateSummary(newSummary)
      .then(result => {
        console.log('Update completed successfully:', result);
        process.exit(0);
      })
      .catch(error => {
        console.error('Update failed:', error.message);
        process.exit(1);
      });
  }
}