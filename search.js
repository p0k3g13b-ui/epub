// URL du backend
const BACKEND_URL = 'https://epub-backend.vercel.app';

// Gestion des onglets
document.querySelectorAll('.tab-button').forEach(button => {
  button.addEventListener('click', () => {
    const tabName = button.dataset.tab;
    
    // Désactive tous les onglets
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Active l'onglet cliqué
    button.classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
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
  
  results.forEach(result => {
    const resultCard = document.createElement('div');
    resultCard.className = 'result-card';
    
    resultCard.innerHTML = `
      <div class="result-main">
        <div class="result-icon">📚</div>
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
      <button class="add-button" data-book='${JSON.stringify(result)}'>
        ➕ Ajouter
      </button>
    `;
    
    searchResults.appendChild(resultCard);
  });
  
  // Ajoute les événements aux boutons
  document.querySelectorAll('.add-button').forEach(button => {
    button.addEventListener('click', () => {
      const bookData = JSON.parse(button.dataset.book);
      addBookToLibrary(bookData, button);
    });
  });
}

// Ajoute un livre à la bibliothèque
async function addBookToLibrary(bookData, button) {
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = '⏳ Téléchargement...';
  
  try {
    const response = await fetch(`${BACKEND_URL}/api/add-book`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        bookUrl: bookData.bookUrl,
        metadata: {
          title: bookData.title,
          author: bookData.author,
          year: bookData.year,
          language: bookData.language
        }
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      button.textContent = '✅ Ajouté !';
      button.classList.add('added');
      showStatus(`"${bookData.title}" a été ajouté à votre bibliothèque !`, 'success');
      
      // Recharge la bibliothèque après 1 seconde
      setTimeout(() => {
        // Recharge la page de la bibliothèque
        if (window.loadLibrary) {
          window.loadLibrary();
        }
      }, 1000);
      
    } else if (response.status === 409) {
      // Doublon
      button.textContent = '📚 Déjà dans la bibliothèque';
      button.classList.add('already-added');
      showStatus(data.message, 'info');
    } else {
      throw new Error(data.message || 'Erreur lors de l\'ajout');
    }
    
  } catch (error) {
    console.error('Erreur ajout:', error);
    button.disabled = false;
    button.textContent = originalText;
    showStatus(`Erreur: ${error.message}`, 'error');
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
