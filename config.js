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
  VERSION: '1.7.0'
});
