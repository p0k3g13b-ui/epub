const epubListEl = document.getElementById('epub-list');

// Liste des EPUB disponibles
const epubs = ["parfum.epub"]; // ajoute d’autres fichiers ici

epubs.forEach(async (name) => {
  const container = document.createElement('div');
  container.className = 'epub-item';

  // Crée un petit lecteur temporaire pour la première page
  const book = ePub(`epubs/${name}`);
  const rendition = book.renderTo(container, { width: 200, height: 250 });
  
  rendition.flow("paginated"); // pour afficher une seule page
  rendition.display(0); // première page

  container.addEventListener('click', () => {
    // Redirection vers le lecteur complet
    window.location.href = `reader.html?book=${encodeURIComponent(name)}`;
  });

  epubListEl.appendChild(container);
});
