import dns from 'dns';
try { dns.setDefaultResultOrder('ipv4first'); } catch (_) {}

import dotenv from 'dotenv';
dotenv.config();

import axios from 'axios';

const API = 'http://127.0.0.1:5050/api/chat/message';
const tenantId = 'tenant_maroc_demo_01';
const phone = '+212611223344'; // WhatsApp sender

async function send(msg: string): Promise<string> {
  const res = await axios.post(API, { tenantId, customerPhone: phone, message: msg });
  return res.data.reply || '(no reply)';
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  🧪 TEST AIRBNB + 2ÈME TÉLÉPHONE + TON PRO (HICHAM)');
  console.log('═══════════════════════════════════════════════════════\n');

  console.log('1️⃣ Client Airbnb passe commande et donne un 2ème numéro :');
  const msg = "salam, 3endi appartement Airbnb f Guéliz bghit liha 4 draps plat 160x260 w 4 serviettes visage 500g. L'adresse Résidence Majorelle, Avenue Mohammed V, Guéliz, w 3ayet l concierge f 0677889900 bach y-stelm";
  console.log(`👤 CLIENT: "${msg}"`);
  
  const reply = await send(msg);
  console.log(`🤖 HICHAM: ${reply}\n`);

  console.log('2️⃣ Vérification des données enregistrées dans la plateforme :');
  const ordersRes = await axios.get(`http://127.0.0.1:5050/api/orders/${tenantId}`);
  const orders = ordersRes.data.orders;
  const lastOrder = orders[orders.length - 1];

  console.log(`📋 N° Commande: ${lastOrder.externalOrderId}`);
  console.log(`👤 Client: ${lastOrder.customerName}`);
  console.log(`🏠 Type: ${lastOrder.propertyType || 'Non spécifié'}`);
  console.log(`📱 N° WhatsApp: ${lastOrder.customerPhone}`);
  console.log(`📞 2ème Téléphone (Concierge/Contact): ${lastOrder.contactPhone || 'Non spécifié'}`);
  console.log(`📍 Adresse: ${lastOrder.address} (${lastOrder.city})`);
  console.log(`💰 Total: ${lastOrder.totalPrice} MAD`);

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('✅ Test terminé avec succès !');
  console.log('═══════════════════════════════════════════════════════');
}

main().catch(console.error);
