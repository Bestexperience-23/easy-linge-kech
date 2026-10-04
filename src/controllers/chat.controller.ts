import { Request, Response } from 'express';
import { aiService } from '../services/ai.service';
import { db } from '../database/store';

export class ChatController {
  async handleIncomingChatMessage(req: Request, res: Response) {
    try {
      const { tenantId, customerPhone, message, apiKey } = req.body;

      if (!tenantId || !customerPhone || !message) {
        return res.status(400).json({ error: 'Champs obligatoires manquants (tenantId, customerPhone, message)' });
      }

      // Enregistrement du message entrant
      db.logMessage({
        id: `msg_in_${Date.now()}`,
        tenantId,
        customerPhone,
        direction: 'INBOUND',
        type: 'TEXT',
        content: message,
        timestamp: new Date(),
      });

      // Traitement par le moteur IA (Gemini multi-tours)
      const aiResult = await aiService.processCustomerMessage(tenantId, customerPhone, message);

      // Enregistrement de la réponse IA
      db.logMessage({
        id: `msg_out_${Date.now()}`,
        tenantId,
        customerPhone,
        direction: 'OUTBOUND',
        type: 'TEXT',
        content: aiResult.reply,
        timestamp: new Date(),
      });

      return res.json({
        success: true,
        reply: aiResult.reply,
        detectedAction: aiResult.detectedAction,
      });
    } catch (error: any) {
      console.error('[ChatController Error]', error);
      return res.status(500).json({ error: 'Erreur lors du traitement du message' });
    }
  }
}

export const chatController = new ChatController();
