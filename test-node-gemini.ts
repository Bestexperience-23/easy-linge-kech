// ═══════════════════════════════════════════════════════
//  test-node-gemini.ts — Agent Gemini avec Function Calling
//  Fonction create_order pour extraction automatique des commandes
// ═══════════════════════════════════════════════════════

import dns from 'dns';
try { dns.setDefaultResultOrder('ipv4first'); } catch (_) {}

import dotenv from 'dotenv';
dotenv.config();

import axios, { AxiosInstance } from 'axios';
import http from 'http';
import https from 'https';
import { CATALOG, buildCatalogTextForPrompt, toTTC, CatalogProduct } from './src/catalog';

// ─── Types ───────────────────────────────────────────────────────────────────

interface OrderItem {
  productName: string;
  size: string;
  quantity: number;
  unitPriceDH: number;
}

interface OrderData {
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  items: OrderItem[];
  totalHT: number;
  totalTTC: number;
  status: 'CONFIRMED' | 'PENDING';
}

interface ChatMessage {
  role: 'user' | 'model' | 'function';
  parts: Array<{ text?: string; functionCall?: any; functionResponse?: any }>;
}

// ─── Gemini Function Declaration: create_order ───────────────────────────────

const CREATE_ORDER_DECLARATION = {
  name: 'create_order',
  description: `Appelle cette fonction quand le client CONFIRME sa commande et que tu as assez d'informations pour créer le bon de commande. Tu dois avoir au minimum : les produits commandés (nom + quantité + taille) et l'adresse de livraison. Le nom et téléphone sont optionnels.`,
  parameters: {
    type: 'OBJECT',
    properties: {
      customerName: {
        type: 'STRING',
        description: "Nom du client ou du riad (ex: 'Riad Dar Zaman'). Laisse vide si inconnu.",
      },
      customerPhone: {
        type: 'STRING',
        description: "Numéro de téléphone du client (format +212...). Laisse vide si inconnu.",
      },
      deliveryAddress: {
        type: 'STRING',
        description: "Adresse de livraison complète à Marrakech (nom du riad, quartier, derb).",
      },
      items: {
        type: 'ARRAY',
        description: 'Liste des articles commandés',
        items: {
          type: 'OBJECT',
          properties: {
            productName: {
              type: 'STRING',
              description: "Nom exact du produit du catalogue (ex: 'Drap Plat', 'Peignoir Velours')",
            },
            size: {
              type: 'STRING',
              description: "Taille ou dimension (ex: '300x300 cm', 'L-XL', '180x200 cm')",
            },
            quantity: {
              type: 'INTEGER',
              description: 'Nombre de pièces commandées',
            },
            unitPriceDH: {
              type: 'NUMBER',
              description: 'Prix unitaire HT en DH (selon le catalogue)',
            },
          },
          required: ['productName', 'size', 'quantity', 'unitPriceDH'],
        },
      },
    },
    required: ['deliveryAddress', 'items'],
  },
};

// ─── System Prompt ──────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  const catalogText = buildCatalogTextForPrompt();

  return `Tu es Hicham, conseiller textile chez Easy Linge Kech (May Business SARL) à Marrakech.
Tu parles par WhatsApp avec des gérants de riads, hôtels et maisons d'hôtes.

══════════════════════════════════════════
  RÈGLE #1 — INTERDICTION TOTALE DE RÉPÉTITION
══════════════════════════════════════════
• NE RÉPÈTE JAMAIS la même phrase d'accueil ou de conclusion.
• Va DIRECTEMENT au cœur de la réponse pour les questions de suivi.
• Varie TOUJOURS tes formulations.

══════════════════════════════════════════
  RÈGLE #2 — CONSCIENCE DU CONTEXTE
══════════════════════════════════════════
• Tu es dans une CONVERSATION CONTINUE.
• "ah", "oui", "wakha", "safi" après un devis = CONFIRMATION → appelle create_order si tu as les articles + adresse.
• Si l'adresse manque, demande-la AVANT d'appeler create_order.

══════════════════════════════════════════
  RÈGLE #3 — CONCIS ET UTILE
══════════════════════════════════════════
• 2 à 4 phrases MAX. Comme un WhatsApp, pas un email.
• CALCULE les totaux exactement : quantité × prix = total.
• Prix toujours en "DH HT".

══════════════════════════════════════════
  RÈGLE #4 — LANGUE ET SCRIPT
══════════════════════════════════════════
• Arabizi (lettres latines) → réponds en Arabizi. INTERDIT d'écrire en عربي.
• Français → français. Anglais → anglais.

══════════════════════════════════════════
  RÈGLE #5 — PERSONNALITÉ
══════════════════════════════════════════
• HUMAIN et naturel. JAMAIS "Marhba bik", "Bienvenue", "Bonjour".
• JAMAIS de lien de site web. 1-2 emojis max.

══════════════════════════════════════════
  RÈGLE #6 — FUNCTION CALLING: create_order
══════════════════════════════════════════
• Quand le client CONFIRME une commande et que tu as :
  1. Les articles (nom + quantité + taille/dimension)
  2. L'adresse de livraison
  → Appelle la fonction create_order avec toutes les données.
• Si l'adresse manque encore, demande-la d'abord.
• Après l'appel, confirme au client avec le récapitulatif.

══════════════════════════════════════════
  CATALOGUE (prix en MAD HT)
══════════════════════════════════════════
${catalogText}

══════════════════════════════════════════
  LIVRAISON
══════════════════════════════════════════
Marrakech: gratuite 24h. Reste du Maroc: 40-50 DH, 48h.
COD possible. Échange sous 7 jours. TVA 20%.`;
}

// ─── Agent Gemini avec Function Calling ─────────────────────────────────────

class GeminiAgent {
  private apiKey: string;
  private httpClient: AxiosInstance;
  private history: ChatMessage[] = [];
  private conversationState: 'ACTIVE' | 'ORDER_PLACED' = 'ACTIVE';
  private lastOrderId?: string;
  private model = 'gemini-3.1-flash-lite';

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
    if (!this.apiKey) throw new Error('GEMINI_API_KEY manquant dans .env');

    this.httpClient = axios.create({
      httpAgent: new http.Agent({ keepAlive: true }),
      httpsAgent: new https.Agent({ keepAlive: true }),
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async chat(userMessage: string): Promise<string> {
    // Add user message to history
    this.history.push({ role: 'user', parts: [{ text: userMessage }] });

    // Keep history manageable
    if (this.history.length > 40) {
      this.history = this.history.slice(-40);
    }

    // Call Gemini
    const response = await this.callGemini();

    // Check if Gemini wants to call a function
    const candidate = response.data?.candidates?.[0];
    const parts = candidate?.content?.parts || [];

    for (const part of parts) {
      if (part.functionCall) {
        const { name, args } = part.functionCall;

        // Add the function call to history — use FULL parts array to preserve thought_signature
        this.history.push({ role: 'model', parts: parts });

        if (name === 'create_order') {
          console.log('\n🔔 ═══ FUNCTION CALL: create_order ═══');
          console.log(JSON.stringify(args, null, 2));

          // Process the order
          const orderResult = this.processCreateOrder(args);

          // Add function response to history (role = 'user' for Gemini API)
          this.history.push({
            role: 'user',
            parts: [{
              functionResponse: {
                name: 'create_order',
                response: orderResult,
              }
            }],
          });

          // Get Gemini's follow-up response after processing the order
          const followUpResponse = await this.callGemini();
          const followUpText = followUpResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

          this.history.push({ role: 'model', parts: [{ text: followUpText }] });
          return followUpText;
        }
      }
    }

    // Normal text response (no function call)
    const textReply = parts.find((p: any) => p.text)?.text?.trim() || '';
    this.history.push({ role: 'model', parts: [{ text: textReply }] });

    return textReply;
  }

  private async callGemini() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    return this.httpClient.post(url, {
      systemInstruction: {
        parts: [{ text: buildSystemPrompt() }],
      },
      contents: this.history,
      tools: [{
        functionDeclarations: [CREATE_ORDER_DECLARATION],
      }],
      generationConfig: {
        maxOutputTokens: 300,
        temperature: 0.5,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
  }

  /**
   * Traite l'appel create_order : valide les données, calcule le total, crée la commande
   */
  private processCreateOrder(args: any): any {
    const orderId = `ORD-${Date.now()}`;
    const items: OrderItem[] = (args.items || []).map((item: any) => ({
      productName: item.productName || 'Produit inconnu',
      size: item.size || '',
      quantity: item.quantity || 1,
      unitPriceDH: item.unitPriceDH || 0,
    }));

    // Calculer le total
    let totalHT = 0;
    for (const item of items) {
      totalHT += item.quantity * item.unitPriceDH;
    }
    const totalTTC = toTTC(totalHT);

    const order: OrderData = {
      customerName: args.customerName || 'Client WhatsApp',
      customerPhone: args.customerPhone || '',
      deliveryAddress: args.deliveryAddress || '',
      items,
      totalHT,
      totalTTC,
      status: 'CONFIRMED',
    };

    // Empêcher la répétition de confirmation
    this.conversationState = 'ORDER_PLACED';
    this.lastOrderId = orderId;

    // ── Log la commande ──
    console.log('\n✅ ═══ COMMANDE CRÉÉE ═══');
    console.log(`📋 N° Commande: ${orderId}`);
    console.log(`👤 Client: ${order.customerName}`);
    console.log(`📞 Tél: ${order.customerPhone || 'Non fourni'}`);
    console.log(`📍 Adresse: ${order.deliveryAddress}`);
    console.log('─── Articles ───');
    for (const item of items) {
      console.log(`  • ${item.quantity}x ${item.productName} (${item.size}) — ${item.unitPriceDH} DH × ${item.quantity} = ${item.quantity * item.unitPriceDH} DH HT`);
    }
    console.log(`─── Total HT: ${totalHT} DH ───`);
    console.log(`─── TVA 20%: ${Math.round(totalHT * 0.20)} DH ───`);
    console.log(`─── Total TTC: ${totalTTC} DH ───`);
    console.log('═══════════════════════\n');

    return {
      success: true,
      orderId,
      totalHT,
      totalTTC,
      itemCount: items.length,
      deliveryDelay: order.deliveryAddress.toLowerCase().includes('marrakech') ? '24h' : '48h',
      message: `Commande ${orderId} créée avec succès. Total: ${totalHT} DH HT (${totalTTC} DH TTC). Livraison prévue.`,
    };
  }
}

// ─── Mode Interactif CLI ────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  🧪 TEST GEMINI FUNCTION CALLING — Easy Linge Kech');
  console.log('  Agent Hicham avec create_order');
  console.log('═══════════════════════════════════════════════════════\n');

  const agent = new GeminiAgent();

  // Scénario de test complet
  const scenario = [
    'salam, bghit n-équipé riad jdid f Marrakech',
    'bghit 10 draps plat dyal 180 w 10 draps housse dyal 180',
    'zid lia 10 peignoirs bouclette L-XL 500g',
    'ah safi, l\'adresse hiya Riad Dar Zaman, derb Moulay Abdellah, Médina, Marrakech',
  ];

  for (const msg of scenario) {
    console.log(`\n👤 CLIENT: "${msg}"`);

    try {
      const reply = await agent.chat(msg);
      console.log(`🤖 HICHAM: ${reply}`);
    } catch (err: any) {
      console.error(`❌ Erreur: ${err.response?.data?.error?.message || err.message}`);
    }

    console.log('─'.repeat(60));

    // Pause between messages
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n\n✅ Test terminé !');
}

main().catch(console.error);
