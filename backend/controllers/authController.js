import { supabase } from '../config/supabase.js';

/**
 * Register a new student
 */
export const register = async (req, res) => {
  const { name, branch, year, phone, subjects, email, password, google_email } = req.body;

  if (!name || !branch || !year || !phone || !subjects || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    // 1. Sign up the user via Supabase Auth
    const { data: signUpData, error: authError } = await supabase.auth.signUp({
      email,
      password
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    const userId = signUpData.user?.id;
    if (!userId) {
      return res.status(400).json({ error: 'Registration failed: user ID not generated.' });
    }

    // 2. Insert metadata into B.Tech student profile table
    const { error: dbError } = await supabase
      .from('students')
      .insert({
        id: userId,
        name,
        branch,
        year: parseInt(year, 10),
        phone,
        subjects,
        google_email: google_email || null
      });

    if (dbError) {
      console.error('Database insertion failed during registration. Rolling back user account.', dbError.message);
      // Attempt rollback by deleting the created auth user using service role admin privilege
      try {
        await supabase.auth.admin.deleteUser(userId);
      } catch (rollbackErr) {
        console.error('User rollback deletion failed:', rollbackErr.message);
      }
      return res.status(500).json({ error: dbError.message });
    }

    // 3. Retrieve student metadata details
    const { data: student, error: fetchError } = await supabase
      .from('students')
      .select('*')
      .eq('id', userId)
      .single();

    if (fetchError) {
      return res.status(500).json({ error: 'Profile created but retrieval failed. Try logging in.' });
    }

    const mergedUser = {
      id: userId,
      email: signUpData.user.email,
      ...student
    };

    return res.status(201).json({
      user: mergedUser,
      session: signUpData.session
    });
  } catch (err) {
    console.error('Registration controller error:', err);
    return res.status(500).json({ error: 'An unexpected error occurred during registration' });
  }
};

/**
 * Log in an existing student
 */
export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    // 1. Sign in via Supabase Auth
    const { data: signInData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    const userId = signInData.user.id;

    // 2. Retrieve student metadata details
    const { data: student, error: dbError } = await supabase
      .from('students')
      .select('*')
      .eq('id', userId)
      .single();

    if (dbError) {
      console.error('Retrieve student metadata failed:', dbError.message);
      return res.status(500).json({ error: 'Student profile details could not be found. Please contact support.' });
    }

    const mergedUser = {
      id: userId,
      email: signInData.user.email,
      ...student
    };

    return res.status(200).json({
      user: mergedUser,
      session: signInData.session,
      token: signInData.session?.access_token
    });
  } catch (err) {
    console.error('Login controller error:', err);
    return res.status(500).json({ error: 'An unexpected error occurred during login' });
  }
};
