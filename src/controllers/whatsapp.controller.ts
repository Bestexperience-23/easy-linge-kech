import { Request, Response } from 'express';
import { db } from '../database/store';
import { whatsappService } from '../services/whatsapp.service';
import { orderService } from '../services/order.service';
import { aiService } from '../services/ai.service';

export class WhatsAppController {
  /**
   * Endpoint de vérification requis par Meta WhatsApp Cloud API (GET)
   */
  verifyWebhook(req: Request, res: Response) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const expectedToken = process.env.META_VERIFY_TOKEN || 'maroc_cod_saas_secure_token_2026';

    if (mode === 'subscribe' && token === expectedToken) {
      console.log('[WhatsApp Webhook] Handshake Meta réussi avec succès.');
      return res.status(200).send(challenge);
    } else {
      console.warn('[WhatsApp Webhook] Échec du handshake : jeton invalide.');
      return res.sendStatus(403);
    }
  }

  /**
   * Endpoint de réception des événements WhatsApp (POST)
   */
  async handleWebhook(req: Request, res: Response) {
    // Toujours répondre immédiatement 200 OK à Meta pour éviter les renvois en boucle
    res.status(200).send('EVENT_RECEIVED');

    try {
      const body = req.body;

      if (!body.object || !body.entry || !body.entry[0]?.changes) {
        return;
      }

      for (const entry of body.entry) {
        for (const change of entry.changes) {
          const value = change.value;
          if (!value || !value.messages || value.messages.length === 0) {
            continue;
          }

          const message = value.messages[0];
          const fromPhone = '+' + message.from.replace(/\+/g, '');
          const messageType = message.type;

          // Récupération du tenant associé au numéro WhatsApp business
          const phoneNumberId = value.metadata?.phone_number_id;
          const tenantId = req.query.tenantId as string || 'tenant_maroc_demo_01';

          console.log(`[WhatsApp Inbound] Type: ${messageType} reçu de ${fromPhone} (Tenant: ${tenantId})`);

          // 1. Cas d'un bouton interactif cliqué (Confirmation, Annulation, Changement adresse)
          if (messageType === 'interactive' && message.interactive?.button_reply) {
            const buttonPayload = message.interactive.button_reply.id;
            const replyText = await orderService.handleButtonAction(tenantId, fromPhone, buttonPayload);
            await whatsappService.sendTextMessage(tenantId, fromPhone, replyText);
          } 
          // 2. Cas d'un message texte (FAQ, Darija, Demande d'info)
          else if (messageType === 'text' && message.text?.body) {
            const text = message.text.body;
            const replyResult = await aiService.processCustomerMessage(tenantId, fromPhone, text);
            await whatsappService.sendTextMessage(tenantId, fromPhone, replyResult.reply);
          }
        }
      }
    } catch (error) {
      console.error('[WhatsApp Controller Error]', error);
    }
  }
}

export const whatsappController = new WhatsAppController();
