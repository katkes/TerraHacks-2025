import mongoose from 'mongoose';

const storySchema = new mongoose.Schema({
  storyId:    { type: String, required: true, unique: true },
  alias:      { type: String, default: '' },
  storyText:  { type: String, required: true },
  insightText:{ type: String, required: true },
  themes:     { type: [String], default: [] },
}, { timestamps: true });

export default mongoose.model('Story', storySchema);
