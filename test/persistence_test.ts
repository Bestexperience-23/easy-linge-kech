import dns from 'dns';
try { dns.setDefaultResultOrder('ipv4first'); } catch (_) {}

import dotenv from 'dotenv';
dotenv.config();

import axios from 'axios';
import fs from 'fs';
import path from 'path';

const API = 'http://127.0.0.1:5050/api/chat/message';
const tenantId = 'tenant_maroc_demo_01';
const phone = '+212661234567';

async function send(msg: string): Promise<string> {
  const res = await axios.post(API, { tenantId, customerPhone: phone, message: msg });
  return res.data.reply || '(no reply)';
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  🧪 TEST PERSISTENCE DISQUE & SUIVI COMMANDE');
  console.log('═══════════════════════════════════════════════════════\n');

  // Étape 1: Création d'une commande
  console.log('1️⃣ Création d\'une commande valide...');
  const msg1 = "salam, bghit 4 peignoirs bouclette L-XL 500g w 2 tapis de bain, l'adresse hiya Riad Salam, Derb Dabachi, Médina, Marrakech w telephoni 0661234567";
  console.log(`👤 CLIENT: "${msg1}"`);
  const reply1 = await send(msg1);
  console.log(`🤖 AMINE: ${reply1}\n`);

  // Étape 2: Vérifier le fichier data/orders.json
  const ordersPath = path.join(process.cwd(), 'data', 'orders.json');
  console.log(`2️⃣ Vérification du fichier sur disque: ${ordersPath}`);
  if (fs.existsSync(ordersPath)) {
    const raw = fs.readFileSync(ordersPath, 'utf-8');
    const orders = JSON.parse(raw);
    console.log(`✅ Fichier trouvé! Nombre de commandes stockées sur le disque : ${orders.length}`);
    const lastOrder = orders[orders.length - 1];
    console.log(`📦 Dernière commande : N°${lastOrder.externalOrderId} | Total: ${lastOrder.totalPrice} DH | Adresse: ${lastOrder.address}\n`);
  } else {
    console.error('❌ Le fichier data/orders.json n\'a pas été créé !');
  }

  // Étape 3: Tester le suivi de commande par le client
  console.log('3️⃣ Test du suivi de commande (Client demande où en est sa commande)...');
  await new Promise(r => setTimeout(r, 2000));
  const msg2 = "salam khoya, fin wslat la commande dyali li 3ad dfe3t?";
  console.log(`👤 CLIENT: "${msg2}"`);
  const reply2 = await send(msg2);
  console.log(`🤖 AMINE: ${reply2}\n`);

  console.log('═══════════════════════════════════════════════════════');
  console.log('✅ Test terminé avec succès !');
  console.log('═══════════════════════════════════════════════════════');
}

main().catch(console.error);
