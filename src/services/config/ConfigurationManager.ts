import dotenv from 'dotenv';

// Ensure environment variables are loaded before we try to read them
dotenv.config();

export interface GitHubConfiguration {
  readonly webhookSecret: string;
  readonly appId: string;
  readonly privateKeyPath: string;
  readonly appName: string;
}

/**
 * Manages GitHub App configuration with validation and caching
 * Follows Single Responsibility Principle for configuration concerns
 * Only supports GitHub App authentication
 */
export class ConfigurationManager {
  private static instance: ConfigurationManager;
  private readonly config: GitHubConfiguration;

  private constructor() {
    this.config = this.loadAndValidateConfiguration();
  }

  /**
   * Singleton pattern - ensures one configuration instance
   */
  public static getInstance(): ConfigurationManager {
    if (!ConfigurationManager.instance) {
      ConfigurationManager.instance = new ConfigurationManager();
    }
    return ConfigurationManager.instance;
  }

  /**
   * Get the validated configuration
   */
  public getConfiguration(): GitHubConfiguration {
    return this.config;
  }

  /**
   * Validate that required configuration is present
   */
  public validateConfiguration(): void {
    // Configuration is already validated in constructor
    // This method exists for explicit validation calls
    if (
      !this.config.appId ||
      !this.config.privateKeyPath ||
      !this.config.webhookSecret
    ) {
      throw new Error(
        'Invalid GitHub App configuration. GITHUB_APP_ID, GITHUB_PRIVATE_KEY_PATH, and GITHUB_WEBHOOK_SECRET are required'
      );
    }
  }

  /**
   * Load and validate environment variables
   */
  private loadAndValidateConfiguration(): GitHubConfiguration {
    // Debug: Log all environment variables that start with GITHUB_
    console.log('🔍 Debugging Environment Variables:');
    const appId = process.env.GITHUB_APP_ID;
    const privateKeyPath = process.env.GITHUB_PRIVATE_KEY_PATH;
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
    const appName = process.env.GITHUB_APP_NAME || 'ai-code-reviewer';

    // Validate required GitHub App credentials
    const missingVars: string[] = [];

    if (!appId) {
      missingVars.push('GITHUB_APP_ID');
    }

    if (!privateKeyPath) {
      missingVars.push('GITHUB_PRIVATE_KEY_PATH');
    }

    if (!webhookSecret) {
      missingVars.push('GITHUB_WEBHOOK_SECRET');
    }

    if (missingVars.length > 0) {
      const errorMessage = `❌ Missing required environment variables: ${missingVars.join(', ')}`;

      throw new Error(errorMessage);
    }

    console.log('✅ All required environment variables are set!');

    return {
      appId: appId!,
      privateKeyPath: privateKeyPath!,
      webhookSecret: webhookSecret!,
      appName,
    };
  }
}
