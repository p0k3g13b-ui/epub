const BACKEND_URL = 'https://epub-backend.vercel.app';

// Map pour stocker les données des livres (évite les problèmes de caractères spéciaux dans JSON)
const booksDataMap = new Map();
let bookIndexCounter = 0;

// Gestion du menu latéral
const menuToggle = document.getElementById('menu-toggle');
const sideMenu = document.getElementById('side-menu');
const menuOverlay = document.getElementById('menu-overlay');
const sideMenuLogout = document.getElementById('side-menu-logout');

// Fonction pour ouvrir le menu
function openMenu() {
  sideMenu.classList.add('active');
  menuOverlay.classList.add('active');
  menuToggle.classList.add('active');
}

// Fonction pour fermer le menu
function closeMenu() {
  sideMenu.classList.remove('active');
  menuOverlay.classList.remove('active');
  menuToggle.classList.remove('active');
}

// Toggle menu au clic sur l'icône
menuToggle.addEventListener('click', () => {
  if (sideMenu.classList.contains('active')) {
    closeMenu();
  } else {
    openMenu();
  }
});

// Fermer le menu au clic sur l'overlay
menuOverlay.addEventListener('click', closeMenu);

// Déconnexion depuis le menu
sideMenuLogout.addEventListener('click', () => {
  logout();
});

// Gestion des onglets depuis le menu latéral
document.querySelectorAll('.side-menu-item').forEach(button => {
  button.addEventListener('click', () => {
    const tabName = button.dataset.tab;
    
    // Désactive tous les onglets
    document.querySelectorAll('.side-menu-item').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Active l'onglet cliqué
    button.classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    // Charge le catalogue si on clique sur l'onglet Catalogue
    if (tabName === 'catalog' && window.loadCatalog) {
      window.loadCatalog();
    }
    
    // Ferme le menu
    closeMenu();
  });
});

// Éléments du DOM
const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');
const searchStatus = document.getElementById('search-status');
const searchResults = document.getElementById('search-results');

// Recherche au clic sur le bouton
searchButton.addEventListener('click', performSearch);

// Recherche au appui sur Entrée
searchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    performSearch();
  }
});

// Fonction de recherche
async function performSearch() {
  const query = searchInput.value.trim();
  
  if (!query) {
    showStatus('Veuillez entrer un terme de recherche', 'error');
    return;
  }
  
  // Affiche le chargement
  searchButton.disabled = true;
  searchButton.textContent = 'Recherche...';
  showStatus('Recherche en cours sur Anna\'s Archive...', 'loading');
  searchResults.innerHTML = '';
  
  try {
    const response = await fetch(`${BACKEND_URL}/api/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
    });
    
    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success && data.results.length > 0) {
      showStatus(`${data.count} résultat(s) trouvé(s)`, 'success');
      displayResults(data.results);
    } else {
      showStatus('Aucun résultat trouvé. Essayez avec d\'autres mots-clés.', 'info');
    }
    
  } catch (error) {
    console.error('Erreur recherche:', error);
    showStatus(`Erreur lors de la recherche: ${error.message}`, 'error');
  } finally {
    searchButton.disabled = false;
    searchButton.textContent = 'Rechercher';
  }
}

// Affiche les résultats
function displayResults(results) {
  searchResults.innerHTML = '';
  
  // Réinitialise la map et le compteur
  booksDataMap.clear();
  bookIndexCounter = 0;
  
  results.forEach(result => {
    const resultCard = document.createElement('div');
    resultCard.className = 'result-card';
    
    // Stocke les données dans la Map avec un index
    const bookIndex = bookIndexCounter++;
    booksDataMap.set(bookIndex, result);
    
    // Affiche la couverture si disponible, sinon l'icône
    let coverHtml;
    if (result.coverUrl) {
      coverHtml = `<img src="${escapeHtml(result.coverUrl)}" alt="${escapeHtml(result.title)}" class="result-cover" referrerpolicy="no-referrer" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                   <div class="result-icon-fallback" style="display:none;">📚</div>`;
    } else {
      coverHtml = `<div class="result-icon">📚</div>`;
    }
    
    resultCard.innerHTML = `
      <div class="result-main">
        ${coverHtml}
        <div class="result-info">
          <h3 class="result-title">${escapeHtml(result.title)}</h3>
          <p class="result-author">${escapeHtml(result.author || 'Auteur inconnu')}</p>
          <div class="result-meta">
            ${result.year ? `<span>📅 ${result.year}</span>` : ''}
            ${result.language ? `<span>🌐 ${result.language}</span>` : ''}
            ${result.fileSize ? `<span>💾 ${result.fileSize}</span>` : ''}
          </div>
        </div>
      </div>
      <button class="add-button" data-book-index="${bookIndex}">
        ➕ Ajouter
      </button>
    `;
    
    searchResults.appendChild(resultCard);
  });
  
  // Ajoute les événements aux boutons
  document.querySelectorAll('.add-button').forEach(button => {
    button.addEventListener('click', () => {
      const bookIndex = parseInt(button.dataset.bookIndex);
      const bookData = booksDataMap.get(bookIndex);
      openAddBookModal(bookData);
    });
  });
}

// Ouvre la modal pour ajouter un livre
function openAddBookModal(bookData) {
  // Ouvre Anna's Archive dans un nouvel onglet
  window.open(bookData.bookUrl, '_blank');
  
  // Crée la modal
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>📥 Ajouter : ${escapeHtml(bookData.title)}</h2>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
      </div>
      
      <div class="modal-body">
        <div class="modal-steps">
          <div class="step">
            <span class="step-number">1️⃣</span>
            <p>Une page Anna's Archive s'est ouverte dans un nouvel onglet</p>
          </div>
          
          <div class="step">
            <span class="step-number">2️⃣</span>
            <p>Passez la vérification puis <strong>CLIC DROIT</strong> sur le bouton/lien "Download"<br>
            → Sélectionnez <strong>"Copier l'adresse du lien"</strong></p>
          </div>
          
          <div class="step">
            <span class="step-number">3️⃣</span>
            <p>Collez le lien ci-dessous :</p>
          </div>
        </div>
        
        <input 
          type="text" 
          id="download-link-input" 
          class="download-link-input"
          placeholder="https://ipfs.io/ipfs/... ou https://download.library.lol/..."
        >
        
        <div id="modal-status"></div>
      </div>
      
      <div class="modal-footer">
        <button class="modal-button secondary" onclick="this.closest('.modal-overlay').remove()">
          Annuler
        </button>
        <button class="modal-button primary" id="download-from-url-btn">
          📥 Télécharger et ajouter
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Focus sur l'input
  setTimeout(() => {
    document.getElementById('download-link-input').focus();
  }, 100);
  
  // Événement du bouton de téléchargement
  document.getElementById('download-from-url-btn').addEventListener('click', () => {
    const downloadUrl = document.getElementById('download-link-input').value.trim();
    addBookFromUrl(downloadUrl, bookData, modal);
  });
  
  // Appui sur Entrée
  document.getElementById('download-link-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const downloadUrl = e.target.value.trim();
      addBookFromUrl(downloadUrl, bookData, modal);
    }
  });
}

// Ajoute un livre depuis une URL de téléchargement
async function addBookFromUrl(downloadUrl, bookData, modal) {
  const statusEl = modal.querySelector('#modal-status');
  const downloadBtn = modal.querySelector('#download-from-url-btn');
  const inputEl = modal.querySelector('#download-link-input');
  
  // Validation du lien
  if (!downloadUrl) {
    statusEl.innerHTML = '<div class="status-message error">❌ Veuillez coller un lien de téléchargement</div>';
    return;
  }
  
  if (!downloadUrl.startsWith('http://') && !downloadUrl.startsWith('https://')) {
    statusEl.innerHTML = '<div class="status-message error">❌ Le lien doit commencer par http:// ou https://</div>';
    return;
  }
  
  // Récupère l'utilisateur actuel
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    statusEl.innerHTML = '<div class="status-message error">❌ Erreur : utilisateur non connecté</div>';
    return;
  }
  
  // Désactive l'interface
  downloadBtn.disabled = true;
  inputEl.disabled = true;
  downloadBtn.textContent = '⏳ Téléchargement en cours...';
  statusEl.innerHTML = '<div class="status-message loading">⏳ Téléchargement du fichier depuis le lien fourni...</div>';
  
  try {
    const response = await fetch(`${BACKEND_URL}/api/add-book-from-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        downloadUrl: downloadUrl,
        userId: currentUser.id, // Envoie l'ID utilisateur
        metadata: {
          title: bookData.title,
          author: bookData.author,
          year: bookData.year,
          language: bookData.language,
          coverUrl: bookData.coverUrl
        }
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      statusEl.innerHTML = '<div class="status-message success">✅ Livre ajouté avec succès !</div>';
      showStatus(`"${bookData.title}" a été ajouté à votre bibliothèque !`, 'success');
      
      // Ferme la modal après 2 secondes
      setTimeout(() => {
        modal.remove();
        // Recharge la bibliothèque
        if (window.loadLibrary) {
          window.loadLibrary();
        }
      }, 2000);
      
    } else if (response.status === 409 || data.alreadyOwned) {
      statusEl.innerHTML = '<div class="status-message info">ℹ️ Ce livre est déjà dans votre bibliothèque</div>';
      downloadBtn.disabled = false;
      inputEl.disabled = false;
      downloadBtn.textContent = '📥 Télécharger et ajouter';
    } else {
      throw new Error(data.message || 'Erreur lors de l\'ajout');
    }
    
  } catch (error) {
    console.error('Erreur ajout depuis URL:', error);
    statusEl.innerHTML = `<div class="status-message error">❌ ${error.message}</div>`;
    downloadBtn.disabled = false;
    inputEl.disabled = false;
    downloadBtn.textContent = '📥 Télécharger et ajouter';
  }
}

// Affiche un message de statut
function showStatus(message, type) {
  searchStatus.innerHTML = `
    <div class="status-message ${type}">
      ${getStatusIcon(type)} ${message}
    </div>
  `;
}

// Icône selon le type de statut
function getStatusIcon(type) {
  switch(type) {
    case 'loading': return '⏳';
    case 'success': return '✅';
    case 'error': return '❌';
    case 'info': return 'ℹ️';
    default: return '';
  }
}

// Échappe le HTML pour éviter les injections XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
