import { Router } from 'express';
import { whatsappController } from '../controllers/whatsapp.controller';
import { orderController } from '../controllers/order.controller';
import { chatController } from '../controllers/chat.controller';

const router = Router();

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    service: 'WhatsApp E-commerce SaaS Morocco (COD Engine)',
    timestamp: new Date().toISOString(),
  });
});

// WhatsApp Meta Webhooks
router.get('/webhook/whatsapp', (req, res) => whatsappController.verifyWebhook(req, res));
router.post('/webhook/whatsapp', (req, res) => whatsappController.handleWebhook(req, res));

// E-commerce Webhooks (YouCan, Shopify, Custom)
router.post('/api/orders/youcan/:tenantId', (req, res) => orderController.handleYouCanWebhook(req, res));
router.post('/api/orders/manual', (req, res) => orderController.handleManualOrder(req, res));

// Moteur de Chat IA en direct
router.post('/api/chat/message', (req, res) => chatController.handleIncomingChatMessage(req, res));

// Dashboard Marchand API
router.get('/api/orders/:tenantId', (req, res) => orderController.getTenantOrders(req, res));
router.get('/api/analytics/:tenantId', (req, res) => orderController.getAnalytics(req, res));

export default router;
