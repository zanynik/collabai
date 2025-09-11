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
    const { newContentHtml } = req.body;

    if (!newContentHtml) {
      res.status(400).json({ error: 'New content HTML is required' });
      return;
    }

    // Validate required environment variables
    if (!process.env.GITHUB_TOKEN) {
      res.status(500).json({ error: 'GITHUB_TOKEN environment variable is required' });
      return;
    }

    const REPO_OWNER = process.env.REPO_OWNER || 'zanynik';
    const REPO_NAME = process.env.REPO_NAME || 'collabai';
    const FILE_PATH = 'public/info.html';
    const COMMIT_MESSAGE = 'update summary';

    // Initialize Octokit with GitHub token
    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });

    console.log('Starting HTML summary update process...');
    
    // Get current file content
    let currentFileContent;
    let currentSha;
    try {
      const { data: currentFile } = await octokit.rest.repos.getContent({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path: FILE_PATH,
      });
      currentSha = currentFile.sha;
      currentFileContent = Buffer.from(currentFile.content, 'base64').toString();
      console.log('Found existing file, SHA:', currentSha);
    } catch (error) {
      if (error.status === 404) {
        res.status(404).json({ error: 'HTML file not found' });
        return;
      } else {
        throw error;
      }
    }
    
    // Replace the content inside the content div
    const contentRegex = /<div id="content">([\s\S]*?)<\/div>/;
    const updatedFileContent = currentFileContent.replace(
      contentRegex,
      `<div id="content">\n            ${newContentHtml}\n        </div>`
    );
    
    // Encode content to base64
    const contentEncoded = Buffer.from(updatedFileContent).toString('base64');
    
    // Update the file
    const updateParams = {
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: FILE_PATH,
      message: COMMIT_MESSAGE,
      content: contentEncoded,
      sha: currentSha,
    };
    
    const { data: result } = await octokit.rest.repos.createOrUpdateFileContents(updateParams);
    
    console.log('Successfully updated HTML summary!');
    console.log('Commit SHA:', result.commit.sha);
    console.log('Commit URL:', result.commit.html_url);
    
    res.status(200).json({
      success: true,
      commitSha: result.commit.sha,
      commitUrl: result.commit.html_url,
    });
    
  } catch (error) {
    console.error('Error updating HTML summary:', error.message);
    res.status(500).json({ 
      error: 'Failed to update HTML summary',
      details: error.message 
    });
  }
}