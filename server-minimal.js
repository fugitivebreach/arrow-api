require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Basic middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Arrow API'
  });
});

// Roblox group membership endpoint (without API key validation for now)
app.get('/:robloxUserId/:groupId', async (req, res) => {
  try {
    const { robloxUserId, groupId } = req.params;
    
    // Call Roblox API
    const response = await axios.get(`https://users.roblox.com/v1/users/${robloxUserId}/groups/roles`);
    const groups = response.data.data;
    
    // Check if user is in the specified group
    const groupMembership = groups.find(group => group.group.id.toString() === groupId);
    
    if (groupMembership) {
      res.json({
        success: true,
        inGroup: true,
        groupName: groupMembership.group.name,
        role: groupMembership.role.name,
        rank: groupMembership.role.rank
      });
    } else {
      res.json({
        success: true,
        inGroup: false,
        message: 'User is not in the specified group'
      });
    }
  } catch (error) {
    console.error('Error checking group membership:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to check group membership'
    });
  }
});

// Basic info endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Arrow API',
    version: '1.0.0',
    description: 'Roblox Group Membership API',
    endpoints: {
      health: 'GET /health',
      groupCheck: 'GET /:robloxUserId/:groupId'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET /health - Health check',
      'GET /:robloxUserId/:groupId - Check group membership'
    ]
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Arrow API server running on port ${PORT}`);
  console.log(`Health check: http://0.0.0.0:${PORT}/health`);
});
