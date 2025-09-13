const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, REST, Routes } = require('discord.js');
const { connectToDatabase } = require('./config/database');

// Configuration - Add these to your .env file
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID; // Optional: for guild-specific commands

// Authorized role IDs and user IDs - Add these to your .env file as comma-separated values
const AUTHORIZED_ROLE_IDS = process.env.AUTHORIZED_ROLE_IDS ? process.env.AUTHORIZED_ROLE_IDS.split(',') : [];
const AUTHORIZED_USER_IDS = process.env.AUTHORIZED_USER_IDS ? process.env.AUTHORIZED_USER_IDS.split(',') : [];

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
].map(command => command.toJSON());

// Register commands
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

// Get user's API keys from database
async function getUserApiKeys(userId) {
    try {
        const db = await connectToDatabase();
        const user = await db.collection('users').findOne({ discordId: userId });
        
        if (!user || !user.apiKeys) {
            return [];
        }
        
        return user.apiKeys.filter(key => key.isActive).map(key => key.name || 'Unnamed Key');
    } catch (error) {
        console.error('Error fetching user API keys:', error);
        return [];
    }
}

// Blacklist user
async function blacklistUser(userId) {
    try {
        const db = await connectToDatabase();
        
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
        const db = await connectToDatabase();
        
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
client.once('ready', async () => {
    console.log(`Discord bot logged in as ${client.user.tag}!`);
    await registerCommands();
});

// Handle slash commands
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'blacklist') {
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
    }
});

// Error handling
client.on('error', console.error);

// Start the bot
if (DISCORD_BOT_TOKEN) {
    client.login(DISCORD_BOT_TOKEN);
} else {
    console.error('DISCORD_BOT_TOKEN is required in environment variables');
}

module.exports = client;
