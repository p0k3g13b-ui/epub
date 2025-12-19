// --- Config Supabase ---
const supabaseUrl = 'TON_SUPABASE_URL';
const supabaseKey = 'TA_CLE_API_ANONYME';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

// Liste des EPUB disponibles
const epubs = [
  "livre1.epub",
  "livre2.epub"
];

const epubListEl = document.getElementById('epub-list');
const readerContainer = document.getElementById('reader-container');
let currentBook = null;
let rendition = null;

// Affiche la liste des EPUB triée par dernière ouverture
async function loadEpubList() {
  const { data } = await supabase.from('reading_positions').select('*');
  const sortedEpubs = epubs.map(name => {
    const record = data.find(d => d.epub_name === name);
    return { name, last_opened: record?.last_opened || 0 };
  }).sort((a,b) => new Date(b.last_opened) - new Date(a.last_opened));

  epubListEl.innerHTML = '';
  sortedEpubs.forEach(book => {
    const li = document.createElement('li');
    li.textContent = book.name;
    li.onclick = () => openEpub(book.name);
    epubListEl.appendChild(li);
  });
}

// Ouvre un EPUB
async function openEpub(name) {
  // Supprime le précédent
  readerContainer.innerHTML = '';
  if(currentBook) currentBook.destroy();

  currentBook = ePub(`epubs/${name}`);
  rendition = currentBook.renderTo("reader-container", { width: "100%", height: "100%" });

  // Récupère la dernière position
  const { data } = await supabase.from('reading_positions').select('*').eq('epub_name', name).single();
  const startLocation = data?.last_position || 0;

  rendition.display(startLocation);

  // Sauvegarde la position à chaque changement
  rendition.on('relocated', async (location) => {
    const pos = location.start.cfi;
    await supabase.from('reading_positions').upsert({
      epub_name: name,
      last_position: pos,
      last_opened: new Date()
    });
    loadEpubList();
  });
}

// Initialisation
loadEpubList();