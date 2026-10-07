import { Router } from 'express';
import { whatsappController } from '../controllers/whatsapp.controller';
import { orderController } from '../controllers/order.controller';
import { chatController } from '../controllers/chat.controller';
import { authController } from '../controllers/auth.controller';

const router = Router();

// Authentification & Sécurité Administrateur
router.post('/api/auth/login', (req, res) => authController.login(req, res));
router.get('/api/auth/verify', (req, res) => authController.verify(req, res));

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
router.get('/api/chat/history/:tenantId', (req, res) => chatController.getChatHistory(req, res));
router.post('/api/chat/reset', (req, res) => chatController.resetChatSession(req, res));

// Dashboard Marchand API
router.get('/api/orders/:tenantId', (req, res) => orderController.getTenantOrders(req, res));
router.get('/api/orders/:tenantId/export', (req, res) => orderController.exportOrdersExcel(req, res));
router.patch('/api/orders/:tenantId/:orderId/status', (req, res) => orderController.updateOrderStatus(req, res));
router.get('/api/analytics/:tenantId', (req, res) => orderController.getAnalytics(req, res));

export default router;
