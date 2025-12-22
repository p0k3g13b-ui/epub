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

// --- Génération des locations (obligatoire pour CFI) ---
book.ready.then(() => {
  return book.locations.generate(1500);
}).then(() => {
  console.log("✅ Locations générées");
  isLocationsReady = true;
  
  // Restaure la position après génération des locations
  restorePosition();
}).catch(err => {
  console.error("Erreur génération locations:", err);
  rendition.display(); // Affiche la première page par défaut
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

// --- Sauvegarde automatique de la position ---
function startAutoSave() {
  // Évite les doublons de setInterval
  if (saveInterval) return;
  
  saveInterval = setInterval(async () => {
    if (!isLocationsReady) return;
    
    try {
      const currentLocation = rendition.currentLocation();
      if (!currentLocation || !currentLocation.start) return;
      
      const cfi = currentLocation.start.cfi;
      const percentage = currentLocation.start.percentage || 0;
      
      // Sauvegarde dans Supabase
      const { data, error } = await supabaseClient
        .from('reading_positions')
        .upsert({
          epub_name: bookName,
          last_cfi: cfi,
          last_percentage: percentage,
          last_opened: new Date().toISOString()
        }, { 
          onConflict: 'epub_name' 
        });
      
      if (error) {
        console.error("Erreur sauvegarde:", error);
      } else {
        console.log(`💾 Position sauvegardée: ${Math.round(percentage * 100)}%`);
      }
    } catch (err) {
      console.error("Erreur lors de la sauvegarde:", err);
    }
  }, 2000); // Sauvegarde toutes les 2 secondes
}

// Démarre la sauvegarde automatique après le premier affichage
rendition.on("rendered", () => {
  startAutoSave();
});

// --- Restauration de la position ---
async function restorePosition() {
  try {
    const { data, error } = await supabaseClient
      .from('reading_positions')
      .select('last_cfi, last_percentage')
      .eq('epub_name', bookName)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = pas de résultat
      console.error("Erreur restauration:", error);
      rendition.display();
      return;
    }
    
    if (data?.last_cfi) {
      console.log(`📖 Restauration à ${Math.round(data.last_percentage * 100)}%`);
      await rendition.display(data.last_cfi);
    } else {
      console.log("📖 Nouvelle lecture, début du livre");
      rendition.display();
    }
  } catch (err) {
    console.error("Erreur:", err);
    rendition.display();
  }
}

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
  
  await supabaseClient
    .from('reading_positions')
    .upsert({
      epub_name: bookName,
      last_cfi: currentLocation.start.cfi,
      last_percentage: currentLocation.start.percentage || 0,
      last_opened: new Date().toISOString()
    }, { 
      onConflict: 'epub_name' 
    });
});
