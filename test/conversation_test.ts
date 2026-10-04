import http from 'http';

const BASE = 'http://127.0.0.1:5050/api/chat/message';
const PHONE = '+212699TEST01';
const TENANT = 'tenant_maroc_demo_01';

const messages = [
  'slmm',
  'je veux des drags',
  'ah siftulia',
  'bghit 2 dyal draps dyal 180',
  'ah',
  'ma3rfsh ntuma li katbiu3u',
  'bghit drap',
];

async function post(msg: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ tenantId: TENANT, customerPhone: PHONE, message: msg });
    const req = http.request(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, (res) => {
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve(parsed.reply || body);
        } catch { resolve(body); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  TEST CONVERSATION COMPLÈTE — Easy Linge Kech Agent');
  console.log('═══════════════════════════════════════════════════════\n');

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    console.log(`👤 CLIENT: "${msg}"`);
    
    try {
      const reply = await post(msg);
      console.log(`🤖 AMINE: ${reply}`);
    } catch (err: any) {
      console.log(`❌ ERREUR: ${err.message}`);
    }
    
    console.log('─'.repeat(55));
    
    // Small delay between messages
    if (i < messages.length - 1) {
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  console.log('\n✅ Test conversation terminé !');
}

main();
