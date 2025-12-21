// --- Supabase ---
const supabaseUrl = 'https://qtqkbuvmbakiheqcyxed.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0cWtidXZtYmFraWhlcWN5eGVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwOTEwMDEsImV4cCI6MjA4MTY2NzAwMX0.fzWkuVmQB770dwGKeLMFGG6EwIwZqlC_aCcZI7EBQUA';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

const epubListEl = document.getElementById('epub-list');

// Liste statique pour l’instant
const epubs = ["parfum.epub"];

async function loadList() {
  const { data = [] } = await supabase
    .from('reading_positions')
    .select('*');

  const books = epubs
    .map(name => {
      const r = data.find(d => d.epub_name === name);
      return { name, last: r?.last_opened || 0 };
    })
    .sort((a, b) => new Date(b.last) - new Date(a.last));

  epubListEl.innerHTML = '';
  books.forEach(b => {
    const li = document.createElement('li');
    li.textContent = b.name;
    li.onclick = () => {
      window.location.href = `reader.html?book=${encodeURIComponent(b.name)}`;
    };
    epubListEl.appendChild(li);
  });
}

loadList();
