const express = require('express');
const router = express.Router();

// API documentation data structure
const apiCategories = {
    'user-profile': {
        title: 'User Profile APIs',
        description: 'Get detailed information about Roblox users including profile data, headshots, badges, and status messages.',
        endpoints: [
            {
                method: 'GET',
                path: '/user/{userid}/profile',
                name: 'Get User Profile',
                description: 'Get comprehensive user profile information including username, display name, description, and join date.',
                params: [
                    { name: 'userid', type: 'integer', description: 'The Roblox user ID' }
                ],
                response: {
                    "apiKey": "API Key is valid and exists",
                    "profile": {
                        "description": "Welcome to my profile!",
                        "created": "2006-02-27T21:06:40.3Z",
                        "isBanned": false,
                        "externalAppDisplayName": null,
                        "hasVerifiedBadge": false,
                        "id": 1,
                        "name": "Roblox",
                        "displayName": "Roblox"
                    }
                }
            },
            {
                method: 'GET',
                path: '/user/{userid}/headshot',
                name: 'Get User Headshot',
                description: 'Returns PNG image data directly! Get user\'s Roblox headshot/avatar image.',
                params: [
                    { name: 'userid', type: 'integer', description: 'The Roblox user ID' }
                ],
                queryParams: [
                    { name: 'size', type: 'string', default: '150x150', description: 'Image size (150x150, 420x420, etc.)' }
                ],
                note: 'This endpoint returns raw PNG image data with Content-Type: image/png headers. Perfect for direct use in HTML <img> tags or saving to files.'
            },
            {
                method: 'GET',
                path: '/user/{userid}/badges',
                name: 'Get User Badges',
                description: 'Get user\'s Roblox badges collection.',
                params: [
                    { name: 'userid', type: 'integer', description: 'The Roblox user ID' }
                ]
            },
            {
                method: 'GET',
                path: '/user/{userid}/status',
                name: 'Get User Status',
                description: 'Get user\'s current status message.',
                params: [
                    { name: 'userid', type: 'integer', description: 'The Roblox user ID' }
                ]
            }
        ]
    },
    'user-games': {
        title: 'User Games APIs',
        description: 'Access user-created games, favorite games, and detailed game information.',
        endpoints: [
            {
                method: 'GET',
                path: '/user/{userid}/games',
                name: 'Get User Games',
                description: 'Get games created by the user.',
                params: [
                    { name: 'userid', type: 'integer', description: 'The Roblox user ID' }
                ]
            },
            {
                method: 'GET',
                path: '/user/{userid}/favorites',
                name: 'Get User Favorites',
                description: 'Get user\'s favorite games.',
                params: [
                    { name: 'userid', type: 'integer', description: 'The Roblox user ID' }
                ]
            },
            {
                method: 'GET',
                path: '/game/{gameid}/info',
                name: 'Get Game Info',
                description: 'Get detailed information about a specific game.',
                params: [
                    { name: 'gameid', type: 'integer', description: 'The Roblox game/universe ID' }
                ]
            }
        ]
    },
    'group-membership': {
        title: 'Group Membership APIs',
        description: 'Check user membership status in Roblox groups.',
        endpoints: [
            {
                method: 'GET',
                path: '/{userid}/{groupid}',
                name: 'Check Group Membership',
                description: 'Check if a user is a member of a specific group.',
                params: [
                    { name: 'userid', type: 'integer', description: 'The Roblox user ID' },
                    { name: 'groupid', type: 'integer', description: 'The Roblox group ID' }
                ]
            }
        ]
    },
    'group-extended': {
        title: 'Group Extended APIs',
        description: 'Get detailed group information, roles, wall posts, and allies.',
        endpoints: [
            {
                method: 'GET',
                path: '/group/{groupid}/info',
                name: 'Get Group Info',
                description: 'Get detailed information about a group.',
                params: [
                    { name: 'groupid', type: 'integer', description: 'The Roblox group ID' }
                ]
            },
            {
                method: 'GET',
                path: '/group/{groupid}/roles',
                name: 'Get Group Roles',
                description: 'Get all roles in a group.',
                params: [
                    { name: 'groupid', type: 'integer', description: 'The Roblox group ID' }
                ]
            },
            {
                method: 'GET',
                path: '/group/{groupid}/wall',
                name: 'Get Group Wall',
                description: 'Get group wall posts.',
                params: [
                    { name: 'groupid', type: 'integer', description: 'The Roblox group ID' }
                ]
            },
            {
                method: 'GET',
                path: '/group/{groupid}/allies',
                name: 'Get Group Allies',
                description: 'Get group allies.',
                params: [
                    { name: 'groupid', type: 'integer', description: 'The Roblox group ID' }
                ]
            }
        ]
    },
    'social-friends': {
        title: 'Friends APIs',
        description: 'Access user friends and social connections.',
        endpoints: [
            {
                method: 'GET',
                path: '/user/{userid}/friends',
                name: 'Get User Friends',
                description: 'Get user\'s friends list.',
                params: [
                    { name: 'userid', type: 'integer', description: 'The Roblox user ID' }
                ]
            }
        ]
    },
    'social-followers': {
        title: 'Followers APIs',
        description: 'Access user followers and following information.',
        endpoints: [
            {
                method: 'GET',
                path: '/user/{userid}/followers',
                name: 'Get User Followers',
                description: 'Get user\'s followers list.',
                params: [
                    { name: 'userid', type: 'integer', description: 'The Roblox user ID' }
                ]
            },
            {
                method: 'GET',
                path: '/user/{userid}/following',
                name: 'Get User Following',
                description: 'Get list of users this user is following.',
                params: [
                    { name: 'userid', type: 'integer', description: 'The Roblox user ID' }
                ]
            }
        ]
    },
    'social-presence': {
        title: 'Presence APIs',
        description: 'Get real-time user presence and activity information.',
        endpoints: [
            {
                method: 'GET',
                path: '/user/{userid}/presence',
                name: 'Get User Presence',
                description: 'Get user\'s current online status and activity.',
                params: [
                    { name: 'userid', type: 'integer', description: 'The Roblox user ID' }
                ]
            }
        ]
    },
    'assets': {
        title: 'Asset & Catalog APIs',
        description: 'Access asset details, user inventory, and catalog search functionality.',
        endpoints: [
            {
                method: 'GET',
                path: '/asset/{assetid}',
                name: 'Get Asset Info',
                description: 'Get detailed information about a specific asset.',
                params: [
                    { name: 'assetid', type: 'integer', description: 'The Roblox asset ID' }
                ]
            },
            {
                method: 'GET',
                path: '/user/{userid}/inventory/{assettype}',
                name: 'Get User Inventory',
                description: 'Get user\'s inventory by asset type.',
                params: [
                    { name: 'userid', type: 'integer', description: 'The Roblox user ID' },
                    { name: 'assettype', type: 'string', description: 'Asset type (e.g., "Hat", "Shirt", "Pants"). Optional - defaults to "Hat"' }
                ]
            },
            {
                method: 'GET',
                path: '/catalog/search',
                name: 'Search Catalog',
                description: 'Search the Roblox catalog.',
                queryParams: [
                    { name: 'keyword', type: 'string', description: 'Search keyword' },
                    { name: 'category', type: 'string', description: 'Asset category' }
                ]
            }
        ]
    }
};

// Main docs page
router.get('/', (req, res) => {
    res.render('docs', { 
        user: req.user,
        title: 'Arrow API Documentation'
    });
});

// Dynamic API category pages
router.get('/roblox/:category', (req, res) => {
    const category = req.params.category;
    const categoryData = apiCategories[category];
    
    if (!categoryData) {
        return res.status(404).render('404', { 
            user: req.user,
            title: '404 - Page Not Found'
        });
    }
    
    res.render('docs-category', { 
        user: req.user,
        title: `${categoryData.title} - Arrow API`,
        category: categoryData,
        categoryKey: category
    });
});

// Social API subcategories
router.get('/roblox/social/:subcategory', (req, res) => {
    const subcategory = `social-${req.params.subcategory}`;
    const categoryData = apiCategories[subcategory];
    
    if (!categoryData) {
        return res.status(404).render('404', { 
            user: req.user,
            title: '404 - Page Not Found'
        });
    }
    
    res.render('docs-category', { 
        user: req.user,
        title: `${categoryData.title} - Arrow API`,
        category: categoryData,
        categoryKey: subcategory
    });
});

// Other documentation pages
router.get('/examples', (req, res) => {
    res.render('docs-examples', { 
        user: req.user,
        title: 'Code Examples - Arrow API'
    });
});

router.get('/responses', (req, res) => {
    res.render('docs-responses', { 
        user: req.user,
        title: 'Response Format - Arrow API'
    });
});

router.get('/rate-limits', (req, res) => {
    res.render('docs-rate-limits', { 
        user: req.user,
        title: 'Rate Limits - Arrow API'
    });
});

module.exports = router;
