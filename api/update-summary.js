import { Octokit } from '@octokit/rest';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { updatedContent } = req.body;

    if (!updatedContent) {
      res.status(400).json({ error: 'Updated content is required' });
      return;
    }

    // Validate required environment variables
    if (!process.env.GITHUB_TOKEN) {
      res.status(500).json({ error: 'GITHUB_TOKEN environment variable is required' });
      return;
    }

    const REPO_OWNER = process.env.REPO_OWNER || 'zanynik';
    const REPO_NAME = process.env.REPO_NAME || 'collabai';
    const FILE_PATH = 'public/info.md';
    const COMMIT_MESSAGE = 'update summary';

    // Initialize Octokit with GitHub token
    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });

    console.log('Starting summary update process...');
    
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
    const contentEncoded = Buffer.from(updatedContent).toString('base64');
    
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
    
    res.status(200).json({
      success: true,
      commitSha: result.commit.sha,
      commitUrl: result.commit.html_url,
    });
    
  } catch (error) {
    console.error('Error updating summary:', error.message);
    res.status(500).json({ 
      error: 'Failed to update summary',
      details: error.message 
    });
  }
}