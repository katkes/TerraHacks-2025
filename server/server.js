import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import storiesRouter from './routes/stories.js';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
app.use(cors(), express.json());

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true, useUnifiedTopology: true
});

app.use('/api/stories', storiesRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(`Server listening on http://localhost:${PORT}`)
);
