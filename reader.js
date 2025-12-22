// --- Supabase ---
const supabaseUrl = 'https://qtqkbuvmbakiheqcyxed.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0cWtidXZtYmFraWhlcWN5eGVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwOTEwMDEsImV4cCI6MjA4MTY2NzAwMX0.fzWkuVmQB770dwGKeLMFGG6EwIwZqlC_aCcZI7EBQUA';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// --- Params ---
const params = new URLSearchParams(window.location.search);
const bookName = params.get('book');
if (!bookName) throw new Error("No book specified");

// --- Reader ---
const readerEl = document.getElementById('reader');

const book = ePub(`epubs/${bookName}`);
const rendition = book.renderTo(readerEl, {
  width: "100%",
  height: "100%",
  spread: "none"
});

// 🔑 MODE FIABLE
rendition.flow("scrolled");

rendition.hooks.content.register((contents) => {
  const doc = contents.document;

  const style = doc.createElement("style");
  style.textContent = `
    body {
      font-size: 200% !important;
      line-height: 1.6 !important;
    }
  `;
  doc.head.appendChild(style);
});


// --- Restaurer la position ---
(async () => {
  const { data, error } = await supabaseClient
    .from('reading_positions')
    .select('last_cfi')
    .eq('epub_name', bookName)
    .single();

  if (data?.last_cfi) {
    rendition.display(data.last_cfi);
  } else {
    rendition.display();
  }
})();

// --- Sauvegarde précise ---
rendition.on('relocated', async (location) => {
  if (!location?.start?.cfi) return;

  await supabaseClient
    .from('reading_positions')
    .upsert(
      {
        epub_name: bookName,
        last_cfi: location.start.cfi,
        last_opened: new Date().toISOString()
      },
      { onConflict: 'epub_name' }
    );
});

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
  if (Math.abs(delta) > 5) { // seuil de swipe
    if (delta > 0) {
      // swipe à droite → chapitre précédent
      rendition.prev();
    } else {
      // swipe à gauche → chapitre suivant
      rendition.next();
    }
  }
}

// --- Boutons ---
document.getElementById('prev-button').onclick = () => rendition.prev();
document.getElementById('next-button').onclick = () => rendition.next();
