// --- Configuration Supabase ---
const supabaseUrl = 'https://qtqkbuvmbakiheqcyxed.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0cWtidXZtYmFraWhlcWN5eGVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwOTEwMDEsImV4cCI6MjA4MTY2NzAwMX0.fzWkuVmQB770dwGKeLMFGG6EwIwZqlC_aCcZI7EBQUA';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

const epubListEl = document.getElementById('epub-list');
const readerContainer = document.getElementById('reader-container');
let currentBook = null;
let rendition = null;

// Liste des EPUB (ici un seul pour l’exemple)
const epubs = ["parfum.epub"];

// Affiche la liste triée par dernière ouverture
async function loadEpubList() {
  const { data } = await supabaseClient.from('reading_positions').select('*');
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
  readerContainer.innerHTML = '';
  if(currentBook) currentBook.destroy();

  currentBook = ePub(`epubs/${name}`);
  rendition = currentBook.renderTo("reader-container", {
    width: "100%",
    height: "100%"
  });

  rendition.flow("scrolled");

  // Récupère la dernière position depuis Supabase
  const { data } = await supabaseClient.from('reading_positions').select('*').eq('epub_name', name).single();
  const startLocation = data?.last_position || 0;

  rendition.display(startLocation);

  // Navigation par boutons
  document.getElementById("prev").onclick = () => rendition.prev();
  document.getElementById("next").onclick = () => rendition.next();

  // Sauvegarde automatique de la position
  rendition.on('relocated', async (location) => {
    const pos = location.start.cfi;
    await supabaseClient.from('reading_positions').upsert({
      epub_name: name,
      last_position: pos,
      last_opened: new Date().toISOString()
    },
    { onConflict: 'epub_name' });
    loadEpubList(); // met à jour l’ordre des livres
  });
}

// Initialisation
loadEpubList();

