// Déclare BACKEND_URL seulement s'il n'existe pas déjà
if (typeof BACKEND_URL === 'undefined') {
  var BACKEND_URL = 'https://epub-backend.vercel.app';
}

let currentUser = null;
let selectedEpisodeId = null;

// Fonction pour convertir une URL d'image en URL proxifiée
function getProxiedImageUrl(imageUrl) {
  if (!imageUrl) return null;
  return `${BACKEND_URL}/proxy-image?url=${encodeURIComponent(imageUrl)}`;
}

(async () => {
  try {
    currentUser = await requireAuth();
    console.log('✅ Utilisateur connecté:', currentUser);
    
    // Récupère l'anime_id depuis l'URL
    const urlParams = new URLSearchParams(window.location.search);
    const animeId = urlParams.get('anime_id');
    
    if (!animeId) {
      alert('ID anime manquant');
      window.location.href = 'index.html';
      return;
    }
    
    await loadAnimeDetails(animeId);
    
  } catch (err) {
    console.error('Erreur auth:', err);
  }
})();

async function loadAnimeDetails(animeId) {
  try {
    // Récupère les infos de l'anime
    const { data: anime, error: animeError } = await supabaseClient
      .from('animes_library')
      .select('*')
      .eq('id', animeId)
      .single();
    
    if (animeError || !anime) {
      console.error('Erreur chargement anime:', animeError);
      alert('Anime introuvable');
      window.location.href = 'index.html';
      return;
    }
    
    // Affiche les infos
    displayAnimeHeader(anime);
    
    // Récupère les épisodes
    const { data: episodes, error: episodesError } = await supabaseClient
      .from('episodes_library')
      .select('*')
      .eq('anime_id', animeId)
      .order('numero', { ascending: true });
    
    if (episodesError) {
      console.error('Erreur chargement épisodes:', episodesError);
      return;
    }
    
    // Récupère les positions de visionnage pour cet anime
    const episodeIds = episodes.map(ep => ep.id);
    const { data: positions, error: positionsError } = await supabaseClient
      .from('anime_viewing_positions')
      .select('*')
      .eq('user_id', currentUser.id)
      .in('episode_id', episodeIds);
    
    if (positionsError) {
      console.warn('Erreur positions:', positionsError);
    }
    
    // Crée un map episode_id → position
    const positionsMap = {};
    let lastWatchedEpisode = null;
    let lastWatchedTime = null;
    
    if (positions && positions.length > 0) {
      positions.forEach(p => {
        positionsMap[p.episode_id] = p;
        
        // Trouve le dernier épisode visionné (non complété)
        if (!p.completed) {
          const watchTime = new Date(p.last_watched);
          if (!lastWatchedTime || watchTime > lastWatchedTime) {
            lastWatchedTime = watchTime;
            lastWatchedEpisode = p.episode_id;
          }
        }
      });
    }
    
    // Affiche le bouton "Reprendre" si un épisode en cours existe
    if (lastWatchedEpisode) {
      const resumeBtn = document.getElementById('resume-button');
      resumeBtn.style.display = 'inline-flex';
      resumeBtn.onclick = () => {
        window.location.href = `player-anime.html?episode_id=${lastWatchedEpisode}`;
      };
    }
    
    // Affiche les épisodes
    displayEpisodes(episodes, positionsMap);
    
  } catch (err) {
    console.error('Erreur:', err);
  }
}

function displayAnimeHeader(anime) {
  const coverEl = document.getElementById('anime-cover');
  const titleEl = document.getElementById('anime-title');
  const metaEl = document.getElementById('anime-meta');
  const synopsisEl = document.getElementById('anime-synopsis');
  
  titleEl.textContent = anime.titre;
  
  // Affiche la couverture via le proxy
  if (anime.cover_url) {
    console.log('📸 URL couverture originale:', anime.cover_url);
    const proxiedUrl = getProxiedImageUrl(anime.cover_url);
    console.log('🔄 URL proxifiée:', proxiedUrl);
    
    coverEl.innerHTML = `<img 
      src="${proxiedUrl}" 
      alt="${anime.titre}" 
      style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px; display: block;"
      onerror="console.error('❌ Erreur chargement image:', this.src); this.style.display='none'; this.parentElement.textContent='🎬';"
      onload="console.log('✅ Image chargée avec succès');"
    >`;
  } else {
    console.warn('⚠️ Aucune URL de couverture trouvée');
  }
  
  let metaHtml = '';
  if (anime.nb_episodes) metaHtml += `<span>📺 ${anime.nb_episodes} épisodes</span>`;
  if (anime.year) metaHtml += `<span>📅 ${anime.year}</span>`;
  if (anime.genre) metaHtml += `<span>🎭 ${anime.genre}</span>`;
  metaEl.innerHTML = metaHtml;
  
  if (anime.synopsis) {
    synopsisEl.textContent = anime.synopsis;
  } else {
    synopsisEl.style.display = 'none';
  }
}

function displayEpisodes(episodes, positionsMap) {
  const container = document.getElementById('episodes-container');
  container.innerHTML = '';
  
  episodes.forEach(episode => {
    const position = positionsMap[episode.id];
    const progress = position ? (position.position_seconds / position.duration_seconds) * 100 : 0;
    const completed = position ? position.completed : false;
    
    const card = document.createElement('div');
    card.className = 'episode-card';
    card.dataset.episodeId = episode.id;
    
    let badgeHtml = '';
    if (completed) {
      badgeHtml = '<div class="episode-badge completed">✓ Vu</div>';
    } else if (progress > 5) {
      badgeHtml = '<div class="episode-badge in-progress">En cours</div>';
    }
    
    card.innerHTML = `
      ${badgeHtml}
      <div class="episode-thumbnail">
        ${episode.thumbnail_url ? 
          `<img src="${getProxiedImageUrl(episode.thumbnail_url)}" style="width:100%; height:100%; object-fit:cover;">` :
          '🎬'
        }
      </div>
      <div class="episode-info">
        <div class="episode-number">Épisode ${episode.numero}</div>
        <div class="episode-title">${episode.titre || ''}</div>
        ${progress > 0 ? `
          <div class="episode-progress">
            <div class="episode-progress-bar" style="width: ${progress}%"></div>
          </div>
        ` : ''}
      </div>
    `;
    
    // Clic pour lire
    card.addEventListener('click', () => {
      window.location.href = `player-anime.html?episode_id=${episode.id}`;
    });
    
    // Clic droit pour menu contextuel
    card.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, episode.id, completed);
    });
    
    container.appendChild(card);
  });
}

// Menu contextuel
const contextMenu = document.getElementById('episode-context-menu');

function showContextMenu(x, y, episodeId, isCompleted) {
  selectedEpisodeId = episodeId;
  contextMenu.style.display = 'block';
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;
}

function hideContextMenu() {
  contextMenu.style.display = 'none';
  selectedEpisodeId = null;
}

document.addEventListener('click', hideContextMenu);

contextMenu.addEventListener('click', (e) => {
  e.stopPropagation();
});

document.querySelectorAll('.context-menu-item').forEach(item => {
  item.addEventListener('click', async () => {
    const action = item.dataset.action;
    
    if (action === 'mark-watched') {
      await markEpisode(selectedEpisodeId, true);
    } else if (action === 'mark-unwatched') {
      await markEpisode(selectedEpisodeId, false);
    }
    
    hideContextMenu();
  });
});

async function markEpisode(episodeId, watched) {
  try {
    if (watched) {
      // Marque comme vu
      const { error } = await supabaseClient
        .from('anime_viewing_positions')
        .upsert({
          user_id: currentUser.id,
          episode_id: episodeId,
          position_seconds: 0,
          duration_seconds: 1,
          completed: true,
          last_watched: new Date().toISOString()
        }, {
          onConflict: 'user_id,episode_id'
        });
      
      if (error) throw error;
      console.log('✅ Épisode marqué comme vu');
    } else {
      // Supprime la position
      const { error } = await supabaseClient
        .from('anime_viewing_positions')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('episode_id', episodeId);
      
      if (error) throw error;
      console.log('✅ Épisode marqué comme non vu');
    }
    
    // Recharge la page
    const urlParams = new URLSearchParams(window.location.search);
    const animeId = urlParams.get('anime_id');
    await loadAnimeDetails(animeId);
    
  } catch (err) {
    console.error('Erreur:', err);
    alert('Erreur lors de la mise à jour');
  }
}
