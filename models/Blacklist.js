const { connectToDatabase } = require('../config/database');

class Blacklist {
    static async isBlacklisted(discordId) {
        try {
            const db = await connectToDatabase();
            const user = await db.collection('users').findOne({ 
                discordId: discordId.toString(),
                isBlacklisted: true 
            });
            return !!user;
        } catch (error) {
            console.error('Error checking blacklist status:', error);
            return false;
        }
    }

    static async addToBlacklist(discordId, reason = null) {
        try {
            const db = await connectToDatabase();
            
            // Update user record
            const result = await db.collection('users').updateOne(
                { discordId: discordId.toString() },
                { 
                    $set: { 
                        isBlacklisted: true,
                        blacklistedAt: new Date(),
                        blacklistReason: reason
                    }
                }
            );

            return result.modifiedCount > 0;
        } catch (error) {
            console.error('Error adding to blacklist:', error);
            return false;
        }
    }

    static async removeFromBlacklist(discordId) {
        try {
            const db = await connectToDatabase();
            
            const result = await db.collection('users').updateOne(
                { discordId: discordId.toString() },
                { 
                    $unset: { 
                        isBlacklisted: '',
                        blacklistedAt: '',
                        blacklistReason: ''
                    }
                }
            );

            return result.modifiedCount > 0;
        } catch (error) {
            console.error('Error removing from blacklist:', error);
            return false;
        }
    }

    static async getBlacklistedUsers() {
        try {
            const db = await connectToDatabase();
            const users = await db.collection('users').find({ 
                isBlacklisted: true 
            }).toArray();
            
            return users.map(user => ({
                discordId: user.discordId,
                username: user.username,
                blacklistedAt: user.blacklistedAt,
                reason: user.blacklistReason
            }));
        } catch (error) {
            console.error('Error fetching blacklisted users:', error);
            return [];
        }
    }
}

module.exports = Blacklist;
