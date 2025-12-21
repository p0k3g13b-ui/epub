// --- Supabase ---
const supabaseUrl = 'https://qtqkbuvmbakiheqcyxed.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0cWtidXZtYmFraWhlcWN5eGVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwOTEwMDEsImV4cCI6MjA4MTY2NzAwMX0.fzWkuVmQB770dwGKeLMFGG6EwIwZqlC_aCcZI7EBQUA';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// Récupère le nom du livre depuis l’URL
const params = new URLSearchParams(window.location.search);
const bookName = params.get('book');

if (!bookName) {
  alert("Aucun livre sélectionné");
  throw new Error("No book specified");
}

// Initialise le conteneur du lecteur
const readerEl = document.getElementById('reader');
readerEl.innerHTML = ''; 

// Charge le livre
const book = ePub(`epubs/${bookName}`);
const rendition = book.renderTo(readerEl, {
  width: "100%",
  height: "100%"
});

rendition.flow("scrolled");
rendition.display();

// Supprime marges/paddings pour un scroll quasi continu
rendition.hooks.content.register((contents) => {
  const doc = contents.document;
  doc.body.style.margin = '0';
  doc.body.style.padding = '0';
});

// Restaure la dernière position si elle existe
(async () => {
  try {
    const { data } = await supabaseClient
      .from('reading_positions')
      .select('*')
      .eq('epub_name', bookName)
      .single();

    if (data?.last_position) {
      rendition.display(data.last_position);
    }
  } catch(e) {
    console.warn("Impossible de récupérer la dernière position :", e);
  }
})();

// Sauvegarde automatique à chaque relocation
rendition.on('relocated', async (location) => {
  try {
    await supabaseClient
      .from('reading_positions')
      .upsert(
        {
          epub_name: bookName,
          last_position: location.start.cfi,
          last_opened: new Date().toISOString()
        },
        { onConflict: 'epub_name' }
      );
  } catch(e) {
    console.warn("Impossible de sauvegarder la position :", e);
  }
});

// --- Swipe horizontal ---
let touchStartX = 0;
let touchEndX = 0;

readerEl.addEventListener('touchstart', e => {
  touchStartX = e.changedTouches[0].screenX;
}, false);

readerEl.addEventListener('touchend', e => {
  touchEndX = e.changedTouches[0].screenX;
  handleGesture();
}, false);

function handleGesture() {
  const delta = touchEndX - touchStartX;
  if (Math.abs(delta) > 50) { // seuil de swipe
    if (delta > 0) {
      rendition.prev(); // swipe à droite → chapitre précédent
    } else {
      rendition.next(); // swipe à gauche → chapitre suivant
    }
  }
}
