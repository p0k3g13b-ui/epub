# 📸 Guide d'ajout des couvertures

## 🎯 Objectif
Ajouter des images de couverture pour tes livres afin qu'elles s'affichent sur la page d'accueil.

---

## 📋 Méthode 1 : Upload dans Supabase Storage (recommandé)

### Étape 1 : Télécharge les images de couverture

Pour chaque livre, trouve une image :
- **Google Images** : Cherche "nom du livre + cover"
- **Amazon** : Page du livre → clic droit sur la couverture → "Enregistrer l'image sous"
- **Goodreads** : Même méthode
- Format recommandé : JPG ou PNG, environ 400x600 pixels

### Étape 2 : Upload dans Supabase

1. Va dans **Storage** → clique sur bucket `epubs`
2. Clique **Upload file**
3. Sélectionne l'image de couverture
4. Nomme-la de façon claire : `lamal-cover.jpg`, `intenebris-cover.jpg`, etc.

### Étape 3 : Récupère l'URL

1. Dans le bucket `epubs`, clique sur l'image que tu viens d'uploader
2. Copie l'URL publique (quelque chose comme : `https://qtqkbuvmbakiheqcyxed.supabase.co/storage/v1/object/public/epubs/lamal-cover.jpg`)

### Étape 4 : Ajoute l'URL dans la table `books`

1. Va dans **Table Editor** → table `books`
2. Trouve la ligne du livre correspondant
3. Clique sur le crayon ✏️ pour éditer
4. Dans le champ `cover_url`, colle l'URL que tu as copiée
5. **Save**

### Étape 5 : Rafraîchis ton site

Les couvertures devraient maintenant s'afficher ! 🎉

---

## 📋 Méthode 2 : Utiliser des URLs externes (plus rapide)

Si tu ne veux pas uploader dans Supabase, tu peux utiliser des URLs externes :

### Étape 1 : Trouve l'URL d'une image en ligne

1. Cherche le livre sur Google Images
2. Clic droit sur la couverture → **"Copier l'adresse de l'image"**
3. Tu obtiens une URL genre : `https://m.media-amazon.com/images/I/51abc123.jpg`

### Étape 2 : Ajoute l'URL dans la table

1. **Table Editor** → table `books`
2. Édite la ligne
3. Colle l'URL dans `cover_url`
4. **Save**

⚠️ **Attention** : Les URLs externes peuvent expirer ou changer.

---

## 🎨 Si tu n'as pas de couverture

Pas de problème ! Si `cover_url` est vide (NULL), le site affichera automatiquement :
- Un fond dégradé violet/bleu stylé
- Une icône de livre 📚
- Le titre reste visible

---

## 📝 Exemple complet

Pour le livre "L'âme du mal" :

**Dans la table `books` :**
```
id: 123...
title: L'âme du mal
author: Maxime Chattam
filename: lamal.epub
cover_url: https://qtqkbuvmbakiheqcyxed.supabase.co/storage/v1/object/public/epubs/lamal-cover.jpg
```

**Résultat sur le site :**
- Une belle image de couverture s'affiche
- Titre en bas : "L'âme du mal"
- Cliquable pour lire le livre

---

## 🐛 Dépannage

### La couverture ne s'affiche pas
- Vérifie que l'URL est correcte (copie-la dans le navigateur)
- Vérifie qu'il n'y a pas d'espace avant/après l'URL
- Si image dans Supabase : vérifie que le bucket est public

### Image déformée
- Utilise des images avec ratio ~2:3 (portrait)
- Dimensions recommandées : 400x600 ou 600x900 pixels

### Image floue
- Utilise une image plus grande (minimum 400px de largeur)

---

## ✅ Checklist

Pour chaque livre :
- [ ] Trouver une image de couverture de bonne qualité
- [ ] L'uploader dans Supabase Storage OU récupérer une URL externe
- [ ] Copier l'URL publique
- [ ] La coller dans le champ `cover_url` de la table `books`
- [ ] Sauvegarder
- [ ] Rafraîchir le site pour vérifier

---

## 🚀 Prochaine étape

Une fois les couvertures ajoutées, la **Phase 1** sera complète !

On pourra passer à la **Phase 2** : Backend de recherche Anna's Archive 🎯
