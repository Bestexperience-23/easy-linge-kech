import { db } from '../database/store';
import { Order, OrderConfirmationStatus } from '../types';
import { whatsappService } from './whatsapp.service';

export class OrderService {
  /**
   * Normalisation des numéros de téléphone marocains vers le format international (+212...)
   */
  normalizeMoroccanPhone(phone: string): string {
    let clean = phone.replace(/[\s\-\.\(\)]/g, '');
    if (clean.startsWith('00212')) {
      clean = '+' + clean.slice(2);
    } else if (clean.startsWith('212')) {
      clean = '+' + clean;
    } else if (clean.startsWith('0')) {
      clean = '+212' + clean.slice(1);
    } else if (!clean.startsWith('+')) {
      clean = '+212' + clean;
    }
    return clean;
  }

  /**
   * Réception et traitement d'une nouvelle commande (ex: YouCan ou Shopify)
   */
  async createAndTriggerOrderConfirmation(params: {
    tenantId: string;
    externalOrderId: string;
    platform: 'youcan' | 'shopify' | 'woocommerce' | 'custom';
    customerName: string;
    customerPhone: string;
    city: string;
    address: string;
    totalPrice: number;
    currency?: string;
    items: Array<{ id: string; title: string; quantity: number; price: number }>;
  }): Promise<Order> {
    const normalizedPhone = this.normalizeMoroccanPhone(params.customerPhone);

    const order: Order = {
      id: `ord_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      tenantId: params.tenantId,
      externalOrderId: params.externalOrderId,
      platform: params.platform,
      customerName: params.customerName,
      customerPhone: normalizedPhone,
      city: params.city,
      address: params.address,
      totalPrice: params.totalPrice,
      currency: params.currency || 'MAD',
      items: params.items,
      confirmationStatus: 'PENDING',
      createdAt: new Date(),
    };

    // Sauvegarde en base de données
    db.saveOrder(order);

    console.log(`[OrderService] Nouvelle commande #${order.externalOrderId} reçue pour le tenant ${order.tenantId}. Envoi du WhatsApp interactif...`);

    // Déclenchement automatique de la confirmation WhatsApp
    await whatsappService.sendOrderConfirmationMessage(order);

    return order;
  }

  /**
   * Traitement de l'action de bouton interactif cliqué par le client
   */
  async handleButtonAction(tenantId: string, customerPhone: string, buttonPayload: string): Promise<string> {
    console.log(`[OrderService] Clic bouton reçu: ${buttonPayload} de ${customerPhone}`);

    // buttonPayload format: CONFIRM_{orderId} ou CANCEL_{orderId} ou CHANGE_ADDR_{orderId}
    const [action, ...orderIdParts] = buttonPayload.split('_');
    const orderId = orderIdParts.join('_');

    const order = db.getOrder(orderId, tenantId) || db.getLatestPendingOrderByPhone(customerPhone, tenantId);

    if (!order) {
      return `Salam ! Chokran 3la l-ijaba dialek. L-talab rahou msajjel 3ndna f le système ✅`;
    }

    if (action === 'CONFIRM') {
      order.confirmationStatus = 'CONFIRMED';
      order.confirmedAt = new Date();
      db.saveOrder(order);

      // Notification au client
      return `Chokran bzaf ${order.customerName} ! Commande dialek #${order.externalOrderId} t'akedat b najah ✅\nL-colis ghadi ykoun wajed l livrayson m3a l'livreur. Nhark mabrouk ! 🚚`;
    }

    if (action === 'CANCEL') {
      order.confirmationStatus = 'CANCELLED';
      order.cancelledAt = new Date();
      db.saveOrder(order);

      return `D'accord ${order.customerName}, la commande #${order.externalOrderId} t'anulat kima bghiti. Ila bghiti chi haja okhra marhba bik f ay wa9t ! 🙏`;
    }

    if (action === 'CHANGE' && buttonPayload.includes('ADDR')) {
      order.confirmationStatus = 'ADDRESS_CHANGE_REQUESTED';
      db.saveOrder(order);

      return `Marhba ! 3afak kteb lina hna l'adresse jdida w l'ville bach nbedlouhom lik f la commande #${order.externalOrderId} 👇`;
    }

    return `Chokran 3la tawasol dialek m3ana !`;
  }
}

export const orderService = new OrderService();
