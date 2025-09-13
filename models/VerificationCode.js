const { getDB } = require('../config/database');

class VerificationCode {
    static generateCode() {
        const parts = [];
        for (let i = 0; i < 7; i++) {
            let partLength;
            if (i === 2) partLength = 9; // Third part is 9 characters
            else if ([0, 1, 3, 4, 5, 6].includes(i)) partLength = [6, 5, 6, 6, 5, 6][i === 0 ? 0 : i === 1 ? 1 : i === 3 ? 2 : i === 4 ? 3 : i === 5 ? 4 : 5];
            
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let part = '';
            for (let j = 0; j < partLength; j++) {
                part += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            parts.push(part);
        }
        return parts.join('-');
    }

    static async createCode(discordId, username) {
        try {
            const db = getDB();
            if (!db) return null;

            const code = this.generateCode();
            const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

            await db.collection('verification_codes').insertOne({
                code,
                discordId,
                username,
                createdAt: new Date(),
                expiresAt,
                used: false
            });

            return code;
        } catch (error) {
            console.error('Error creating verification code:', error);
            return null;
        }
    }

    static async validateCode(code) {
        try {
            const db = getDB();
            if (!db) return null;

            const verificationCode = await db.collection('verification_codes').findOne({
                code,
                used: false,
                expiresAt: { $gt: new Date() }
            });

            if (verificationCode) {
                // Mark as used
                await db.collection('verification_codes').updateOne(
                    { _id: verificationCode._id },
                    { $set: { used: true, usedAt: new Date() } }
                );
                return verificationCode;
            }

            return null;
        } catch (error) {
            console.error('Error validating verification code:', error);
            return null;
        }
    }

    static async cleanupExpiredCodes() {
        try {
            const db = getDB();
            if (!db) return;

            await db.collection('verification_codes').deleteMany({
                expiresAt: { $lt: new Date() }
            });
        } catch (error) {
            console.error('Error cleaning up expired codes:', error);
        }
    }

    static async getUserActiveCode(discordId) {
        try {
            const db = getDB();
            if (!db) return null;

            return await db.collection('verification_codes').findOne({
                discordId,
                used: false,
                expiresAt: { $gt: new Date() }
            });
        } catch (error) {
            console.error('Error getting user active code:', error);
            return null;
        }
    }
}

module.exports = VerificationCode;
