const epubListEl = document.getElementById('epub-list');
const readerContainer = document.getElementById('reader-container');
let currentBook = null;
let rendition = null;

// Liste avec un seul EPUB
epubListEl.innerHTML = '';
const li = document.createElement('li');
li.textContent = "parfum.epub";
li.onclick = () => openEpub("parfum.epub");
epubListEl.appendChild(li);

// Fonction pour ouvrir le livre
function openEpub(name) {
  // Vide le conteneur
  readerContainer.innerHTML = '';
  if(currentBook) currentBook.destroy();

  // Charge le livre
  currentBook = ePub(`epubs/${name}`);
  rendition = currentBook.renderTo("reader-container", {
    width: "100%",
    height: "100%"
  });

  // Défilement vertical (optionnel)
  rendition.flow("scrolled");

  // Affiche depuis le début
  rendition.display();

  // Navigation par boutons
  document.getElementById("prev").onclick = () => rendition.prev();
  document.getElementById("next").onclick = () => rendition.next();
}
