const { ObjectId } = require('mongodb');
const crypto = require('crypto');
const { getDB } = require('../config/database');

class User {
  constructor(data) {
    this._id = data._id || new ObjectId();
    this.discordId = data.discordId;
    this.username = data.username;
    this.discriminator = data.discriminator;
    this.avatar = data.avatar;
    this.email = data.email;
    this.apiKeys = data.apiKeys || [];
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  static async findOne(query) {
    const db = getDB();
    if (!db) return null;
    const userData = await db.collection('users').findOne(query);
    return userData ? new User(userData) : null;
  }

  static async findById(id) {
    const db = getDB();
    if (!db) return null;
    const userData = await db.collection('users').findOne({ _id: new ObjectId(id) });
    return userData ? new User(userData) : null;
  }

  async save() {
    const db = getDB();
    if (!db) return null;
    this.updatedAt = new Date();
    const result = await db.collection('users').replaceOne(
      { _id: this._id },
      this,
      { upsert: true }
    );
    return result;
  }

  generateApiKey(name) {
    const apiKey = crypto.randomBytes(32).toString('hex');
    this.apiKeys.push({
      _id: new ObjectId(),
      key: apiKey,
      name: name,
      createdAt: new Date(),
      usageCount: 0
    });
    return apiKey;
  }

  removeApiKey(keyId) {
    this.apiKeys = this.apiKeys.filter(key => key._id.toString() !== keyId);
  }

  updateApiKeyUsage(apiKey) {
    const key = this.apiKeys.find(k => k.key === apiKey);
    if (key) {
      key.lastUsed = new Date();
      key.usageCount += 1;
    }
  }
}

module.exports = User;
