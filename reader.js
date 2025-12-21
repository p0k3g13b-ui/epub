// --- Supabase ---
const supabaseUrl = 'https://qtqkbuvmbakiheqcyxed.supabase.co';
const supabaseKey = 'TON_ANON_KEY';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// --- Params ---
const params = new URLSearchParams(window.location.search);
const bookName = params.get('book');
if (!bookName) throw new Error("No book");

// --- Reader ---
const readerEl = document.getElementById('reader');
const book = ePub(`epubs/${bookName}`);
const rendition = book.renderTo(readerEl, {
  width: "100%",
  height: "100%"
});

rendition.flow("scrolled");

// Nettoyage marges
rendition.hooks.content.register(contents => {
  const doc = contents.document;
  doc.body.style.margin = '0';
  doc.body.style.padding = '0';
});

// 🔑 RESTAURATION AU BON MOMENT
book.ready.then(async () => {
  const { data } = await supabaseClient
    .from('reading_positions')
    .select('last_cfi')
    .eq('epub_name', bookName)
    .single();

  if (data?.last_cfi) {
    rendition.display(data.last_cfi);
  } else {
    rendition.display();
  }
});

// ✅ SAUVEGARDE FIABLE
rendition.on('relocated', (location) => {
  if (!location?.start?.cfi) return;

  supabaseClient
    .from('reading_positions')
    .upsert({
      epub_name: bookName,
      last_cfi: location.start.cfi,
      last_percentage: location.start.percentage,
      last_opened: new Date().toISOString()
    }, { onConflict: 'epub_name' });
});

// Boutons
document.getElementById('prev-button').onclick = () => rendition.prev();
document.getElementById('next-button').onclick = () => rendition.next();
