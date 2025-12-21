// --- Supabase ---
const supabaseUrl = 'https://qtqkbuvmbakiheqcyxed.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0cWtidXZtYmFraWhlcWN5eGVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwOTEwMDEsImV4cCI6MjA4MTY2NzAwMX0.fzWkuVmQB770dwGKeLMFGG6EwIwZqlC_aCcZI7EBQUA';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

// Récupère le nom du livre
const params = new URLSearchParams(window.location.search);
const bookName = params.get('book');

if (!bookName) {
  alert("Aucun livre");
  throw new Error("No book");
}

// Charge l’EPUB
const book = ePub(`epubs/${bookName}`);
const rendition = book.renderTo("reader", {
  width: "100%",
  height: "100%"
});

rendition.display();

// Restaure position
(async () => {
  const { data } = await supabase
    .from('reading_positions')
    .select('*')
    .eq('epub_name', bookName)
    .single();

  if (data?.last_position) {
    rendition.display(data.last_position);
  }
})();

// Sauvegarde position
rendition.on('relocated', async (location) => {
  await supabase
    .from('reading_positions')
    .upsert(
      {
        epub_name: bookName,
        last_position: location.start.cfi,
        last_opened: new Date().toISOString()
      },
      { onConflict: 'epub_name' }
    );
});
