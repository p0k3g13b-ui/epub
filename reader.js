// --- Supabase ---
const supabaseUrl = 'https://qtqkbuvmbakiheqcyxed.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0cWtidXZtYmFraWhlcWN5eGVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwOTEwMDEsImV4cCI6MjA4MTY2NzAwMX0.fzWkuVmQB770dwGKeLMFGG6EwIwZqlC_aCcZI7EBQUA';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// --- Params ---
const params = new URLSearchParams(window.location.search);
const bookName = params.get('book');
if (!bookName) {
  alert("Aucun livre spécifié");
  window.location.href = 'index.html';
  throw new Error("No book specified");
}

// --- Reader Setup ---
const readerEl = document.getElementById('reader');
const book = ePub(`epubs/${bookName}`);
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
let currentDoc = null;

// Ajoute après la ligne "let currentDoc = null;"
setInterval(() => {
  console.log("🔍 DEBUG Scroll positions:", {
    reader: document.getElementById('reader')?.scrollTop,
    epubContainer: document.querySelector('.epub-container')?.scrollTop,
    epubView: document.querySelector('.epub-view')?.scrollTop,
    // Cherche tous les divs avec un scroll
    allScrollable: Array.from(document.querySelectorAll('div')).map(div => ({
      className: div.className,
      scrollTop: div.scrollTop
    })).filter(x => x.scrollTop > 0)
  });
}, 3000);
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
  currentDoc = doc; // Garde une référence au document
  
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

// --- Fonction pour obtenir la position de scroll ---
function getScrollPosition() {
  if (!currentDoc) return 0;
  return currentDoc.documentElement.scrollTop || currentDoc.body.scrollTop || 0;
}

// --- Fonction pour définir la position de scroll ---
function setScrollPosition(scrollTop) {
  if (!currentDoc) return;
  if (currentDoc.documentElement) {
    currentDoc.documentElement.scrollTop = scrollTop;
  }
  if (currentDoc.body) {
    currentDoc.body.scrollTop = scrollTop;
  }
}

// --- Sauvegarde automatique de la position ---
function startAutoSave() {
  if (saveInterval) return;
  
  saveInterval = setInterval(async () => {
    if (!isLocationsReady || !currentDoc) return;
    
    try {
      const currentLocation = rendition.currentLocation();
      if (!currentLocation || !currentLocation.start) return;
      
      const cfi = currentLocation.start.cfi;
      const percentage = currentLocation.start.percentage || 0;
      const scrollTop = getScrollPosition();
      
      // Sauvegarde dans Supabase avec la position de scroll
      const { error } = await supabaseClient
        .from('reading_positions')
        .upsert({
          epub_name: bookName,
          last_cfi: cfi,
          last_percentage: percentage,
          scroll_position: scrollTop, // 🔑 Nouvelle colonne
          last_opened: new Date().toISOString()
        }, { 
          onConflict: 'epub_name' 
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
  startAutoSave();
});

// --- Restauration de la position ---
let positionToRestore = null;

// 1. Charge la position depuis Supabase
(async () => {
  try {
    const { data, error } = await supabaseClient
      .from('reading_positions')
      .select('last_cfi, last_percentage, scroll_position')
      .eq('epub_name', bookName)
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
      
      // Affiche à la bonne position CFI
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
  // Attend que le DOM soit prêt
  setTimeout(() => {
    if (positionToRestore && currentDoc) {
      console.log(`🎯 Restauration du scroll à ${positionToRestore.scrollTop}px`);
      setScrollPosition(positionToRestore.scrollTop);
      positionToRestore = null; // Ne restaure qu'une seule fois
    }
  }, 100); // Petit délai pour s'assurer que le DOM est complètement chargé
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
  if (!isLocationsReady || !currentDoc) return;
  
  const currentLocation = rendition.currentLocation();
  if (!currentLocation || !currentLocation.start) return;
  
  const scrollTop = getScrollPosition();
  
  await supabaseClient
    .from('reading_positions')
    .upsert({
      epub_name: bookName,
      last_cfi: currentLocation.start.cfi,
      last_percentage: currentLocation.start.percentage || 0,
      scroll_position: scrollTop,
      last_opened: new Date().toISOString()
    }, { 
      onConflict: 'epub_name' 
    });
});

