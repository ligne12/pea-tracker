# PEA Tracker

Pas d'export, des graphiques d'un autre âge, et une plus-value qui raconte n'importe quoi — la visu PEA de Bourso m'a donné envie de faire mon propre truc. Rien de fou, juste de quoi y voir clair.

## Features

**Import & saisie**
- Drag & drop des avis d'opéré PDF, parsing auto
- Saisie manuelle avec recherche Yahoo Finance en temps réel
- Édition / suppression inline
- Export / import JSON pour backup entre devices

**Visualisations**
- Courbe de prix interactive (Lightweight Charts) avec markers achat/vente
- Répartition du portefeuille (donut + tableau)
- Investissement cumulé, PRU évolutif vs cours d'achat
- Investissement mensuel (bar chart)

**Métriques**
- Investi, valeur actuelle, plus-value avec et sans frais, frais totaux
- XIRR (rendement pondéré annualisé)
- TWR (rendement temporel annualisé)

**UX**
- Thème clair / sombre
- Responsive mobile (cards au lieu de tableaux)
- Filtrage par type (Achats / Ventes)
- Notifications toast
- Auto-refresh des cours pendant les heures de marché

**Sync**
- Local-first : fonctionne 100% hors-ligne
- Sync cloud optionnelle via Supabase (auth magic link)

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Ouvrir http://localhost:5173 — glisser les PDFs ou saisir manuellement.

## Parsers PDF

Le parsing des avis d'opéré est pour l'instant calé sur le format **BoursoBank**. Si tu utilises un autre broker, tu peux soit utiliser la saisie manuelle / import JSON, soit ajouter ton propre parser.

Le parser Bourso est dans `src/lib/pdf-parser.ts` — c'est du regex sur le texte extrait par pdf.js. Pour ajouter un broker, il suffit de créer une fonction qui prend un `File` et retourne un objet `Transaction` :

```ts
// src/lib/pdf-parser.ts

interface Transaction {
  id: string;
  date: string;       // YYYY-MM-DD
  time: string;       // HH:MM:SS
  type: 'ACHAT' | 'VENTE';
  name: string;
  isin: string;
  quantity: number;
  price: number;
  grossAmount: number;
  commission: number;
  fees: number;
  netAmount: number;
  market: string;
  reference: string;
}
```

Le format varie d'un broker à l'autre mais la logique est la même : extraire le texte du PDF, regex les champs, retourner l'objet.

## Sync cloud (optionnel)

Pour retrouver ses données sur plusieurs devices :

1. Créer un projet gratuit sur [supabase.com](https://supabase.com)
2. Coller le SQL de `supabase/migrations/001_create_transactions.sql` dans le SQL Editor et Run
3. Activer l'auth Email (magic link) dans Authentication > Providers
4. Remplir `.env` avec l'URL du projet et la clé anon

Sans ces variables, l'app reste full local — rien n'est envoyé nulle part.

## Déployer sur Vercel

```bash
vercel
```

Le proxy Yahoo Finance est géré par une serverless function (`api/yahoo/[...path].ts`, région Paris). Ajouter les env vars Supabase dans le dashboard Vercel si besoin.

## Ajouter un ETF

Soit via le formulaire (la recherche Yahoo Finance trouve tout), soit en ajoutant le mapping ISIN → ticker dans `src/lib/types.ts` :

```ts
'FR0011871110': 'PUST.PA', // Amundi PEA Nasdaq-100
```

Suffixe `.PA` pour Euronext Paris.

## Structure

```
src/
├── components/     UI (charts, table, form, settings, toast)
├── hooks/          useMarketData, useTheme
├── lib/            parsing PDF, calculs, market data, sync, storage
api/                serverless Yahoo Finance proxy (Vercel)
supabase/           migration SQL
```

## Stack

React 19 · TypeScript · Vite 8 · Tailwind CSS v4 · Lightweight Charts v5 · Recharts · pdfjs-dist · Supabase · Vercel
