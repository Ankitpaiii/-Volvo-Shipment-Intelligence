import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth.js';
import taskRoutes from './routes/tasks.js';
import aiRoutes from './routes/ai.js';
import chatRoutes from './routes/chat.js';
import placementRoutes from './routes/placement.js';
import brainspaceRoutes from './routes/brainspace.js';
import studyGroupRoutes from './routes/studygroups.js';
import knowledgeRoutes from './routes/knowledge.js';
import deadlineRoutes from './routes/deadlinePlanner.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for frontend integration
app.use(cors({
  origin: '*', // Allow connections from Vite local environment and deployment environments
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// API route registrations
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/placement', placementRoutes);
app.use('/api/brainspace', brainspaceRoutes);
app.use('/api/study-groups', studyGroupRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/deadline-planner', deadlineRoutes);

// Root ping endpoint
app.get('/', (req, res) => {
  res.json({ message: 'CampusFlow API is active.' });
});

// Catch-all route handler for undefined routes
app.use((req, res, next) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global Error Handler Middleware
app.use((err, req, res, next) => {
  console.error('Global Error Handler caught error:', err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'An internal server error occurred.'
  });
});

app.listen(PORT, () => {
  console.log(`CampusFlow server running on port ${PORT}`);
});
