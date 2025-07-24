import { GitHubService } from './GitHubService';
import { InitialCodeReviewService } from '../../workflows/code-reviewer-worflow';
import { InteractivePRAssistant } from '../../workflows/interactive-pr-assistant-workflow';
import { ConfigurationManager, GitHubConfiguration } from '../config';

export interface GitHubServiceInstances {
  readonly githubService: GitHubService;
  readonly reviewService: InitialCodeReviewService;
  readonly assistantService: InteractivePRAssistant;
}

export interface ServiceInitializationResult {
  readonly success: boolean;
  readonly instances?: GitHubServiceInstances;
  readonly error?: Error;
}

/**
 * Factory for creating and managing GitHub service instances
 * Implements proper lifecycle management and caching
 * Only supports GitHub App authentication
 */
export class GitHubServiceFactory {
  private static instance: GitHubServiceFactory;
  private serviceInstances: Map<string, GitHubServiceInstances> = new Map();
  private readonly configManager: ConfigurationManager;

  private constructor() {
    this.configManager = ConfigurationManager.getInstance();
  }

  /**
   * Singleton pattern for factory instance
   */
  public static getInstance(): GitHubServiceFactory {
    if (!GitHubServiceFactory.instance) {
      GitHubServiceFactory.instance = new GitHubServiceFactory();
    }
    return GitHubServiceFactory.instance;
  }

  /**
   * Get or create service instances for the given installation
   * Uses caching to avoid recreating services unnecessarily
   */
  public async getServiceInstances(
    installationId: number
  ): Promise<ServiceInitializationResult> {
    try {
      const config = this.configManager.getConfiguration();
      const cacheKey = this.generateCacheKey(installationId);

      // Return cached instances if available
      const cached = this.serviceInstances.get(cacheKey);
      if (cached) {
        return { success: true, instances: cached };
      }

      // Create new instances
      const instances = await this.createServiceInstances(
        config,
        installationId
      );

      // Cache the instances
      this.serviceInstances.set(cacheKey, instances);

      return { success: true, instances };
    } catch (error) {
      console.error('❌ Failed to create GitHub service instances:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error
            : new Error('Unknown service creation error'),
      };
    }
  }

  /**
   * Clear cached service instances (useful for testing or configuration changes)
   */
  public clearCache(): void {
    this.serviceInstances.clear();
  }

  /**
   * Check if services are initialized for given installation
   */
  public hasServiceInstances(installationId: number): boolean {
    const cacheKey = this.generateCacheKey(installationId);
    return this.serviceInstances.has(cacheKey);
  }

  /**
   * Create new service instances based on configuration
   */
  private async createServiceInstances(
    config: GitHubConfiguration,
    installationId: number
  ): Promise<GitHubServiceInstances> {
    console.log(
      '🔧 Creating GitHub App service for installation:',
      installationId
    );

    // Create GitHub App service
    const githubService = GitHubService.withApp(
      config.appId,
      config.privateKeyPath,
      installationId,
      config.webhookSecret
    );

    // Create dependent services
    const reviewService = new InitialCodeReviewService(githubService);
    const assistantService = new InteractivePRAssistant(githubService);

    console.log('✅ GitHub services created successfully', {
      botUsername: githubService.getBotUsername(),
      installationId,
      authType: 'app',
    });

    return {
      githubService,
      reviewService,
      assistantService,
    };
  }

  /**
   * Generate cache key for service instances
   */
  private generateCacheKey(installationId: number): string {
    return `app-${installationId}`;
  }
}
