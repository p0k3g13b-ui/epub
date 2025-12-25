const epubListEl = document.getElementById('epub-list');

// Liste des EPUB disponibles
const epubs = [
  "Le parfum.epub",
  "Entre deux mondes.epub",
  "L'ame du mal.epub",
  "In tenebris.epub"
];

epubs.forEach(async (name) => {
  const container = document.createElement('div');
  container.className = 'epub-item';
  
  // Ajoute le titre
  const title = document.createElement('div');
  title.className = 'epub-title';
  title.textContent = name.replace('.epub', '');
  
  // Crée un petit lecteur temporaire pour la première page
  const book = ePub(`epubs/${name}`); // ✅ Correction : backticks ajoutés
  const rendition = book.renderTo(container, { 
    width: 200, 
    height: 220 
  });
  
  rendition.flow("paginated");
  rendition.display(0); // première page
  
  container.addEventListener('click', () => {
    window.location.href = `reader.html?book=${encodeURIComponent(name)}`;
  });
  
  container.appendChild(title);
  epubListEl.appendChild(container);
});




