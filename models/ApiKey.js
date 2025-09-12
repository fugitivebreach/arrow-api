const mongoose = require('mongoose');

const apiKeySchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastUsed: {
    type: Date,
    default: null
  },
  usageCount: {
    type: Number,
    default: 0
  }
});

apiKeySchema.methods.recordUsage = function() {
  this.lastUsed = new Date();
  this.usageCount += 1;
  return this.save();
};

module.exports = mongoose.model('ApiKey', apiKeySchema);
