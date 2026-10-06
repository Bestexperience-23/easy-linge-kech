import dns from 'dns';
import http from 'http';
import https from 'https';

// Force IPv4 to avoid slow IPv6 DNS lookups
try { dns.setDefaultResultOrder('ipv4first'); } catch (_) {}

import axios, { AxiosInstance } from 'axios';
import { db } from '../database/store';
import { buildCatalogTextForPrompt, toTTC } from '../catalog';
import { Order } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

interface ConversationSession {
  history: ChatMessage[];
  lastActivityMs: number;
}

// ─── MAIN AI SERVICE — 100% Gemini-Powered Agent ─────────────────────────────

export class AiService {
  private apiKey: string;
  private sessions: Map<string, ConversationSession> = new Map();
  private httpClient: AxiosInstance;

  // Models to try in order
  private readonly MODELS = [
    'gemini-3.1-flash-lite',
    'gemini-3.8-flash',
  ];

  // Session expiry: 30 minutes of inactivity
  private readonly SESSION_TTL_MS = 30 * 60 * 1000;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';

    // Persistent HTTP agent — reuse connections, avoid TLS handshake every time
    this.httpClient = axios.create({
      httpAgent: new http.Agent({ keepAlive: true, maxSockets: 5 }),
      httpsAgent: new https.Agent({ keepAlive: true, maxSockets: 5 }),
      timeout: 15000, // 15 seconds — user prefers real answer over speed
      headers: { 'Content-Type': 'application/json' },
    });

    // Cleanup expired sessions every 10 minutes
    setInterval(() => this.cleanupSessions(), 10 * 60 * 1000);
  }

  // ─── Function Declaration for create_order ───────────────────────────────

  private readonly CREATE_ORDER_TOOL = {
    functionDeclarations: [{
      name: 'create_order',
      description: `Appelle UNIQUEMENT quand : (1) tu as les articles confirmés, (2) un numéro marocain valide (10 chiffres: 06/07/05 + 8 chiffres, ou +212 + 9 chiffres), ET (3) une adresse réelle au Maroc (pas de charabia). Si une condition manque, NE PAS appeler cette fonction.`,
      parameters: {
        type: 'OBJECT',
        properties: {
          customerName: { type: 'STRING', description: "Nom du client ou de l'établissement (Riad, Hôtel, Villa, Airbnb, Booking, Maison d'hôte)" },
          propertyType: { type: 'STRING', description: "Type d'établissement : 'Riad', 'Hôtel', 'Airbnb', 'Booking', 'Villa', 'Maison d\'hôte', 'Particulier'" },
          contactPhone: { type: 'STRING', description: "Deuxième numéro de téléphone fourni par le client pour la livraison (06/07/05...)" },
          customerPhone: { type: 'STRING', description: "Numéro marocain VALIDE : 06/07/05 + 8 chiffres (10 total) ou +212 + 9 chiffres. NE PAS accepter de numéros incomplets." },
          deliveryAddress: { type: 'STRING', description: "Adresse de livraison RÉELLE au Maroc avec quartier/hay/derb/rue/avenue. NE PAS accepter de lettres aléatoires ou charabia." },
          items: {
            type: 'ARRAY',
            description: 'Articles commandés',
            items: {
              type: 'OBJECT',
              properties: {
                productName: { type: 'STRING', description: "Nom du produit" },
                size: { type: 'STRING', description: "Taille/dimension" },
                quantity: { type: 'INTEGER', description: 'Quantité' },
                unitPriceDH: { type: 'NUMBER', description: 'Prix unitaire HT' },
              },
              required: ['productName', 'size', 'quantity', 'unitPriceDH'],
            },
          },
        },
        required: ['customerPhone', 'deliveryAddress', 'items'],
      },
    }],
  };

  // ─── Public Entry Point ──────────────────────────────────────────────────

  async processCustomerMessage(
    tenantId: string,
    customerPhone: string,
    messageText: string
  ): Promise<{ reply: string; detectedAction?: 'CONFIRM' | 'CANCEL' | 'NONE'; orderData?: any }> {
    const trimmed = messageText.trim();
    const session = this.getOrCreateSession(customerPhone);

    // Build system prompt using the catalog module and customer order history
    const knowledge = db.getBotKnowledge(tenantId);
    const catalogText = buildCatalogTextForPrompt();
    const customerOrders = db.getOrdersByCustomerPhone(customerPhone, tenantId);
    const systemPrompt = this.buildSystemPrompt(catalogText, knowledge, customerOrders);

    // Add user message to history
    session.history.push({ role: 'user', parts: [{ text: trimmed }] });
    session.lastActivityMs = Date.now();

    // Keep history manageable (last 20 turns = 40 messages)
    if (session.history.length > 40) {
      session.history = session.history.slice(-40);
    }

    // Call Gemini with retry across models
    const result = await this.callGeminiWithRetry(systemPrompt, session.history);

    if (result) {
      // Check for function call (create_order)
      if (result.functionCall) {
        const { args } = result.functionCall;
        console.log('[AI] 🔔 FUNCTION CALL: create_order', JSON.stringify(args));

        // Add function call to history — use rawParts to preserve thought_signature
        session.history.push({ role: 'model', parts: result.rawParts || [{ functionCall: result.functionCall }] } as any);

        // Process the order
        const orderResult = this.handleCreateOrder(args, tenantId, customerPhone);

        // Add function response to history (role must be 'model' with functionResponse)
        session.history.push({
          role: 'user' as any,
          parts: [{ functionResponse: { name: 'create_order', response: orderResult } }] as any,
        });

        // Get follow-up response from Gemini
        const followUp = await this.callGeminiWithRetry(systemPrompt, session.history);
        const followUpText = followUp?.text || `Commande confirmée ✅ Total: ${orderResult.totalHT} DH HT (${orderResult.totalTTC} DH TTC). Livraison sous 24h!`;

        session.history.push({ role: 'model', parts: [{ text: followUpText }] });
        return { reply: followUpText, detectedAction: 'CONFIRM', orderData: orderResult };
      }

      // Normal text response
      if (result.text) {
        session.history.push({ role: 'model', parts: [{ text: result.text }] });
        const action = this.detectAction(trimmed);
        return { reply: result.text, detectedAction: action };
      }
    }

    // Absolute last resort — Gemini completely unreachable
    const emergencyReply = this.getEmergencyFallback(trimmed);
    session.history.push({ role: 'model', parts: [{ text: emergencyReply }] });

    return { reply: emergencyReply, detectedAction: 'NONE' };
  }

  // ─── Handle create_order Function Call ───────────────────────────────────

  private handleCreateOrder(args: any, tenantId: string, customerPhone: string): any {
    // ── Server-side validation: Phone ──
    const phone = args.customerPhone || '';
    const phoneValidation = this.validateMoroccanPhone(phone);
    if (!phoneValidation.valid) {
      console.log(`[ORDER] ❌ Téléphone invalide: "${phone}" — ${phoneValidation.reason}`);
      return {
        success: false,
        error: 'INVALID_PHONE',
        message: phoneValidation.reason,
      };
    }

    // ── Server-side validation: Address ──
    const address = args.deliveryAddress || '';
    const addressValidation = this.validateAddress(address);
    if (!addressValidation.valid) {
      console.log(`[ORDER] ❌ Adresse invalide: "${address}" — ${addressValidation.reason}`);
      return {
        success: false,
        error: 'INVALID_ADDRESS',
        message: addressValidation.reason,
      };
    }

    const orderItems = (args.items || []).map((item: any, idx: number) => ({
      id: `item_${idx + 1}`,
      title: `${item.productName || 'Produit'} (${item.size || ''})`,
      quantity: item.quantity || 1,
      price: item.unitPriceDH || 0,
    }));

    let totalHT = 0;
    for (const item of orderItems) {
      totalHT += item.quantity * item.price;
    }
    const totalTTC = toTTC(totalHT);

    const orderId = `ORD-${Date.now()}`;
    const deliveryAddress = args.deliveryAddress || '';

    // Extract city from address — default to "Marrakech"
    const city = this.extractCityFromAddress(deliveryAddress);

    // Extract second contact phone if provided by client
    const contactPhone = args.contactPhone || (args.customerPhone && args.customerPhone !== customerPhone ? args.customerPhone : args.customerPhone || undefined);
    const propertyType = args.propertyType || undefined;

    // Build Order object matching the Order interface exactly
    const order = {
      id: orderId,
      tenantId,
      externalOrderId: orderId,
      platform: 'custom' as const,
      customerName: args.customerName || 'Client WhatsApp',
      customerPhone,
      contactPhone,
      propertyType,
      city,
      address: deliveryAddress,
      totalPrice: totalHT,
      currency: 'MAD',
      items: orderItems,
      confirmationStatus: 'PENDING' as const,
      createdAt: new Date(),
    };
    db.saveOrder(order as any);

    console.log(`[ORDER] ✅ ${orderId} — ${orderItems.length} articles — ${totalHT} DH HT — ${city} — Tél2: ${contactPhone || 'non spécifié'} — Type: ${propertyType || 'Non spécifié'} — ${deliveryAddress}`);

    return {
      success: true,
      orderId,
      totalHT,
      totalTTC,
      city,
      contactPhone,
      propertyType,
      itemCount: orderItems.length,
      message: `Commande ${orderId} créée: ${totalHT} DH HT (${totalTTC} DH TTC).`,
    };
  }

  /** Extract city name from a delivery address string */
  private extractCityFromAddress(address: string): string {
    const addr = address.toLowerCase();
    const knownCities = ['marrakech', 'casablanca', 'rabat', 'agadir', 'tanger', 'fès', 'fes', 'meknès', 'meknes', 'oujda', 'essaouira', 'ouarzazate'];
    for (const city of knownCities) {
      if (addr.includes(city)) {
        return city.charAt(0).toUpperCase() + city.slice(1);
      }
    }
    // Default — most clients are in Marrakech
    return 'Marrakech';
  }

  /** Validate Moroccan phone number */
  private validateMoroccanPhone(phone: string): { valid: boolean; reason?: string } {
    if (!phone || phone.trim() === '') {
      return { valid: false, reason: 'Numéro de téléphone manquant. Demande au client son numéro.' };
    }

    // Normalize: remove spaces, dashes, dots
    const cleaned = phone.replace(/[\s\-\.]/g, '');

    // Format +212XXXXXXXXX (13 chars) or 0212XXXXXXXXX
    const intlRegex = /^\+212[5-7]\d{8}$/;
    // Format 0[5-7]XXXXXXXX (10 digits)
    const localRegex = /^0[5-7]\d{8}$/;

    if (intlRegex.test(cleaned) || localRegex.test(cleaned)) {
      return { valid: true };
    }

    // Too short
    if (cleaned.replace(/\D/g, '').length < 10) {
      return { valid: false, reason: `Le numéro "${phone}" est incomplet (${cleaned.replace(/\D/g, '').length} chiffres au lieu de 10). Demande au client de donner son numéro complet.` };
    }

    return { valid: false, reason: `Le numéro "${phone}" n'est pas un numéro marocain valide. Format attendu : 06XXXXXXXX, 07XXXXXXXX ou 05XXXXXXXX (10 chiffres).` };
  }

  /** Validate delivery address is real, not gibberish */
  private validateAddress(address: string): { valid: boolean; reason?: string } {
    if (!address || address.trim().length < 5) {
      return { valid: false, reason: 'Adresse trop courte ou manquante. Demande au client son quartier et adresse complète.' };
    }

    const addr = address.toLowerCase().trim();

    // Check for gibberish: if >60% consonants with no vowels pattern, it's random
    const vowels = addr.match(/[aeiouyàâéèêëïîôùûü]/g) || [];
    const letters = addr.match(/[a-zàâéèêëïîôùûü]/g) || [];
    if (letters.length > 5 && vowels.length / letters.length < 0.15) {
      return { valid: false, reason: 'L\'adresse semble être des lettres aléatoires. Demande au client de donner un vrai quartier/hay/derb.' };
    }

    // Must contain at least one known Moroccan location keyword
    const locationKeywords = [
      // Quartiers Marrakech
      'médina', 'medina', 'guéliz', 'gueliz', 'hivernage', 'palmeraie', 'targa', 'tamansourt',
      'massira', 'daoudiat', 'daoudiate', 'sidi youssef', 'bab', 'derb', 'hay', 'quartier',
      'avenue', 'rue', 'boulevard', 'résidence', 'residence', 'immeuble', 'bloc', 'n°', 'numero',
      'riad', 'hotel', 'hôtel', 'maison', 'villa', 'appartement', 'appt',
      // Villes
      'marrakech', 'casablanca', 'rabat', 'agadir', 'tanger', 'fès', 'fes', 'meknès', 'meknes',
      'oujda', 'essaouira', 'ouarzazate', 'kenitra', 'mohammedia', 'safi', 'salé', 'sale',
      // Types de lieux
      'zone', 'lotissement', 'cité', 'cite', 'douar', 'commune', 'centre', 'gare',
      'camp', 'al', 'el', 'sidi', 'moulay', 'lalla', 'ain', 'souk',
      'mellah', 'kasbah', 'koutoubia', 'jemaa', 'majorelle',
      'mohammadi', 'maarif', 'anfa', 'ain diab', 'californie', 'bourgogne',
    ];

    const hasLocationKeyword = locationKeywords.some(kw => addr.includes(kw));
    if (!hasLocationKeyword) {
      return { valid: false, reason: 'L\'adresse ne contient aucun quartier, rue ou lieu reconnu. Demande au client de préciser le quartier, le derb, ou le nom de la résidence.' };
    }

    return { valid: true };
  }

  // ─── Gemini API Call with Retry Logic ────────────────────────────────────

  private async callGeminiWithRetry(
    systemPrompt: string,
    history: ChatMessage[]
  ): Promise<{ text?: string; functionCall?: any; rawParts?: any[] } | null> {
    for (const model of this.MODELS) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const result = await this.callGemini(model, systemPrompt, history);
          if (result) {
            console.log(`[AI] ✅ ${model} responded (attempt ${attempt})`);
            return result;
          }
        } catch (err: any) {
          const status = err?.response?.status;
          const code = err?.code;
          console.warn(`[AI] ⚠️ ${model} attempt ${attempt}/3 failed: ${status || code || err.message}`);

          // 404 = model not found, skip to next model immediately
          if (status === 404) break;

          // Wait before retry: 800ms, then 1500ms
          if (attempt < 3) {
            await new Promise(r => setTimeout(r, attempt === 1 ? 800 : 1500));
          }
        }
      }
    }

    console.error('[AI] ❌ All Gemini models failed after all retries');
    return null;
  }

  private async callGemini(
    model: string,
    systemPrompt: string,
    history: ChatMessage[]
  ): Promise<{ text?: string; functionCall?: any; rawParts?: any[] } | null> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;

    const response = await this.httpClient.post(url, {
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: history,
      tools: [this.CREATE_ORDER_TOOL],
      generationConfig: {
        maxOutputTokens: 300,
        temperature: 0.5,
        topP: 0.9,
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    const parts = response.data?.candidates?.[0]?.content?.parts || [];

    // Check for function call — return FULL parts to preserve thought_signature
    for (const part of parts) {
      if (part.functionCall) {
        return { functionCall: part.functionCall, rawParts: parts };
      }
    }

    // Text response
    const textPart = parts.find((p: any) => p.text);
    if (textPart?.text?.trim()) {
      return { text: textPart.text.trim() };
    }

    return null;
  }


  private buildSystemPrompt(catalogText: string, knowledge: any, customerOrders: Order[] = []): string {
    const shippingInfo = knowledge
      ? Object.entries(knowledge.shippingCities || {})
          .map(([city, info]: [string, any]) => `${city}: ${info.delayHours} (${info.costMad} DH)`)
          .join(', ')
      : 'Marrakech: livraison 24h gratuite';

    const customerOrdersSection = this.buildCustomerOrdersContext(customerOrders);

    return `Tu es Hicham, conseiller textile chez Easy Linge Kech (May Business SARL) à Marrakech.
Tu parles par WhatsApp avec des gérants et propriétaires de tout type d'hébergement : Riads, Hôtels, appartements Airbnb / Booking, Maisons d'hôtes et Villas de vacances.

══════════════════════════════════════════
  RÈGLE #1 — INTERDICTION TOTALE DE RÉPÉTITION
══════════════════════════════════════════
• NE RÉPÈTE JAMAIS la même phrase d'accueil, de salutation, ou de conclusion d'un message à l'autre.
• Si le client pose une question de suivi, va DIRECTEMENT au cœur de la réponse sans re-résumer ce que tu as déjà dit.
• Varie TOUJOURS tes formulations. Si tu as dit "Wakha" dans le message précédent, utilise autre chose ("Safi", "Mzyan", "Aucun souci", etc.).
• Ne réutilise jamais le même template ou la même structure de liste identique d'un message à l'autre.

══════════════════════════════════════════
  RÈGLE #2 — CONSCIENCE DU CONTEXTE (مهم بزاف)
══════════════════════════════════════════
• Tu es dans une CONVERSATION CONTINUE. Relis les messages précédents et sache exactement où en est la discussion.
• NE TE COMPORTE JAMAIS comme si chaque message est un premier contact. Si tu connais déjà le client et ce qu'il veut, ne recommence pas à zéro.
• Si une info a déjà été donnée (prix, produit, taille), CONSTRUIS dessus, ne la re-donne pas sauf si le client la redemande.
• "ah", "oui", "wakha", "safi", "iyeh", "ok", "d'accord" après un devis = CONFIRMATION. Confirme la commande et demande l'adresse. Ne redemande JAMAIS "chno bghiti?".
• "siftulia" / "sayftoulia" = le client veut les détails / la commande → donne les détails du produit dont on parlait.
• Un chiffre + taille (ex: "2 dyal 180") → réfère-toi au PRODUIT déjà discuté dans la conversation.

══════════════════════════════════════════
  RÈGLE #3 — CONCIS ET UTILE
══════════════════════════════════════════
• 2 à 4 phrases MAXIMUM. Comme un vrai message WhatsApp, pas un email.
• Pas de blabla, pas de phrases creuses. Chaque mot doit apporter de la valeur.
• Pour les listes de produits/prix, utilise des bullet points clairs et courts.
• Si le client demande un total → CALCULE exactement : quantité × prix = total. Pas d'approximation.

══════════════════════════════════════════
  RÈGLE #4 — GESTION DE L'AMBIGUÏTÉ
══════════════════════════════════════════
• Si le message du client est vague ou incomplet, pose UNE SEULE question de clarification précise et directe.
• Ne donne jamais une réponse générique ou superficielle par défaut.
• "chno katbi3o", "ma3rfsh ntuma", "ash kayn", "chno 3endkom" = le client ne connaît pas le catalogue → présente les 2 grandes catégories (Linge de lit + Linge de bain) avec des exemples de produits, pas toute la liste.

══════════════════════════════════════════
  RÈGLE #5 — LANGUE ET SCRIPT
══════════════════════════════════════════
• DÉTECTE la langue du client et RÉPONDS dans EXACTEMENT la même langue ET le même script :
  - Arabizi (lettres latines : "bghit", "chhal", "salam") → RÉPONDS en Darija LATINE (Arabizi). INTERDIT d'écrire en caractères arabes (عربي).
  - Arabe (عربي) → réponds en arabe.
  - Français → réponds en français.
  - Anglais → réponds en anglais.
• Arabizi : 3=ع, 7=ح, 9=ق, 5=خ, 8=غ.

══════════════════════════════════════════
  RÈGLE #6 — CLIENTÈLE & TON PROFESSIONNEL
══════════════════════════════════════════
• CLIENTÈLE DIVERSIFIÉE : Nos clients ne sont pas seulement des Riads ! Nous équipons aussi des hôtes Airbnb, Booking, appartements meublés, villas privées, hôtels et maisons d'hôtes.
  - NE PRÉSUME PAS que le client a forcément un riad. Utilise des termes adaptés : "votre hébergement", "votre riad, appartement Airbnb ou villa".
  - Demande ou note le type d'établissement et son nom (Riad, Hôtel, Airbnb, Villa, etc.).
• INTERDICTION STRICTE DE "3LA SLAMTEK" OU FORMULES FAMILIÈRES :
  - Ne dis JAMAIS "3la slamtek" ou "Safi 3la slamtek". C'est un contact commercial B2B professionnel.
  - Pour confirmer une commande, utilise TOUJOURS une formule professionnelle :
    * En Français : "Parfait, votre commande est enregistrée avec succès. Voici le récapitulatif : [...]"
    * En Darija : "Mzyan bzaf, commande dyalkom tsajjlat b najah. Ha l-récapitulatif : [...]"
    * En Arabe : "ممتاز، تم تسجيل طلبكم بنجاح ومراجعته كالتالي: [...]"
• DEUXIÈME NUMÉRO DE CONTACT :
  - Si le client donne son numéro de téléphone ou un deuxième numéro pour la livraison/réception, enregistre-le précieusement dans contactPhone.
• Sois poli, dynamique et professionnel.
• JAMAIS de "Marhba bik", "Bienvenue", "Bonjour", "Ahlan" répétitifs en début de message.
• JAMAIS de lien de site web.
• Emojis : 1-2 max par message, sobres et naturels.
• Tous les prix en "DH HT" (MAD Hors Taxe).
• Si un produit n'est pas dans le catalogue, dis-le honnêtement.

══════════════════════════════════════════
  COMPRÉHENSION DU DARIJA
══════════════════════════════════════════
• "drags", "dra", "dra7", "drap" = draps (linge de lit). PAS draps de bain.
• "penoir", "peniwar", "benoir" = peignoir.
• "couvrelit", "couette", "housse" = housses de couette.
• "180" / "dyal 180" en parlant de draps = lit de 180x200 cm (King).
• "serviette", "fouta" = serviettes de bain.
• "surmatelas", "matla 3la matla" = surmatelas 10cm.

══════════════════════════════════════════
  CATALOGUE COMPLET (prix en MAD HT)
══════════════════════════════════════════
${catalogText}

══════════════════════════════════════════
  CORRESPONDANCE TAILLES DE LITS
══════════════════════════════════════════
• Lit 90 cm (simple) → drap-housse 90x200, drap plat 160x260
• Lit 140 cm (double) → drap-housse 140x200, drap plat 220x280, housse couette 160x220 ou 220x240
• Lit 160 cm (Queen) → drap-housse 160x200, drap plat 280x300, housse couette 220x240
• Lit 180 cm (King) → drap-housse 180x200, drap plat 300x300, housse couette 240x260
• Lit 200 cm → drap-housse 200x200, housse couette 240x260

══════════════════════════════════════════
  LIVRAISON
══════════════════════════════════════════
${shippingInfo}
Livraison gratuite à Marrakech sous 24h. Reste du Maroc sous 48h.
Paiement à la livraison (COD) possible. Échange sous 7 jours. TVA 20%.

══════════════════════════════════════════
  FUNCTION CALLING: create_order
══════════════════════════════════════════
AVANT d'appeler create_order, tu DOIS vérifier ces 3 conditions :

1. ✅ ARTICLES : Tu as au minimum 1 article (nom + quantité + taille).
2. ✅ TÉLÉPHONE VALIDE : Le numéro doit être marocain :
   - Format 06XXXXXXXX, 07XXXXXXXX ou 05XXXXXXXX (10 chiffres exactement)
   - Ou +212 6XXXXXXXX / +212 7XXXXXXXX / +212 5XXXXXXXX (9 chiffres après +212)
   - Si le numéro est incomplet (ex: 060887, 06123) ou comporte moins de 10 chiffres → NE PAS appeler create_order. Demande poliment au client de corriger son numéro.
   - Si le client n'a pas donné de téléphone → demande-le AVANT d'appeler create_order.
3. ✅ ADRESSE RÉELLE : L'adresse doit contenir des détails géographiques réels au Maroc :
   - Exemples valides : "Riad Dar Zaman, derb Moulay Abdellah, Médina", "Résidence Yasmine, Avenue Hassan II, Guéliz", "Hay Mohammadi, rue 12, N°34"
   - L'adresse doit contenir au minimum un nom de quartier/hay/derb/rue/avenue/résidence connu.
   - Si l'adresse est des lettres aléatoires, du charabia (ex: "jkhsjkhs", "azertyuiop", "xxxxx"), ou n'a aucun sens géographique → NE PAS appeler create_order. Demande au client de préciser son quartier, derb, ou numéro.

Si une de ces conditions n'est PAS remplie → NE JAMAIS appeler create_order. Demande la correction de façon naturelle et polie.
Quand TOUT est validé → appelle create_order. Après l'appel, confirme avec le récapitulatif.

${customerOrdersSection}

══════════════════════════════════════════
  SOCIÉTÉ
══════════════════════════════════════════
Easy Linge Kech (May Business SARL). Factures professionnelles avec TVA disponibles.`;
  }

  private buildCustomerOrdersContext(customerOrders: Order[]): string {
    if (!customerOrders || customerOrders.length === 0) return '';
    const recent = customerOrders.slice(0, 3);
    const lines = recent.map((o) => {
      const itemsStr = (o.items || []).map((i) => `${i.quantity}x ${i.title}`).join(', ');
      let statusLabel = 'En attente ⏳';
      if (o.confirmationStatus === 'CONFIRMED') statusLabel = 'Confirmée ✅ (Enregistrée)';
      else if (o.confirmationStatus === 'PREPARATION') statusLabel = 'En préparation à l\'atelier 🧵';
      else if (o.confirmationStatus === 'SHIPPED') statusLabel = 'En cours de livraison (Livreur en route) 🚚';
      else if (o.confirmationStatus === 'DELIVERED') statusLabel = 'Livrée & Payée avec succès ✅';
      else if (o.confirmationStatus === 'CANCELLED') statusLabel = 'Annulée ❌';

      return `• N° ${o.externalOrderId || o.id} (${itemsStr}) — Total: ${o.totalPrice} DH HT — Statut: ${statusLabel} — Adresse: ${o.address || o.city}`;
    });

    return `\n══════════════════════════════════════════
  HISTORIQUE / SUIVI COMMANDES DE CE CLIENT
══════════════════════════════════════════
Ce client a déjà ces commandes enregistrées dans le système :
${lines.join('\n')}

• Si le client demande le suivi ou l'état de sa commande ("fin wslat la commande", "suivi commande", "wach tsajlat commande", "mon colis", etc.), donne-lui le statut précis avec son numéro de commande et rassure-le sur la livraison.
• Si le client est récurrent, reconnais-le avec professionnalisme.`;
  }

  // ─── Build Catalogue Text from Store Data ────────────────────────────────

  private buildCatalogueText(knowledge: any): string {
    if (!knowledge?.catalog?.length) {
      return `--- Linge de lit ---
• Drap plat (Polycoton 70% coton): 160x260cm 115 DH | 220x280cm 145 DH | 280x300cm 153 DH | 300x300cm 173 DH
• Drap-housse (Polycoton 70% coton): 90x200cm 115 DH | 140x200cm 153 DH | 160x200cm 165 DH | 180x200cm 165 DH | 200x200cm 185 DH
• Housse de couette (Polycoton 70% coton): 160x220cm 203 DH | 220x240cm 250 DH | 240x260cm 290 DH
• Couette hôtelière: 160x220cm 250 DH | 220x240cm 324 DH | 240x260cm 424 DH
• Surmatelas 10cm: 90x190cm 945 DH | 140x200cm 1053 DH | 160x200cm 1400 DH | 180x200cm 1454 DH | 200x200cm 1624 DH
• Oreiller 70x50cm: 82 DH | Taie: 37 DH | Taie à volant: 46 DH
• Protège-matelas: 90x200cm 142 DH | 140x200cm 190 DH | 160x200cm 225 DH | 180x200cm 270 DH | 200x200cm 280 DH
--- Linge de bain ---
• Drap de bain 100% coton: 70x140cm 500g 92 DH | 90x150cm 500g 117 DH | 90x150cm 600g 135 DH | 100x150cm 700g 180 DH
• Serviette visage: 50x90cm 500g 47 DH | 50x90cm 600g 51 DH | 50x100cm 700g 60 DH
• Serviette carrée 30x30cm: 12 DH
• Tapis de bain 50x80cm 700g: 53 DH
• Peignoir velours 500g L-XL: 460 DH
• Peignoir bouclette: L 350g 270 DH | XL 350g 270 DH | L-XL 500g 320 DH
• Peignoir nid d'abeille L-XL: 280 DH`;
    }

    const lines: string[] = [];
    let currentCategory = '';

    for (const item of knowledge.catalog) {
      if (item.category !== currentCategory) {
        currentCategory = item.category;
        lines.push(`\n--- ${currentCategory} ---`);
      }

      const variants = item.variants.join(' | ');
      const material = item.material ? ` (${item.material})` : '';
      lines.push(`• ${item.name}${material}: ${variants}`);
    }

    return lines.join('\n');
  }

  // ─── Action Detection (lightweight, from user text) ──────────────────────

  private detectAction(text: string): 'CONFIRM' | 'CANCEL' | 'NONE' {
    const t = text.toLowerCase().trim()
      .replace(/7/g, 'h')
      .replace(/3/g, 'a')
      .replace(/9/g, 'q');

    const cancelWords = ['annule', 'cancel', 'non merci', 'la merci', 'mabghitch', 'annuler'];
    const confirmWords = [
      'oui', 'ok', 'safi', 'aked', 'confirme', 'daccord', 'd accord',
      'c bon', 'c\'est bon', 'je valide', 'validé', 'wakha', 'iyeh',
      'ah', 'tamam', 'parfait', 'je prends', 'nakhod'
    ];

    for (const w of cancelWords) {
      if (t.includes(w)) return 'CANCEL';
    }

    // For short confirmation words, match as full message (not substring)
    for (const w of confirmWords) {
      if (w.length <= 3) {
        // Short words: must be the entire message (with possible punctuation)
        if (t.replace(/[!.?]/g, '').trim() === w) return 'CONFIRM';
      } else {
        if (t.includes(w)) return 'CONFIRM';
      }
    }

    return 'NONE';
  }

  // ─── Session Management ──────────────────────────────────────────────────

  private getOrCreateSession(phone: string): ConversationSession {
    const existing = this.sessions.get(phone);
    if (existing && (Date.now() - existing.lastActivityMs) < this.SESSION_TTL_MS) {
      return existing;
    }

    const session: ConversationSession = {
      history: [],
      lastActivityMs: Date.now(),
    };
    this.sessions.set(phone, session);
    return session;
  }

  private cleanupSessions(): void {
    const now = Date.now();
    for (const [phone, session] of this.sessions.entries()) {
      if (now - session.lastActivityMs > this.SESSION_TTL_MS) {
        this.sessions.delete(phone);
      }
    }
  }

  // ─── Emergency Fallback (ONLY when Gemini is 100% unreachable) ──────────

  private getEmergencyFallback(text: string): string {
    const t = text.toLowerCase();

    // Detect language
    const darijaWords = ['bghit', 'chhal', 'khass', 'wash', 'wach', 'shnu', 'chno', 'fin', 'dyal', 'slm', 'slam', 'salam', 'drap', 'penoir', 'siftu'];
    const englishWords = ['hello', 'hi', 'price', 'how much', 'do you', 'deliver'];

    const isDarija = darijaWords.some(w => t.includes(w));
    const isEnglish = englishWords.some(w => t.includes(w));

    if (isDarija) {
      return "Smeh lia, 3endi mouchkil technique daba. 3awed jarreb men ba3d ola kteb lia f WhatsApp w nredd 3lik directement 🙏";
    }
    if (isEnglish) {
      return "Sorry, I'm having a brief technical issue. Please try again in a moment and I'll get right back to you 🙏";
    }
    return "Désolé, petit souci technique de mon côté. Réessayez dans un instant, je vous réponds rapidement 🙏";
  }
}

export const aiService = new AiService();
