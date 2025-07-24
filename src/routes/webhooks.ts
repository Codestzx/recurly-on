import express, { Router } from 'express';
import { WebhookController } from '../controllers/webhook-controller';

const router: Router = express.Router();

// Initialize controller
const webhookController = new WebhookController();

// Middleware for webhook validation and initialization
router.use(webhookController.validateAndInitialize.bind(webhookController));

// Main webhook endpoint
router.post('/', webhookController.handleWebhook.bind(webhookController));

export default router;
