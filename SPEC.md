# SPEC — Logiciel de gestion de boutique d'électronique

## Objectif
Application web de gestion pour une boutique d'équipements électroniques, utilisable sur ordinateur et tablette (interface tactile, écrans larges). Une seule boutique au départ.

## Utilisateurs et rôles
- **owner** (propriétaire) : accès total, gère les utilisateurs et voit les marges.
- **manager** (gérant) : produits, stock, achats, fournisseurs, rapports, annulations.
- **seller** (vendeur) : caisse, clients, consultation du stock. Ne voit pas les prix d'achat.

## Règles métier
- Le stock n'est jamais modifié directement : il est la somme des mouvements de stock (achat, vente, retour, ajustement).
- Les produits de valeur (téléphones, laptops, etc.) sont suivis par **numéro de série / IMEI** : une vente doit désigner l'unité exacte.
- Chaque vente garde le prix de vente et le coût au moment de la vente (pour calculer la marge même si les prix changent).
- Une vente peut être payée en plusieurs paiements (espèces, mobile money, carte, virement) et peut être partiellement payée (crédit client).
- Garantie : date de fin = date de vente + durée de garantie du produit.
- Montants stockés en **entiers (plus petite unité de la devise)**, jamais en décimaux flottants. La devise est configurable.
- Interface en **français**.

## Fonctionnalités par étape

### Étape 1 — Fondations
- Authentification (email + mot de passe), profils et rôles
- Mise en page responsive (menu latéral sur ordinateur, navigation adaptée tablette)

### Étape 2 — Produits et stock
- CRUD catégories et produits (SKU, code-barres, marque, prix achat/vente, garantie, stock minimum)
- Entrées et ajustements de stock, historique des mouvements
- Liste avec recherche, filtres et alerte de stock bas

### Étape 3 — Caisse
- Recherche rapide produit (nom, SKU, code-barres), panier, remise
- Sélection du numéro de série pour les produits suivis
- Paiements multiples, ticket de caisse imprimable / PDF
- Décrément automatique du stock

### Étape 4 — Clients, fournisseurs, achats
- Fiches clients avec historique d'achats et soldes dus
- Fournisseurs, bons de commande, réception (entrée de stock + numéros de série)

### Étape 5 — Rapports
- Chiffre d'affaires et marge par période
- Produits les plus vendus, stock faible, clôture de caisse journalière

### Étape 6 — Finitions
- Recherche de garantie par numéro de série
- Sauvegardes, export CSV, éventuellement mode hors ligne

## Hors périmètre (pour l'instant)
Multi-boutiques, comptabilité complète, e-commerce, application mobile native.

## Critères de qualité
- Tests automatisés pour : calcul du stock, totaux de vente, remises, marge.
- Row Level Security activée sur toutes les tables.
- Aucune clé secrète dans le code ni dans Git.
