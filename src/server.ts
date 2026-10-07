import dns from 'dns';
try { dns.setDefaultResultOrder('ipv4first'); } catch (_) {}

import dotenv from 'dotenv';
dotenv.config();

import { app } from './app';

const PORT = process.env.PORT || 5000;

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`🚀 SaaS WhatsApp E-Commerce Maroc (COD Engine) démarré`);
  console.log(`📡 Port: http://localhost:${PORT}`);
  console.log(`🔗 Webhook WhatsApp Meta: http://localhost:${PORT}/webhook/whatsapp`);
  console.log(`🛒 Webhook YouCan: http://localhost:${PORT}/api/orders/youcan/:tenantId`);
  console.log(`📊 Health Check: http://localhost:${PORT}/health`);
  console.log(`=======================================================`);
});
