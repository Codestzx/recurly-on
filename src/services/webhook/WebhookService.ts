import { Request } from 'express';
import {
  GitHubService,
  WebhookEvent,
  GitHubServiceFactory,
  GitHubServiceInstances,
} from '../github';
import { ConfigurationManager } from '../config';

export interface WebhookProcessingResult {
  message: string;
  event: string;
  action: string;
  timestamp: string;
}

/**
 * Orchestrates webhook processing with proper separation of concerns
 * Acts as application service layer
 * Only supports GitHub App authentication
 */
export class WebhookService {
  private static instance: WebhookService;
  private readonly configManager: ConfigurationManager;
  private readonly serviceFactory: GitHubServiceFactory;
  private currentServices?: GitHubServiceInstances;
  private currentInstallationId?: number;
  private isInitialized = false;

  private constructor() {
    this.configManager = ConfigurationManager.getInstance();
    this.serviceFactory = GitHubServiceFactory.getInstance();
  }

  /**
   * Singleton pattern for service instance
   */
  public static getInstance(): WebhookService {
    if (!WebhookService.instance) {
      WebhookService.instance = new WebhookService();
    }
    return WebhookService.instance;
  }

  /**
   * Ensure services are initialized (called once per application lifecycle)
   */
  public async ensureInitialized(req: Request): Promise<void> {
    const installationId = req.body?.installation?.id;

    if (!installationId) {
      throw new Error(
        'GitHub App installation ID is required in webhook payload'
      );
    }

    // Check if we already have services for this installation
    if (
      this.isInitialized &&
      this.currentInstallationId === installationId &&
      this.currentServices
    ) {
      return;
    }

    const result =
      await this.serviceFactory.getServiceInstances(installationId);

    if (!result.success || !result.instances) {
      throw result.error || new Error('Failed to initialize GitHub services');
    }

    this.currentServices = result.instances;
    this.currentInstallationId = installationId;
    this.isInitialized = true;

    console.log(
      '✅ WebhookService initialized successfully for installation:',
      installationId
    );
  }

  /**
   * Verify webhook signature
   */
  public async verifySignature(req: Request): Promise<boolean> {
    if (!this.currentServices) {
      throw new Error('Services not initialized');
    }

    const signature = req.headers['x-hub-signature-256'] as string;
    if (!signature) {
      return true; // No signature to verify
    }

    const payload = JSON.stringify(req.body);
    return this.currentServices.githubService.verifyWebhookSignature(
      payload,
      signature
    );
  }

  /**
   * Process webhook event
   */
  public async processWebhook(req: Request): Promise<WebhookProcessingResult> {
    if (!this.currentServices) {
      throw new Error('Services not initialized');
    }

    const { githubService, reviewService, assistantService } =
      this.currentServices;
    const event = githubService.parseWebhookEvent(req.headers, req.body);

    if (!event) {
      throw new Error('Failed to parse webhook event');
    }

    const githubEvent = req.headers['x-github-event'] as string;

    // Handle special events
    if (githubEvent === 'ping') {
      return this.handlePingEvent(req.body);
    }

    // Handle installation events
    if (
      githubEvent === 'installation' ||
      githubEvent === 'installation_repositories'
    ) {
      await this.handleInstallationEvents(event, req.body);
      return {
        message: `${githubEvent} event processed successfully`,
        event: githubEvent,
        action: event.action,
        timestamp: new Date().toISOString(),
      };
    }

    // Validate repository information for other events
    if (!event.repository) {
      throw new Error('Webhook event missing repository information');
    }

    // Process main webhook events
    await this.routeEventToHandler(event, githubEvent, {
      reviewService,
      assistantService,
      githubService,
    });

    return {
      message: 'Webhook processed successfully',
      event: githubEvent,
      action: event.action,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Route event to appropriate handler
   */
  private async routeEventToHandler(
    event: WebhookEvent,
    eventType: string,
    services: Pick<
      GitHubServiceInstances,
      'reviewService' | 'assistantService' | 'githubService'
    >
  ): Promise<void> {
    console.log('Processing webhook event', {
      action: event.action,
      repository: event.repository?.full_name,
      number: event.number,
      event: eventType,
    });

    switch (eventType) {
      case 'pull_request':
        await this.handlePullRequestEvent(event, services);
        break;
      case 'issue_comment':
        await this.handleIssueCommentEvent(event, services);
        break;
      case 'pull_request_review_comment':
        await this.handleReviewCommentEvent(event, services);
        break;
      case 'push':
        await this.handlePushEvent(event);
        break;
      default:
        console.log('Unhandled event type', { eventType });
    }
  }

  /**
   * Handle ping events
   */
  private handlePingEvent(body: any): WebhookProcessingResult {
    console.log('✅ GitHub webhook ping received - connection successful!', {
      zen: body.zen,
      hook_id: body.hook_id,
    });

    return {
      message: 'Pong! 🏓 AI Code Reviewer webhook is active',
      event: 'ping',
      action: 'ping',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Handle installation events
   */
  private async handleInstallationEvents(
    event: WebhookEvent,
    body: any
  ): Promise<void> {
    const { action } = event;
    const installation = body.installation;

    console.log('🔧 GitHub App Installation Event', {
      action,
      installationId: installation?.id,
      accountLogin: installation?.account?.login,
    });

    // Clear cache when installation changes to force reinitialization
    if (action === 'deleted' || action === 'suspend') {
      this.serviceFactory.clearCache();
      this.isInitialized = false;
      this.currentServices = undefined;
      this.currentInstallationId = undefined;
    }
  }

  /**
   * Handle pull request events
   */
  private async handlePullRequestEvent(
    event: WebhookEvent,
    services: Pick<
      GitHubServiceInstances,
      'reviewService' | 'assistantService' | 'githubService'
    >
  ): Promise<void> {
    const { action, pull_request, repository } = event;

    if (!pull_request || !repository) {
      console.warn('Missing pull_request or repository data');
      return;
    }

    const owner = repository.owner.login;
    const repo = repository.name;
    const prNumber = pull_request.number;

    console.log('Handling pull request event', {
      action,
      owner,
      repo,
      prNumber,
      title: pull_request.title,
    });

    switch (action) {
      case 'opened':
      case 'ready_for_review':
        await this.handlePRReview(owner, repo, prNumber, services);
        break;
      case 'synchronize':
        await this.handlePRUpdate(owner, repo, prNumber, services);
        break;
      case 'reopened':
        await this.handlePRReview(owner, repo, prNumber, services);
        break;
      case 'closed':
        await this.handlePRClosed(
          owner,
          repo,
          prNumber,
          pull_request.merged,
          services.githubService
        );
        break;
      default:
        console.log('Unhandled PR action', { action });
    }
  }

  /**
   * Handle issue comment events
   */
  private async handleIssueCommentEvent(
    event: WebhookEvent,
    services: Pick<GitHubServiceInstances, 'assistantService' | 'githubService'>
  ): Promise<void> {
    const { issue, comment, repository } = event;

    if (!comment || !repository || !issue?.pull_request) {
      return;
    }

    const { githubService } = services;
    const commentUser = comment.user.login;

    // Skip bot comments
    if (githubService.isCommentFromBot(commentUser)) {
      return;
    }

    // Handle bot mentions
    if (githubService.isBotMentioned(comment.body)) {
      await this.handleBotMention(
        repository.owner.login,
        repository.name,
        issue.number,
        comment.body,
        commentUser,
        services
      );
    }
  }

  /**
   * Handle review comment events
   */
  private async handleReviewCommentEvent(
    event: WebhookEvent,
    services: Pick<GitHubServiceInstances, 'assistantService' | 'githubService'>
  ): Promise<void> {
    const { comment, repository } = event;

    if (!comment || !repository) {
      return;
    }

    const { githubService } = services;
    const commentUser = comment.user.login;

    // Skip bot comments and handle mentions
    if (
      !githubService.isCommentFromBot(commentUser) &&
      githubService.isBotMentioned(comment.body)
    ) {
      await this.handleBotMention(
        repository.owner.login,
        repository.name,
        comment.pull_request_number,
        comment.body,
        commentUser,
        services
      );
    }
  }

  /**
   * Handle push events
   */
  private async handlePushEvent(event: WebhookEvent): Promise<void> {
    const { repository } = event;
    if (repository) {
      console.log('Handling push event', {
        repository: repository.full_name,
      });
    }
  }

  /**
   * Handle PR review (opened/ready for review)
   */
  private async handlePRReview(
    owner: string,
    repo: string,
    prNumber: number,
    services: Pick<GitHubServiceInstances, 'reviewService' | 'githubService'>
  ): Promise<void> {
    try {
      const { githubService, reviewService } = services;

      // Check if it's a draft PR
      const prDetails = await githubService.getPullRequest(
        owner,
        repo,
        prNumber
      );
      if (prDetails.draft) {
        console.log('Skipping draft PR', { owner, repo, prNumber });
        return;
      }

      // Start review process
      const lastMessage = await reviewService.execute(owner, repo, prNumber);

      if (lastMessage.content) {
        await githubService.createPRComment(
          owner,
          repo,
          prNumber,
          typeof lastMessage.content === 'string'
            ? lastMessage.content
            : JSON.stringify(lastMessage.content)
        );
      }
    } catch (error) {
      console.error('PR review failed:', error);
    }
  }

  /**
   * Handle PR update (synchronize)
   */
  private async handlePRUpdate(
    owner: string,
    repo: string,
    prNumber: number,
    services: Pick<GitHubServiceInstances, 'assistantService' | 'githubService'>
  ): Promise<void> {
    try {
      const { githubService, assistantService } = services;

      const files = await githubService.getPullRequestFiles(
        owner,
        repo,
        prNumber
      );
      const changedFiles = files.map(f => f.filename);

      const lastMessage = await assistantService.execute(
        owner,
        repo,
        prNumber,
        {
          type: 'push',
          changedFiles,
        }
      );

      if (lastMessage.content) {
        await githubService.createPRComment(
          owner,
          repo,
          prNumber,
          lastMessage.content as string
        );
      }
    } catch (error) {
      console.error('PR update review failed:', error);
    }
  }

  /**
   * Handle PR closed
   */
  private async handlePRClosed(
    owner: string,
    repo: string,
    prNumber: number,
    merged: boolean,
    githubService: GitHubService
  ): Promise<void> {
    if (merged) {
      await githubService.createPRComment(
        owner,
        repo,
        prNumber,
        '🎉 **PR Merged!** Thanks for the great code contribution!'
      );
    }
  }

  /**
   * Handle bot mentions
   */
  private async handleBotMention(
    owner: string,
    repo: string,
    prNumber: number,
    commentBody: string,
    user: string,
    services: Pick<GitHubServiceInstances, 'assistantService' | 'githubService'>
  ): Promise<void> {
    try {
      const { githubService, assistantService } = services;
      const userMessage = githubService.extractCommand(commentBody);

      if (!userMessage) {
        await githubService.createPRComment(
          owner,
          repo,
          prNumber,
          `👋 Hi @${user}! I'm here to help with code reviews. Ask me anything about this PR!`
        );
        return;
      }

      const lastMessage = await assistantService.handleBotCommand(
        owner,
        repo,
        prNumber,
        userMessage,
        user
      );

      if (lastMessage.content) {
        await githubService.createPRComment(
          owner,
          repo,
          prNumber,
          lastMessage.content as string
        );
      }
    } catch (error) {
      console.error('Bot mention handling failed:', error);
    }
  }
}
