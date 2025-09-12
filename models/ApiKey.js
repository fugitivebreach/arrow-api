const { ObjectId } = require('mongodb');
const { getDB } = require('../config/database');

class ApiKey {
  constructor(data) {
    this._id = data._id || new ObjectId();
    this.key = data.key;
    this.name = data.name;
    this.userId = data.userId;
    this.createdAt = data.createdAt || new Date();
    this.lastUsed = data.lastUsed;
    this.usageCount = data.usageCount || 0;
    this.isActive = data.isActive !== undefined ? data.isActive : true;
  }

  static async findByKey(key) {
    const db = getDB();
    if (!db) return null;
    const keyData = await db.collection('apikeys').findOne({ key, isActive: true });
    return keyData ? new ApiKey(keyData) : null;
  }

  static async findByUser(userId) {
    const db = getDB();
    if (!db) return [];
    const keysData = await db.collection('apikeys').find({ userId: new ObjectId(userId), isActive: true }).toArray();
    return keysData.map(keyData => new ApiKey(keyData));
  }

  async recordUsage() {
    const db = getDB();
    if (!db) return null;
    this.lastUsed = new Date();
    this.usageCount += 1;
    const result = await db.collection('apikeys').updateOne(
      { _id: this._id },
      { $set: { lastUsed: this.lastUsed, usageCount: this.usageCount } }
    );
    return result;
  }

  async save() {
    const db = getDB();
    if (!db) return null;
    const result = await db.collection('apikeys').replaceOne(
      { _id: this._id },
      this,
      { upsert: true }
    );
    return result;
  }
}

module.exports = ApiKey;
