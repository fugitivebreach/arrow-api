const axios = require('axios');

class RobloxService {
  constructor() {
    this.baseURL = 'https://groups.roblox.com/v1';
    this.usersURL = 'https://users.roblox.com/v1';
  }

  async getGroupMembership(userId, groupId) {
    try {
      console.log(`Roblox API - Checking membership for user ${userId} in group ${groupId}`);
      console.log(`Roblox API - Full URL: ${this.usersURL}/users/${userId}/groups/roles`);
      
      // First, let's try to get basic user info to verify the user exists
      try {
        const userCheck = await axios.get(`${this.usersURL}/users/${userId}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          timeout: 10000
        });
        console.log(`Roblox API - User exists:`, userCheck.data);
      } catch (userError) {
        console.log(`Roblox API - User check failed:`, userError.response?.status, userError.response?.data);
      }
      
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

      console.log(`Roblox API - Response status: ${response.status}`);
      console.log(`Roblox API - Response data structure:`, {
        hasData: !!response.data,
        hasDataArray: !!(response.data && response.data.data),
        groupCount: response.data && response.data.data ? response.data.data.length : 0
      });

      if (response.status === 200 && response.data && response.data.data) {
        // Log all groups for debugging
        console.log(`Roblox API - User's groups:`, response.data.data.map(g => ({
          id: g.group.id,
          name: g.group.name,
          rank: g.role.rank,
          roleName: g.role.name
        })));
        
        // Find the specific group in user's groups
        const userGroup = response.data.data.find(group => group.group.id === parseInt(groupId));
        console.log(`Roblox API - Target group ${groupId} found:`, !!userGroup);
        
        if (userGroup) {
          console.log(`Roblox API - User is in group with rank: ${userGroup.role.name} (${userGroup.role.rank})`);
          return {
            membership: 'In group',
            rankName: userGroup.role.name,
            rankID: userGroup.role.rank,
            groupName: userGroup.group.name,
            groupID: userGroup.group.id
          };
        }
      }
      
      console.log(`Roblox API - User not found in group ${groupId}`);
      return { membership: 'Not in group' };
    } catch (error) {
      console.error('Roblox API error details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
      
      if (error.response && error.response.status === 404) {
        console.log(`Roblox API - Groups endpoint returned 404 for user ${userId}`);
        return { 
          membership: 'Groups not visible',
          error: `User ${userId} has privacy settings that prevent group visibility or groups endpoint is restricted`
        };
      }
      
      if (error.response && error.response.status === 400) {
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
