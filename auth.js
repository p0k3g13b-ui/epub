// --- Supabase Client ---
const supabaseUrl = 'https://qtqkbuvmbakiheqcyxed.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0cWtidXZtYmFraWhlcWN5eGVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwOTEwMDEsImV4cCI6MjA4MTY2NzAwMX0.fzWkuVmQB770dwGKeLMFGG6EwIwZqlC_aCcZI7EBQUA';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

/**
 * Vérifie si l'utilisateur est authentifié
 * @returns {Promise<Object|null>} L'utilisateur ou null
 */
async function checkAuth() {
  const user = supabaseClient.auth.user();
  
  if (!user) {
    return null;
  }
  
  // Récupère les infos complètes (username) depuis la table users
  try {
    const { data, error } = await supabaseClient
      .from('users')
      .select('id, email, username, created_at')
      .eq('id', user.id)
      .single();
    
    if (error) {
      console.error('Erreur récupération user:', error);
      return user; // Retourne au moins l'user de base
    }
    
    return data || user;
  } catch (err) {
    console.error('Erreur checkAuth:', err);
    return user;
  }
}

/**
 * Redirige vers login si non authentifié
 * À appeler au début des pages protégées
 */
async function requireAuth() {
  const user = await checkAuth();
  
  if (!user) {
    // Redirige vers login avec l'URL de retour
    const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `login.html?return=${returnUrl}`;
    throw new Error('Not authenticated');
  }
  
  return user;
}

/**
 * Déconnexion
 */
async function logout() {
  try {
    const { error } = await supabaseClient.auth.signOut();
    
    if (error) {
      console.error('Erreur déconnexion:', error);
      alert('Erreur lors de la déconnexion');
      return;
    }
    
    window.location.href = 'login.html';
  } catch (err) {
    console.error('Erreur logout:', err);
    alert('Erreur lors de la déconnexion');
  }
}

/**
 * Récupère l'utilisateur actuel (avec ses infos complètes)
 */
async function getCurrentUser() {
  return await checkAuth();
}
