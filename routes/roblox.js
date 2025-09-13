const express = require('express');
const router = express.Router();
const robloxService = require('../services/robloxService');
const { validateApiKey } = require('../middleware/auth');

// Roblox group membership endpoint
router.get('/:robloxuserid/:groupid', validateApiKey, async (req, res) => {
  try {
    const { robloxuserid, groupid } = req.params;
    
    // Validate parameters
    if (!robloxuserid || !groupid) {
      return res.status(400).json({
        error: 'Missing required parameters: robloxuserid and groupid'
      });
    }

    // Validate that parameters are numbers
    const userId = parseInt(robloxuserid);
    const groupId = parseInt(groupid);
    
    if (isNaN(userId) || isNaN(groupId)) {
      return res.status(400).json({
        error: 'Invalid parameters: robloxuserid and groupid must be numbers'
      });
    }

    // Get group membership data using public API
    const membershipData = await robloxService.getGroupMembership(userId, groupId);
    
    // Prepare response
    const response = {
      apiKey: req.apiKeyStatus,
      membership: membershipData.membership
    };

    // Add additional data if user is in group
    if (membershipData.membership === 'In group') {
      response.rankName = membershipData.rankName;
      response.rankID = membershipData.rankID;
      response.groupName = membershipData.groupName;
      response.groupID = membershipData.groupID;
    }

    res.json(response);
  } catch (error) {
    console.error('Roblox endpoint error:', error);
    res.status(500).json({
      error: 'Internal server error while fetching group membership'
    });
  }
});

// User Profile APIs
router.get('/user/:userid/profile', validateApiKey, async (req, res) => {
  try {
    const userId = parseInt(req.params.userid);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const profile = await robloxService.getUserProfile(userId);
    res.json({
      apiKey: req.apiKeyStatus,
      profile: profile
    });
  } catch (error) {
    console.error('User profile error:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

router.get('/user/:userid/headshot', validateApiKey, async (req, res) => {
  try {
    const userId = parseInt(req.params.userid);
    const size = req.query.size || '150x150';
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const imageBuffer = await robloxService.getUserHeadshotImage(userId, size);
    
    res.set({
      'Content-Type': 'image/png',
      'Content-Length': imageBuffer.length,
      'Cache-Control': 'public, max-age=3600'
    });
    
    res.send(imageBuffer);
  } catch (error) {
    console.error('User headshot error:', error);
    res.status(500).json({ error: 'Failed to fetch user headshot' });
  }
});

router.get('/user/:userid/badges', validateApiKey, async (req, res) => {
  try {
    const userId = parseInt(req.params.userid);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const badges = await robloxService.getUserBadges(userId);
    res.json({
      apiKey: req.apiKeyStatus,
      badges: badges
    });
  } catch (error) {
    console.error('User badges error:', error);
    res.status(500).json({ error: 'Failed to fetch user badges' });
  }
});

router.get('/user/:userid/status', validateApiKey, async (req, res) => {
  try {
    const userId = parseInt(req.params.userid);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const status = await robloxService.getUserStatus(userId);
    res.json({
      apiKey: req.apiKeyStatus,
      status: status
    });
  } catch (error) {
    console.error('User status error:', error);
    res.status(500).json({ error: 'Failed to fetch user status' });
  }
});

// Game APIs
router.get('/user/:userid/games', validateApiKey, async (req, res) => {
  try {
    const userId = parseInt(req.params.userid);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const games = await robloxService.getUserGames(userId);
    res.json({
      apiKey: req.apiKeyStatus,
      games: games
    });
  } catch (error) {
    console.error('User games error:', error);
    res.status(500).json({ error: 'Failed to fetch user games' });
  }
});

router.get('/user/:userid/favorites', validateApiKey, async (req, res) => {
  try {
    const userId = parseInt(req.params.userid);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const favorites = await robloxService.getUserFavoriteGames(userId);
    res.json({
      apiKey: req.apiKeyStatus,
      favorites: favorites
    });
  } catch (error) {
    console.error('User favorites error:', error);
    res.status(500).json({ error: 'Failed to fetch user favorites' });
  }
});

router.get('/game/:gameid/info', validateApiKey, async (req, res) => {
  try {
    const gameId = parseInt(req.params.gameid);
    if (isNaN(gameId)) {
      return res.status(400).json({ error: 'Invalid game ID' });
    }

    const gameInfo = await robloxService.getGameInfo(gameId);
    res.json({
      apiKey: req.apiKeyStatus,
      game: gameInfo
    });
  } catch (error) {
    console.error('Game info error:', error);
    res.status(500).json({ error: 'Failed to fetch game info' });
  }
});

// Group Extended APIs
router.get('/group/:groupid/info', validateApiKey, async (req, res) => {
  try {
    const groupId = parseInt(req.params.groupid);
    if (isNaN(groupId)) {
      return res.status(400).json({ error: 'Invalid group ID' });
    }

    const groupInfo = await robloxService.getGroupInfo(groupId);
    res.json({
      apiKey: req.apiKeyStatus,
      group: groupInfo
    });
  } catch (error) {
    console.error('Group info error:', error);
    res.status(500).json({ error: 'Failed to fetch group info' });
  }
});

router.get('/group/:groupid/roles', validateApiKey, async (req, res) => {
  try {
    const groupId = parseInt(req.params.groupid);
    if (isNaN(groupId)) {
      return res.status(400).json({ error: 'Invalid group ID' });
    }

    const roles = await robloxService.getGroupRoles(groupId);
    res.json({
      apiKey: req.apiKeyStatus,
      roles: roles
    });
  } catch (error) {
    console.error('Group roles error:', error);
    res.status(500).json({ error: 'Failed to fetch group roles' });
  }
});

router.get('/group/:groupid/wall', validateApiKey, async (req, res) => {
  try {
    const groupId = parseInt(req.params.groupid);
    if (isNaN(groupId)) {
      return res.status(400).json({ error: 'Invalid group ID' });
    }

    const wall = await robloxService.getGroupWall(groupId);
    res.json({
      apiKey: req.apiKeyStatus,
      wall: wall
    });
  } catch (error) {
    console.error('Group wall error:', error);
    res.status(500).json({ error: 'Failed to fetch group wall' });
  }
});

router.get('/group/:groupid/allies', validateApiKey, async (req, res) => {
  try {
    const groupId = parseInt(req.params.groupid);
    if (isNaN(groupId)) {
      return res.status(400).json({ error: 'Invalid group ID' });
    }

    const allies = await robloxService.getGroupAllies(groupId);
    res.json({
      apiKey: req.apiKeyStatus,
      allies: allies
    });
  } catch (error) {
    console.error('Group allies error:', error);
    res.status(500).json({ error: 'Failed to fetch group allies' });
  }
});

// Social APIs
router.get('/user/:userid/friends', validateApiKey, async (req, res) => {
  try {
    const userId = parseInt(req.params.userid);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const friends = await robloxService.getUserFriends(userId);
    res.json({
      apiKey: req.apiKeyStatus,
      friends: friends
    });
  } catch (error) {
    console.error('User friends error:', error);
    res.status(500).json({ error: 'Failed to fetch user friends' });
  }
});

router.get('/user/:userid/followers', validateApiKey, async (req, res) => {
  try {
    const userId = parseInt(req.params.userid);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const followers = await robloxService.getUserFollowers(userId);
    res.json({
      apiKey: req.apiKeyStatus,
      followers: followers
    });
  } catch (error) {
    console.error('User followers error:', error);
    res.status(500).json({ error: 'Failed to fetch user followers' });
  }
});

router.get('/user/:userid/following', validateApiKey, async (req, res) => {
  try {
    const userId = parseInt(req.params.userid);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const following = await robloxService.getUserFollowing(userId);
    res.json({
      apiKey: req.apiKeyStatus,
      following: following
    });
  } catch (error) {
    console.error('User following error:', error);
    res.status(500).json({ error: 'Failed to fetch user following' });
  }
});

// Presence APIs
router.get('/user/:userid/presence', validateApiKey, async (req, res) => {
  try {
    const userId = parseInt(req.params.userid);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const presence = await robloxService.getUserPresence(userId);
    res.json({
      apiKey: req.apiKeyStatus,
      presence: presence
    });
  } catch (error) {
    console.error('User presence error:', error);
    res.status(500).json({ error: 'Failed to fetch user presence' });
  }
});

// Asset APIs
router.get('/asset/:assetid', validateApiKey, async (req, res) => {
  try {
    const assetId = parseInt(req.params.assetid);
    if (isNaN(assetId)) {
      return res.status(400).json({ error: 'Invalid asset ID' });
    }

    const asset = await robloxService.getAssetInfo(assetId);
    res.json({
      apiKey: req.apiKeyStatus,
      asset: asset
    });
  } catch (error) {
    console.error('Asset info error:', error);
    res.status(500).json({ error: 'Failed to fetch asset info' });
  }
});

router.get('/user/:userid/inventory/:assettype?', validateApiKey, async (req, res) => {
  try {
    const userId = parseInt(req.params.userid);
    const assetType = req.params.assettype || 'Hat';
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const inventory = await robloxService.getUserInventory(userId, assetType);
    res.json({
      apiKey: req.apiKeyStatus,
      inventory: inventory
    });
  } catch (error) {
    console.error('User inventory error:', error);
    res.status(500).json({ error: 'Failed to fetch user inventory' });
  }
});

router.get('/catalog/search', validateApiKey, async (req, res) => {
  try {
    const keyword = req.query.keyword;
    const category = req.query.category || 'All';
    
    if (!keyword) {
      return res.status(400).json({ error: 'Missing keyword parameter' });
    }

    const results = await robloxService.searchCatalog(keyword, category);
    res.json({
      apiKey: req.apiKeyStatus,
      results: results
    });
  } catch (error) {
    console.error('Catalog search error:', error);
    res.status(500).json({ error: 'Failed to search catalog' });
  }
});

module.exports = router;
