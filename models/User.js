const mongoose = require('mongoose');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  discordId: {
    type: String,
    required: true,
    unique: true
  },
  username: {
    type: String,
    required: true
  },
  discriminator: {
    type: String,
    required: true
  },
  avatar: {
    type: String,
    default: null
  },
  email: {
    type: String,
    default: null
  },
  apiKeys: [{
    key: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
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
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  robloxCookie: {
    value: {
      type: String,
      default: null
    },
    updatedAt: {
      type: Date,
      default: null
    },
    lastRegenerated: {
      type: Date,
      default: null
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date,
    default: Date.now
  }
});

userSchema.methods.generateApiKey = function(name) {
  const key = crypto.randomBytes(32).toString('hex');
  this.apiKeys.push({
    key: key,
    name: name || `API Key ${this.apiKeys.length + 1}`,
    createdAt: new Date(),
    isActive: true
  });
  return key;
};

userSchema.methods.canRegenerateCookie = function() {
  if (!this.robloxCookie.lastRegenerated) return true;
  const fiveSecondsAgo = new Date(Date.now() - 5000);
  return this.robloxCookie.lastRegenerated < fiveSecondsAgo;
};

userSchema.methods.updateCookie = function(newCookie) {
  this.robloxCookie.value = newCookie;
  this.robloxCookie.updatedAt = new Date();
  this.robloxCookie.lastRegenerated = new Date();
};

module.exports = mongoose.model('User', userSchema);
