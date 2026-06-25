import { supabase } from '../config/supabase.js';
import * as groqService from '../services/groqService.js';
import { semanticSearch } from '../services/ragService.js';

/**
 * Send a chat message, persistent history, and return AI response.
 */
export const sendMessage = async (req, res) => {
  const { message, mode, sessionId } = req.body;
  const studentId = req.user.id;

  if (!message || !mode) {
    return res.status(400).json({ error: 'Message and mode are required fields.' });
  }

  try {
    let currentSessionId = sessionId;

    // 1. If no sessionId, create a new chat session
    if (!currentSessionId) {
      const title = message.length > 40 ? message.substring(0, 37) + '...' : message;
      const { data: newSession, error: sessionError } = await supabase
        .from('chat_sessions')
        .insert({
          student_id: studentId,
          mode,
          title
        })
        .select()
        .single();

      if (sessionError) {
        console.error('Session creation error:', sessionError);
        return res.status(500).json({ error: 'Failed to initialize chat session.' });
      }
      currentSessionId = newSession.id;
    } else {
      // Validate session ownership
      const { data: session, error: valError } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('id', currentSessionId)
        .eq('student_id', studentId)
        .single();

      if (valError || !session) {
        return res.status(403).json({ error: 'Unauthorized or invalid chat session.' });
      }
    }

    // 2. Insert user message
    const { error: userMsgError } = await supabase
      .from('chat_messages')
      .insert({
        session_id: currentSessionId,
        role: 'user',
        content: message
      });

    if (userMsgError) {
      console.error('Error saving user message:', userMsgError);
      return res.status(500).json({ error: 'Failed to record user message.' });
    }

    // 3. Retrieve recent history for context (last 10 messages)
    const { data: history, error: historyError } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('session_id', currentSessionId)
      .order('created_at', { ascending: true });

    if (historyError) {
      console.error('Error fetching chat history:', historyError);
      return res.status(500).json({ error: 'Failed to load conversation history.' });
    }

    // Map history to standard Chat Completion format
    const formattedHistory = history.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // Perform RAG lookup if category is applicable
    let category = null;
    if (mode === 'study') category = 'academic';
    else if (mode === 'placement') category = 'placement';
    else if (mode === 'startup') category = 'startup';

    let ragContext = '';
    if (category) {
      try {
        const matches = await semanticSearch(studentId, message, category, 3);
        if (matches && matches.length > 0) {
          ragContext = matches.map(m => `[Source file: ${m.filename}]\n${m.content}`).join('\n\n');
        }
      } catch (ragErr) {
        console.error('RAG lookup failed in chat controller:', ragErr);
      }
    }

    // 4. Generate AI response from Groq
    const aiResponse = await groqService.chatCompletion(formattedHistory, mode, ragContext);

    // 5. Insert AI response
    const { error: aiMsgError } = await supabase
      .from('chat_messages')
      .insert({
        session_id: currentSessionId,
        role: 'assistant',
        content: aiResponse
      });

    if (aiMsgError) {
      console.error('Error saving assistant message:', aiMsgError);
      return res.status(500).json({ error: 'Failed to record AI response.' });
    }

    // 6. Update session updated_at timestamp
    await supabase
      .from('chat_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', currentSessionId);

    return res.status(200).json({
      success: true,
      response: aiResponse,
      sessionId: currentSessionId
    });
  } catch (error) {
    console.error('Error in sendMessage controller:', error);
    return res.status(500).json({ error: error.message || 'An error occurred during your chat session.' });
  }
};

/**
 * Get all chat sessions for the logged-in student.
 */
export const getSessions = async (req, res) => {
  const studentId = req.user.id;

  try {
    const { data: sessions, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('student_id', studentId)
      .order('updated_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'Failed to retrieve sessions.' });
    }

    return res.status(200).json({ sessions });
  } catch (error) {
    console.error('Error in getSessions controller:', error);
    return res.status(500).json({ error: 'An unexpected error occurred.' });
  }
};

/**
 * Get messages inside a chat session.
 */
export const getSessionMessages = async (req, res) => {
  const studentId = req.user.id;
  const sessionId = req.params.id;

  try {
    // Verify session ownership
    const { data: session, error: sessionErr } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('student_id', studentId)
      .single();

    if (sessionErr || !session) {
      return res.status(403).json({ error: 'Unauthorized or session not found.' });
    }

    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch session messages.' });
    }

    return res.status(200).json({ messages });
  } catch (error) {
    console.error('Error in getSessionMessages controller:', error);
    return res.status(500).json({ error: 'An unexpected error occurred.' });
  }
};

/**
 * Delete a chat session.
 */
export const deleteSession = async (req, res) => {
  const studentId = req.user.id;
  const sessionId = req.params.id;

  try {
    const { error } = await supabase
      .from('chat_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('student_id', studentId);

    if (error) {
      return res.status(500).json({ error: 'Failed to delete chat session.' });
    }

    return res.status(200).json({ success: true, message: 'Chat session deleted successfully.' });
  } catch (error) {
    console.error('Error in deleteSession controller:', error);
    return res.status(500).json({ error: 'An unexpected error occurred.' });
  }
};
