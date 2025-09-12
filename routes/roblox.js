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

module.exports = router;
