const axios = require('axios');
const Cookie = require('../models/Cookie');

class RobloxService {
  constructor() {
    this.baseURL = 'https://groups.roblox.com/v1/groups';
  }

  async getCookie(user = null) {
    try {
      // First priority: User-specific cookie if user is provided
      if (user && user.robloxCookie && user.robloxCookie.value) {
        return user.robloxCookie.value;
      }
      
      // Second priority: Global cookie from Cookie collection
      const cookie = await Cookie.findOne({ 
        name: 'ROBLOSECURITY', 
        isActive: true 
      });
      
      if (cookie) {
        return cookie.value;
      }
      
      // Fallback to environment variable
      return process.env.ROBLOX_COOKIE;
    } catch (error) {
      console.error('Error fetching cookie:', error);
      return process.env.ROBLOX_COOKIE;
    }
  }

  async getGroupMembership(userId, groupId, user = null) {
    try {
      const cookie = await this.getCookie(user);
      
      if (!cookie) {
        throw new Error('No Roblox cookie available');
      }

      const response = await axios.get(
        `${this.baseURL}/${groupId}/users/${userId}`,
        {
          headers: {
            'Cookie': `.ROBLOSECURITY=${cookie}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          timeout: 10000
        }
      );

      if (response.status === 200 && response.data) {
        return {
          membership: 'In group',
          rankName: response.data.role.name,
          rankID: response.data.role.rank,
          groupName: response.data.group.name,
          groupID: response.data.group.id
        };
      }
      
      return { membership: 'Not in group' };
    } catch (error) {
      if (error.response && error.response.status === 404) {
        return { membership: 'Not in group' };
      }
      
      console.error('Roblox API error:', error.message);
      throw new Error('Failed to fetch group membership data');
    }
  }

  async getGroupInfo(groupId) {
    try {
      const response = await axios.get(`${this.baseURL}/${groupId}`, {
        timeout: 10000
      });
      
      return response.data;
    } catch (error) {
      console.error('Error fetching group info:', error);
      throw new Error('Failed to fetch group information');
    }
  }
}

module.exports = new RobloxService();
