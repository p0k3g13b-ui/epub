# 🎬 Installation de l'onglet Animes

## 📋 Fichiers créés/modifiés

### Frontend (à remplacer/ajouter)
1. ✅ **index.html** (modifié) - Ajout onglet Animes + panneau recherche
2. ✅ **style.css** (modifié) - Styles pour animes
3. ✅ **search.js** (modifié) - Gestion panneau droit dynamique
4. ✅ **index.js** (déjà modifié avant)
5. ➕ **anime.js** (NOUVEAU) - Gestion recherche et ajout animes
6. ➕ **anime.html** (NOUVEAU) - Page liste épisodes
7. ➕ **anime-page.js** (NOUVEAU) - Logique page liste épisodes
8. ➕ **player-anime.html** (NOUVEAU) - Lecteur vidéo

### Backend (à ajouter)
9. ➕ **scraper-anime.js** (NOUVEAU) - Scraper VoirAnime
10. ✏️ **server.js** - Ajouter les routes du fichier `server-anime-routes`

### Base de données
11. 📊 **anime-tables.sql** - Tables Supabase à créer

---

## 🚀 Instructions d'installation

### Étape 1 : Base de données

1. Allez sur **Supabase** → SQL Editor
2. Copiez le contenu de `anime-tables.sql`
3. Exécutez le script (créé 4 tables + index + RLS)
4. Vérifiez dans Table Editor que les tables apparaissent

### Étape 2 : Backend

1. **Téléchargez** `scraper-anime.js` et placez-le dans votre dossier backend (à côté de `scraper.js`)

2. **Ouvrez** `server.js` et ajoutez tout en haut (après les autres require) :
```javascript
const { searchAnime, scrapeAnimeDetails, scrapeEpisodeLinks, refreshEpisodeLinks } = require('./scraper-anime');
```

3. **Copiez** les 3 routes de `server-anime-routes` et collez-les AVANT le `app.use((req, res) => { ... })` (gestion 404)

4. **Installez** les dépendances (si pas déjà fait) :
```bash
npm install axios cheerio
```

5. **Redéployez** sur Vercel :
```bash
vercel --prod
```

### Étape 3 : Frontend

1. **Remplacez** les fichiers existants :
   - `index.html`
   - `style.css`
   - `search.js`

2. **Ajoutez** les nouveaux fichiers :
   - `anime.js`
   - `anime.html`
   - `anime-page.js`
   - `player-anime.html`

3. **Commitez et poussez** sur GitHub (si hébergé sur GitHub Pages)

---

## 🧪 Test

1. **Ouvrez** votre site
2. **Cliquez** sur le bouton "+" en haut à droite
3. **Allez** sur l'onglet Animes (menu latéral)
4. **Le panneau** devrait afficher "🎬 Ajouter un anime" avec 2 barres de recherche
5. **Testez** une recherche VF (ex: "demon slayer")
6. **Cliquez** sur un résultat → Modal avec sélection épisodes
7. **Ajoutez** quelques épisodes (ex: 1 à 3)
8. **Attendez** le scraping (peut prendre 30s-1min)
9. **Vérifiez** que l'anime apparaît dans l'onglet Animes
10. **Cliquez** sur l'anime → Liste des épisodes
11. **Cliquez** sur un épisode → Lecteur vidéo

---

## 🐛 Dépannage

### Le scraper ne trouve rien
- Vérifiez que VoirAnime est accessible
- Ouvrez F12 → Network et regardez si le backend est appelé
- Vérifiez les logs backend (Vercel → Functions → Logs)
- Les sélecteurs HTML peuvent changer, il faudra ajuster `scraper-anime.js`

### La vidéo ne charge pas
- Vérifiez les logs console (F12)
- Testez si Streamtape est accessible
- Essayez de re-scraper (bouton Réessayer dans le lecteur)
- Les liens expirent souvent, c'est normal

### Erreur "Table not found"
- Vérifiez que les tables sont créées dans Supabase
- Vérifiez les noms de colonnes (user_id, anime_id, etc.)

### Les épisodes ne s'ajoutent pas
- Vérifiez les logs backend
- Vérifiez que SUPABASE_URL et SUPABASE_KEY sont configurés
- Testez manuellement l'URL VoirAnime dans le navigateur

---

## ⚙️ Configuration avancée

### Ordre de priorité des hébergeurs

Dans `player-anime.html`, ligne ~190, vous pouvez modifier :
```javascript
// Essaie streamtape_mp4 en premier
if (links.streamtape_mp4) { ... }

// Puis les autres
const iframeLinks = Object.entries(links).filter(([key]) => key.endsWith('_iframe'));
```

Pour changer l'ordre, modifiez la logique ou ajoutez un tri.

### Timeout de chargement vidéo

Dans `player-anime.html`, ligne ~203 :
```javascript
const timeout = setTimeout(() => { ... }, 5000); // 5 secondes
```

Augmentez à 10000 (10s) si votre connexion est lente.

### Extraction Streamtape MP4

Dans `scraper-anime.js`, la fonction `extractStreamtapeMp4` utilise des regex pour extraire le lien.
Si ça ne marche plus (Streamtape change souvent), ouvrez un épisode VoirAnime, inspectez l'iframe Streamtape (F12), et trouvez le pattern du lien .mp4.

---

## 📝 Notes importantes

1. **VoirAnime change régulièrement** sa structure HTML. Les scrapes peuvent casser. Surveillez les logs.

2. **Les liens expirent** (quelques heures à quelques jours). Le re-scraping auto est implémenté.

3. **CORS peut bloquer** certains hébergeurs. Si un iframe ne s'affiche pas, c'est normal.

4. **Déduplication** : Si un user ajoute un anime déjà ajouté par un autre, aucun re-scraping n'est fait (économie de temps).

5. **Légalité** : VoirAnime héberge du contenu sous copyright. Usage à vos risques.

---

## ✅ Checklist finale

- [ ] Tables Supabase créées
- [ ] Backend déployé avec les nouvelles routes
- [ ] Frontend mis à jour avec tous les fichiers
- [ ] Test recherche VF fonctionne
- [ ] Test recherche VOSTFR fonctionne
- [ ] Test ajout anime fonctionne
- [ ] Test lecture vidéo fonctionne
- [ ] Test clic droit "Marquer vu/non vu" fonctionne
- [ ] Test épisode suivant fonctionne

Tout est bon ? Profitez ! 🎉
