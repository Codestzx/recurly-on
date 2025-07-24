// @ts-nocheck

import { DynamicStructuredTool } from '@langchain/core/tools';
import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import crypto from 'crypto';
import z from 'zod';
import fs from 'fs';

export interface PRDetails {
  number: number;
  title: string;
  body: string | null;
  user: {
    login: string;
    avatar_url: string;
  };
  base: {
    ref: string;
    sha: string;
  };
  head: {
    ref: string;
    sha: string;
  };
  state: string;
  draft: boolean;
  mergeable: boolean | null;
  additions: number;
  deletions: number;
  changed_files: number;
}

export interface FileChange {
  filename: string;
  status: 'added' | 'removed' | 'modified' | 'renamed';
  additions: number;
  deletions: number;
  changes: number;
  blob_url: string;
  patch?: string;
  contents_url: string;
}

export interface ReviewComment {
  body: string;
  path: string;
  line?: number;
  side?: 'LEFT' | 'RIGHT';
  start_line?: number;
  start_side?: 'LEFT' | 'RIGHT';
  commit_id?: string;
}

export interface WebhookEvent {
  action: string;
  number?: number;
  pull_request?: any;
  issue?: any;
  comment?: any;
  repository: {
    name: string;
    full_name: string;
    owner: {
      login: string;
    };
  };
}

export class GitHubService {
  private octokit: Octokit;
  private webhookSecret: string;
  private botUsername?: string;

  constructor(octokit: Octokit, webhookSecret: string, botUsername?: string) {
    this.octokit = octokit;
    this.webhookSecret = webhookSecret;
    this.botUsername = botUsername;
  }

  /**
   * Create GitHub Service with GitHub App (using installation ID from webhook)
   */
  static withApp(
    appId: string,
    privateKeyPath: string,
    installationId: number,
    webhookSecret: string
  ): GitHubService {
    const privateKey = fs.readFileSync(privateKeyPath, 'utf8');

    const octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: parseInt(appId),
        privateKey,
        installationId: installationId,
      },
      userAgent: 'AI-Code-Reviewer/1.0.0',
    });

    // Bot username will be something like "ai-code-reviewer[bot]"
    const botUsername = `${process.env.GITHUB_APP_NAME || 'ai-code-reviewer'}`;

    return new GitHubService(octokit, webhookSecret, botUsername);
  }

  /**
   * Get the bot username (for GitHub Apps) or undefined (for tokens)
   */
  getBotUsername(): string | undefined {
    return this.botUsername;
  }

  /**
   * Verify GitHub webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    try {
      const expectedSignature = `sha256=${crypto
        .createHmac('sha256', this.webhookSecret)
        .update(payload, 'utf8')
        .digest('hex')}`;

      return crypto.timingSafeEqual(
        Buffer.from(signature, 'utf8'),
        Buffer.from(expectedSignature, 'utf8')
      );
    } catch (error) {
      console.error('Error verifying webhook signature:', error);
      return false;
    }
  }

  /**
   * Get pull request details
   */
  async getPullRequest(
    owner: string,
    repo: string,
    pullNumber: number
  ): Promise<PRDetails> {
    try {
      const { data } = await this.octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: pullNumber,
      });

      return {
        number: data.number,
        title: data.title,
        body: data.body,
        user: {
          login: data.user?.login || 'unknown',
          avatar_url: data.user?.avatar_url || '',
        },
        base: {
          ref: data.base.ref,
          sha: data.base.sha,
        },
        head: {
          ref: data.head.ref,
          sha: data.head.sha,
        },
        state: data.state,
        draft: data.draft || false,
        mergeable: data.mergeable,
        additions: data.additions || 0,
        deletions: data.deletions || 0,
        changed_files: data.changed_files || 0,
      };
    } catch (error) {
      console.error('Error getting pull request:', error);
      throw new Error(`Failed to get pull request: ${error}`);
    }
  }

  /**
   * Get files changed in a pull request
   */
  async getPullRequestFiles(
    owner: string,
    repo: string,
    pullNumber: number
  ): Promise<FileChange[]> {
    try {
      const { data } = await this.octokit.rest.pulls.listFiles({
        owner,
        repo,
        pull_number: pullNumber,
        per_page: 100, // GitHub max is 100
      });

      return data.map(file => ({
        filename: file.filename,
        status: file.status as 'added' | 'removed' | 'modified' | 'renamed',
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
        blob_url: file.blob_url,
        patch: file.patch,
        contents_url: file.contents_url,
      }));
    } catch (error) {
      console.error('Error getting PR files:', error);
      throw new Error(`Failed to get PR files: ${error}`);
    }
  }

  /**
   * Get file content from repository
   */
  async getFileContent(
    owner: string,
    repo: string,
    path: string,
    ref?: string
  ): Promise<string> {
    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref,
      });

      if ('content' in data && data.content) {
        return Buffer.from(data.content, 'base64').toString('utf8');
      }

      throw new Error('File content not found or is a directory');
    } catch (error) {
      console.error('Error getting file content:', error);
      throw new Error(`Failed to get file content: ${error}`);
    }
  }

  /**
   * Get the diff for a pull request
   */
  async getPullRequestDiff(
    owner: string,
    repo: string,
    pullNumber: number
  ): Promise<string> {
    try {
      const { data } = await this.octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: pullNumber,
        mediaType: {
          format: 'diff',
        },
      });

      return data as unknown as string;
    } catch (error) {
      console.error('Error getting PR diff:', error);
      throw new Error(`Failed to get PR diff: ${error}`);
    }
  }

  /**
   * Create a review comment on a specific line
   */
  async createReviewComment(
    owner: string,
    repo: string,
    pullNumber: number,
    comment: ReviewComment,
    commitId?: string
  ): Promise<void> {
    try {
      // Get the latest commit ID from PR head to avoid "commit_id is not part of the pull request" error
      let latestCommitId = commitId;
      if (!latestCommitId || !comment.commit_id) {
        console.log('🔍 Fetching latest commit ID for PR review comment...');
        const prDetails = await this.getPullRequest(owner, repo, pullNumber);
        latestCommitId = prDetails.head.sha;
        console.log('✅ Using latest commit ID:', latestCommitId);
      }

      await this.octokit.rest.pulls.createReviewComment({
        owner,
        repo,
        pull_number: pullNumber,
        body: comment.body,
        commit_id: comment.commit_id || latestCommitId,
        path: comment.path,
        line: comment.line,
        side: comment.side,
        start_line: comment.start_line,
        start_side: comment.start_side,
      });

      console.log('✅ Review comment created successfully', {
        owner,
        repo,
        pullNumber,
        path: comment.path,
        commitId: comment.commit_id || latestCommitId,
      });
    } catch (error) {
      console.error('Error creating review comment', {
        owner,
        repo,
        pullNumber,
        error,
      });
      throw new Error(`Failed to create review comment: ${error}`);
    }
  }

  /**
   * Create a general PR comment
   */
  async createPRComment(
    owner: string,
    repo: string,
    pullNumber: number,
    body: string
  ): Promise<void> {
    try {
      const result = await this.octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: pullNumber,
        body,
      });

      console.log('✅ PR comment created successfully', {
        owner,
        repo,
        pullNumber,
        commentId: result.data.id,
        authorLogin: result.data.user?.login,
        authorType: result.data.user?.type,
        botUsername: this.botUsername,
        isFromBot: result.data.user?.login === this.botUsername,
      });
    } catch (error) {
      console.error('Error creating PR comment', {
        owner,
        repo,
        pullNumber,
        error,
      });
      throw new Error(`Failed to create PR comment: ${error}`);
    }
  }

  /**
   * Create a full PR review with multiple comments
   */
  async createPullRequestReview(
    owner: string,
    repo: string,
    pullNumber: number,
    body: string,
    event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT' = 'COMMENT',
    comments: ReviewComment[] = []
  ): Promise<void> {
    try {
      // Format individual comments
      const reviewComments = comments.map(comment => ({
        path: comment.path,
        line: comment.line,
        body: comment.body,
        side: comment.side,
        start_line: comment.start_line,
        start_side: comment.start_side,
      }));

      await this.octokit.rest.pulls.createReview({
        owner,
        repo,
        pull_number: pullNumber,
        body,
        event,
        comments: reviewComments,
      });

      console.log('PR review created', {
        owner,
        repo,
        pullNumber,
        event,
        commentCount: comments.length,
      });
    } catch (error) {
      console.error('Error creating PR review', {
        owner,
        repo,
        pullNumber,
        error,
      });
      throw new Error(`Failed to create PR review: ${error}`);
    }
  }

  /**
   * Get existing comments on a pull request
   */
  async getPRComments(
    owner: string,
    repo: string,
    pullNumber: number
  ): Promise<any[]> {
    try {
      const { data } = await this.octokit.rest.issues.listComments({
        owner,
        repo,
        issue_number: pullNumber,
      });

      return data;
    } catch (error) {
      console.error('Error getting PR comments', {
        owner,
        repo,
        pullNumber,
        error,
      });
      throw new Error(`Failed to get PR comments: ${error}`);
    }
  }

  /**
   * Get existing review comments on a pull request
   */
  async getReviewComments(
    owner: string,
    repo: string,
    pullNumber: number
  ): Promise<any[]> {
    try {
      const { data } = await this.octokit.rest.pulls.listReviewComments({
        owner,
        repo,
        pull_number: pullNumber,
      });

      return data;
    } catch (error) {
      console.error('Error getting review comments', {
        owner,
        repo,
        pullNumber,
        error,
      });
      throw new Error(`Failed to get review comments: ${error}`);
    }
  }

  /**
   * Check if a comment is from the bot itself
   */
  isCommentFromBot(commentUser: string): boolean {
    // Check if it's the GitHub App bot
    if (this.botUsername && commentUser === this.botUsername) {
      return true;
    }

    // Check for common bot patterns
    if (
      commentUser.includes('[bot]') ||
      commentUser.includes('bot') ||
      commentUser.toLowerCase().includes('github-actions')
    ) {
      return true;
    }

    return false;
  }

  /**
   * Check if a user mentioned the bot
   */
  isBotMentioned(body: string): boolean {
    // For GitHub Apps, use the actual bot username or common patterns
    const botPatterns = [
      this.botUsername,
      this.botUsername?.replace('[bot]', ''),
      'ai-reviewer',
      'ai-code-reviewer',
    ].filter(Boolean); // Remove undefined values

    return botPatterns.some(pattern => {
      const mentionPattern = new RegExp(`@${pattern}\\b`, 'i');
      return mentionPattern.test(body);
    });
  }

  /**
   * Extract user query from mention (handles commands and natural language)
   */
  extractCommand(body: string): string | null {
    // Handle both single bot username and array of possible usernames
    const botPatterns = [
      this.botUsername, // e.g., "recurly-on[bot]"
      'ai-reviewer', // Generic mention
      'ai-code-reviewer', // App name mention
    ].filter(Boolean); // Remove undefined values

    for (const pattern of botPatterns) {
      // Match @botname followed by any text (including multiline)
      const mentionPattern = new RegExp(
        `@${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*([\\s\\S]*)`,
        'i'
      );
      const match = body.match(mentionPattern);

      if (match && match[1]) {
        // Clean up the extracted text
        const extracted = match[1]
          .trim()
          .replace(/\n\s*\n/g, '\n') // Remove excessive newlines
          .replace(/^\s+|\s+$/g, ''); // Trim whitespace

        return extracted || null;
      }
    }

    return null;
  }

  /**
   * Check if file should be excluded from review
   */
  shouldExcludeFile(filename: string, excludePatterns: string[] = []): boolean {
    const defaultExcludes = [
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml',
      '*.min.js',
      '*.min.css',
      '*.map',
      'dist/',
      'build/',
      'node_modules/',
      '.git/',
    ];

    const allPatterns = [...defaultExcludes, ...excludePatterns];

    return allPatterns.some(pattern => {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(filename);
      }
      return filename.includes(pattern);
    });
  }

  /**
   * Get repository information
   */
  async getRepository(owner: string, repo: string): Promise<any> {
    try {
      const { data } = await this.octokit.rest.repos.get({
        owner,
        repo,
      });

      return data;
    } catch (error) {
      console.error('Error getting repository', { owner, repo, error });
      throw new Error(`Failed to get repository: ${error}`);
    }
  }

  /**
   * Parse webhook payload
   */
  parseWebhookEvent(headers: any, body: any): WebhookEvent | null {
    try {
      const event = headers['x-github-event'];
      const deliveryId = headers['x-github-delivery'];

      console.log('Webhook event received', { event, deliveryId });

      return {
        action: body.action || 'unknown',
        number: body.number || body.pull_request?.number || body.issue?.number,
        pull_request: body.pull_request,
        issue: body.issue,
        comment: body.comment,
        repository: body.repository,
      };
    } catch (error) {
      console.error('Error parsing webhook event:', error);
      return null;
    }
  }

  getPullRequestTool() {
    return new DynamicStructuredTool({
      name: 'get_pull_request',
      description: 'Get pull request details',
      func: async ({
        owner,
        repo,
        pullNumber,
      }: {
        owner: string;
        repo: string;
        pullNumber: number;
      }) => {
        const result = await this.getPullRequest(owner, repo, pullNumber);
        return JSON.stringify(result);
      },
      schema: z.object({
        owner: z.string(),
        repo: z.string(),
        pullNumber: z.number(),
      }),
    });
  }

  getPullRequestFilesTool() {
    return new DynamicStructuredTool({
      name: 'get_pull_request_files',
      description: 'Get files changed in a pull request',
      func: async ({
        owner,
        repo,
        pullNumber,
      }: {
        owner: string;
        repo: string;
        pullNumber: number;
      }) => {
        const result = await this.getPullRequestFiles(owner, repo, pullNumber);
        return JSON.stringify(result);
      },
      schema: z.object({
        owner: z.string(),
        repo: z.string(),
        pullNumber: z.number(),
      }),
    });
  }

  getFileContentTool() {
    return new DynamicStructuredTool({
      name: 'get_file_content',
      description: 'Get file content from repository',
      func: async ({
        owner,
        repo,
        path,
        ref,
      }: {
        owner: string;
        repo: string;
        path: string;
        ref?: string;
      }) => {
        const result = await this.getFileContent(owner, repo, path, ref);
        return result;
      },
      schema: z.object({
        owner: z.string(),
        repo: z.string(),
        path: z.string(),
        ref: z.string().optional(),
      }),
    });
  }

  getPullRequestDiffTool() {
    return new DynamicStructuredTool({
      name: 'get_pull_request_diff',
      description: 'Get the diff for a pull request',
      func: async ({
        owner,
        repo,
        pullNumber,
      }: {
        owner: string;
        repo: string;
        pullNumber: number;
      }) => {
        const result = await this.getPullRequestDiff(owner, repo, pullNumber);
        return result;
      },
      schema: z.object({
        owner: z.string(),
        repo: z.string(),
        pullNumber: z.number(),
      }),
    });
  }

  reviewCommentTool() {
    return new DynamicStructuredTool({
      name: 'create_review_comment',
      description: 'Create a review comment on a specific line',
      func: async ({
        owner,
        repo,
        pullNumber,
        body,
        path,
        line,
        commitId,
      }: {
        owner: string;
        repo: string;
        pullNumber: number;
        body: string;
        path: string;
        line?: number;
        commitId?: string;
      }) => {
        await this.createReviewComment(
          owner,
          repo,
          pullNumber,
          { body, path, line },
          commitId
        );
        return '🤖 Review comment created successfully';
      },
      schema: z.object({
        owner: z.string(),
        repo: z.string(),
        pullNumber: z.number(),
        body: z.string(),
        path: z.string(),
        line: z.number().optional(),
        commitId: z.string().optional(),
      }),
    });
  }

  createPRCommentTool() {
    return new DynamicStructuredTool({
      name: 'create_pr_comment',
      description: 'Create a general PR comment',
      func: async ({
        owner,
        repo,
        pullNumber,
        body,
      }: {
        owner: string;
        repo: string;
        pullNumber: number;
        body: string;
      }) => {
        await this.createPRComment(owner, repo, pullNumber, body);
        return '🤖 PR comment created successfully';
      },
      schema: z.object({
        owner: z.string(),
        repo: z.string(),
        pullNumber: z.number(),
        body: z.string(),
      }),
    });
  }
}

export default GitHubService;
