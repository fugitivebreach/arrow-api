const axios = require('axios');

class RobloxService {
  constructor() {
    this.baseURL = 'https://groups.roblox.com/v1';
    this.usersURL = 'https://users.roblox.com/v1';
  }

  async getGroupMembership(userId, groupId) {
    try {
      // Use public API to get user's groups
      const response = await axios.get(
        `${this.usersURL}/users/${userId}/groups/roles`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          timeout: 10000
        }
      );

      if (response.status === 200 && response.data && response.data.data) {
        // Find the specific group in user's groups
        const userGroup = response.data.data.find(group => group.group.id === parseInt(groupId));
        
        if (userGroup) {
          return {
            membership: 'In group',
            rankName: userGroup.role.name,
            rankID: userGroup.role.rank,
            groupName: userGroup.group.name,
            groupID: userGroup.group.id
          };
        }
      }
      
      return { membership: 'Not in group' };
    } catch (error) {
      if (error.response && (error.response.status === 404 || error.response.status === 400)) {
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
