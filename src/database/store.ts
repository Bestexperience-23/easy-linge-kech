import fs from 'fs';
import path from 'path';
import { Tenant, WhatsAppConfig, Order, BotKnowledge, MessageLog } from '../types';

export class MemoryStore {
  private tenants: Map<string, Tenant> = new Map();
  private configs: Map<string, WhatsAppConfig> = new Map();
  private orders: Map<string, Order> = new Map();
  private knowledge: Map<string, BotKnowledge> = new Map();
  private messageLogs: MessageLog[] = [];

  private dataDir = path.join(process.cwd(), 'data');
  private ordersFilePath = path.join(this.dataDir, 'orders.json');
  private messagesFilePath = path.join(this.dataDir, 'messages.json');

  constructor() {
    this.seedDemoData();
    this.ensureDataDir();
    this.loadFromDisk();
  }

  private ensureDataDir() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
    } catch (err) {
      console.error('[DB] Erreur création dossier data:', err);
    }
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(this.ordersFilePath)) {
        const raw = fs.readFileSync(this.ordersFilePath, 'utf-8');
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          for (const item of list) {
            this.orders.set(item.id, {
              ...item,
              createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
              confirmedAt: item.confirmedAt ? new Date(item.confirmedAt) : undefined,
              cancelledAt: item.cancelledAt ? new Date(item.cancelledAt) : undefined,
            });
          }
          console.log(`[DB] 💾 ${this.orders.size} commande(s) persistée(s) chargée(s) depuis ${this.ordersFilePath}`);
        }
      }

      if (fs.existsSync(this.messagesFilePath)) {
        const raw = fs.readFileSync(this.messagesFilePath, 'utf-8');
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          this.messageLogs = list.map((m: any) => ({
            ...m,
            timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
          }));
          console.log(`[DB] 💬 ${this.messageLogs.length} message(s) chargé(s) depuis le disque`);
        }
      }
    } catch (err) {
      console.error('[DB] Erreur chargement données depuis le disque:', err);
    }
  }

  private saveOrdersToDisk() {
    try {
      this.ensureDataDir();
      const list = Array.from(this.orders.values());
      fs.writeFileSync(this.ordersFilePath, JSON.stringify(list, null, 2), 'utf-8');
    } catch (err) {
      console.error('[DB] Erreur sauvegarde commandes sur disque:', err);
    }
  }

  private saveMessagesToDisk() {
    try {
      this.ensureDataDir();
      fs.writeFileSync(this.messagesFilePath, JSON.stringify(this.messageLogs.slice(-500), null, 2), 'utf-8');
    } catch (err) {
      console.error('[DB] Erreur sauvegarde messages sur disque:', err);
    }
  }

  // Initialisation d'une boutique témoin marocaine
  private seedDemoData() {
    const demoTenantId = 'tenant_maroc_demo_01';
    
    this.tenants.set(demoTenantId, {
      id: demoTenantId,
      name: 'Easy Linge Kech (May Business SARL)',
      email: 'contact@ezzilinge.ma',
      phone: '+212661000000',
      plan: 'enterprise',
      status: 'active',
      createdAt: new Date(),
    });

    this.configs.set(demoTenantId, {
      tenantId: demoTenantId,
      wabaId: 'WABA_EASY_LINGE_KECH',
      phoneNumberId: 'PHONE_ID_EASY_LINGE',
      accessToken: 'EAAG_DEMO_TOKEN_META',
      webhookVerifyToken: process.env.META_VERIFY_TOKEN || 'maroc_cod_saas_secure_token_2026',
      isActive: true,
    });

    this.knowledge.set(demoTenantId, {
      tenantId: demoTenantId,
      storeName: 'Easy Linge Kech',
      website: 'https://ezzilinge.ma/',
      tagline: 'Linge hôtelier d\'exception pour riads, hôtels et maisons d\'hôtes à Marrakech',
      description: 'Easy Linge Kech accompagne les riads, hôtels et maisons de Marrakech dans chaque détail textile — du choix des fibres jusqu’à l’entretien quotidien. Nous réunissons exigence professionnelle et sensibilité artisanale pour créer un linge accueillant, durable et parfaitement adapté à votre rythme d’exploitation.',
      shippingCities: {
        marrakech: { delayHours: 'Livraison express en 24h directe aux riads & hôtels', costMad: 0 },
        casablanca: { delayHours: '24h - 48h', costMad: 40 },
        rabat: { delayHours: '24h - 48h', costMad: 40 },
        agadir: { delayHours: '48h', costMad: 50 },
        tanger: { delayHours: '48h', costMad: 50 },
        fes: { delayHours: '48h', costMad: 50 },
      },
      defaultShippingDelay: 'Livraison rapide à Marrakech sous 24h et partout au Maroc sous 48h max',
      inspectBeforePay: true,
      exchangePolicyDays: 7,
      supportPhone: '+212 6 61 00 00 00',
      catalog: [
        { category: 'Linge de lit', name: 'Drap plat', material: 'Polycoton 70% coton', variants: ['160x260cm (115 MAD HT)', '220x280cm (145 MAD HT)', '280x300cm (153 MAD HT)', '300x300cm (173 MAD HT)'] },
        { category: 'Linge de lit', name: 'Protège-matelas', material: 'Protection literie respirante', variants: ['90x200cm (142 MAD HT)', '140x200cm (190 MAD HT)', '160x200cm (225 MAD HT)', '180x200cm (270 MAD HT)', '200x200cm (280 MAD HT)'] },
        { category: 'Linge de lit', name: 'Drap-housse', material: 'Polycoton 70% coton', variants: ['90x200cm (115 MAD HT)', '140x200cm (153 MAD HT)', '160x200cm (165 MAD HT)', '180x200cm (165 MAD HT)', '200x200cm (185 MAD HT)'] },
        { category: 'Linge de lit', name: 'Housse de couette', material: 'Polycoton 70% coton', variants: ['160x220cm (203 MAD HT)', '220x240cm (250 MAD HT)', '240x260cm (290 MAD HT)'] },
        { category: 'Linge de lit', name: 'Oreiller hôtelier', material: 'Confort moelleux et équilibré', variants: ['70x50cm (82 MAD HT)'] },
        { category: 'Linge de lit', name: 'Taie d\'oreiller', material: 'Polycoton 70% coton', variants: ['70x50cm (37 MAD HT)'] },
        { category: 'Linge de lit', name: 'Taie d\'oreiller à volant', material: 'Finition décorative', variants: ['70x50cm (46 MAD HT)'] },
        { category: 'Linge de lit', name: 'Couette hôtelière', material: 'Gonflant hôtelier régulier', variants: ['160x220cm (250 MAD HT)', '220x240cm (324 MAD HT)', '240x260cm (424 MAD HT)'] },
        { category: 'Linge de lit', name: 'Surmatelas hôtelier 10 cm', material: 'Confort premium de literie', variants: ['90x190x10cm (945 MAD HT)', '140x200x10cm (1053 MAD HT)', '160x200x10cm (1400 MAD HT)', '180x200x10cm (1454 MAD HT)', '200x200x10cm (1624 MAD HT)'] },
        { category: 'Linge de bain', name: 'Drap de bain', material: '100% coton absorbant', variants: ['70x140cm 500g/m2 (92 MAD HT)', '90x150cm 500g/m2 (117 MAD HT)', '90x150cm 600g/m2 (135 MAD HT)', '100x150cm 700g/m2 (180 MAD HT)'] },
        { category: 'Linge de bain', name: 'Serviette visage', material: '100% coton', variants: ['50x90cm 500g/m2 (47 MAD HT)', '50x90cm 600g/m2 (51 MAD HT)', '50x100cm 700g/m2 (60 MAD HT)'] },
        { category: 'Linge de bain', name: 'Serviette carrée (visage/soins)', material: '100% coton', variants: ['30x30cm 500g/m2 (12 MAD HT)'] },
        { category: 'Linge de bain', name: 'Tapis de bain', material: '100% coton dense 700g/m2', variants: ['50x80cm (53 MAD HT)'] },
        { category: 'Linge de bain', name: 'Peignoir velours premium', material: 'Toucher velours enveloppant', variants: ['L-XL 500g/m2 (460 MAD HT)'] },
        { category: 'Linge de bain', name: 'Peignoir bouclette', material: '100% coton absorbant', variants: ['L 350g/m2 (270 MAD HT)', 'XL 350g/m2 (270 MAD HT)', 'L-XL 500g/m2 (320 MAD HT)'] },
        { category: 'Linge de bain', name: 'Peignoir nid d\'abeille', material: 'Léger, respirant & séchage rapide', variants: ['L-XL (280 MAD HT)'] }
      ]
    });
  }

  // Tenant methods
  getTenant(id: string): Tenant | undefined {
    return this.tenants.get(id);
  }

  getWhatsAppConfig(tenantId: string): WhatsAppConfig | undefined {
    return this.configs.get(tenantId);
  }

  getBotKnowledge(tenantId: string): BotKnowledge | undefined {
    return this.knowledge.get(tenantId);
  }

  // Order management with strict tenant isolation
  saveOrder(order: Order): Order {
    this.orders.set(order.id, order);
    this.saveOrdersToDisk();
    return order;
  }

  getOrder(id: string, tenantId: string): Order | undefined {
    const order = this.orders.get(id);
    if (order && order.tenantId === tenantId) {
      return order;
    }
    return undefined;
  }

  getOrderByCustomerPhone(phone: string, tenantId: string): Order | undefined {
    for (const order of this.orders.values()) {
      if (order.tenantId === tenantId && order.customerPhone === phone) {
        return order;
      }
    }
    return undefined;
  }

  getOrdersByCustomerPhone(phone: string, tenantId: string): Order[] {
    const cleanPhone = phone.replace(/\D/g, '');
    return Array.from(this.orders.values())
      .filter((o) => {
        if (o.tenantId !== tenantId) return false;
        const cleanOrderPhone = (o.customerPhone || '').replace(/\D/g, '');
        return cleanOrderPhone === cleanPhone || o.customerPhone === phone;
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getLatestPendingOrderByPhone(phone: string, tenantId: string): Order | undefined {
    const list = Array.from(this.orders.values())
      .filter((o) => o.tenantId === tenantId && o.customerPhone === phone && o.confirmationStatus === 'PENDING')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return list[0];
  }

  getTenantOrders(tenantId: string): Order[] {
    return Array.from(this.orders.values()).filter((o) => o.tenantId === tenantId);
  }

  logMessage(log: MessageLog): void {
    this.messageLogs.push(log);
    this.saveMessagesToDisk();
  }

  getMessageLogs(tenantId: string, phone?: string): MessageLog[] {
    return this.messageLogs.filter((m) => {
      if (m.tenantId !== tenantId) return false;
      if (phone && m.customerPhone !== phone) return false;
      return true;
    });
  }

  // Analytics for merchant dashboard
  getAnalytics(tenantId: string) {
    const orders = this.getTenantOrders(tenantId);
    const total = orders.length;
    const confirmed = orders.filter((o) => o.confirmationStatus === 'CONFIRMED').length;
    const cancelled = orders.filter((o) => o.confirmationStatus === 'CANCELLED').length;
    const pending = orders.filter((o) => o.confirmationStatus === 'PENDING').length;
    const addressChange = orders.filter((o) => o.confirmationStatus === 'ADDRESS_CHANGE_REQUESTED').length;

    const confirmationRate = total > 0 ? ((confirmed / total) * 100).toFixed(1) : '0';

    return {
      totalOrders: total,
      confirmedOrders: confirmed,
      cancelledOrders: cancelled,
      pendingOrders: pending,
      addressChangeRequested: addressChange,
      confirmationRate: `${confirmationRate}%`,
    };
  }
}

export const db = new MemoryStore();
