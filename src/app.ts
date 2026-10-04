import express from 'express';
import cors from 'cors';
import router from './routes/api.routes';

export const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Enregistrement des routes
app.use(router);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint non trouvé' });
});
