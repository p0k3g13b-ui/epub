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
const rendition = book.renderTo(readerEl, { width: "100%", height: "100%" });

rendition.flow("scrolled");

// --- Nettoyage marges ---
rendition.hooks.content.register(contents => {
  const doc = contents.document;
  doc.body.style.margin = '0';
  doc.body.style.padding = '0';
});

// --- Restauration position après que le livre soit prêt ---
book.ready.then(async () => {
  try {
    const { data } = await supabaseClient
      .from('reading_positions')
      .select('*')
      .eq('epub_name', bookName)
      .single();

    if (data?.last_cfi) {
      rendition.display(data.last_cfi);
    } else {
      rendition.display(0);
    }
  } catch (e) {
    rendition.display(0);
    console.warn("Impossible de récupérer la dernière position :", e);
  }
});

// --- Sauvegarde précise ---
let saveTimeout = null;
function savePosition() {
  const loc = rendition.currentLocation();
  if (!loc?.start?.cfi) return;

  supabaseClient
    .from('reading_positions')
    .upsert({
      epub_name: bookName,
      last_cfi: loc.start.cfi,
      last_percentage: loc.start.percentage,
      last_opened: new Date().toISOString()
    }, { onConflict: 'epub_name' })
    .catch(() => {});
}

// Écoute le scroll DANS l’iframe
rendition.hooks.content.register(contents => {
  const scrollEl = contents.document.scrollingElement || contents.document.documentElement;
  scrollEl.addEventListener('scroll', () => {
    if (saveTimeout) return;
    saveTimeout = setTimeout(() => {
      savePosition();
      saveTimeout = null;
    }, 1500);
  }, { passive: true });
});

// Fallback sur relocation (section change)
rendition.on('relocated', savePosition);

// --- Boutons navigation ---
document.getElementById('prev-button').onclick = () => rendition.prev();
document.getElementById('next-button').onclick = () => rendition.next();
