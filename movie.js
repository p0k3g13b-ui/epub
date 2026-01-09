// Déclare BACKEND_URL seulement s'il n'existe pas déjà
if (typeof BACKEND_URL === 'undefined') {
  var BACKEND_URL = 'https://epub-backend.vercel.app';
}

const moviesListEl = document.getElementById('movies-list');
const movieSearchInput = document.getElementById('search-movie-input');
const movieSearchBtn = document.getElementById('search-movie-btn');
const movieSearchStatus = document.getElementById('movie-search-status');
const movieSearchResults = document.getElementById('movie-search-results');
const movieStatusFilter = document.getElementById('movie-status-filter');

let currentMovies = []; // Stocke tous les films pour le filtrage
let selectedMovieId = null; // Pour le menu contextuel

// Fonction pour convertir une URL d'image en URL proxifiée
function getProxiedImageUrl(imageUrl) {
  if (!imageUrl) return null;
  return `${BACKEND_URL}/proxy-image?url=${encodeURIComponent(imageUrl)}`;
}

// Fonction pour charger les films de l'utilisateur
window.loadMovies = async function() {
  if (!moviesListEl) return;
  moviesListEl.innerHTML = '';

  if (!currentUser) {
    moviesListEl.innerHTML = '<p>Erreur : utilisateur non connecté</p>';
    return;
  }

  try {
    // Récupère les films de l'utilisateur
    const { data: userMovies, error: moviesError } = await supabaseClient
      .from('user_movies')
      .select(`
        id,
        added_at,
        reading_status,
        movies_library (
          id,
          titre,
          cover_url,
          duration,
          quality
        )
      `)
      .eq('user_id', currentUser.id)
      .order('added_at', { ascending: false });

    if (moviesError) {
      console.error("❌ Erreur chargement films:", moviesError);
      moviesListEl.innerHTML = '<p>Erreur lors du chargement des films.</p>';
      return;
    }

    if (!userMovies || userMovies.length === 0) {
      moviesListEl.innerHTML = '<p>Aucun film dans votre bibliothèque. Ajoutez-en via le bouton + !</p>';
      currentMovies = [];
      return;
    }

    console.log("🎬 Films chargés:", userMovies.length);

    // Récupère les positions de visionnage
    const movieIds = userMovies.map(um => um.movies_library?.id).filter(Boolean);
    const { data: positions, error: positionsError } = await supabaseClient
      .from('movie_viewing_positions')
      .select('movie_id, last_watched')
      .eq('user_id', currentUser.id)
      .in('movie_id', movieIds);

    if (positionsError) {
      console.warn("⚠️ Erreur positions (non bloquant):", positionsError);
    }

    // Crée un map movie_id → date de dernière ouverture
    const lastWatchedMap = {};
    if (positions) {
      positions.forEach(p => {
        lastWatchedMap[p.movie_id] = new Date(p.last_watched);
      });
    }

    // Enrichit les données
    const enrichedMovies = userMovies.map(um => ({
      ...um.movies_library,
      user_movie_id: um.id,
      reading_status: um.reading_status || 'unread',
      added_at: um.added_at,
      last_watched: lastWatchedMap[um.movies_library?.id] || null
    })).filter(movie => movie.id);

    currentMovies = enrichedMovies;

    // Affiche avec filtrage actif
    filterAndDisplayMovies();

  } catch (err) {
    console.error("❌ Erreur fatale:", err);
    moviesListEl.innerHTML = '<p>Erreur lors du chargement.</p>';
  }
};

// Fonction pour filtrer et afficher les films
async function filterAndDisplayMovies() {
  if (!moviesListEl) return;
  moviesListEl.innerHTML = '';
  
  const filterValue = movieStatusFilter ? movieStatusFilter.value : 'all';
  
  // Filtre selon la sélection
  let filteredMovies = currentMovies;
  if (filterValue !== 'all') {
    filteredMovies = currentMovies.filter(movie => movie.reading_status === filterValue);
  }
  
  if (filteredMovies.length === 0) {
    const statusLabels = {
      watching: 'en cours',
      unread: 'non vus',
      watched: 'vus'
    };
    const label = filterValue === 'all' ? 'dans votre bibliothèque' : statusLabels[filterValue];
    moviesListEl.innerHTML = `<p>Aucun film ${label}.</p>`;
    return;
  }
  
  // Tri par catégorie
  const statusOrder = { watching: 1, unread: 2, watched: 3 };
  
  const sortedMovies = [...filteredMovies].sort((a, b) => {
    const statusA = statusOrder[a.reading_status] || 99;
    const statusB = statusOrder[b.reading_status] || 99;
    
    if (statusA !== statusB) {
      return statusA - statusB;
    }
    
    const dateA = a.last_watched;
    const dateB = b.last_watched;
    
    if (!dateA && !dateB) {
      return new Date(b.added_at) - new Date(a.added_at);
    }
    if (!dateA) return 1;
    if (!dateB) return -1;
    return dateB - dateA;
  });
  
  // Affiche les films
  for (const movie of sortedMovies) {
    displayMovie(movie);
  }
}

// Fonction pour afficher un film
function displayMovie(movie) {
  const container = document.createElement('div');
  container.className = 'movie-item';
  container.dataset.userMovieId = movie.user_movie_id;
  container.dataset.movieId = movie.id;

  // Cover avec proxy
  if (movie.cover_url) {
    const coverImg = document.createElement('img');
    coverImg.src = getProxiedImageUrl(movie.cover_url);
    coverImg.alt = movie.titre;
    coverImg.className = 'movie-cover';
    container.appendChild(coverImg);
  } else {
    const placeholder = document.createElement('div');
    placeholder.className = 'movie-cover';
    placeholder.style.display = 'flex';
    placeholder.style.alignItems = 'center';
    placeholder.style.justifyContent = 'center';
    placeholder.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    placeholder.style.fontSize = '64px';
    placeholder.textContent = '🎬';
    container.appendChild(placeholder);
  }

  // Statut
  const status = document.createElement('div');
  status.className = `movie-status ${movie.reading_status}`;
  const statusLabels = {
    unread: 'Non vu',
    watching: 'En cours',
    watched: 'Vu'
  };
  status.textContent = statusLabels[movie.reading_status] || 'Non vu';
  container.appendChild(status);

  // Titre
  const title = document.createElement('div');
  title.className = 'movie-title';
  title.textContent = movie.titre;
  container.appendChild(title);

  // Clic pour lire
  container.addEventListener('click', () => {
    window.location.href = `player-movie.html?movie_id=${movie.id}`;
  });

  // Clic droit pour menu contextuel
  container.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showMovieContextMenu(e.clientX, e.clientY, movie.user_movie_id, movie.id);
  });

  moviesListEl.appendChild(container);
}

// Recherche de films
if (movieSearchBtn && movieSearchInput) {
  movieSearchBtn.addEventListener('click', () => performMovieSearch());
  movieSearchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performMovieSearch();
  });
}

// Gestion du filtrage
if (movieStatusFilter) {
  movieStatusFilter.addEventListener('change', () => {
    filterAndDisplayMovies();
  });
}

// Fonction de recherche
async function performMovieSearch() {
  const query = movieSearchInput.value.trim();

  if (!query) {
    showMovieStatus('Veuillez entrer un titre de film', 'error');
    return;
  }

  movieSearchBtn.disabled = true;
  movieSearchBtn.textContent = 'Recherche...';
  showMovieStatus('Recherche en cours...', 'loading');
  movieSearchResults.innerHTML = '';

  try {
    const response = await fetch(`${BACKEND_URL}/api/search-movie`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const data = await response.json();

    if (data.success && data.results.length > 0) {
      showMovieStatus(`${data.results.length} résultat(s) trouvé(s)`, 'success');
      displayMovieResults(data.results);
    } else {
      showMovieStatus('Aucun résultat trouvé.', 'info');
    }

  } catch (error) {
    console.error('Erreur recherche film:', error);
    showMovieStatus(`Erreur: ${error.message}`, 'error');
  } finally {
    movieSearchBtn.disabled = false;
    movieSearchBtn.textContent = 'Rechercher';
  }
}

// Affiche les résultats
function displayMovieResults(results) {
  movieSearchResults.innerHTML = '';

  results.forEach(result => {
    const card = document.createElement('div');
    card.className = 'movie-result-card';

    const durationText = result.duration ? formatDuration(result.duration) : 'N/A';
    const qualityText = result.quality || 'N/A';

    card.innerHTML = `
      ${result.coverUrl ? 
        `<img src="${getProxiedImageUrl(escapeHtml(result.coverUrl))}" alt="${escapeHtml(result.titre)}" class="movie-result-cover">` :
        '<div class="movie-result-cover" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; font-size: 32px;">🎬</div>'
      }
      <div class="movie-result-info">
        <div class="movie-result-title">${escapeHtml(result.titre)}</div>
        <div class="movie-result-meta">⏱️ ${durationText} • 📺 ${qualityText}</div>
      </div>
      <button class="add-movie-btn">➕ Ajouter</button>
    `;

    card.querySelector('.add-movie-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      addMovie(result, card.querySelector('.add-movie-btn'));
    });

    movieSearchResults.appendChild(card);
  });
}

// Ajoute un film
async function addMovie(movieData, button) {
  const user = await getCurrentUser();
  if (!user) {
    alert('Utilisateur non connecté');
    return;
  }

  button.disabled = true;
  button.textContent = '⏳ Ajout...';

  try {
    const response = await fetch(`${BACKEND_URL}/api/add-movie`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        movieUrl: movieData.url,
        userId: user.id,
        metadata: {
          titre: movieData.titre,
          coverUrl: movieData.coverUrl,
          duration: movieData.duration,
          quality: movieData.quality
        }
      })
    });

    const data = await response.json();

    if (data.success) {
      button.textContent = '✅ Ajouté';
      button.style.background = '#27ae60';
      
      setTimeout(() => {
        // Recharge la liste des films
        if (window.loadMovies) {
          window.loadMovies();
        }
        // Ferme le panneau
        closeRightPanel();
      }, 1500);
    } else {
      throw new Error(data.message || 'Erreur lors de l\'ajout');
    }

  } catch (error) {
    console.error('Erreur ajout film:', error);
    alert(`Erreur: ${error.message}`);
    button.disabled = false;
    button.textContent = '➕ Ajouter';
  }
}

// Menu contextuel
function showMovieContextMenu(x, y, userMovieId, movieId) {
  selectedMovieId = userMovieId;
  const contextMenu = document.getElementById('movie-context-menu');
  if (contextMenu) {
    contextMenu.style.display = 'block';
    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;
  }
}

// Affiche un message de statut
function showMovieStatus(message, type) {
  if (!movieSearchStatus) return;
  
  movieSearchStatus.innerHTML = `
    <div class="status-message ${type}">
      ${getStatusIcon(type)} ${message}
    </div>
  `;
}

// Helper functions
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

function formatDuration(seconds) {
  if (!seconds) return 'N/A';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h${minutes.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}min`;
  }
}
