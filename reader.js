// --- Supabase ---
const supabaseUrl = 'https://qtqkbuvmbakiheqcyxed.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0cWtidXZtYmFraWhlcWN5eGVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwOTEwMDEsImV4cCI6MjA4MTY2NzAwMX0.fzWkuVmQB770dwGKeLMFGG6EwIwZqlC_aCcZI7EBQUA';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// --- Params ---
const params = new URLSearchParams(window.location.search);
const bookName = params.get('book');

if (!bookName) {
  alert("Aucun livre sélectionné");
  throw new Error("No book specified");
}

// --- Reader ---
const readerEl = document.getElementById('reader');
readerEl.innerHTML = '';

const book = ePub(`epubs/${bookName}`);
const rendition = book.renderTo(readerEl, {
  width: "100%",
  height: "100%"
});

rendition.flow("scrolled");
rendition.display();

// Supprime marges internes
rendition.hooks.content.register(contents => {
  const doc = contents.document;
  doc.body.style.margin = '0';
  doc.body.style.padding = '0';
});

// --- Restauration position ---
(async () => {
  try {
    const { data } = await supabaseClient
      .from('reading_positions')
      .select('*')
      .eq('epub_name', bookName)
      .single();

    if (data?.last_cfi) {
      rendition.display(data.last_cfi);
    }
  } catch (e) {
    console.warn("Aucune position sauvegardée");
  }
})();

// --- Sauvegarde fine (scroll réel) ---
let saveTimeout = null;

function saveCurrentPosition() {
  const location = rendition.currentLocation();
  if (!location || !location.start) return;

  const payload = {
    epub_name: bookName,
    last_cfi: location.start.cfi,
    last_percentage: location.start.percentage,
    last_opened: new Date().toISOString()
  };

  supabaseClient
    .from('reading_positions')
    .upsert(payload, { onConflict: 'epub_name' })
    .catch(() => {});
}

// Throttle pour éviter le spam
readerEl.addEventListener('scroll', () => {
  if (saveTimeout) return;
  saveTimeout = setTimeout(() => {
    saveCurrentPosition();
    saveTimeout = null;
  }, 1500);
});

// Sauvegarde aussi lors d’un vrai changement de section (fallback)
rendition.on('relocated', saveCurrentPosition);

// --- Boutons navigation ---
document.getElementById('prev-button')
  .addEventListener('click', () => rendition.prev());

document.getElementById('next-button')
  .addEventListener('click', () => rendition.next());
