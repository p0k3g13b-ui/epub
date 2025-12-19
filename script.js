// --- Config Supabase ---
const supabaseUrl = 'https://qtqkbuvmbakiheqcyxed.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0cWtidXZtYmFraWhlcWN5eGVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwOTEwMDEsImV4cCI6MjA4MTY2NzAwMX0.fzWkuVmQB770dwGKeLMFGG6EwIwZqlC_aCcZI7EBQUA';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

// Liste des EPUB disponibles
const epubs = [
  "Le parfum -- Suskind,Patrick [Suskind,Patrick] -- 1984 -- 69c25114e05aed6246df157ec3f02dc0 -- Anna’s Archive.epub",
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

