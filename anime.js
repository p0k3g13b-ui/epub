// Déclare BACKEND_URL seulement s'il n'existe pas déjà
if (typeof BACKEND_URL === 'undefined') {
  var BACKEND_URL = 'https://epub-backend.vercel.app';
}

const animesListEl = document.getElementById('animes-list');
const animeSearchVfInput = document.getElementById('search-anime-vf-input');
const animeSearchVostfrInput = document.getElementById('search-anime-vostfr-input');
const animeSearchVfBtn = document.getElementById('search-anime-vf-btn');
const animeSearchVostfrBtn = document.getElementById('search-anime-vostfr-btn');
const animeSearchStatus = document.getElementById('anime-search-status');
const animeSearchResults = document.getElementById('anime-search-results');

// Fonction pour charger les animes de l'utilisateur
window.loadAnimes = async function() {
  if (!animesListEl) return;
  animesListEl.innerHTML = '';

  if (!currentUser) {
    animesListEl.innerHTML = '<p>Erreur : utilisateur non connecté</p>';
    return;
  }

  try {
    // Récupère les animes de l'utilisateur
    const { data: userAnimes, error: animesError } = await supabaseClient
      .from('user_animes')
      .select(`
        id,
        added_at,
        animes_library (
          id,
          titre,
          cover_url,
          nb_episodes
        )
      `)
      .eq('user_id', currentUser.id)
      .order('added_at', { ascending: false });

    if (animesError) {
      console.error("❌ Erreur chargement animes:", animesError);
      animesListEl.innerHTML = '<p>Erreur lors du chargement des animes.</p>';
      return;
    }

    if (!userAnimes || userAnimes.length === 0) {
      animesListEl.innerHTML = '<p>Aucun anime dans votre bibliothèque. Ajoutez-en via le bouton + !</p>';
      return;
    }

    console.log("🎬 Animes chargés:", userAnimes.length);

    // Affiche les animes
    for (const userAnime of userAnimes) {
      if (userAnime.animes_library) {
        displayAnime(userAnime.animes_library);
      }
    }

  } catch (err) {
    console.error("❌ Erreur fatale:", err);
    animesListEl.innerHTML = '<p>Erreur lors du chargement.</p>';
  }
};

// Fonction pour afficher un anime
function displayAnime(anime) {
  const container = document.createElement('div');
  container.className = 'anime-item';
  container.dataset.animeId = anime.id;

  // Cover
  if (anime.cover_url) {
    const coverImg = document.createElement('img');
    coverImg.src = anime.cover_url;
    coverImg.alt = anime.titre;
    coverImg.className = 'anime-cover';
    container.appendChild(coverImg);
  } else {
    const placeholder = document.createElement('div');
    placeholder.className = 'anime-cover';
    placeholder.style.display = 'flex';
    placeholder.style.alignItems = 'center';
    placeholder.style.justifyContent = 'center';
    placeholder.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    placeholder.style.fontSize = '64px';
    placeholder.textContent = '🎬';
    container.appendChild(placeholder);
  }

  // Titre
  const title = document.createElement('div');
  title.className = 'anime-title';
  title.textContent = anime.titre;
  container.appendChild(title);

  // Clic pour ouvrir la page de l'anime
  container.addEventListener('click', () => {
    window.location.href = `anime.html?anime_id=${anime.id}`;
  });

  animesListEl.appendChild(container);
}

// Recherche VF
if (animeSearchVfBtn && animeSearchVfInput) {
  animeSearchVfBtn.addEventListener('click', () => performAnimeSearch('vf'));
  animeSearchVfInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performAnimeSearch('vf');
  });
}

// Recherche VOSTFR
if (animeSearchVostfrBtn && animeSearchVostfrInput) {
  animeSearchVostfrBtn.addEventListener('click', () => performAnimeSearch('vostfr'));
  animeSearchVostfrInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performAnimeSearch('vostfr');
  });
}

// Fonction de recherche anime
async function performAnimeSearch(language) {
  const input = language === 'vf' ? animeSearchVfInput : animeSearchVostfrInput;
  const btn = language === 'vf' ? animeSearchVfBtn : animeSearchVostfrBtn;
  const query = input.value.trim();

  if (!query) {
    showAnimeStatus('Veuillez entrer un nom d\'anime', 'error');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Recherche...';
  showAnimeStatus(`Recherche ${language.toUpperCase()} en cours...`, 'loading');
  animeSearchResults.innerHTML = '';

  try {
    const response = await fetch(`${BACKEND_URL}/api/search-anime`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, language })
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const data = await response.json();

    if (data.success && data.results.length > 0) {
      showAnimeStatus(`${data.results.length} résultat(s) trouvé(s)`, 'success');
      displayAnimeResults(data.results);
    } else {
      showAnimeStatus('Aucun résultat trouvé.', 'info');
    }

  } catch (error) {
    console.error('Erreur recherche anime:', error);
    showAnimeStatus(`Erreur: ${error.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Rechercher';
  }
}

// Affiche les résultats de recherche
function displayAnimeResults(results) {
  animeSearchResults.innerHTML = '';

  results.forEach(result => {
    const card = document.createElement('div');
    card.className = 'anime-result-card';

    card.innerHTML = `
      ${result.coverUrl ? 
        `<img src="${escapeHtml(result.coverUrl)}" alt="${escapeHtml(result.titre)}" class="anime-result-cover">` :
        '<div class="anime-result-cover" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; font-size: 32px;">🎬</div>'
      }
      <div class="anime-result-info">
        <div class="anime-result-title">${escapeHtml(result.titre)}</div>
        <div class="anime-result-meta">${result.nbEpisodes || '?'} épisodes</div>
      </div>
    `;

    card.addEventListener('click', () => openAnimeEpisodesModal(result));
    animeSearchResults.appendChild(card);
  });
}

// Ouvre la modal pour choisir les épisodes
function openAnimeEpisodesModal(animeData) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>📥 ${escapeHtml(animeData.titre)}</h2>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
      </div>
      
      <div class="modal-body">
        <p><strong>${animeData.nbEpisodes || '?'}</strong> épisodes disponibles</p>
        
        <div style="display: flex; gap: 12px; align-items: center; margin: 20px 0;">
          <label style="flex-shrink: 0;">Épisodes :</label>
          <input type="number" id="episode-start" min="1" max="${animeData.nbEpisodes || 999}" value="1" 
                 style="width: 80px; padding: 8px; border: 2px solid #e0e0e0; border-radius: 4px;">
          <span>à</span>
          <input type="number" id="episode-end" min="1" max="${animeData.nbEpisodes || 999}" value="${animeData.nbEpisodes || 12}" 
                 style="width: 80px; padding: 8px; border: 2px solid #e0e0e0; border-radius: 4px;">
        </div>
        
        <div id="modal-anime-status"></div>
      </div>
      
      <div class="modal-footer">
        <button class="modal-button secondary" onclick="this.closest('.modal-overlay').remove()">
          Annuler
        </button>
        <button class="modal-button primary" id="add-anime-episodes-btn">
          ➕ Ajouter les épisodes
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Événement du bouton d'ajout
  document.getElementById('add-anime-episodes-btn').addEventListener('click', () => {
    addAnimeEpisodes(animeData, modal);
  });
}

// Ajoute les épisodes d'un anime
async function addAnimeEpisodes(animeData, modal) {
  const startInput = document.getElementById('episode-start');
  const endInput = document.getElementById('episode-end');
  const statusEl = document.getElementById('modal-anime-status');
  const addBtn = document.getElementById('add-anime-episodes-btn');

  const start = parseInt(startInput.value);
  const end = parseInt(endInput.value);

  if (!start || !end || start > end || start < 1) {
    statusEl.innerHTML = '<div class="status-message error">❌ Plage d\'épisodes invalide</div>';
    return;
  }

  const user = await getCurrentUser();
  if (!user) {
    statusEl.innerHTML = '<div class="status-message error">❌ Utilisateur non connecté</div>';
    return;
  }

  addBtn.disabled = true;
  startInput.disabled = true;
  endInput.disabled = true;
  addBtn.textContent = '⏳ Ajout en cours...';
  statusEl.innerHTML = '<div class="status-message loading">⏳ Scraping et ajout des épisodes...</div>';

  try {
    const response = await fetch(`${BACKEND_URL}/api/add-anime-episodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        animeUrl: animeData.url,
        userId: user.id,
        episodeStart: start,
        episodeEnd: end,
        metadata: {
          titre: animeData.titre,
          coverUrl: animeData.coverUrl,
          nbEpisodes: animeData.nbEpisodes
        }
      })
    });

    const data = await response.json();

    if (data.success) {
      statusEl.innerHTML = '<div class="status-message success">✅ Épisodes ajoutés avec succès !</div>';
      
      setTimeout(() => {
        modal.remove();
        // Recharge la liste des animes
        if (window.loadAnimes) {
          window.loadAnimes();
        }
        // Ferme le panneau droit
        closeRightPanel();
      }, 1500);
    } else {
      throw new Error(data.message || 'Erreur lors de l\'ajout');
    }

  } catch (error) {
    console.error('Erreur ajout anime:', error);
    statusEl.innerHTML = `<div class="status-message error">❌ ${error.message}</div>`;
    addBtn.disabled = false;
    startInput.disabled = false;
    endInput.disabled = false;
    addBtn.textContent = '➕ Ajouter les épisodes';
  }
}

// Affiche un message de statut pour les animes
function showAnimeStatus(message, type) {
  if (!animeSearchStatus) return;
  
  animeSearchStatus.innerHTML = `
    <div class="status-message ${type}">
      ${getStatusIcon(type)} ${message}
    </div>
  `;
}

// Helper getCurrentUser (si pas déjà défini)
async function getCurrentUser() {
  if (typeof currentUser !== 'undefined' && currentUser) {
    return currentUser;
  }
  
  if (typeof supabaseClient !== 'undefined') {
    const { data: { user } } = await supabaseClient.auth.getUser();
    return user;
  }
  
  return null;
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getStatusIcon(type) {
  switch(type) {
    case 'loading': return '⏳';
    case 'success': return '✅';
    case 'error': return '❌';
    case 'info': return 'ℹ️';
    default: return '';
  }
}
