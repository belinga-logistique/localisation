/*
 * Belinga Localisation Chauffeurs — © 2026 Samuel OLO OLO — Tous droits réservés.
 * Logiciel protégé par le droit d'auteur (Accord de Bangui révisé — OAPI, Annexe VII ; droit gabonais).
 * Reproduction, modification, vente ou réutilisation interdites sans autorisation écrite de l'auteur.
 * Voir LICENCE.
 */
/*
 * Belinga Localisation — service worker (mode hors ligne)
 * ---------------------------------------------------------------------------
 * 1. Garde en mémoire l'application chauffeur : elle s'ouvre même sans réseau.
 *    Stratégie « réseau d'abord » : la dernière version est prise quand le
 *    réseau répond en moins de 4 s, sinon la copie enregistrée est utilisée.
 * 2. Les données (Supabase), les cartes et l'interface logistique ne sont
 *    JAMAIS mises en cache ici : aucune position n'est stockée par ce fichier.
 * 3. Envoi en arrière-plan (« Background Sync », Android / Chrome) : au retour
 *    du réseau, les alertes Panne / Urgence (en premier) et les pointages en
 *    attente partent même si l'application est fermée.
 * 4. Un toucher sur une notification de rappel ouvre l'application.
 *
 * Pour publier une nouvelle version : changer VERSION ci-dessous.
 */
'use strict';

importScripts('config.js');          // définit self.LOC_CONFIG (URL + clé publishable)

const VERSION = 'v1.16.1';   // 1.16.1 : photos ouvertes à taille réduite (mémoire des téléphones modestes)
const CACHE = 'belinga-loc-' + VERSION;
const FICHIERS_APPLI = [
  './chauffeur.html',
  './legal.html',
  './config.js',
  './manifest.json',
  './icones/icone-192.png',
  './icones/icone-512.png',
  './icones/icone-maskable-512.png',
  './icones/apple-touch-icon.png',
];
const DELAI_RESEAU_MS = 4000;

/* ---------------------------------------------------------------------------
   Installation : copie des fichiers de l'application
   --------------------------------------------------------------------------- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(FICHIERS_APPLI.map((f) => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

/* Activation : suppression des anciennes versions */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((c) => c.startsWith('belinga-loc-') && c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

/* ---------------------------------------------------------------------------
   Requêtes : réseau d'abord (4 s max), sinon copie enregistrée
   --------------------------------------------------------------------------- */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Autres sites (Supabase, cartes, bibliothèques) : pas d'interception
  if (url.origin !== self.location.origin) return;
  // Interface logistique : toujours en ligne, jamais mise en cache
  if (url.pathname.endsWith('/logistique.html')) return;
  event.respondWith(reseauPuisCache(event, req));
});

async function reseauPuisCache(event, req) {
  const cache = await caches.open(CACHE);
  const reseau = fetch(req).then((rep) => {
    if (rep && rep.ok && rep.type === 'basic') cache.put(req, rep.clone());
    return rep;
  });
  event.waitUntil(reseau.catch(() => {}));   // la mise à jour continue en arrière-plan

  const delai = new Promise((_, rejeter) => setTimeout(() => rejeter(new Error('délai')), DELAI_RESEAU_MS));
  try {
    return await Promise.race([reseau, delai]);
  } catch {
    const copie = await cache.match(req, { ignoreSearch: true })
      || (req.mode === 'navigate' ? await cache.match('./chauffeur.html') : undefined);
    if (copie) return copie;
    // Rien en mémoire : on attend quand même la réponse du réseau
    return reseau.catch(() => new Response('Hors ligne : contenu indisponible.', {
      status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    }));
  }
}

/* ---------------------------------------------------------------------------
   Envoi des pointages en arrière-plan
   --------------------------------------------------------------------------- */
self.addEventListener('sync', (event) => {
  if (event.tag === 'envoi-pointages') event.waitUntil(envoyerEnSerie(true));
});

// L'application peut aussi demander un envoi immédiat
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'synchroniser') event.waitUntil(envoyerEnSerie(false).catch(() => {}));
});

/* Les envois passent l'un après l'autre : chacun relit la file à jour. */
let chaineEnvois = Promise.resolve();
function envoyerEnSerie(relancerSiEchec) {
  const p = chaineEnvois.then(() => envoyerFile(relancerSiEchec));
  chaineEnvois = p.catch(() => {});
  return p;
}

/** Ouvre la base locale partagée avec l'application (mêmes nom et structure). */
function ouvrirBase() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('belinga-localisation', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('file')) db.createObjectStore('file', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function operation(db, store, mode, action) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const r = action(tx.objectStore(store));
    tx.oncomplete = () => resolve(r ? r.result : undefined);
    tx.onerror = () => reject(tx.error);
  });
}

/** Même préparation que dans l'application (champs internes retirés). */
function versServeur(i) {
  return {
    id: i.id, statut: i.statut, horodatage: i.horodatage, destination: i.destination || null,
    latitude: i.latitude ?? null, longitude: i.longitude ?? null, precision_m: i.precision_m ?? null,
    quartier_detecte_id: i.quartier_detecte_id ?? null, distance_detecte_m: i.distance_detecte_m ?? null,
    quartier_confirme_id: i.quartier_confirme_id ?? null, repere: i.repere || null,
    province: i.province || null, ville: i.ville || null, lieu_dispo: i.lieu_dispo || null,
    vehicule_id: i.vehicule_id ?? null, contestation: i.contestation || null, site: i.site || null,
    passagers: i.passagers ?? null, jours_maladie: i.jours_maladie ?? null,
    hors_ligne: Date.now() - (i.cree_ms || Date.now()) > 2 * 60 * 1000,
  };
}

/** Même préparation des alertes que dans l'application. */
function alerteVersServeur(a) {
  return {
    id: a.id, motif: a.motif, message: a.message || null, horodatage: a.horodatage,
    latitude: a.latitude ?? null, longitude: a.longitude ?? null, precision_m: a.precision_m ?? null,
    vehicule_id: a.vehicule_id ?? null, hors_ligne: Date.now() - (a.cree_ms || Date.now()) > 2 * 60 * 1000,
  };
}

/**
 * Envoie le trajet des courses suivies en attente (clé « courseFile », version 1.5).
 * Renvoie true si quelque chose a été envoyé.
 */
async function envoyerSuivi(db, CFG, session, relancerSiEchec) {
  const f = (await operation(db, 'kv', 'readonly', (s) => s.get('courseFile'))) || { courses: [], points: [] };
  const courses = f.courses.filter((x) => x.chauffeur_id === session.chauffeur_id).slice(0, 20);
  const points = f.points.filter((x) => x.chauffeur_id === session.chauffeur_id).slice(0, 500);
  if (!courses.length && !points.length) return false;
  let rep;
  try {
    rep = await fetch(`${CFG.SUPABASE_URL}/rest/v1/rpc/loc_course_sync`, {
      method: 'POST',
      headers: { apikey: CFG.SUPABASE_CLE, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_jeton: session.jeton, p_donnees: { courses, points } }),
    });
  } catch (e) {
    if (relancerSiEchec) throw e;
    return false;
  }
  if (!rep.ok) { if (relancerSiEchec && rep.status >= 500) throw new Error('serveur ' + rep.status); return false; }
  const r = await rep.json();
  if (!r.ok) return false;
  const faits = new Set([...r.courses, ...r.points, ...r.rejetes.map((x) => x.id)]);
  const g = (await operation(db, 'kv', 'readonly', (s) => s.get('courseFile'))) || { courses: [], points: [] };
  g.courses = g.courses.filter((x) => !(faits.has(x.id) && courses.some((y) => y.id === x.id && y.fin === x.fin)));
  g.points = g.points.filter((x) => !faits.has(x.id));
  await operation(db, 'kv', 'readwrite', (s) => s.put(g, 'courseFile'));
  return true;
}

/**
 * Envoie les alertes Panne / Urgence en attente (clé « alertesFile »).
 * Renvoie la liste des identifiants acceptés par le serveur.
 */
async function envoyerAlertes(db, CFG, session, relancerSiEchec) {
  const file = (await operation(db, 'kv', 'readonly', (s) => s.get('alertesFile'))) || [];
  const miennes = file.filter((a) => a.chauffeur_id === session.chauffeur_id).slice(0, 20);
  if (!miennes.length) return [];
  let rep;
  try {
    rep = await fetch(`${CFG.SUPABASE_URL}/rest/v1/rpc/loc_signaler_alertes`, {
      method: 'POST',
      headers: { apikey: CFG.SUPABASE_CLE, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_jeton: session.jeton, p_alertes: miennes.map(alerteVersServeur) }),
    });
  } catch (e) {
    if (relancerSiEchec) throw e;   // pas de réseau : nouvel essai plus tard
    return [];
  }
  if (!rep.ok) { if (relancerSiEchec && rep.status >= 500) throw new Error('serveur ' + rep.status); return []; }
  const r = await rep.json();
  if (!r.ok) return [];             // session expirée : la file est gardée
  const traites = new Set([...r.acceptes, ...r.rejetes.map((x) => x.id)]);
  // Relecture juste avant l'écriture : une nouvelle alerte a pu être ajoutée entre-temps
  const aJour = (await operation(db, 'kv', 'readonly', (s) => s.get('alertesFile'))) || [];
  await operation(db, 'kv', 'readwrite', (s) => s.put(aJour.filter((a) => !traites.has(a.id)), 'alertesFile'));
  return r.acceptes;
}

/**
 * Envoie la file d'attente du chauffeur connecté.
 * relancerSiEchec = true : une erreur réseau fait échouer la promesse, ce qui
 * demande au navigateur de réessayer plus tard (Background Sync).
 */
async function envoyerFile(relancerSiEchec) {
  const CFG = self.LOC_CONFIG;
  const db = await ouvrirBase();
  const session = await operation(db, 'kv', 'readonly', (s) => s.get('session'));
  if (!session || !session.jeton || !CFG) return;
  // 1. Les alertes d'urgence d'abord
  const alertes = await envoyerAlertes(db, CFG, session, relancerSiEchec);
  // 2. Le trajet des courses suivies (version 1.5)
  const suivi = await envoyerSuivi(db, CFG, session, relancerSiEchec);
  const prevenir = async (envoyes, rejets) => {
    const fenetres = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    fenetres.forEach((c) => c.postMessage({ type: 'sync-termine', envoyes, rejets, alertes, suivi }));
  };
  // 2. Puis les pointages
  const items = (await operation(db, 'file', 'readonly', (s) => s.getAll()))
    .filter((i) => i.chauffeur_id === session.chauffeur_id)
    .sort((a, b) => a.horodatage.localeCompare(b.horodatage));
  if (!items.length) { if (alertes.length || suivi) await prevenir(0, []); return; }

  let envoyes = 0;
  const rejets = [];
  for (let n = 0; n < items.length; n += 100) {
    const lot = items.slice(n, n + 100);
    let rep;
    try {
      rep = await fetch(`${CFG.SUPABASE_URL}/rest/v1/rpc/loc_pointer`, {
        method: 'POST',
        headers: { apikey: CFG.SUPABASE_CLE, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_jeton: session.jeton, p_pointages: lot.map(versServeur) }),
      });
    } catch (e) {
      if (relancerSiEchec) throw e;   // pas de réseau : nouvel essai plus tard
      return;
    }
    if (!rep.ok) { if (relancerSiEchec && rep.status >= 500) throw new Error('serveur ' + rep.status); return; }
    const r = await rep.json();
    if (!r.ok) return;                // session expirée / consentement : la file est gardée
    await operation(db, 'file', 'readwrite', (s) => {
      r.acceptes.forEach((id) => s.delete(id));
      r.rejetes.forEach((x) => { if (x.id) s.delete(x.id); });
    });
    envoyes += r.acceptes.length;
    rejets.push(...r.rejetes);
  }
  await operation(db, 'kv', 'readwrite', (s) => s.put(Date.now(), 'dernierEnvoi'));
  // Prévenir l'application si elle est ouverte
  await prevenir(envoyes, rejets);
}

/* ---------------------------------------------------------------------------
   Notification de rappel : ouvrir l'application
   --------------------------------------------------------------------------- */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || './chauffeur.html';
  event.waitUntil((async () => {
    const fenetres = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const appli = fenetres.find((c) => c.url.includes('chauffeur.html'));
    if (appli) { appli.postMessage({ type: 'rappel' }); return appli.focus(); }
    return self.clients.openWindow(url);
  })());
});

/* Version 1.10 : rappel envoyé par le serveur (« push »), même application fermée.
   Le message est chiffré pour CE téléphone ; il ne contient aucune position. */
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { corps: event.data ? event.data.text() : '' }; }
  event.waitUntil(self.registration.showNotification(d.titre || 'Belinga Localisation', {
    body: d.corps || 'Pensez à pointer.',
    icon: 'icones/icone-192.png', badge: 'icones/icone-192.png',
    tag: d.tag || 'rappel-pointage', renotify: true, requireInteraction: true,
    data: { url: d.url || './chauffeur.html?rappel=1' },
  }));
});
