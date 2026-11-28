/*
 * Belinga Localisation Chauffeurs — © 2026 Samuel OLO OLO — Tous droits réservés.
 * Logiciel protégé par le droit d'auteur (Accord de Bangui révisé — OAPI, Annexe VII ; droit gabonais).
 * Reproduction, modification, vente ou réutilisation interdites sans autorisation écrite de l'auteur.
 * Voir LICENCE.
 */
/*
 * Belinga Localisation Chauffeurs — configuration Supabase
 * ---------------------------------------------------------
 * SEUL endroit où figurent l'adresse du projet et la clé publishable.
 *
 * La clé « publishable » est faite pour être publique : elle ne donne accès
 * qu'aux fonctions autorisées (connexion par PIN, pointage...). Les données
 * restent protégées par la sécurité de la base (RLS + contrôle des jetons).
 *
 * ⚠ Ne JAMAIS mettre ici la clé « secret » ou « service_role ».
 *
 * « self » désigne la page ET le service worker (envoi en arrière-plan).
 */
self.LOC_CONFIG = Object.freeze({
  SUPABASE_URL: 'https://pgoesbhdbmnjscmvsflv.supabase.co',
  SUPABASE_CLE: 'sb_publishable_QLqQLvr7DrGwfwXcM3EE2Q_x8vjMojB',
  VERSION: '1.29.0',
  // Version 1.10 : clé PUBLIQUE des notifications de rappel (la clé privée est seulement sur le serveur)
  VAPID_PUBLIC: 'BEhwh0QM8sdje8uNO-ZKXwILDsRNrROQpXSSS_GcbuhCAgEbgNs3RLVnJzAJkrN7V0ACDS9ZuF9RZ0Ooydkv4KU'
});
