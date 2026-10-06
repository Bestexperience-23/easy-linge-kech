# 🏨 Easy Linge Kech — Assistant WhatsApp IA & Gestion de Commandes (SaaS)

Agent conversationnel WhatsApp intelligent propulsé par **Google Gemini** pour la gestion commerciale et la prise de commande automatisée de linge hôtelier haut de gamme pour les riads et hôtels à Marrakech.

---

## ✨ Fonctionnalités Clés

- 🧠 **Agent IA Intelligent (Hicham)** :
  - Support multilingue : **Darija (Arabizi)**, Français, Arabe et Anglais avec adaptation automatique.
  - Compréhension avancée des formats marocains (tailles hôtelières 180, types de linge, argot local).
  - Calcul automatique et exact des devis (HT et TTC à 20%).
- 🛍️ **Function Calling (Prise de Commande Autonome)** :
  - Déclenchement automatique de `create_order` lors de la confirmation client.
  - **Validation stricte** :
    - Numéros marocains valides (10 chiffres commençant par 06/07/05 ou format +212).
    - Adresses réelles et cohérentes avec détection automatique de la ville (Marrakech par défaut).
- 💾 **Stockage & Persistance Données** :
  - Sauvegarde permanente sur disque (`data/orders.json`).
  - Tolérance aux redémarrages et pannes.
- 🚚 **Suivi de Commande en Temps Réel** :
  - L'IA reconnaît les clients récurrents et répond précisément aux demandes de suivi (*"fin wslat la commande dyali?"*).
- 📊 **Tableau de Bord & Simulateur WhatsApp** :
  - Interface web moderne avec simulateur de smartphone en direct.
  - Suivi des KPI, des commandes traitées et gestion des adresses.

---

## 🚀 Installation & Démarrage

### 1. Prérequis
- Node.js (v18+)
- Clé d'API Google Gemini

### 2. Cloner & Installer les dépendances
```bash
git clone <URL_DU_REPO>
cd whatsapp-ecommerce-saas
npm install
```

### 3. Configuration de l'environnement
Copiez `.env.example` en `.env` et renseignez votre clé :
```bash
cp .env.example .env
```
Dans `.env` :
```env
PORT=5050
GEMINI_API_KEY=votre_cle_gemini_ici
```

### 4. Compiler & Lancer
```bash
# Compilation TypeScript
npm run build

# Démarrage du serveur
npm start
```
Accédez au tableau de bord : **http://localhost:5050**

---

## 🛠️ Stack Technique

- **Backend** : Node.js, Express, TypeScript
- **IA & NLP** : Google Gemini API (`gemini-3.1-flash-lite`, `gemini-3.8-flash`) avec Function Calling
- **Validation** : Zod & Regex marocaine
- **Frontend** : Vanilla HTML5 / CSS3 / JavaScript
- **Base de données** : JSON-backed Persistence Engine
