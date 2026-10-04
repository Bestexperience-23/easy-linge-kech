export type TenantPlan = 'starter' | 'pro' | 'enterprise';

export interface Tenant {
  id: string;
  name: string;
  email: string;
  phone: string;
  plan: TenantPlan;
  status: 'active' | 'suspended' | 'trial';
  createdAt: Date;
}

export interface WhatsAppConfig {
  tenantId: string;
  wabaId: string;
  phoneNumberId: string;
  accessToken: string;
  webhookVerifyToken: string;
  isActive: boolean;
}

export type OrderConfirmationStatus = 
  | 'PENDING' 
  | 'CONFIRMED' 
  | 'CANCELLED' 
  | 'ADDRESS_CHANGE_REQUESTED';

export interface OrderItem {
  id: string;
  title: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  tenantId: string;
  externalOrderId: string;
  platform: 'youcan' | 'shopify' | 'woocommerce' | 'custom';
  customerName: string;
  customerPhone: string; // Format E.164 (+212...)
  city: string;
  address: string;
  totalPrice: number;
  currency: string;
  items: OrderItem[];
  confirmationStatus: OrderConfirmationStatus;
  confirmedAt?: Date;
  cancelledAt?: Date;
  notes?: string;
  createdAt: Date;
}

export interface BotKnowledge {
  tenantId: string;
  storeName: string;
  website?: string;
  tagline?: string;
  description?: string;
  shippingCities: { [city: string]: { delayHours: string; costMad: number } };
  defaultShippingDelay: string;
  inspectBeforePay: boolean;
  exchangePolicyDays: number;
  supportPhone: string;
  catalog?: any[];
}

export interface MessageLog {
  id: string;
  tenantId: string;
  customerPhone: string;
  direction: 'INBOUND' | 'OUTBOUND';
  type: 'TEXT' | 'INTERACTIVE_BUTTON' | 'TEMPLATE';
  content: string;
  buttonPayload?: string;
  timestamp: Date;
}
