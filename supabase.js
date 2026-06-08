// supabase.js - Supabase client initialization
const SUPABASE_URL = 'https://wigxrzsyzjlkkoymkhwe.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_jM6XrlGJt2PqfkD9KR0Oeg_6U4zlXZk'; // ← Replace this!

let supabaseClient = null;

export async function getSupabase() {
  if (supabaseClient) return supabaseClient;
  try {
    const { createClient } = await import(
      'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'
    );
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storageKey: 'lindner-lca-auth',
      }
    });
    return supabaseClient;
  } catch (e) {
    console.warn('Supabase connection failed:', e.message);
    return null;
  }
}

export async function signUp(email, password, fullName) {
  try {
    const supabase = await getSupabase();
    if (!supabase) return { data: null, error: { message: 'Connection failed' } };
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } }
    });
    return { data, error };
  } catch (e) {
    return { data: null, error: { message: e.message } };
  }
}

export async function signIn(email, password) {
  try {
    const supabase = await getSupabase();
    if (!supabase) return { data: null, error: { message: 'Connection failed' } };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error };
  } catch (e) {
    return { data: null, error: { message: e.message } };
  }
}

export async function signOut() {
  try {
    const supabase = await getSupabase();
    if (!supabase) return { error: null };
    const { error } = await supabase.auth.signOut();
    return { error };
  } catch (e) {
    return { error: null };
  }
}

export async function getCurrentUser() {
  try {
    const supabase = await getSupabase();
    if (!supabase) return null;
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch (e) {
    return null;
  }
}

export async function getCurrentSession() {
  try {
    const supabase = await getSupabase();
    if (!supabase) return null;
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  } catch (e) {
    return null;
  }
}

export function onAuthStateChange(callback) {
  getSupabase().then(supabase => {
    if (!supabase) return;
    supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });
  }).catch(() => {});
}

export async function saveProject(projectData, projectId = null) {
  try {
    const supabase = await getSupabase();
    if (!supabase) return { data: null, error: { message: 'Not connected' } };
    const user = await getCurrentUser();
    if (!user) return { data: null, error: { message: 'Not logged in' } };

    const payload = {
      user_id: user.id,
      name: projectData?.name || 'Untitled Project',
      description: `${projectData?.projectType || ''} - ${projectData?.location || ''}`.trim(),
      building_data: projectData,
      updated_at: new Date().toISOString(),
    };

    if (projectId) {
      const { data, error } = await supabase
        .from('projects')
        .update(payload)
        .eq('id', projectId)
        .eq('user_id', user.id)
        .select()
        .single();
      return { data, error };
    } else {
      const { data, error } = await supabase
        .from('projects')
        .insert(payload)
        .select()
        .single();
      return { data, error };
    }
  } catch (e) {
    return { data: null, error: { message: e.message } };
  }
}

export async function loadProjects() {
  try {
    const supabase = await getSupabase();
    if (!supabase) return { data: [], error: null };
    const user = await getCurrentUser();
    if (!user) return { data: [], error: null };

    const { data, error } = await supabase
      .from('projects')
      .select('id, name, description, created_at, updated_at')
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .order('updated_at', { ascending: false });

    return { data: data || [], error };
  } catch (e) {
    return { data: [], error: null };
  }
}

export async function loadProject(projectId) {
  try {
    const supabase = await getSupabase();
    if (!supabase) return { data: null, error: { message: 'Not connected' } };
    const user = await getCurrentUser();
    if (!user) return { data: null, error: { message: 'Not logged in' } };

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    return { data, error };
  } catch (e) {
    return { data: null, error: { message: e.message } };
  }
}

export async function deleteProject(projectId) {
  try {
    const supabase = await getSupabase();
    if (!supabase) return { error: { message: 'Not connected' } };
    const user = await getCurrentUser();
    if (!user) return { error: { message: 'Not logged in' } };

    const { error } = await supabase
      .from('projects')
      .update({ is_deleted: true })
      .eq('id', projectId)
      .eq('user_id', user.id);

    return { error };
  } catch (e) {
    return { error: { message: e.message } };
  }
}

export async function getUserProfile() {
  try {
    const supabase = await getSupabase();
    if (!supabase) return { data: null, error: null };
    const user = await getCurrentUser();
    if (!user) return { data: null, error: null };

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    return { data, error };
  } catch (e) {
    return { data: null, error: null };
  }
}
