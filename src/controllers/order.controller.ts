import { Request, Response } from 'express';
import { orderService } from '../services/order.service';
import { parseYouCanOrder } from '../services/ecommerce/youcan.parser';
import { db } from '../database/store';

export class OrderController {
  /**
   * Webhook récepteur pour YouCan
   */
  async handleYouCanWebhook(req: Request, res: Response) {
    try {
      const tenantId = req.params.tenantId || 'tenant_maroc_demo_01';
      const parsedData = parseYouCanOrder(req.body);

      if (!parsedData.customerPhone) {
        return res.status(400).json({ error: 'Numéro de téléphone client manquant dans la commande' });
      }

      const order = await orderService.createAndTriggerOrderConfirmation({
        tenantId,
        platform: 'youcan',
        externalOrderId: parsedData.externalOrderId,
        customerName: parsedData.customerName,
        customerPhone: parsedData.customerPhone,
        city: parsedData.city,
        address: parsedData.address,
        totalPrice: parsedData.totalPrice,
        currency: parsedData.currency,
        items: parsedData.items,
      });

      return res.status(201).json({
        success: true,
        message: 'Commande YouCan reçue et message WhatsApp de confirmation déclenché',
        order,
      });
    } catch (error: any) {
      console.error('[YouCan Webhook Error]', error);
      return res.status(500).json({ error: 'Erreur lors du traitement de la commande YouCan' });
    }
  }

  /**
   * Création manuelle d'une commande (pour tests ou intégration personnalisée)
   */
  async handleManualOrder(req: Request, res: Response) {
    try {
      const { tenantId, externalOrderId, customerName, customerPhone, city, address, totalPrice, items } = req.body;

      if (!tenantId || !customerPhone || !totalPrice) {
        return res.status(400).json({ error: 'Champs obligatoires manquants (tenantId, customerPhone, totalPrice)' });
      }

      const order = await orderService.createAndTriggerOrderConfirmation({
        tenantId,
        platform: 'custom',
        externalOrderId: externalOrderId || `ORD-${Date.now()}`,
        customerName: customerName || 'Client Test',
        customerPhone,
        city: city || 'Casablanca',
        address: address || 'Centre Ville',
        totalPrice: Number(totalPrice),
        currency: 'MAD',
        items: items || [{ id: '1', title: 'Pack Test COD', quantity: 1, price: Number(totalPrice) }],
      });

      return res.status(201).json({
        success: true,
        message: 'Commande créée et WhatsApp envoyé',
        order,
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Liste des commandes d'une boutique (Dashboard)
   */
  getTenantOrders(req: Request, res: Response) {
    const tenantId = req.params.tenantId;
    const orders = db.getTenantOrders(tenantId);
    return res.json({ success: true, count: orders.length, orders });
  }

  /**
   * Métriques et statistiques du marchand
   */
  getAnalytics(req: Request, res: Response) {
    const tenantId = req.params.tenantId;
    const analytics = db.getAnalytics(tenantId);
    return res.json({ success: true, analytics });
  }
}

export const orderController = new OrderController();
