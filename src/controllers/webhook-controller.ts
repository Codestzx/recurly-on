import { Request, Response } from 'express';
import { WebhookService, ConfigurationManager } from '../services';

export interface WebhookResponse {
  success: boolean;
  data?: any;
  error?: string;
  statusCode: number;
}

/**
 * HTTP Controller for webhook endpoints
 * Follows Controller pattern - only handles HTTP concerns
 * Only supports GitHub App authentication
 */
export class WebhookController {
  private readonly webhookService: WebhookService;
  private readonly configManager: ConfigurationManager;

  constructor() {
    this.webhookService = WebhookService.getInstance();
    this.configManager = ConfigurationManager.getInstance();
  }

  /**
   * Handle webhook POST requests
   * Pure HTTP handling - delegates business logic to service
   */
  public async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      // Delegate to service layer
      const result = await this.webhookService.processWebhook(req);

      // Handle successful response
      this.sendSuccessResponse(res, result);
    } catch (error) {
      // Handle error response
      this.sendErrorResponse(res, error);
    }
  }

  /**
   * Middleware for webhook validation and initialization
   */
  public async validateAndInitialize(
    req: Request,
    res: Response,
    next: Function
  ): Promise<void> {
    try {
      // Validate configuration
      this.configManager.validateConfiguration();

      // Check for installation ID in webhook payload
      const installationId = req.body?.installation?.id;
      if (!installationId && this.requiresInstallationId(req)) {
        this.sendErrorResponse(
          res,
          new Error(
            'GitHub App installation ID is required for this webhook event'
          ),
          400
        );
        return;
      }

      // Initialize services if needed
      await this.webhookService.ensureInitialized(req);

      // Verify webhook signature
      const isValidSignature = await this.webhookService.verifySignature(req);
      if (!isValidSignature) {
        this.sendErrorResponse(
          res,
          new Error('Invalid webhook signature'),
          401
        );
        return;
      }

      next();
    } catch (error) {
      this.sendErrorResponse(res, error);
    }
  }

  /**
   * Check if the webhook event requires an installation ID
   */
  private requiresInstallationId(req: Request): boolean {
    const eventType = req.headers['x-github-event'] as string;

    // Ping events don't require installation ID
    if (eventType === 'ping') {
      return false;
    }

    // Installation events have installation ID in different location
    if (
      eventType === 'installation' ||
      eventType === 'installation_repositories'
    ) {
      return false;
    }

    return true;
  }

  /**
   * Send successful HTTP response
   */
  private sendSuccessResponse(res: Response, data: any): void {
    res.status(200).json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send error HTTP response with appropriate status code
   */
  private sendErrorResponse(
    res: Response,
    error: unknown,
    statusCode?: number
  ): void {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    // Determine appropriate status code
    let status = statusCode || 500;

    if (errorMessage.includes('configuration')) {
      status = 500;
    } else if (errorMessage.includes('Failed to parse webhook')) {
      status = 400;
    } else if (errorMessage.includes('missing repository information')) {
      status = 400;
    } else if (errorMessage.includes('installation ID is required')) {
      status = 400;
    } else if (errorMessage.includes('Invalid webhook signature')) {
      status = 401;
    }

    console.error(`❌ Webhook error (${status}):`, errorMessage);

    res.status(status).json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });
  }
}
