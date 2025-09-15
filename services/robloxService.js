const axios = require('axios');

class RobloxService {
  constructor() {
    this.baseURL = 'https://groups.roblox.com/v1';
    this.usersURL = 'https://users.roblox.com/v1';
    this.gamesURL = 'https://games.roblox.com/v1';
    this.thumbnailsURL = 'https://thumbnails.roblox.com/v1';
    this.catalogURL = 'https://catalog.roblox.com/v1';
    this.presenceURL = 'https://presence.roblox.com/v1';
    this.friendsURL = 'https://friends.roblox.com/v1';
    this.inventoryURL = 'https://inventory.roblox.com/v1';
    // Get cookies from environment
    this.cookies = process.env.COOKIES ? JSON.parse(process.env.COOKIES) : [];
  }
  
  // Get available cookie for operations
  async getAvailableCookie() {
    for (const cookie of this.cookies) {
      try {
        // Test cookie validity
        const response = await axios.get('https://users.roblox.com/v1/users/authenticated', {
          headers: {
            'Cookie': `.ROBLOSECURITY=${cookie}`
          },
          timeout: 5000
        });
        
        if (response.data && response.data.id) {
          return cookie;
        }
      } catch (error) {
        continue;
      }
    }
    return null;
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
      
      // Try multiple endpoints - the v1 endpoint might have issues
      let response;
      try {
        // First try the v1 endpoint
        response = await axios.get(
          `${this.usersURL}/users/${userId}/groups/roles`,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000
          }
        );
      } catch (v1Error) {
        console.log(`Roblox API - v1 groups endpoint failed, trying alternative...`);
        console.log(`Roblox API - Trying group members endpoint: ${this.baseURL}/groups/${groupId}/users`);
        
        // Try the groups API from the group side with pagination
        try {
          let allMembers = [];
          let nextPageCursor = null;
          let pageCount = 0;
          const maxPages = 50; // Safety limit to prevent infinite loops
          
          console.log(`Roblox API - Fetching all group members with pagination...`);
          
          do {
            const url = nextPageCursor 
              ? `${this.baseURL}/groups/${groupId}/users?cursor=${nextPageCursor}`
              : `${this.baseURL}/groups/${groupId}/users`;
              
            console.log(`Roblox API - Fetching page ${pageCount + 1}: ${url}`);
            
            const groupResponse = await axios.get(url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              },
              timeout: 10000
            });
            
            if (groupResponse.data && groupResponse.data.data) {
              allMembers = allMembers.concat(groupResponse.data.data);
              nextPageCursor = groupResponse.data.nextPageCursor;
              pageCount++;
              
              console.log(`Roblox API - Page ${pageCount}: Found ${groupResponse.data.data.length} members, total so far: ${allMembers.length}`);
              
              if (pageCount === 1) {
                // Log sample structure on first page
                console.log(`Roblox API - Sample member structure:`, JSON.stringify(groupResponse.data.data[0], null, 2));
              }
            } else {
              break;
            }
          } while (nextPageCursor && pageCount < maxPages);
          
          console.log(`Roblox API - Finished pagination: ${allMembers.length} total members across ${pageCount} pages`);
          
          // Check if user is in the complete members list
          if (allMembers.length > 0) {
            const targetUserId = parseInt(userId);
            console.log(`Roblox API - Looking for user ID: ${targetUserId} in ${allMembers.length} total members`);
            
            const userInGroup = allMembers.find(member => {
              const memberId = member.user?.userId || member.user?.id || member.userId || member.id;
              const memberIdInt = parseInt(memberId);
              return memberIdInt === targetUserId;
            });
            
            if (userInGroup) {
              console.log(`Roblox API - Found user in group via group members endpoint`);
              console.log(`Roblox API - User details:`, {
                username: userInGroup.user?.username,
                rank: userInGroup.role?.name,
                rankId: userInGroup.role?.rank
              });
              return {
                membership: 'In group',
                rankName: userInGroup.role?.name || 'Unknown',
                rankID: userInGroup.role?.rank || 0,
                groupName: `Group ${groupId}`,
                groupID: parseInt(groupId)
              };
            } else {
              console.log(`Roblox API - User ${userId} not found in ${allMembers.length} group members`);
              return { membership: 'Not in group' };
            }
          }
        } catch (groupError) {
          console.log(`Roblox API - Group members endpoint also failed:`, {
            status: groupError.response?.status,
            statusText: groupError.response?.statusText,
            url: `${this.baseURL}/groups/${groupId}/users`,
            data: groupError.response?.data
          });
          
          // Return the groups not visible error since both endpoints failed
          return { 
            membership: 'Groups not visible',
            error: `User ${userId} has privacy settings that prevent group visibility or groups endpoint is restricted`
          };
        }
        
        // This shouldn't be reached, but just in case
        return { membership: 'Not in group' };
      }

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
      const response = await axios.get(`${this.baseURL}/groups/${groupId}`, {
        timeout: 10000
      });
      
      return response.data;
    } catch (error) {
      console.error('Error fetching group info:', error);
      throw new Error('Failed to fetch group information');
    }
  }

  // User Profile APIs
  async getUserProfile(userId) {
    try {
      const response = await axios.get(`${this.usersURL}/users/${userId}`, {
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      throw new Error('Failed to fetch user profile');
    }
  }

  async getUserHeadshot(userId, size = '150x150', format = 'Png') {
    try {
      const response = await axios.get(`${this.thumbnailsURL}/users/avatar-headshot`, {
        params: {
          userIds: userId,
          size: size,
          format: format
        },
        timeout: 10000
      });
      
      if (response.data && response.data.data && response.data.data[0]) {
        return response.data.data[0].imageUrl;
      }
      throw new Error('No headshot data found');
    } catch (error) {
      console.error('Error fetching user headshot:', error);
      throw new Error('Failed to fetch user headshot');
    }
  }

  async getUserHeadshotImage(userId, size = '150x150') {
    try {
      const imageUrl = await this.getUserHeadshot(userId, size);
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching headshot image:', error);
      throw new Error('Failed to fetch headshot image');
    }
  }

  async getUserBadges(userId) {
    try {
      const response = await axios.get(`${this.usersURL}/users/${userId}/roblox-badges`, {
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching user badges:', error);
      throw new Error('Failed to fetch user badges');
    }
  }

  async getUserStatus(userId) {
    try {
      const response = await axios.get(`${this.usersURL}/users/${userId}/status`, {
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching user status:', error);
      throw new Error('Failed to fetch user status');
    }
  }

  // Game APIs
  async getUserGames(userId) {
    try {
      const response = await axios.get(`${this.gamesURL}/users/${userId}/games`, {
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching user games:', error);
      throw new Error('Failed to fetch user games');
    }
  }

  async getGameInfo(gameId) {
    try {
      const response = await axios.get(`${this.gamesURL}/games`, {
        params: { universeIds: gameId },
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching game info:', error);
      throw new Error('Failed to fetch game info');
    }
  }

  async getUserFavoriteGames(userId) {
    try {
      const response = await axios.get(`${this.gamesURL}/users/${userId}/favorite/games`, {
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching user favorite games:', error);
      throw new Error('Failed to fetch user favorite games');
    }
  }

  // Group Extended APIs
  async getGroupRoles(groupId) {
    try {
      const response = await axios.get(`${this.baseURL}/groups/${groupId}/roles`, {
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching group roles:', error);
      throw new Error('Failed to fetch group roles');
    }
  }

  async getGroupWall(groupId) {
    try {
      const response = await axios.get(`${this.baseURL}/groups/${groupId}/wall/posts`, {
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching group wall:', error);
      throw new Error('Failed to fetch group wall');
    }
  }

  async getGroupAllies(groupId) {
    try {
      const response = await axios.get(`${this.baseURL}/groups/${groupId}/relationships/allies`, {
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching group allies:', error);
      throw new Error('Failed to fetch group allies');
    }
  }

  // Social APIs
  async getUserFriends(userId) {
    try {
      const response = await axios.get(`${this.friendsURL}/users/${userId}/friends`, {
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching user friends:', error);
      throw new Error('Failed to fetch user friends');
    }
  }

  async getUserFollowers(userId) {
    try {
      const response = await axios.get(`${this.friendsURL}/users/${userId}/followers`, {
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching user followers:', error);
      throw new Error('Failed to fetch user followers');
    }
  }

  async getUserFollowing(userId) {
    try {
      const response = await axios.get(`${this.friendsURL}/users/${userId}/followings`, {
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching user following:', error);
      throw new Error('Failed to fetch user following');
    }
  }

  // Presence APIs
  async getUserPresence(userId) {
    try {
      const response = await axios.post(`${this.presenceURL}/presence/users`, {
        userIds: [userId]
      }, {
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching user presence:', error);
      throw new Error('Failed to fetch user presence');
    }
  }

  // Asset APIs
  async getAssetInfo(assetId) {
    try {
      const response = await axios.get(`${this.catalogURL}/assets/${assetId}/details`, {
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching asset info:', error);
      throw new Error('Failed to fetch asset info');
    }
  }

  async getUserInventory(userId, assetType = 'Hat') {
    try {
      const response = await axios.get(`${this.inventoryURL}/users/${userId}/assets/collectibles`, {
        params: {
          assetType: assetType,
          sortOrder: 'Desc',
          limit: 100
        },
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching user inventory:', error);
      throw new Error('Failed to fetch user inventory');
    }
  }

  async searchCatalog(keyword, category = 'All') {
    try {
      const response = await axios.get(`${this.catalogURL}/search/items`, {
        params: {
          keyword: keyword,
          category: category,
          limit: 30
        },
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error('Error searching catalog:', error);
      throw new Error('Failed to search catalog');
    }
  }

  // Role Management APIs
  async setUserRole(groupId, userId, roleId, roleRank, roleName, cookie) {
    try {
      // First get group roles to find the correct role
      let targetRole = null;
      
      if (roleId) {
        // Use roleId directly
        targetRole = { id: roleId };
      } else if (roleRank || roleName) {
        // Get group roles to find by rank or name
        const rolesResponse = await axios.get(`${this.baseURL}/groups/${groupId}/roles`, {
          timeout: 10000
        });
        
        if (rolesResponse.data && rolesResponse.data.roles) {
          if (roleRank) {
            targetRole = rolesResponse.data.roles.find(role => role.rank === roleRank);
          } else if (roleName) {
            targetRole = rolesResponse.data.roles.find(role => role.name.toLowerCase() === roleName.toLowerCase());
          }
        }
      }
      
      if (!targetRole) {
        throw new Error('Role not found');
      }
      
      // Set the user's role
      const response = await axios.patch(`${this.baseURL}/groups/${groupId}/users/${userId}`, {
        roleId: targetRole.id
      }, {
        headers: {
          'Cookie': `.ROBLOSECURITY=${cookie}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      return {
        success: true,
        role: targetRole,
        userId: userId
      };
    } catch (error) {
      console.error('Error setting user role:', error);
      throw new Error(`Failed to set user role: ${error.response?.data?.errors?.[0]?.message || error.message}`);
    }
  }
  
  async exileUser(groupId, userId, cookie) {
    try {
      // Exile the user from the group
      const response = await axios.delete(`${this.baseURL}/groups/${groupId}/users/${userId}`, {
        headers: {
          'Cookie': `.ROBLOSECURITY=${cookie}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      return {
        success: true,
        userId: userId,
        groupId: groupId
      };
    } catch (error) {
      console.error('Error exiling user:', error);
      throw new Error(`Failed to exile user: ${error.response?.data?.errors?.[0]?.message || error.message}`);
    }
  }
}

module.exports = new RobloxService();
