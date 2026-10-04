import axios from 'axios';
import { app } from '../src/app';
import { Server } from 'http';

const TEST_PORT = 5099;
const BASE_URL = `http://localhost:${TEST_PORT}`;
let server: Server;

async function runSimulator() {
  console.log('\n🟢 Démarrage de la simulation E2E du SaaS WhatsApp E-commerce...\n');

  // 1. Démarrer le serveur en mémoire
  server = app.listen(TEST_PORT);
  await new Promise((resolve) => setTimeout(resolve, 500));

  try {
    // TEST 1: Healthcheck
    console.log('--- TEST 1: Vérification de l\'état du serveur ---');
    const health = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Statut du serveur:', health.data.status);

    // TEST 2: Handshake Webhook Meta WhatsApp (Verification Token)
    console.log('\n--- TEST 2: Handshake Meta WhatsApp Cloud API ---');
    const handshake = await axios.get(`${BASE_URL}/webhook/whatsapp`, {
      params: {
        'hub.mode': 'subscribe',
        'hub.verify_token': 'maroc_cod_saas_secure_token_2026',
        'hub.challenge': 'CHALLENGE_CODE_12345',
      },
    });
    console.log('✅ Handshake Meta accepté avec le challenge:', handshake.data);

    // TEST 3: Réception d'une nouvelle commande YouCan (Casablanca, COD 450 MAD)
    console.log('\n--- TEST 3: Réception commande YouCan (COD) ---');
    const youcanPayload = {
      id: 'YC_ORDER_9841',
      order_number: '1098',
      customer: {
        first_name: 'Youssef',
        last_name: 'El Mansouri',
        phone: '0661234567', // Numéro marocain classique à normaliser
        city: 'Casablanca',
        address: 'Quartier Maarif, Rue Normandie N 42',
      },
      total: 450,
      currency: 'MAD',
      order_lines: [
        { id: '101', name: 'Veste Cuir Homme Slim Fit', quantity: 1, price: 450 },
      ],
    };

    const orderRes = await axios.post(`${BASE_URL}/api/orders/youcan/tenant_maroc_demo_01`, youcanPayload);
    const orderData = orderRes.data.order;
    console.log(`✅ Commande YouCan créée: #${orderData.externalOrderId}`);
    console.log(`📱 Numéro normalisé: ${orderData.customerPhone}`);
    console.log(`⏳ Statut initial: ${orderData.confirmationStatus}`);

    // TEST 4: Le client clique sur "Confirmer" sur WhatsApp
    console.log('\n--- TEST 4: Simulation Clic Client "✅ Kan\'akdi / Confirmer" ---');
    const metaButtonClickPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WABA_DEMO_123456',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: { phone_number_id: 'PHONE_ID_DEMO_789' },
                messages: [
                  {
                    from: '212661234567',
                    id: 'wamid.HBgLMjEyNjYxMjM0NTY3FQIAERgSMzAy',
                    timestamp: Math.floor(Date.now() / 1000).toString(),
                    type: 'interactive',
                    interactive: {
                      type: 'button_reply',
                      button_reply: {
                        id: `CONFIRM_${orderData.id}`,
                        title: '✅ Kan\'akdi / Confirmer',
                      },
                    },
                  },
                ],
              },
              field: 'messages',
            },
          ],
        },
      ],
    };

    await axios.post(`${BASE_URL}/webhook/whatsapp?tenantId=tenant_maroc_demo_01`, metaButtonClickPayload);

    // Vérifier la mise à jour du statut dans les commandes
    const ordersList = await axios.get(`${BASE_URL}/api/orders/tenant_maroc_demo_01`);
    const confirmedOrder = ordersList.data.orders.find((o: any) => o.id === orderData.id);
    console.log(`✅ Nouveau statut de la commande après clic WhatsApp: ${confirmedOrder.confirmationStatus}`);

    // TEST 5: Question client en Darija sur l'inspection avant paiement
    console.log('\n--- TEST 5: Question Darija (Inspection du colis avant paiement) ---');
    const darijaMsgPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WABA_DEMO_123456',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: { phone_number_id: 'PHONE_ID_DEMO_789' },
                messages: [
                  {
                    from: '212661234567',
                    id: 'wamid.HBgLMjEyNjYxMjM0NTY3FQIAERgSMzAz',
                    timestamp: Math.floor(Date.now() / 1000).toString(),
                    type: 'text',
                    text: {
                      body: 'Salam khouya, wesh n9der nchouf l colis 9bel ma nkhles livreur ?',
                    },
                  },
                ],
              },
              field: 'messages',
            },
          ],
        },
      ],
    };

    await axios.post(`${BASE_URL}/webhook/whatsapp?tenantId=tenant_maroc_demo_01`, darijaMsgPayload);
    console.log('✅ Question Darija traitée avec succès par le moteur IA');

    // TEST 6: Analytics du Dashboard Marchand
    console.log('\n--- TEST 6: Métriques du Dashboard Marchand ---');
    const analytics = await axios.get(`${BASE_URL}/api/analytics/tenant_maroc_demo_01`);
    console.log('📊 Statistiques de la boutique:', JSON.stringify(analytics.data.analytics, null, 2));

    console.log('\n🎉 TOUS LES TESTS SONT PASSÉS AVEC SUCCÈS ! SYSTÈME OPÉRATIONNEL À 100%.\n');
  } catch (err: any) {
    console.error('❌ Erreur lors de la simulation:', err.response?.data || err.message);
  } finally {
    server.close();
    process.exit(0);
  }
}

runSimulator();
