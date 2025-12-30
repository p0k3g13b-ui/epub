// --- Vérification de l'authentification ---
let currentUser = null;
let currentEpub = null;

(async () => {
  try {
    currentUser = await requireAuth();
    console.log('✅ Utilisateur connecté:', currentUser);
    
    // Récupère les params
    const params = new URLSearchParams(window.location.search);
    const epubId = params.get('epub_id');
    
    if (!epubId) {
      alert("Aucun livre spécifié");
      window.location.href = 'index.html';
      throw new Error("No epub_id specified");
    }
    
    // Récupère les infos du livre depuis epubs_library
    const { data: epub, error: epubError } = await supabaseClient
      .from('epubs_library')
      .select('*')
      .eq('id', epubId)
      .single();
    
    if (epubError || !epub) {
      alert("Livre introuvable");
      window.location.href = 'index.html';
      throw new Error("Epub not found");
    }
    
    currentEpub = epub;
    console.log('📖 Livre:', currentEpub.title);
    
    // Lance le lecteur
    initReader();
    
  } catch (err) {
    console.error('Erreur initialisation:', err);
  }
})();

// --- Initialisation du lecteur ---
async function initReader() {
  // Récupère l'URL publique du fichier
  const { data: urlData } = supabaseClient.storage
    .from('epubs')
    .getPublicUrl(currentEpub.filename);

  const publicUrl = urlData?.publicURL || urlData?.publicUrl;

  if (!publicUrl) {
    alert("Impossible de charger le livre");
    window.location.href = 'index.html';
    throw new Error("Could not get book URL");
  }

  // --- Reader Setup ---
  const readerEl = document.getElementById('reader');
  const book = ePub(publicUrl);
  const rendition = book.renderTo(readerEl, {
    width: "100%",
    height: "100%",
    spread: "none",
    allowScriptedContent: true
  });

  // Mode scrolled pour une lecture fluide
  rendition.flow("scrolled");

  // Variables de sauvegarde
  let saveInterval = null;
  let isLocationsReady = false;
  let epubContainer = null;

  // --- Génération des locations ---
  book.ready.then(() => {
    return book.locations.generate(1500);
  }).then(() => {
    console.log("✅ Locations générées");
    isLocationsReady = true;
  }).catch(err => {
    console.error("Erreur génération locations:", err);
  });

  // --- Style personnalisé ---
  rendition.hooks.content.register((contents) => {
    const doc = contents.document;
    const style = doc.createElement("style");
    style.textContent = `
      body {
        font-size: 200% !important;
        line-height: 1.6 !important;
        padding: 20px !important;
      }
    `;
    doc.head.appendChild(style);
  });

  // --- Fonction pour obtenir le container de scroll ---
  function getEpubContainer() {
    epubContainer = document.querySelector('.epub-container');
    return epubContainer;
  }

  // --- Fonction pour obtenir la position de scroll ---
  function getScrollPosition() {
    const container = getEpubContainer();
    const scrollTop = container ? container.scrollTop : 0;
    return Math.round(scrollTop);
  }

  // --- Fonction pour définir la position de scroll ---
  function setScrollPosition(scrollTop) {
    const container = getEpubContainer();
    if (container) {
      container.scrollTop = scrollTop;
    }
  }

  // --- Sauvegarde automatique de la position ---
  function startAutoSave() {
    if (saveInterval) return;
    
    saveInterval = setInterval(async () => {
      if (!isLocationsReady) return;
      
      try {
        const currentLocation = rendition.currentLocation();
        if (!currentLocation || !currentLocation.start) return;
        
        const cfi = currentLocation.start.cfi;
        const percentage = currentLocation.start.percentage || 0;
        const scrollTop = getScrollPosition();
        
        if (scrollTop === 0) {
          console.warn("⚠️ ScrollTop = 0, container existe ?", !!getEpubContainer());
        }
        
        // Sauvegarde dans Supabase avec user_id + epub_id
        const { error } = await supabaseClient
          .from('reading_positions')
          .upsert({
            user_id: currentUser.id,
            epub_id: currentEpub.id,
            last_cfi: cfi,
            last_percentage: percentage,
            scroll_position: scrollTop,
            last_opened: new Date().toISOString()
          }, { 
            onConflict: 'user_id,epub_id'
          });
        
        if (error) {
          console.error("Erreur sauvegarde:", error);
        } else {
          console.log(`💾 Sauvegarde: ${Math.round(percentage * 100)}% | Scroll: ${scrollTop}px`);
        }
      } catch (err) {
        console.error("Erreur lors de la sauvegarde:", err);
      }
    }, 2000);
  }

  // Démarre la sauvegarde automatique
  rendition.on("rendered", () => {
    const waitForContainer = setInterval(() => {
      if (getEpubContainer()) {
        clearInterval(waitForContainer);
        console.log("✅ Container trouvé, démarrage de l'auto-save");
        startAutoSave();
      }
    }, 100);
  });

  // --- Restauration de la position ---
  let positionToRestore = null;

  // 1. Charge la position depuis Supabase
  (async () => {
    try {
      const { data, error } = await supabaseClient
        .from('reading_positions')
        .select('last_cfi, last_percentage, scroll_position')
        .eq('user_id', currentUser.id)
        .eq('epub_id', currentEpub.id)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error("Erreur restauration:", error);
        rendition.display();
        return;
      }
      
      if (data?.last_cfi) {
        positionToRestore = {
          cfi: data.last_cfi,
          scrollTop: data.scroll_position || 0,
          percentage: data.last_percentage || 0
        };
        console.log(`📖 Position trouvée: ${Math.round(data.last_percentage * 100)}% | Scroll: ${data.scroll_position}px`);
        
        await rendition.display(data.last_cfi);
      } else {
        console.log("📖 Nouvelle lecture, début du livre");
        rendition.display();
      }
    } catch (err) {
      console.error("Erreur:", err);
      rendition.display();
    }
  })();

  // 2. Restaure le scroll exact après le rendu
  rendition.on("relocated", (location) => {
    if (positionToRestore) {
      const attemptRestore = (attempts = 0) => {
        const container = getEpubContainer();
        
        if (!container && attempts < 10) {
          setTimeout(() => attemptRestore(attempts + 1), 100);
          return;
        }
        
        if (container) {
          console.log(`🎯 Restauration du scroll à ${positionToRestore.scrollTop}px`);
          setScrollPosition(positionToRestore.scrollTop);
          positionToRestore = null;
        }
      };
      
      setTimeout(() => attemptRestore(), 300);
    }
  });

  // --- Navigation tactile ---
  document.getElementById('swipe-left').addEventListener('click', () => {
    rendition.prev();
  });

  document.getElementById('swipe-right').addEventListener('click', () => {
    rendition.next();
  });

  // --- Navigation clavier ---
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
      rendition.prev();
    } else if (e.key === 'ArrowRight') {
      rendition.next();
    }
  });

  // --- Sauvegarde avant fermeture ---
  window.addEventListener('beforeunload', async () => {
    if (!isLocationsReady) return;
    
    const currentLocation = rendition.currentLocation();
    if (!currentLocation || !currentLocation.start) return;
    
    const scrollTop = getScrollPosition();
    
    await supabaseClient
      .from('reading_positions')
      .upsert({
        user_id: currentUser.id,
        epub_id: currentEpub.id,
        last_cfi: currentLocation.start.cfi,
        last_percentage: currentLocation.start.percentage || 0,
        scroll_position: scrollTop,
        last_opened: new Date().toISOString()
      }, { 
        onConflict: 'user_id,epub_id'
      });
  });
}
