// --- Vérification de l'authentification ---
let currentUser = null;

(async () => {
  try {
    currentUser = await requireAuth();
    console.log('✅ Utilisateur connecté:', currentUser);
    
    // Affiche le nom d'utilisateur et le bouton de déconnexion
    displayUserInfo(currentUser);
    
    // Charge la bibliothèque
    window.loadLibrary();
  } catch (err) {
    console.error('Erreur auth:', err);
    // requireAuth redirige déjà
  }
})();

// Fonction pour afficher les infos utilisateur
function displayUserInfo(user) {
  const tabs = document.querySelector('.tabs');
  
  // Crée le conteneur d'infos utilisateur
  const userInfo = document.createElement('div');
  userInfo.className = 'user-info';
  userInfo.innerHTML = `
    <span class="username">👤 ${user.username || user.email}</span>
    <button class="logout-btn" onclick="logout()">🚪 Déconnexion</button>
  `;
  
  tabs.appendChild(userInfo);
}

const epubListEl = document.getElementById('epub-list');

// Fonction globale pour charger la bibliothèque (appelée depuis search.js)
window.loadLibrary = async function() {
  // Vide la liste avant de recharger
  epubListEl.innerHTML = '';

  if (!currentUser) {
    epubListEl.innerHTML = '<p>Erreur : utilisateur non connecté</p>';
    return;
  }

  try {
    // 1. Récupère les livres de l'utilisateur via user_books + epubs_library
    const { data: userBooks, error: booksError } = await supabaseClient
      .from('user_books')
      .select(`
        id,
        added_at,
        epubs_library (
          id,
          title,
          author,
          filename,
          cover_url,
          file_size,
          language,
          year
        )
      `)
      .eq('user_id', currentUser.id)
      .order('added_at', { ascending: false });

    if (booksError) {
      console.error("❌ Erreur chargement livres:", booksError);
      epubListEl.innerHTML = '<p>Erreur lors du chargement des livres.</p>';
      return;
    }

    if (!userBooks || userBooks.length === 0) {
      epubListEl.innerHTML = '<p>Aucun livre dans votre bibliothèque. Ajoutez-en via l\'onglet Recherche !</p>';
      return;
    }

    console.log("📚 Livres chargés:", userBooks.length);

    // 2. Récupère les positions de lecture pour le tri
    const { data: positions, error: positionsError } = await supabaseClient
      .from('reading_positions')
      .select('epub_id, last_opened')
      .eq('user_id', currentUser.id);

    if (positionsError) {
      console.warn("⚠️ Erreur positions (non bloquant):", positionsError);
    }

    // 3. Crée un map epub_id → date de dernière ouverture
    const lastOpenedMap = {};
    if (positions) {
      positions.forEach(p => {
        lastOpenedMap[p.epub_id] = new Date(p.last_opened);
      });
    }

    console.log("📅 Positions de lecture:", Object.keys(lastOpenedMap).length);

    // 4. Trie les livres : récemment lus en premier
    const sortedBooks = [...userBooks].sort((a, b) => {
      const epubIdA = a.epubs_library?.id;
      const epubIdB = b.epubs_library?.id;
      
      const dateA = epubIdA ? lastOpenedMap[epubIdA] : null;
      const dateB = epubIdB ? lastOpenedMap[epubIdB] : null;

      // Si aucun n'a été ouvert, ordre par date d'ajout (plus récent d'abord)
      if (!dateA && !dateB) {
        return new Date(b.added_at) - new Date(a.added_at);
      }

      // Si seulement A n'a pas été ouvert, B avant A
      if (!dateA) return 1;

      // Si seulement B n'a pas été ouvert, A avant B
      if (!dateB) return -1;

      // Les deux ont été ouverts, le plus récent en premier
      return dateB - dateA;
    });

    console.log("📊 Ordre d'affichage:", sortedBooks.map(b => b.epubs_library?.title));

    // 5. Affiche les livres UN PAR UN
    for (const userBook of sortedBooks) {
      const book = userBook.epubs_library;
      if (book) {
        await displayBook(book);
      }
    }

  } catch (err) {
    console.error("❌ Erreur fatale:", err);
    epubListEl.innerHTML = '<p>Erreur lors du chargement.</p>';
  }
};

// Fonction pour afficher un livre
async function displayBook(book) {
  const container = document.createElement('div');
  container.className = 'epub-item';

  // Si une couverture existe, l'afficher
  if (book.cover_url) {
    const coverImg = document.createElement('img');
    coverImg.src = book.cover_url;
    coverImg.alt = book.title;
    coverImg.style.width = '100%';
    coverImg.style.height = '220px';
    coverImg.style.objectFit = 'cover';
    container.appendChild(coverImg);
  } else {
    // Sinon, afficher un fond coloré avec l'icône
    const placeholder = document.createElement('div');
    placeholder.style.width = '100%';
    placeholder.style.height = '220px';
    placeholder.style.display = 'flex';
    placeholder.style.alignItems = 'center';
    placeholder.style.justifyContent = 'center';
    placeholder.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    placeholder.style.fontSize = '64px';
    placeholder.textContent = '📚';
    container.appendChild(placeholder);
  }

  // Ajoute le titre
  const title = document.createElement('div');
  title.className = 'epub-title';
  title.textContent = book.title;
  container.appendChild(title);

  // Événement clic - passe l'epub_id au lieu du filename
  container.addEventListener('click', () => {
    window.location.href = `reader.html?epub_id=${book.id}`;
  });

  epubListEl.appendChild(container);
}
