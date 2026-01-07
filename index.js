// --- Vérification de l'authentification ---
let currentUser = null;

(async () => {
  try {
    currentUser = await requireAuth();
    console.log('✅ Utilisateur connecté:', currentUser);
    
    // Affiche le nom d'utilisateur et le bouton de déconnexion
    displayUserInfo(currentUser);
    
    // Vérifie s'il faut ouvrir un onglet spécifique
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    
    if (tabParam === 'animes') {
      // Active l'onglet animes
      document.querySelectorAll('.side-menu-item').forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
      
      const animesBtn = document.querySelector('.side-menu-item[data-tab="animes"]');
      const animesTab = document.getElementById('animes-tab');
      
      if (animesBtn) animesBtn.classList.add('active');
      if (animesTab) animesTab.classList.add('active');
      
      // Charge les animes
      if (window.loadAnimes) {
        window.loadAnimes();
      }
    } else {
      // Charge la bibliothèque par défaut
      window.loadLibrary();
    }
  } catch (err) {
    console.error('Erreur auth:', err);
    // requireAuth redirige déjà
  }
})();

// Fonction pour afficher les infos utilisateur
function displayUserInfo(user) {
  const topBarUser = document.querySelector('.top-bar-user');
  const sideMenuUser = document.querySelector('.side-menu-user');
  
  // Affiche le pseudo dans la barre supérieure
  topBarUser.textContent = user.username || user.email;
  
  // Affiche le pseudo avec icône dans le menu latéral
  sideMenuUser.innerHTML = `👤 ${user.username || user.email}`;
}

const epubListEl = document.getElementById('epub-list');
const catalogListEl = document.getElementById('catalog-list');
const statusFilter = document.getElementById('status-filter');
const contextMenu = document.getElementById('status-context-menu');

let currentBooks = []; // Stocke tous les livres pour le filtrage
let selectedBookId = null; // Pour le menu contextuel
let selectedEpubId = null; // Pour connaître l'epub_id lors de la suppression

// Variables pour l'appui long sur mobile
let touchTimer = null;
let touchStartPos = { x: 0, y: 0 };

// Gestion du filtrage
statusFilter.addEventListener('change', () => {
  filterAndDisplayBooks();
});

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
        reading_status,
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
      epubListEl.innerHTML = '<p>Aucun livre dans votre bibliothèque. Ajoutez-en via le bouton + !</p>';
      currentBooks = [];
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

    // 4. Enrichit les données avec user_book_id et reading_status
    const enrichedBooks = userBooks.map(ub => ({
      ...ub.epubs_library,
      user_book_id: ub.id,
      reading_status: ub.reading_status || 'unread',
      added_at: ub.added_at,
      last_opened: lastOpenedMap[ub.epubs_library?.id] || null
    })).filter(book => book.id); // Filtre les livres sans epub_library

    // 5. Stocke pour le filtrage
    currentBooks = enrichedBooks;

    // 6. Affiche avec filtrage actif
    filterAndDisplayBooks();

  } catch (err) {
    console.error("❌ Erreur fatale:", err);
    epubListEl.innerHTML = '<p>Erreur lors du chargement.</p>';
  }
};

// Fonction pour filtrer et afficher les livres
async function filterAndDisplayBooks() {
  epubListEl.innerHTML = '';
  
  const filterValue = statusFilter.value;
  
  // Filtre selon la sélection
  let filteredBooks = currentBooks;
  if (filterValue !== 'all') {
    filteredBooks = currentBooks.filter(book => book.reading_status === filterValue);
  }
  
  if (filteredBooks.length === 0) {
    const statusLabels = {
      reading: 'en cours',
      unread: 'non lus',
      read: 'lus'
    };
    const label = filterValue === 'all' ? 'dans votre bibliothèque' : statusLabels[filterValue];
    epubListEl.innerHTML = `<p>Aucun livre ${label}.</p>`;
    return;
  }
  
  // Tri par catégorie : En cours > Non lu > Lu
  const statusOrder = { reading: 1, unread: 2, read: 3 };
  
  const sortedBooks = [...filteredBooks].sort((a, b) => {
    const statusA = statusOrder[a.reading_status] || 99;
    const statusB = statusOrder[b.reading_status] || 99;
    
    // Tri principal par statut
    if (statusA !== statusB) {
      return statusA - statusB;
    }
    
    // Tri secondaire par dernière ouverture
    const dateA = a.last_opened;
    const dateB = b.last_opened;
    
    if (!dateA && !dateB) {
      return new Date(b.added_at) - new Date(a.added_at);
    }
    if (!dateA) return 1;
    if (!dateB) return -1;
    return dateB - dateA;
  });
  
  // Affiche les livres
  for (const book of sortedBooks) {
    await displayBook(book);
  }
}

// Fonction pour afficher un livre
async function displayBook(book) {
  const container = document.createElement('div');
  container.className = 'epub-item';
  container.dataset.userBookId = book.user_book_id;
  container.dataset.epubId = book.id;

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

  // Ajoute le statut
  const status = document.createElement('div');
  status.className = `epub-status ${book.reading_status}`;
  const statusLabels = {
    unread: 'Non lu',
    reading: 'En cours',
    read: 'Lu'
  };
  status.textContent = statusLabels[book.reading_status] || 'Non lu';
  container.appendChild(status);

  // Ajoute le titre
  const title = document.createElement('div');
  title.className = 'epub-title';
  title.textContent = book.title;
  container.appendChild(title);

  // Événement clic (lecture)
  container.addEventListener('click', (e) => {
    // Ne pas ouvrir si on a cliqué sur le menu contextuel
    if (e.button !== 0) return;
    window.location.href = `reader.html?epub_id=${book.id}`;
  });

  // Événement clic droit (menu contextuel)
  container.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY, book.user_book_id, book.id);
  });

  // Support tactile (appui long) pour mobile
  container.addEventListener('touchstart', (e) => {
    touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    touchTimer = setTimeout(() => {
      // Simule un clic droit après 500ms d'appui
      const touch = e.touches[0];
      showContextMenu(touch.clientX, touch.clientY, book.user_book_id, book.id);
      // Empêche le clic normal
      container.style.pointerEvents = 'none';
      setTimeout(() => {
        container.style.pointerEvents = 'auto';
      }, 100);
    }, 500);
  });

  container.addEventListener('touchmove', (e) => {
    // Si l'utilisateur bouge trop, annule l'appui long
    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartPos.x);
    const deltaY = Math.abs(touch.clientY - touchStartPos.y);
    if (deltaX > 10 || deltaY > 10) {
      clearTimeout(touchTimer);
    }
  });

  container.addEventListener('touchend', () => {
    clearTimeout(touchTimer);
  });

  container.addEventListener('touchcancel', () => {
    clearTimeout(touchTimer);
  });

  epubListEl.appendChild(container);
}

// Fonction pour afficher le menu contextuel
function showContextMenu(x, y, userBookId, epubId) {
  selectedBookId = userBookId;
  selectedEpubId = epubId;
  contextMenu.style.display = 'block';
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;
}

// Fonction pour masquer le menu contextuel
function hideContextMenu() {
  contextMenu.style.display = 'none';
  selectedBookId = null;
  selectedEpubId = null;
}

// Masquer le menu au clic ailleurs
document.addEventListener('click', hideContextMenu);

// Empêcher la fermeture si on clique sur le menu lui-même
contextMenu.addEventListener('click', (e) => {
  e.stopPropagation();
});

// Gestion des clics sur les items du menu
document.querySelectorAll('.context-menu-item').forEach(item => {
  item.addEventListener('click', async () => {
    const newStatus = item.dataset.status;
    const action = item.dataset.action;
    
    if (action === 'remove') {
      // Suppression du livre
      await removeBookFromLibrary(selectedBookId, selectedEpubId);
    } else if (newStatus && selectedBookId) {
      // Changement de statut
      await updateReadingStatus(selectedBookId, newStatus);
    }
    
    hideContextMenu();
  });
});

// Fonction pour mettre à jour le statut de lecture
async function updateReadingStatus(userBookId, newStatus) {
  try {
    const { error } = await supabaseClient
      .from('user_books')
      .update({ reading_status: newStatus })
      .eq('id', userBookId);
    
    if (error) {
      console.error('❌ Erreur mise à jour statut:', error);
      alert('Erreur lors de la mise à jour du statut');
      return;
    }
    
    console.log(`✅ Statut mis à jour: ${newStatus}`);
    
    // Met à jour dans currentBooks
    const book = currentBooks.find(b => b.user_book_id === userBookId);
    if (book) {
      book.reading_status = newStatus;
    }
    
    // Recharge l'affichage
    await filterAndDisplayBooks();
    
  } catch (err) {
    console.error('❌ Erreur:', err);
    alert('Erreur lors de la mise à jour du statut');
  }
}

// Fonction pour retirer un livre de la bibliothèque
async function removeBookFromLibrary(userBookId, epubId) {
  // Demande confirmation
  const book = currentBooks.find(b => b.user_book_id === userBookId);
  const bookTitle = book ? book.title : 'ce livre';
  
  if (!confirm(`Voulez-vous vraiment retirer "${bookTitle}" de votre bibliothèque ?`)) {
    return;
  }
  
  try {
    // Supprime de user_books (pas de epubs_library, juste la relation)
    const { error } = await supabaseClient
      .from('user_books')
      .delete()
      .eq('id', userBookId);
    
    if (error) {
      console.error('❌ Erreur suppression:', error);
      alert('Erreur lors de la suppression du livre');
      return;
    }
    
    console.log(`✅ Livre retiré de la bibliothèque: ${bookTitle}`);
    
    // Supprime de currentBooks
    currentBooks = currentBooks.filter(b => b.user_book_id !== userBookId);
    
    // Recharge l'affichage
    await filterAndDisplayBooks();
    
  } catch (err) {
    console.error('❌ Erreur:', err);
    alert('Erreur lors de la suppression du livre');
  }
}

// Fonction pour charger le catalogue (bibliothèque commune)
window.loadCatalog = async function() {
  if (!catalogListEl) return; // Si le catalogue est commenté
  
  catalogListEl.innerHTML = '';

  if (!currentUser) {
    catalogListEl.innerHTML = '<p>Erreur : utilisateur non connecté</p>';
    return;
  }

  try {
    // 1. Récupère TOUS les livres de la bibliothèque commune
    const { data: allEpubs, error: epubsError } = await supabaseClient
      .from('epubs_library')
      .select('*')
      .order('uploaded_at', { ascending: false });

    if (epubsError) {
      console.error("❌ Erreur chargement catalogue:", epubsError);
      catalogListEl.innerHTML = '<p>Erreur lors du chargement du catalogue.</p>';
      return;
    }

    if (!allEpubs || allEpubs.length === 0) {
      catalogListEl.innerHTML = '<p>Le catalogue est vide. Ajoutez des livres via le bouton + !</p>';
      return;
    }

    console.log("📖 Livres dans le catalogue:", allEpubs.length);

    // 2. Récupère les livres de l'utilisateur pour savoir lesquels il a déjà
    const { data: userBooks, error: userBooksError } = await supabaseClient
      .from('user_books')
      .select('epub_id')
      .eq('user_id', currentUser.id);

    if (userBooksError) {
      console.warn("⚠️ Erreur chargement user_books:", userBooksError);
    }

    // 3. Crée un Set des epub_id que l'utilisateur possède
    const userEpubIds = new Set(userBooks ? userBooks.map(ub => ub.epub_id) : []);

    // 4. Affiche tous les livres
    for (const epub of allEpubs) {
      await displayCatalogBook(epub, userEpubIds.has(epub.id));
    }

  } catch (err) {
    console.error("❌ Erreur fatale:", err);
    catalogListEl.innerHTML = '<p>Erreur lors du chargement.</p>';
  }
};

// Fonction pour afficher un livre du catalogue
async function displayCatalogBook(book, inUserLibrary) {
  const container = document.createElement('div');
  container.className = 'epub-item catalog-item';

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

  // Ajoute le bouton d'action (overlay)
  const actionBtn = document.createElement('button');
  actionBtn.className = inUserLibrary ? 'catalog-action-btn in-library' : 'catalog-action-btn add-to-library';
  actionBtn.textContent = inUserLibrary ? '✓ Dans ma bibliothèque' : '+ Ajouter';
  actionBtn.dataset.epubId = book.id;
  actionBtn.dataset.inLibrary = inUserLibrary;

  actionBtn.addEventListener('click', async (e) => {
    e.stopPropagation(); // Empêche le clic sur le container
    await toggleBookInLibrary(book.id, actionBtn);
  });

  container.appendChild(actionBtn);

  // Événement clic sur le container (pour lire directement si dans la bibliothèque)
  container.addEventListener('click', () => {
    if (inUserLibrary) {
      window.location.href = `reader.html?epub_id=${book.id}`;
    } else {
      // Si pas dans la bibliothèque, on l'ajoute
      toggleBookInLibrary(book.id, actionBtn);
    }
  });

  catalogListEl.appendChild(container);
}

// Fonction pour ajouter/retirer un livre de la bibliothèque personnelle
async function toggleBookInLibrary(epubId, button) {
  const isInLibrary = button.dataset.inLibrary === 'true';

  button.disabled = true;
  button.textContent = isInLibrary ? 'Retrait...' : 'Ajout...';

  try {
    if (isInLibrary) {
      // Retirer de la bibliothèque
      const { error } = await supabaseClient
        .from('user_books')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('epub_id', epubId);

      if (error) {
        console.error('Erreur retrait:', error);
        alert('Erreur lors du retrait du livre');
        return;
      }

      console.log('✅ Livre retiré de la bibliothèque');
      button.textContent = '+ Ajouter';
      button.className = 'catalog-action-btn add-to-library';
      button.dataset.inLibrary = 'false';

    } else {
      // Ajouter à la bibliothèque
      const { error } = await supabaseClient
        .from('user_books')
        .insert({
          user_id: currentUser.id,
          epub_id: epubId
        });

      if (error) {
        console.error('Erreur ajout:', error);
        alert('Erreur lors de l\'ajout du livre');
        return;
      }

      console.log('✅ Livre ajouté à la bibliothèque');
      button.textContent = '✓ Dans ma bibliothèque';
      button.className = 'catalog-action-btn in-library';
      button.dataset.inLibrary = 'true';
    }

    button.disabled = false;

  } catch (err) {
    console.error('Erreur toggle:', err);
    alert('Erreur lors de l\'opération');
    button.disabled = false;
    button.textContent = isInLibrary ? '✓ Dans ma bibliothèque' : '+ Ajouter';
  }
}
