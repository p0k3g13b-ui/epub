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
  spread: "none",
  allowScriptedContent : true
});

(async () => {
  await book.ready;
  await book.locations.generate(1500);
})();

// 🔑 MODE FIABLE
rendition.flow("scrolled");

//sauvegarde de position
let saveInterval = null;

rendition.hooks.content.register(contents => {
  const doc = contents.document;

  if (saveInterval) return;

  saveInterval = setInterval(() => {
    const scrollTop = doc.documentElement.scrollTop || doc.body.scrollTop;
    const scrollHeight = doc.documentElement.scrollHeight || doc.body.scrollHeight;
    const clientHeight = doc.documentElement.clientHeight || doc.body.clientHeight;

    if (!scrollHeight) return;

    const percentage = scrollTop / (scrollHeight - clientHeight);
    if (percentage < 0 || percentage > 1) return;

    const cfi = book.locations.cfiFromPercentage(percentage);
    if (!cfi) return;

    supabaseClient
      .from('reading_positions')
      .upsert({
        epub_name: bookName,
        last_cfi: cfi,
        last_percentage: percentage,
        last_opened: new Date().toISOString()
      }, { onConflict: 'epub_name' });

  }, 1000);
});


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

document.getElementById('swipe-left').addEventListener('click', () => rendition.prev());
document.getElementById('swipe-right').addEventListener('click', () => rendition.next());
