import dns from 'dns';
try { dns.setDefaultResultOrder('ipv4first'); } catch (_) {}

import dotenv from 'dotenv';
dotenv.config();

import axios from 'axios';

const API = 'http://127.0.0.1:5050/api/chat/message';
const tenantId = 'tenant_maroc_demo_01';
const phone = '+212661987654';

async function send(msg: string): Promise<string> {
  const res = await axios.post(API, { tenantId, customerPhone: phone, message: msg });
  return res.data.reply || '(no reply)';
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  🧪 TEST VALIDATION — Téléphone + Adresse + Dashboard');
  console.log('═══════════════════════════════════════════════════════\n');

  // Step 1: Start order
  console.log('👤 CLIENT: "salam bghit 5 draps plat dyal 180"');
  let reply = await send('salam bghit 5 draps plat dyal 180');
  console.log(`🤖 HICHAM: ${reply}`);
  console.log('─'.repeat(60));

  // Step 2: Give INVALID phone (6 digits only)
  await new Promise(r => setTimeout(r, 2000));
  console.log('\n👤 CLIENT: "ok safi, telefoni 060887, w l\'adresse jkhsjkhs lgshieq"');
  reply = await send("ok safi, telefoni 060887, w l'adresse jkhsjkhs lgshieq");
  console.log(`🤖 HICHAM: ${reply}`);
  console.log('─'.repeat(60));
  console.log('  ⬆️ Le bot devrait REFUSER le numéro ET l\'adresse\n');

  // Step 3: Give valid phone but still gibberish address
  await new Promise(r => setTimeout(r, 2000));
  console.log('👤 CLIENT: "0661234567 w l\'adresse hiya xxxzzzyyyqqq"');
  reply = await send("0661234567 w l'adresse hiya xxxzzzyyyqqq");
  console.log(`🤖 HICHAM: ${reply}`);
  console.log('─'.repeat(60));
  console.log('  ⬆️ Le bot devrait REFUSER l\'adresse\n');

  // Step 4: Give valid phone + valid address → should work
  await new Promise(r => setTimeout(r, 2000));
  console.log('👤 CLIENT: "0661234567, Riad Dar Zaman, derb Moulay Abdellah, Médina, Marrakech"');
  reply = await send('0661234567, Riad Dar Zaman, derb Moulay Abdellah, Médina, Marrakech');
  console.log(`🤖 HICHAM: ${reply}`);
  console.log('─'.repeat(60));
  console.log('  ⬆️ Le bot devrait CRÉER la commande\n');

  // Step 5: Verify order in dashboard API
  await new Promise(r => setTimeout(r, 1000));
  const ordersRes = await axios.get(`http://127.0.0.1:5050/api/orders/${tenantId}`);
  const orders = ordersRes.data.orders;
  console.log('\n📊 DASHBOARD ORDERS API:');
  for (const o of orders) {
    console.log(`  N°${o.externalOrderId} | ${o.customerName} | 📍 ${o.city} | 🏠 ${o.address} | 💰 ${o.totalPrice} MAD | ${o.confirmationStatus}`);
  }

  console.log('\n✅ Test validation terminé !');
}

main().catch(console.error);
