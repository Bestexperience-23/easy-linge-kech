import { Request, Response } from 'express';
import * as XLSX from 'xlsx';
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

  /**
   * Mise à jour du statut d'une commande (Workflow Livreur)
   */
  updateOrderStatus(req: Request, res: Response) {
    const { tenantId, orderId } = req.params;
    const { status } = req.body;

    const order = db.getOrder(orderId, tenantId);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Commande non trouvée' });
    }

    order.confirmationStatus = status;
    if (status === 'CONFIRMED' && !order.confirmedAt) {
      order.confirmedAt = new Date();
    } else if (status === 'CANCELLED' && !order.cancelledAt) {
      order.cancelledAt = new Date();
    }

    db.saveOrder(order);
    console.log(`[ORDER] 🔄 Statut mis à jour pour ${orderId}: ${status}`);
    return res.json({ success: true, order });
  }

  /**
   * Exportation des commandes en fichier Excel (.xlsx)
   */
  exportOrdersExcel(req: Request, res: Response) {
    try {
      const tenantId = req.params.tenantId;
      const orders = db.getTenantOrders(tenantId);

      const rows = orders.map((o) => {
        const itemsStr = (o.items || [])
          .map((i) => `${i.quantity}x ${i.title}`)
          .join(', ');

        const statusLabels: Record<string, string> = {
          CONFIRMED: 'Confirmée',
          PREPARATION: 'En préparation atelier',
          SHIPPED: 'En cours de livraison',
          DELIVERED: 'Livrée & Payée',
          CANCELLED: 'Annulée',
          PENDING: 'En attente',
        };

        return {
          'N° Commande': o.externalOrderId || o.id,
          'Date': o.createdAt ? new Date(o.createdAt).toLocaleDateString('fr-FR') : '—',
          'Client / Établissement': o.customerName || '—',
          'Type Hébergement': o.propertyType || 'Autre',
          'Tél WhatsApp': o.customerPhone || '—',
          '2ème Tél (Contact/Livraison)': o.contactPhone || '—',
          'Articles Commandés': itemsStr || '—',
          'Ville': o.city || '—',
          'Adresse de livraison': o.address || '—',
          'Total HT (MAD)': o.totalPrice || 0,
          'Total TTC (MAD)': Math.round((o.totalPrice || 0) * 1.2),
          'Statut': statusLabels[o.confirmationStatus] || o.confirmationStatus || '—',
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Commandes Easy Linge Kech');

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Disposition', 'attachment; filename="commandes_easy_linge_kech.xlsx"');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buffer);
    } catch (err: any) {
      console.error('[EXCEL] Erreur export:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}

export const orderController = new OrderController();
