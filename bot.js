const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder } = require('discord.js');
const { getDB } = require('./config/database');
const VerificationCode = require('./models/VerificationCode');
const User = require('./models/User');
const axios = require('axios');
const crypto = require('crypto');

// Configuration - Add these to your .env file
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID; // Optional: for guild-specific commands

// Authorized role IDs and user IDs - Add these to your .env file as comma-separated values
const AUTHORIZED_ROLE_IDS = process.env.AUTHORIZED_ROLE_IDS ? process.env.AUTHORIZED_ROLE_IDS.split(',') : [];
const AUTHORIZED_USER_IDS = process.env.AUTHORIZED_USER_IDS ? process.env.AUTHORIZED_USER_IDS.split(',') : [];

// Verification system configuration
const VERIFICATION_CHANNEL_ID = process.env.VERIFICATION_CHANNEL_ID;
const ROLES = process.env.ROLES ? process.env.ROLES.split(',') : [];
const ERROR_LOG_CHANNEL_ID = process.env.ERROR_LOG_CHANNEL_ID;

// Roblox cookies for bot operations
const ROBLOX_COOKIES = process.env.COOKIES ? JSON.parse(process.env.COOKIES) : [];

// Server verification storage (in-memory fallback)
const serverVerifications = new Map(); // guildId -> { userId, robloxUserId, robloxUsername }
const serverSetups = new Map(); // guildId -> { groupId, botUserId, botUsername }

// Database functions for server verifications
async function saveServerVerification(guildId, verificationData) {
    try {
        const db = getDB();
        if (!db) {
            // Fallback to in-memory storage
            serverVerifications.set(guildId, verificationData);
            return;
        }
        
        await db.collection('serverVerifications').updateOne(
            { guildId: guildId },
            { 
                $set: {
                    ...verificationData,
                    guildId: guildId,
                    updatedAt: new Date()
                }
            },
            { upsert: true }
        );
    } catch (error) {
        console.error('Error saving server verification:', error);
        // Fallback to in-memory storage
        serverVerifications.set(guildId, verificationData);
    }
}

async function getServerVerification(guildId) {
    try {
        const db = getDB();
        if (!db) {
            // Fallback to in-memory storage
            return serverVerifications.get(guildId);
        }
        
        const verification = await db.collection('serverVerifications').findOne({ guildId: guildId });
        return verification || null;
    } catch (error) {
        console.error('Error getting server verification:', error);
        // Fallback to in-memory storage
        return serverVerifications.get(guildId);
    }
}

async function saveServerSetup(guildId, setupData) {
    try {
        const db = getDB();
        if (!db) {
            // Fallback to in-memory storage
            serverSetups.set(guildId, setupData);
            return;
        }
        
        await db.collection('serverSetups').updateOne(
            { guildId: guildId },
            { 
                $set: {
                    ...setupData,
                    guildId: guildId,
                    updatedAt: new Date()
                }
            },
            { upsert: true }
        );
    } catch (error) {
        console.error('Error saving server setup:', error);
        // Fallback to in-memory storage
        serverSetups.set(guildId, setupData);
    }
}

async function getServerSetup(guildId) {
    try {
        const db = getDB();
        if (!db) {
            // Fallback to in-memory storage
            return serverSetups.get(guildId);
        }
        
        const setup = await db.collection('serverSetups').findOne({ guildId: guildId });
        return setup || null;
    } catch (error) {
        console.error('Error getting server setup:', error);
        // Fallback to in-memory storage
        return serverSetups.get(guildId);
    }
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

// Commands
const commands = [
    new SlashCommandBuilder()
        .setName('blacklist')
        .setDescription('Manage user blacklist for Arrow API')
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Blacklist a user from using Arrow API')
                .addStringOption(option =>
                    option
                        .setName('user_id')
                        .setDescription('The Discord user ID you wish to blacklist')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a user from the blacklist')
                .addStringOption(option =>
                    option
                        .setName('user_id')
                        .setDescription('The Discord user ID you wish to remove from blacklist')
                        .setRequired(true)
                )
        ),
    new SlashCommandBuilder()
        .setName('panel')
        .setDescription('Send verification panel to link Discord accounts'),
    new SlashCommandBuilder()
        .setName('api')
        .setDescription('Manage API keys')
        .addSubcommand(subcommand =>
            subcommand
                .setName('key_generate')
                .setDescription('Generate a new API key')
                .addStringOption(option =>
                    option
                        .setName('name')
                        .setDescription('Name for your API key')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('key_delete')
                .setDescription('Delete an existing API key')
        ),
    new SlashCommandBuilder()
        .setName('verify')
        .setDescription('Verify your Roblox account (Server Owner Only)'),
    new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Set up ArrowAPI bot for your server (Verified Server Owner Only)')
        .addIntegerOption(option =>
            option
                .setName('group_id')
                .setDescription('The group ID you wish to set up')
                .setRequired(true)
        ),
].map(command => command.toJSON());

// Register commands
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const rest = new REST({ version: '10' }).setToken(DISCORD_BOT_TOKEN);

async function registerCommands() {
    try {
        console.log('Started refreshing application (/) commands.');

        if (GUILD_ID) {
            // Guild-specific commands (faster deployment)
            await rest.put(
                Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
                { body: commands },
            );
        } else {
            // Global commands (takes up to 1 hour to deploy)
            await rest.put(
                Routes.applicationCommands(CLIENT_ID),
                { body: commands },
            );
        }

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
}

// Check if user is authorized
function isAuthorized(interaction) {
    const userId = interaction.user.id;
    const member = interaction.member;
    
    // Check if user ID is in authorized list
    if (AUTHORIZED_USER_IDS.includes(userId)) {
        return true;
    }
    
    // Check if user has any authorized roles
    if (member && member.roles && member.roles.cache) {
        const hasAuthorizedRole = member.roles.cache.some(role => 
            AUTHORIZED_ROLE_IDS.includes(role.id)
        );
        if (hasAuthorizedRole) {
            return true;
        }
    }
    
    return false;
}

// Generate unique error ID
function generateErrorId() {
    const segments = [];
    for (let i = 0; i < 5; i++) {
        const length = i === 4 ? 10 : (Math.random() < 0.5 ? 6 : 7);
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let segment = '';
        for (let j = 0; j < length; j++) {
            segment += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        segments.push(segment);
    }
    return segments.join('-');
}

// Log error to channel
async function logError(errorId, error, command, userId) {
    if (!ERROR_LOG_CHANNEL_ID) return;
    
    try {
        const channel = await client.channels.fetch(ERROR_LOG_CHANNEL_ID);
        if (channel && channel.isTextBased()) {
            const embed = new EmbedBuilder()
                .setTitle('Bot Error Logged')
                .setDescription(`**Error ID:** ${errorId}\n**Command:** ${command}\n**User:** <@${userId}>\n**Error:** \`\`\`${error.message || error}\`\`\``)
                .setColor('#FF0000')
                .setTimestamp();
            
            await channel.send({ embeds: [embed] });
        }
    } catch (logError) {
        console.error('Failed to log error to channel:', logError);
    }
}

// Get user's API keys from database
async function getUserApiKeys(userId) {
    try {
        const db = getDB();
        if (!db) {
            return [];
        }
        
        const user = await db.collection('users').findOne({ discordId: userId });
        
        if (!user || !user.apiKeys) {
            return [];
        }
        
        return user.apiKeys.filter(key => key.isActive).map(key => ({ name: key.name || 'Unnamed Key', id: key._id.toString() }));
    } catch (error) {
        console.error('Error fetching user API keys:', error);
        return [];
    }
}

// Generate API key for user
async function generateApiKey(userId, keyName) {
    try {
        const db = getDB();
        if (!db) {
            return { success: false, error: 'DATABASE_ERROR' };
        }
        
        let user = await db.collection('users').findOne({ discordId: userId });
        if (!user) {
            return { success: false, error: 'USER_NOT_FOUND' };
        }
        
        const userObj = new User(user);
        const apiKey = userObj.generateApiKey(keyName);
        await userObj.save();
        
        return { success: true, apiKey };
    } catch (error) {
        console.error('Error generating API key:', error);
        return { success: false, error: 'DATABASE_ERROR' };
    }
}

// Delete API key for user
async function deleteApiKey(userId, keyId) {
    try {
        const db = getDB();
        if (!db) {
            return { success: false, error: 'DATABASE_ERROR' };
        }
        
        let user = await db.collection('users').findOne({ discordId: userId });
        if (!user) {
            return { success: false, error: 'USER_NOT_FOUND' };
        }
        
        const keyToDelete = user.apiKeys.find(key => key._id.toString() === keyId);
        if (!keyToDelete) {
            return { success: false, error: 'KEY_NOT_FOUND' };
        }
        
        const keyName = keyToDelete.name || 'Unnamed Key';
        
        const userObj = new User(user);
        userObj.removeApiKey(keyId);
        await userObj.save();
        
        return { success: true, keyName };
    } catch (error) {
        console.error('Error deleting API key:', error);
        return { success: false, error: 'DATABASE_ERROR' };
    }
}

// Check if user is server owner
function isServerOwner(interaction) {
    return interaction.guild && interaction.guild.ownerId === interaction.user.id;
}

// Get Roblox user info from username
async function getRobloxUserFromUsername(username) {
    try {
        const response = await axios.post('https://users.roblox.com/v1/usernames/users', {
            usernames: [username]
        }, {
            timeout: 10000
        });
        
        if (response.data && response.data.data && response.data.data.length > 0) {
            return response.data.data[0];
        }
        return null;
    } catch (error) {
        console.error('Error fetching Roblox user:', error);
        return null;
    }
}

// Generate random verification text with fruits and vegetables
function generateVerificationText() {
    const fruits = ['apple', 'banana', 'orange', 'grape', 'strawberry', 'blueberry', 'watermelon', 'pineapple', 'mango', 'kiwi', 'peach', 'plum', 'cherry', 'lemon', 'lime'];
    const vegetables = ['carrot', 'broccoli', 'spinach', 'tomato', 'cucumber', 'pepper', 'onion', 'garlic', 'potato', 'zucchini', 'lettuce', 'cabbage', 'celery', 'radish', 'beet'];
    
    const allItems = [...fruits, ...vegetables];
    const selectedItems = [];
    
    // Select 3 random items
    for (let i = 0; i < 3; i++) {
        const randomIndex = Math.floor(Math.random() * allItems.length);
        selectedItems.push(allItems[randomIndex]);
        allItems.splice(randomIndex, 1); // Remove to avoid duplicates
    }
    
    return selectedItems.join(' ');
}

// Get Roblox user description
async function getRobloxUserDescription(userId) {
    try {
        const response = await axios.get(`https://users.roblox.com/v1/users/${userId}`, {
            timeout: 10000
        });
        return response.data.description || '';
    } catch (error) {
        console.error('Error fetching Roblox user description:', error);
        return null;
    }
}

// Find available cookie for group operations
async function findAvailableCookie() {
    for (const cookie of ROBLOX_COOKIES) {
        try {
            // First get the current user's ID from the cookie
            const userResponse = await axios.get('https://users.roblox.com/v1/users/authenticated', {
                headers: {
                    'Cookie': `.ROBLOSECURITY=${cookie}`
                },
                timeout: 10000
            });
            
            if (!userResponse.data || !userResponse.data.id) {
                console.log('Invalid cookie, skipping...');
                continue;
            }
            
            const userId = userResponse.data.id;
            
            // Check how many groups this cookie's account is in
            const response = await axios.get(`https://groups.roblox.com/v1/users/${userId}/groups/roles`, {
                headers: {
                    'Cookie': `.ROBLOSECURITY=${cookie}`
                },
                timeout: 10000
            });
            
            if (response.data && response.data.data && response.data.data.length < 100) {
                return cookie;
            }
        } catch (error) {
            console.error('Error checking cookie:', error);
            continue;
        }
    }
    return null;
}

// Get current user info from cookie
async function getCurrentUserFromCookie(cookie) {
    try {
        const response = await axios.get('https://users.roblox.com/v1/users/authenticated', {
            headers: {
                'Cookie': `.ROBLOSECURITY=${cookie}`
            },
            timeout: 10000
        });
        return response.data;
    } catch (error) {
        console.error('Error getting current user from cookie:', error);
        return null;
    }
}

// Join group with cookie
async function joinGroupWithCookie(groupId, cookie) {
    try {
        // First get group info
        const groupResponse = await axios.get(`https://groups.roblox.com/v1/groups/${groupId}`, {
            timeout: 10000
        });
        
        if (!groupResponse.data) {
            return { success: false, error: 'Group not found' };
        }
        
        // Check if group is public (can be joined)
        if (!groupResponse.data.publicEntryAllowed) {
            return { 
                success: false, 
                error: `The group "${groupResponse.data.name}" is private and requires approval to join. Please make the group public or manually add the bot account.`,
                groupName: groupResponse.data.name
            };
        }
        
        // Get current user info to check if already in group
        const userResponse = await axios.get('https://users.roblox.com/v1/users/authenticated', {
            headers: {
                'Cookie': `.ROBLOSECURITY=${cookie}`
            },
            timeout: 10000
        });
        
        if (!userResponse.data || !userResponse.data.id) {
            return { success: false, error: 'Invalid bot account cookie' };
        }
        
        const botUserId = userResponse.data.id;
        
        // Check if bot is already in the group
        try {
            const membershipResponse = await axios.get(`https://groups.roblox.com/v1/users/${botUserId}/groups/roles`, {
                headers: {
                    'Cookie': `.ROBLOSECURITY=${cookie}`
                },
                timeout: 10000
            });
            
            if (membershipResponse.data && membershipResponse.data.data) {
                const isAlreadyMember = membershipResponse.data.data.some(group => group.group.id === groupId);
                if (isAlreadyMember) {
                    return { 
                        success: true, 
                        groupName: groupResponse.data.name,
                        alreadyMember: true
                    };
                }
            }
        } catch (membershipError) {
            console.log('Could not check membership status, proceeding with join attempt');
        }
        
        // Get CSRF token first
        let csrfToken = null;
        try {
            await axios.post(`https://groups.roblox.com/v1/groups/${groupId}/users`, {}, {
                headers: {
                    'Cookie': `.ROBLOSECURITY=${cookie}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });
        } catch (csrfError) {
            if (csrfError.response && csrfError.response.status === 403 && csrfError.response.headers['x-csrf-token']) {
                csrfToken = csrfError.response.headers['x-csrf-token'];
            } else {
                // If it's not a CSRF error, check if it's already a member or other specific error
                if (csrfError.response && csrfError.response.data && csrfError.response.data.errors) {
                    const error = csrfError.response.data.errors[0];
                    if (error.code === 2) { // Already in group
                        return { success: true, groupName: groupResponse.data.name, alreadyMember: true };
                    }
                }
                throw csrfError;
            }
        }
        
        // Join the group with CSRF token
        const joinResponse = await axios.post(`https://groups.roblox.com/v1/groups/${groupId}/users`, {}, {
            headers: {
                'Cookie': `.ROBLOSECURITY=${cookie}`,
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': csrfToken
            },
            timeout: 10000
        });
        
        return { success: true, groupName: groupResponse.data.name };
    } catch (error) {
        console.error('Error joining group:', error);
        console.error('Response data:', error.response?.data);
        console.error('Response status:', error.response?.status);
        
        if (error.response) {
            const status = error.response.status;
            const data = error.response.data;
            
            switch (status) {
                case 400:
                    return { success: false, error: 'Invalid group ID or request format' };
                case 401:
                    return { success: false, error: 'Bot account authentication failed - invalid cookie' };
                case 403:
                    if (data && data.errors && data.errors[0]) {
                        const errorCode = data.errors[0].code;
                        switch (errorCode) {
                            case 0: // Challenge required
                                return { 
                                    success: false, 
                                    error: 'Roblox security challenge required. Please manually add the bot account to your group.',
                                    requiresManualJoin: true
                                };
                            case 1: // InsufficientPermissions
                                return { success: false, error: 'Bot account does not have permission to join this group' };
                            case 2: // AlreadyInGroup
                                return { success: true, groupName: 'Unknown Group', alreadyMember: true };
                            case 3: // GroupFull
                                return { success: false, error: 'The group is full and cannot accept new members' };
                            case 18: // GroupJoinRequiresApproval
                                return { success: false, error: 'This group requires approval to join. Please manually add the bot account or make the group public.' };
                            default:
                                const message = data.errors[0].message || 'Unknown reason';
                                if (message.toLowerCase().includes('challenge')) {
                                    return { 
                                        success: false, 
                                        error: 'Roblox security challenge required. Please manually add the bot account to your group.',
                                        requiresManualJoin: true
                                    };
                                }
                                return { success: false, error: `Group join denied: ${message}` };
                        }
                    }
                    return { success: false, error: 'Access denied - group may be private or require approval' };
                case 404:
                    return { success: false, error: 'Group not found' };
                case 429:
                    return { success: false, error: 'Rate limited - please try again later' };
                default:
                    return { success: false, error: `HTTP ${status}: ${data?.errors?.[0]?.message || 'Unknown error'}` };
            }
        }
        
        return { success: false, error: error.message || 'Unknown error occurred' };
    }
}

// Blacklist user
async function blacklistUser(userId) {
    try {
        const db = getDB();
        if (!db) {
            return { success: false, error: 'DATABASE_ERROR' };
        }
        
        // Check if user exists in database
        const user = await db.collection('users').findOne({ discordId: userId });
        if (!user) {
            return { success: false, error: 'USER_NOT_FOUND' };
        }
        
        // Check if already blacklisted
        if (user.isBlacklisted) {
            return { success: false, error: 'ALREADY_BLACKLISTED' };
        }
        
        // Get active API keys before blacklisting
        const activeApiKeys = user.apiKeys ? user.apiKeys.filter(key => key.isActive).map(key => key.name || 'Unnamed Key') : [];
        
        // Blacklist user and disable all API keys
        await db.collection('users').updateOne(
            { discordId: userId },
            { 
                $set: { 
                    isBlacklisted: true,
                    blacklistedAt: new Date()
                },
                $unset: {
                    'apiKeys.$[].isActive': ''
                }
            }
        );
        
        // Set all API keys to inactive
        await db.collection('users').updateOne(
            { discordId: userId },
            { 
                $set: { 
                    'apiKeys.$[].isActive': false
                }
            }
        );
        
        return { success: true, disabledKeys: activeApiKeys };
    } catch (error) {
        console.error('Error blacklisting user:', error);
        return { success: false, error: 'DATABASE_ERROR' };
    }
}

// Remove user from blacklist
async function removeFromBlacklist(userId) {
    try {
        const db = getDB();
        if (!db) {
            return { success: false, error: 'DATABASE_ERROR' };
        }
        
        // Check if user exists in database
        const user = await db.collection('users').findOne({ discordId: userId });
        if (!user) {
            return { success: false, error: 'USER_NOT_FOUND' };
        }
        
        // Check if user is blacklisted
        if (!user.isBlacklisted) {
            return { success: false, error: 'NOT_BLACKLISTED' };
        }
        
        // Remove from blacklist
        await db.collection('users').updateOne(
            { discordId: userId },
            { 
                $unset: { 
                    isBlacklisted: '',
                    blacklistedAt: ''
                }
            }
        );
        
        return { success: true };
    } catch (error) {
        console.error('Error removing user from blacklist:', error);
        return { success: false, error: 'DATABASE_ERROR' };
    }
}

// Bot ready event
client.once('clientReady', async () => {
    console.log(`Discord bot logged in as ${client.user.tag}!`);
    await registerCommands();
    
    // Auto-send verification panel to configured channel
    if (VERIFICATION_CHANNEL_ID && VERIFICATION_CHANNEL_ID !== 'your_verification_channel_id_here') {
        try {
            const channel = await client.channels.fetch(VERIFICATION_CHANNEL_ID);
            if (channel && channel.isTextBased()) {
                // Purge messages in the channel
                try {
                    const messages = await channel.messages.fetch({ limit: 100 });
                    await channel.bulkDelete(messages.filter(msg => !msg.pinned && (Date.now() - msg.createdTimestamp) < 1209600000)); // 14 days limit
                    console.log('Verification channel messages purged');
                } catch (purgeError) {
                    console.log('Could not purge messages in verification channel:', purgeError.message);
                }

                // Send verification panel
                const embed = new EmbedBuilder()
                    .setAuthor({ 
                        name: client.user.username, 
                        iconURL: client.user.displayAvatarURL() 
                    })
                    .setTitle('LINK DISCORD ACCOUNT')
                    .setDescription('Use the button below to link your account to receive roles in our server.')
                    .setColor('#FFFFFF');

                const button = new ButtonBuilder()
                    .setCustomId('link_account')
                    .setLabel('Link')
                    .setStyle(ButtonStyle.Secondary);

                const row = new ActionRowBuilder()
                    .addComponents(button);

                await channel.send({ embeds: [embed], components: [row] });
                console.log('Verification panel sent to channel:', VERIFICATION_CHANNEL_ID);
            }
        } catch (error) {
            console.error('Failed to send verification panel to channel:', error.message);
        }
    } else {
        console.log('VERIFICATION_CHANNEL_ID not configured - skipping auto panel send');
    }
});

// Handle slash commands
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;
    
    if (commandName === 'api') {
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'key_generate') {
            const keyName = interaction.options.getString('name');
            
            try {
                const result = await generateApiKey(interaction.user.id, keyName);
                
                if (!result.success) {
                    let description;
                    switch (result.error) {
                        case 'USER_NOT_FOUND':
                            description = 'You need to log in to the ArrowAPI dashboard first to create API keys.';
                            break;
                        default:
                            description = 'An error occurred while generating your API key.';
                    }
                    
                    const embed = new EmbedBuilder()
                        .setAuthor({ 
                            name: interaction.user.username, 
                            iconURL: interaction.user.displayAvatarURL() 
                        })
                        .setDescription(description)
                        .setColor('#FFFFFF');
                    
                    return interaction.reply({ embeds: [embed], ephemeral: true });
                }
                
                const embed = new EmbedBuilder()
                    .setAuthor({ 
                        name: interaction.user.username, 
                        iconURL: interaction.user.displayAvatarURL() 
                    })
                    .setTitle('API Key Generated')
                    .setDescription(`\`\`\`${result.apiKey}\`\`\``)
                    .setColor('#FFFFFF');
                
                return interaction.reply({ embeds: [embed], ephemeral: true });
            } catch (error) {
                console.error('API key generation error:', error);
                
                const embed = new EmbedBuilder()
                    .setAuthor({ 
                        name: interaction.user.username, 
                        iconURL: interaction.user.displayAvatarURL() 
                    })
                    .setDescription('An error occurred while generating your API key.')
                    .setColor('#FFFFFF');
                
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }
        } else if (subcommand === 'key_delete') {
            try {
                const apiKeys = await getUserApiKeys(interaction.user.id);
                
                if (apiKeys.length === 0) {
                    const embed = new EmbedBuilder()
                        .setAuthor({ 
                            name: interaction.user.username, 
                            iconURL: interaction.user.displayAvatarURL() 
                        })
                        .setDescription('You have no API keys to delete.')
                        .setColor('#FFFFFF');
                    
                    return interaction.reply({ embeds: [embed], ephemeral: true });
                }
                
                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('delete_api_key')
                    .setPlaceholder('Select an API key to delete')
                    .addOptions(
                        apiKeys.map(key => ({
                            label: key.name,
                            value: key.id,
                            description: `Delete ${key.name}`
                        }))
                    );
                
                const row = new ActionRowBuilder().addComponents(selectMenu);
                
                const embed = new EmbedBuilder()
                    .setAuthor({ 
                        name: interaction.user.username, 
                        iconURL: interaction.user.displayAvatarURL() 
                    })
                    .setTitle('Delete API Key')
                    .setDescription('Select an API key to delete from the dropdown below.')
                    .setColor('#FFFFFF');
                
                return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
            } catch (error) {
                console.error('API key deletion setup error:', error);
                
                const embed = new EmbedBuilder()
                    .setAuthor({ 
                        name: interaction.user.username, 
                        iconURL: interaction.user.displayAvatarURL() 
                    })
                    .setDescription('An error occurred while loading your API keys.')
                    .setColor('#FFFFFF');
                
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }
        }
    } else if (commandName === 'verify') {
        if (!isServerOwner(interaction)) {
            const embed = new EmbedBuilder()
                .setAuthor({ 
                    name: interaction.user.username, 
                    iconURL: interaction.user.displayAvatarURL() 
                })
                .setTitle('Access Denied')
                .setDescription('This command is only available to server owners.')
                .setColor('#FFFFFF');
            
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        // Generate random verification text
        const verificationText = generateVerificationText();
        
        // Store verification attempt
        const verificationData = {
            userId: interaction.user.id,
            verificationText: verificationText,
            timestamp: Date.now()
        };
        await saveServerVerification(interaction.guild.id, verificationData);
        
        const embed = new EmbedBuilder()
            .setAuthor({ 
                name: interaction.user.username, 
                iconURL: interaction.user.displayAvatarURL() 
            })
            .setTitle('Roblox Account Verification')
            .setDescription(`Please provide your Roblox username first, then you'll be given verification instructions.`)
            .setColor('#FFFFFF');
        
        const modal = new ModalBuilder()
            .setCustomId('roblox_verification')
            .setTitle('Roblox Username Verification');
        
        const usernameInput = new TextInputBuilder()
            .setCustomId('roblox_username')
            .setLabel('Your Roblox Username')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter your exact Roblox username')
            .setRequired(true);
        
        const firstActionRow = new ActionRowBuilder().addComponents(usernameInput);
        modal.addComponents(firstActionRow);
        
        await interaction.showModal(modal);
    } else if (commandName === 'setup') {
        if (!isServerOwner(interaction)) {
            const embed = new EmbedBuilder()
                .setAuthor({ 
                    name: interaction.user.username, 
                    iconURL: interaction.user.displayAvatarURL() 
                })
                .setTitle('Access Denied')
                .setDescription('This command is only available to server owners.')
                .setColor('#FFFFFF');
            
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        // Check if server owner is verified
        const verification = await getServerVerification(interaction.guild.id);
        if (!verification || verification.userId !== interaction.user.id) {
            const embed = new EmbedBuilder()
                .setAuthor({ 
                    name: interaction.user.username, 
                    iconURL: interaction.user.displayAvatarURL() 
                })
                .setTitle('Verification Required')
                .setDescription('You must verify your Roblox account first using the `/verify` command.')
                .setColor('#FFFFFF');
            
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        // Check if server already has setup
        const existingSetup = await getServerSetup(interaction.guild.id);
        if (existingSetup) {
            const embed = new EmbedBuilder()
                .setAuthor({ 
                    name: interaction.user.username, 
                    iconURL: interaction.user.displayAvatarURL() 
                })
                .setTitle('Already Set Up')
                .setDescription('This server has already been set up with ArrowAPI.')
                .setColor('#FFFFFF');
            
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        const groupId = interaction.options.getInteger('group_id');
        
        try {
            // Find available cookie
            const cookie = await findAvailableCookie();
            if (!cookie) {
                const embed = new EmbedBuilder()
                    .setAuthor({ 
                        name: interaction.user.username, 
                        iconURL: interaction.user.displayAvatarURL() 
                    })
                    .setTitle('ArrowAPI Bots Are Full')
                    .setDescription('Please try again later.')
                    .setColor('#FFFFFF');
                
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }
            
            // Get bot user info
            const botUser = await getCurrentUserFromCookie(cookie);
            if (!botUser) {
                throw new Error('Failed to get bot user info');
            }
            
            // Join the group
            const joinResult = await joinGroupWithCookie(groupId, cookie);
            if (!joinResult.success) {
                let description = `**Error:** ${joinResult.error}\n\n**Bot Account:** ${botUser.name} (${botUser.id})`;
                
                if (joinResult.requiresManualJoin) {
                    description += `\n\n**Manual Setup Instructions:**\n1. Go to your Roblox group: https://www.roblox.com/groups/${groupId}\n2. Invite the bot account **${botUser.name}** to your group\n3. Once added, run \`/setup ${groupId}\` again to complete the setup`;
                }
                
                const embed = new EmbedBuilder()
                    .setAuthor({ 
                        name: interaction.user.username, 
                        iconURL: interaction.user.displayAvatarURL() 
                    })
                    .setTitle('Manual Setup Required')
                    .setDescription(description)
                    .setColor('#FFFFFF');
                
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }
            
            // Store setup info
            const setupData = {
                groupId: groupId,
                botUserId: botUser.id,
                botUsername: botUser.name,
                cookie: cookie
            };
            await saveServerSetup(interaction.guild.id, setupData);
            
            let description;
            if (joinResult.alreadyMember) {
                description = `The bot account **${botUser.name} (${botUser.id})** was already a member of **${joinResult.groupName} (${groupId})**. Setup completed successfully!`;
            } else {
                description = `Successfully joined **${joinResult.groupName} (${groupId})** with the bot account **${botUser.name} (${botUser.id})**`;
            }
            
            const embed = new EmbedBuilder()
                .setAuthor({ 
                    name: interaction.user.username, 
                    iconURL: interaction.user.displayAvatarURL() 
                })
                .setTitle('Setup Successful')
                .setDescription(description)
                .setColor('#FFFFFF');
            
            return interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Setup error:', error);
            
            const errorId = generateErrorId();
            await logError(errorId, error, 'setup', interaction.user.id);
            
            const embed = new EmbedBuilder()
                .setAuthor({ 
                    name: interaction.user.username, 
                    iconURL: interaction.user.displayAvatarURL() 
                })
                .setTitle('Setup Failed')
                .setDescription('An internal bot error occurred with the **setup** command. Please try again. If this error continues to occur, please join the support server and notify us of the issue.')
                .setFooter({ text: `Error ID: ${errorId}` })
                .setColor('#FFFFFF');
            
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }

    else if (commandName === 'blacklist') {
        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.options.getString('user_id');

        // Check authorization
        if (!isAuthorized(interaction)) {
            const embed = new EmbedBuilder()
                .setAuthor({ 
                    name: interaction.user.username, 
                    iconURL: interaction.user.displayAvatarURL() 
                })
                .setTitle('Warning - Invalid Credentials')
                .setDescription('This command is limited to specific role and user ids!')
                .setColor('#FFFFFF');

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Validate user ID format
        if (!/^\d+$/.test(userId)) {
            const embed = new EmbedBuilder()
                .setAuthor({ 
                    name: interaction.user.username, 
                    iconURL: interaction.user.displayAvatarURL() 
                })
                .setTitle('Warning - Invalid User')
                .setDescription('The user ID in place does not exist!')
                .setColor('#FFFFFF');

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (subcommand === 'add') {
            const result = await blacklistUser(userId);

            if (!result.success) {
                let title, description;
                
                switch (result.error) {
                    case 'USER_NOT_FOUND':
                        title = 'Warning - Invalid User';
                        description = 'The user ID in place does not exist!';
                        break;
                    case 'ALREADY_BLACKLISTED':
                        title = 'Warning - Invalid Credentials';
                        description = 'This user is already blacklisted!';
                        break;
                    default:
                        title = 'Error';
                        description = 'An error occurred while blacklisting the user.';
                }

                const embed = new EmbedBuilder()
                    .setAuthor({ 
                        name: interaction.user.username, 
                        iconURL: interaction.user.displayAvatarURL() 
                    })
                    .setTitle(title)
                    .setDescription(description)
                    .setColor('#FFFFFF');

                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            // Success
            const keysList = result.disabledKeys.length > 0 
                ? result.disabledKeys.map(key => `- ${key}`).join('\n')
                : '- No active API keys found';

            const embed = new EmbedBuilder()
                .setAuthor({ 
                    name: interaction.user.username, 
                    iconURL: interaction.user.displayAvatarURL() 
                })
                .setTitle('User Blacklisted')
                .setDescription('The user has been blacklisted successfully!')
                .addFields({
                    name: 'API Keys Disabled:',
                    value: keysList,
                    inline: false
                })
                .setColor('#FFFFFF');

            return interaction.reply({ embeds: [embed] });

        } else if (subcommand === 'remove') {
            const result = await removeFromBlacklist(userId);

            if (!result.success) {
                let title, description;
                
                switch (result.error) {
                    case 'USER_NOT_FOUND':
                        title = 'Warning - Invalid User';
                        description = 'The user ID in place does not exist!';
                        break;
                    case 'NOT_BLACKLISTED':
                        title = 'Warning - User Not Blacklisted';
                        description = 'This user is not currently blacklisted!';
                        break;
                    default:
                        title = 'Error';
                        description = 'An error occurred while removing the user from blacklist.';
                }

                const embed = new EmbedBuilder()
                    .setAuthor({ 
                        name: interaction.user.username, 
                        iconURL: interaction.user.displayAvatarURL() 
                    })
                    .setTitle(title)
                    .setDescription(description)
                    .setColor('#FFFFFF');

                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            // Success
            const embed = new EmbedBuilder()
                .setAuthor({ 
                    name: interaction.user.username, 
                    iconURL: interaction.user.displayAvatarURL() 
                })
                .setTitle('User Removed from Blacklist')
                .setDescription('The user has been successfully removed from the blacklist!')
                .setColor('#FFFFFF');

            return interaction.reply({ embeds: [embed] });
        }
    } else if (commandName === 'panel') {
        // Check authorization
        if (!isAuthorized(interaction)) {
            const embed = new EmbedBuilder()
                .setAuthor({ 
                    name: interaction.user.username, 
                    iconURL: interaction.user.displayAvatarURL() 
                })
                .setTitle('Warning - Invalid Credentials')
                .setDescription('This command is limited to specific role and user ids!')
                .setColor('#FFFFFF');

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Purge messages in the channel before sending panel
        try {
            const channel = interaction.channel;
            if (channel && channel.isTextBased()) {
                const messages = await channel.messages.fetch({ limit: 100 });
                await channel.bulkDelete(messages.filter(msg => !msg.pinned && (Date.now() - msg.createdTimestamp) < 1209600000)); // 14 days limit
            }
        } catch (error) {
            console.log('Could not purge messages:', error.message);
        }

        // Create verification panel
        const embed = new EmbedBuilder()
            .setAuthor({ 
                name: client.user.username, 
                iconURL: client.user.displayAvatarURL() 
            })
            .setTitle('LINK DISCORD ACCOUNT')
            .setDescription('Use the button below to link your account to receive roles in our server.')
            .setColor('#FFFFFF');

        const button = new ButtonBuilder()
            .setCustomId('link_account')
            .setLabel('Link')
            .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder()
            .addComponents(button);

        return interaction.reply({ embeds: [embed], components: [row] });
    }
});

// Handle select menu interactions
client.on('interactionCreate', async interaction => {
    if (!interaction.isStringSelectMenu()) return;
    
    if (interaction.customId === 'delete_api_key') {
        const keyId = interaction.values[0];
        
        try {
            const result = await deleteApiKey(interaction.user.id, keyId);
            
            if (!result.success) {
                let description;
                switch (result.error) {
                    case 'USER_NOT_FOUND':
                        description = 'User not found in database.';
                        break;
                    case 'KEY_NOT_FOUND':
                        description = 'API key not found.';
                        break;
                    default:
                        description = 'An error occurred while deleting your API key.';
                }
                
                const embed = new EmbedBuilder()
                    .setAuthor({ 
                        name: interaction.user.username, 
                        iconURL: interaction.user.displayAvatarURL() 
                    })
                    .setDescription(description)
                    .setColor('#FFFFFF');
                
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }
            
            const embed = new EmbedBuilder()
                .setAuthor({ 
                    name: interaction.user.username, 
                    iconURL: interaction.user.displayAvatarURL() 
                })
                .setTitle('API Key Deleted')
                .setDescription(`Successfully deleted **${result.keyName}**`)
                .setColor('#FFFFFF');
            
            return interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            console.error('API key deletion error:', error);
            
            const embed = new EmbedBuilder()
                .setAuthor({ 
                    name: interaction.user.username, 
                    iconURL: interaction.user.displayAvatarURL() 
                })
                .setDescription('An error occurred while deleting your API key.')
                .setColor('#FFFFFF');
            
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
});

// Handle button interactions
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    if (interaction.customId.startsWith('verify_check_')) {
        const robloxUserId = interaction.customId.replace('verify_check_', '');
        const verification = serverVerifications.get(interaction.guild.id);
        
        if (!verification || verification.userId !== interaction.user.id || !verification.awaitingCheck) {
            const embed = new EmbedBuilder()
                .setAuthor({ 
                    name: interaction.user.username, 
                    iconURL: interaction.user.displayAvatarURL() 
                })
                .setTitle('Verification Failed')
                .setDescription('Verification session expired or invalid. Please run `/verify` again.')
                .setColor('#FFFFFF');
            
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        try {
            // Get user's description
            const description = await getRobloxUserDescription(parseInt(robloxUserId));
            if (description === null) {
                const embed = new EmbedBuilder()
                    .setAuthor({ 
                        name: interaction.user.username, 
                        iconURL: interaction.user.displayAvatarURL() 
                    })
                    .setTitle('Verification Failed')
                    .setDescription('Could not fetch your Roblox profile. Please try again.')
                    .setColor('#FFFFFF');
                
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }
            
            // Check if verification text is in description
            if (!description.includes(verification.verificationText)) {
                const embed = new EmbedBuilder()
                    .setAuthor({ 
                        name: interaction.user.username, 
                        iconURL: interaction.user.displayAvatarURL() 
                    })
                    .setTitle('Verification Failed')
                    .setDescription(`Your Roblox description does not contain the verification text. Please add this to your description:\n\`\`\`${verification.verificationText}\`\`\`\n\nThen try again.`)
                    .setColor('#FFFFFF');
                
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }
            
            // Update verification as completed
            const updatedVerification = {
                ...verification,
                verified: true,
                awaitingCheck: false
            };
            await saveServerVerification(interaction.guild.id, updatedVerification);
            
            const embed = new EmbedBuilder()
                .setAuthor({ 
                    name: interaction.user.username, 
                    iconURL: interaction.user.displayAvatarURL() 
                })
                .setTitle('Verification Successful')
                .setDescription(`Successfully verified your Roblox account: **${verification.robloxUsername} (${verification.robloxUserId})**\n\nYou can now use the \`/setup\` command to set up your server.`)
                .setColor('#FFFFFF');
            
            return interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            console.error('Verification check error:', error);
            
            const embed = new EmbedBuilder()
                .setAuthor({ 
                    name: interaction.user.username, 
                    iconURL: interaction.user.displayAvatarURL() 
                })
                .setTitle('Verification Failed')
                .setDescription('An error occurred while checking your verification. Please try again.')
                .setColor('#FFFFFF');
            
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
    } else if (interaction.customId === 'link_account') {
        const modal = new ModalBuilder()
            .setCustomId('link_form')
            .setTitle('Link Discord Account');

        const codeInput = new TextInputBuilder()
            .setCustomId('verification_code')
            .setLabel('Enter Linking Code')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Only enter your linking code')
            .setRequired(true);

        const firstActionRow = new ActionRowBuilder().addComponents(codeInput);
        modal.addComponents(firstActionRow);

        await interaction.showModal(modal);
    }
});

// Handle modal submissions
client.on('interactionCreate', async interaction => {
    if (!interaction.isModalSubmit()) return;
    
    if (interaction.customId === 'roblox_verification') {
        const username = interaction.fields.getTextInputValue('roblox_username');
        const verification = await getServerVerification(interaction.guild.id);
        
        if (!verification || verification.userId !== interaction.user.id) {
            const embed = new EmbedBuilder()
                .setAuthor({ 
                    name: interaction.user.username, 
                    iconURL: interaction.user.displayAvatarURL() 
                })
                .setTitle('Verification Failed')
                .setDescription('Verification session expired. Please run `/verify` again.')
                .setColor('#FFFFFF');
            
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        try {
            // Get Roblox user info
            const robloxUser = await getRobloxUserFromUsername(username);
            if (!robloxUser) {
                const embed = new EmbedBuilder()
                    .setAuthor({ 
                        name: interaction.user.username, 
                        iconURL: interaction.user.displayAvatarURL() 
                    })
                    .setTitle('Verification Failed')
                    .setDescription('Roblox username not found. Please check your username and try again.')
                    .setColor('#FFFFFF');
                
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }
            
            // Show verification instructions
            const embed = new EmbedBuilder()
                .setAuthor({ 
                    name: interaction.user.username, 
                    iconURL: interaction.user.displayAvatarURL() 
                })
                .setTitle('Verification Instructions')
                .setDescription(`**Step 1:** Go to your Roblox profile: https://www.roblox.com/users/${robloxUser.id}/profile\n\n**Step 2:** Edit your description and add this text anywhere in it:\n\`\`\`${verification.verificationText}\`\`\`\n\n**Step 3:** Click the button below once you've updated your description.`)
                .setColor('#FFFFFF');
            
            const button = new ButtonBuilder()
                .setCustomId(`verify_check_${robloxUser.id}`)
                .setLabel('Check Verification')
                .setStyle(ButtonStyle.Primary);
            
            const row = new ActionRowBuilder().addComponents(button);
            
            // Store the Roblox user info for the button click
            const updatedVerification = {
                ...verification,
                robloxUserId: robloxUser.id,
                robloxUsername: robloxUser.name,
                awaitingCheck: true
            };
            await saveServerVerification(interaction.guild.id, updatedVerification);
            
            return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        } catch (error) {
            console.error('Roblox verification error:', error);
            
            const embed = new EmbedBuilder()
                .setAuthor({ 
                    name: interaction.user.username, 
                    iconURL: interaction.user.displayAvatarURL() 
                })
                .setTitle('Verification Failed')
                .setDescription('An error occurred during verification. Please try again.')
                .setColor('#FFFFFF');
            
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
    } else if (interaction.customId === 'link_form') {
        const code = interaction.fields.getTextInputValue('verification_code');
        
        // Validate the code
        const verificationResult = await VerificationCode.validateCode(code);
        
        if (!verificationResult) {
            const embed = new EmbedBuilder()
                .setAuthor({ 
                    name: interaction.user.username, 
                    iconURL: interaction.user.displayAvatarURL() 
                })
                .setTitle('Linking Failed')
                .setDescription('The code is invalid or no longer exists.')
                .setColor('#FFFFFF');

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Assign roles to the user
        try {
            const member = await interaction.guild.members.fetch(interaction.user.id);
            const rolesToAdd = ROLES.filter(roleId => roleId && roleId.trim() !== '');
            
            if (rolesToAdd.length > 0) {
                await member.roles.add(rolesToAdd);
            }

            const embed = new EmbedBuilder()
                .setAuthor({ 
                    name: interaction.user.username, 
                    iconURL: interaction.user.displayAvatarURL() 
                })
                .setTitle('Linking Successful')
                .setDescription('The code was validated and successfully redeemed. I have added your roles accordingly.')
                .setColor('#FFFFFF');

            return interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            console.error('Error assigning roles:', error);
            
            const embed = new EmbedBuilder()
                .setAuthor({ 
                    name: interaction.user.username, 
                    iconURL: interaction.user.displayAvatarURL() 
                })
                .setTitle('Linking Failed')
                .setDescription('An error occurred while assigning roles. Please contact an administrator.')
                .setColor('#FFFFFF');

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
});

// Error handling
client.on('error', console.error);

// Start the bot
if (DISCORD_BOT_TOKEN && DISCORD_BOT_TOKEN !== 'your_discord_bot_token_here') {
    client.login(DISCORD_BOT_TOKEN).catch(error => {
        console.error('Discord bot login failed:', error.message);
        console.log('Server will continue without Discord bot functionality');
    });
} else {
    console.log('Discord bot disabled - DISCORD_BOT_TOKEN not configured');
}

module.exports = client;
