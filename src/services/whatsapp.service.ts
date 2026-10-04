import axios from 'axios';
import { db } from '../database/store';
import { Order } from '../types';

export class WhatsAppService {
  private graphUrl = process.env.META_GRAPH_URL || 'https://graph.facebook.com/v21.0';

  /**
   * Envoie le message interactif avec boutons de confirmation COD
   */
  async sendOrderConfirmationMessage(order: Order): Promise<boolean> {
    const config = db.getWhatsAppConfig(order.tenantId);
    if (!config) {
      console.error(`[WhatsApp] Configuration manquante pour le tenant ${order.tenantId}`);
      return false;
    }

    const itemsSummary = order.items
      .map((item) => `• ${item.quantity}x ${item.title} (${item.price * item.quantity} ${order.currency})`)
      .join('\n');

    // Message bilingue Darija / Français parfaitement adapté au e-commerce marocain
    const messageBody = 
`Salam ${order.customerName} 👋
Chokran 3la talab dialek men 3end *Casablanca Fashion Store* !

📦 *Détails dial la commande:*
${itemsSummary}

💰 *Le total (COD - Khalas 3nd l'istilam):* ${order.totalPrice} ${order.currency}
📍 *Ville / L'moudoûn:* ${order.city}
🏠 *Adresse:* ${order.address}

3afak wesh kat'aked lina had la commande bach nsayftouha lik m3a l'livreur ? 👇`;

    const interactivePayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: order.customerPhone,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: {
          text: messageBody,
        },
        footer: {
          text: 'Tawssil sari3 & Khalas 3nd l-istilam 🚚',
        },
        action: {
          buttons: [
            {
              type: 'reply',
              reply: {
                id: `CONFIRM_${order.id}`,
                title: '✅ Kan\'akdi / Confirmer',
              },
            },
            {
              type: 'reply',
              reply: {
                id: `CHANGE_ADDR_${order.id}`,
                title: '📍 Bghit nbedel l\'adresse',
              },
            },
            {
              type: 'reply',
              reply: {
                id: `CANCEL_${order.id}`,
                title: '❌ Bghit n\'anuler',
              },
            },
          ],
        },
      },
    };

    return this.dispatchMessage(config.phoneNumberId, config.accessToken, interactivePayload, order.tenantId, order.customerPhone, messageBody);
  }

  /**
   * Envoi d'un message texte simple (utilisé pour les réponses IA)
   */
  async sendTextMessage(tenantId: string, toPhone: string, text: string): Promise<boolean> {
    const config = db.getWhatsAppConfig(tenantId);
    if (!config) return false;

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: toPhone,
      type: 'text',
      text: { body: text },
    };

    return this.dispatchMessage(config.phoneNumberId, config.accessToken, payload, tenantId, toPhone, text);
  }

  /**
   * Dispatch vers l'API Meta avec gestion du mode Démo / Simulation
   */
  private async dispatchMessage(
    phoneNumberId: string, 
    accessToken: string, 
    payload: any,
    tenantId: string,
    toPhone: string,
    content: string
  ): Promise<boolean> {
    // Enregistrement dans les logs
    db.logMessage({
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      tenantId,
      customerPhone: toPhone,
      direction: 'OUTBOUND',
      type: payload.type === 'interactive' ? 'INTERACTIVE_BUTTON' : 'TEXT',
      content,
      timestamp: new Date(),
    });

    // Si nous sommes avec un token de démo, simulation propre
    if (accessToken.startsWith('EAAG_DEMO') || process.env.NODE_ENV === 'test') {
      console.log(`[WhatsApp SIMULATION] Message envoyé vers ${toPhone}:`);
      console.log(JSON.stringify(payload, null, 2));
      return true;
    }

    try {
      const response = await axios.post(
        `${this.graphUrl}/${phoneNumberId}/messages`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return response.status === 200;
    } catch (error: any) {
      console.error('[WhatsApp Meta API Error]', error.response?.data || error.message);
      return false;
    }
  }
}

export const whatsappService = new WhatsAppService();
