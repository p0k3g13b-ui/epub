// --- Supabase ---
const supabaseUrl = 'https://qtqkbuvmbakiheqcyxed.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0cWtidXZtYmFraWhlcWN5eGVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwOTEwMDEsImV4cCI6MjA4MTY2NzAwMX0.fzWkuVmQB770dwGKeLMFGG6EwIwZqlC_aCcZI7EBQUA';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

const epubListEl = document.getElementById('epub-list');

// Fonction pour charger et afficher les livres
(async () => {
  try {
    // 1. Récupère tous les livres depuis la table books
    const { data: books, error: booksError } = await supabaseClient
      .from('books')
      .select('*')
      .order('added_date', { ascending: false }); // Par défaut, les plus récents d'abord
    
    if (booksError) {
      console.error("❌ Erreur chargement livres:", booksError);
      epubListEl.innerHTML = '<p>Erreur lors du chargement des livres.</p>';
      return;
    }
    
    if (!books || books.length === 0) {
      epubListEl.innerHTML = '<p>Aucun livre dans la bibliothèque. Ajoutez-en via l\'onglet Recherche !</p>';
      return;
    }
    
    console.log("📚 Livres chargés:", books.length);
    
    // 2. Récupère les positions de lecture pour le tri
    const { data: positions, error: positionsError } = await supabaseClient
      .from('reading_positions')
      .select('epub_name, last_opened');
    
    if (positionsError) {
      console.warn("⚠️ Erreur positions (non bloquant):", positionsError);
    }
    
    // 3. Crée un map filename → date de dernière ouverture
    const lastOpenedMap = {};
    if (positions) {
      positions.forEach(p => {
        lastOpenedMap[p.epub_name] = new Date(p.last_opened);
      });
    }
    
    console.log("📅 Positions de lecture:", Object.keys(lastOpenedMap).length);
    
    // 4. Trie les livres : récemment lus en premier
    const sortedBooks = [...books].sort((a, b) => {
      const dateA = lastOpenedMap[a.filename];
      const dateB = lastOpenedMap[b.filename];
      
      // Si aucun n'a été ouvert, ordre par date d'ajout (plus récent d'abord)
      if (!dateA && !dateB) {
        return new Date(b.added_date) - new Date(a.added_date);
      }
      
      // Si seulement A n'a pas été ouvert, B avant A
      if (!dateA) return 1;
      
      // Si seulement B n'a pas été ouvert, A avant B
      if (!dateB) return -1;
      
      // Les deux ont été ouverts, le plus récent en premier
      return dateB - dateA;
    });
    
    console.log("📊 Ordre d'affichage:", sortedBooks.map(b => b.title));
    
    // 5. Affiche les livres
    for (const book of sortedBooks) {
      await displayBook(book);
    }
    
  } catch (err) {
    console.error("❌ Erreur fatale:", err);
    epubListEl.innerHTML = '<p>Erreur lors du chargement.</p>';
  }
})();

// Fonction pour afficher un livre
async function displayBook(book) {
  const container = document.createElement('div');
  container.className = 'epub-item';
  
  // Ajoute le titre
  const title = document.createElement('div');
  title.className = 'epub-title';
  title.textContent = book.title;
  
  // Récupère l'URL publique du fichier depuis Supabase Storage
  const { data: urlData } = supabaseClient.storage
    .from('epubs')
    .getPublicUrl(book.filename);
  
  // L'API retourne publicURL (majuscules) pas publicUrl
  const publicUrl = urlData?.publicURL || urlData?.publicUrl;
  
  if (!publicUrl) {
    console.error("❌ Impossible de récupérer l'URL pour:", book.filename);
    return;
  }
  
  try {
    // Crée un aperçu de la première page
    const epubBook = ePub(publicUrl);
    const rendition = epubBook.renderTo(container, { 
      width: 200, 
      height: 220 
    });
    
    rendition.flow("paginated");
    await rendition.display(0); // Première page
    
    // Événement clic
    container.addEventListener('click', () => {
      // Passe le filename en paramètre au lieu du nom complet
      window.location.href = `reader.html?book=${encodeURIComponent(book.filename)}`;
    });
    
    container.appendChild(title);
    epubListEl.appendChild(container);
    
  } catch (err) {
    console.error("❌ Erreur affichage livre:", book.title, err);
  }
}
