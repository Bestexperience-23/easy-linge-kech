export interface YouCanWebhookOrder {
  id: string;
  order_number?: string;
  customer?: {
    first_name?: string;
    last_name?: string;
    phone?: string;
    city?: string;
    address?: string;
  };
  total?: number;
  total_price?: number;
  currency?: string;
  order_lines?: Array<{
    id: string;
    name: string;
    quantity: number;
    price: number;
  }>;
}

export function parseYouCanOrder(payload: YouCanWebhookOrder) {
  const customer = payload.customer || {};
  const fullName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Client';
  
  const items = (payload.order_lines || []).map((line) => ({
    id: String(line.id),
    title: line.name || 'Article',
    quantity: Number(line.quantity) || 1,
    price: Number(line.price) || 0,
  }));

  return {
    externalOrderId: String(payload.order_number || payload.id),
    customerName: fullName,
    customerPhone: customer.phone || '',
    city: customer.city || 'Maroc',
    address: customer.address || 'Adresse non renseignée',
    totalPrice: Number(payload.total || payload.total_price || 0),
    currency: payload.currency || 'MAD',
    items,
  };
}
