import { SlashCommandBuilder } from 'discord.js';
import gatewayManager from '../../modules/gateway/gatewayManager.js';
import gatewayModule from '../../modules/gateway/index.js';
import { logger } from '../../core/logger.js';

/**
 * Setup Gateway Slash Command
 * DDD: Presentation Layer - Command Handler
 * 
 * Collects user input and delegates to gateway module
 * Validates configuration before saving to DB and cache
 * 
 * Subcommands:
 * - button: Deploy a button-based gateway
 * - reaction: Deploy a reaction-based gateway
 * - trigger: Deploy a trigger-word gateway
 * - slash: Deploy an instruction to use /verify command
 */
export default {
    data: new SlashCommandBuilder()
        .setName('setup-gateway')
        .setDescription('Configure and deploy the gateway message for the server')
        .setDefaultMemberPermissions('8') // Administrator permission
        
        .addSubcommand(sc => sc
            .setName('button')
            .setDescription('Deploy a button-based gateway')
            .addRoleOption(o => o.setName('role').setDescription('Role to grant on verification').setRequired(true))
            .addChannelOption(o => o.setName('channel').setDescription('Channel to send the gateway message').setRequired(true))
            .addStringOption(o => o.setName('embed_text').setDescription('Embed text/description').setRequired(false))
            .addStringOption(o => o.setName('button_label').setDescription('Label for the button').setRequired(false))
            .addStringOption(o => o.setName('button_style').setDescription('Button style (Primary/Secondary/Success/Danger)').setRequired(false))
            .addChannelOption(o => o.setName('log_channel').setDescription('Channel to log verifications').setRequired(false))
        )

        .addSubcommand(sc => sc
            .setName('reaction')
            .setDescription('Deploy a reaction-based gateway')
            .addRoleOption(o => o.setName('role').setDescription('Role to grant on verification').setRequired(true))
            .addChannelOption(o => o.setName('channel').setDescription('Channel to send the gateway message').setRequired(true))
            .addStringOption(o => o.setName('embed_text').setDescription('Embed text/description').setRequired(false))
            .addStringOption(o => o.setName('emoji').setDescription('Emoji to react with (unicode or <:name:id>)').setRequired(false))
            .addChannelOption(o => o.setName('log_channel').setDescription('Channel to log verifications').setRequired(false))
        )

        .addSubcommand(sc => sc
            .setName('trigger')
            .setDescription('Deploy a trigger-word gateway')
            .addRoleOption(o => o.setName('role').setDescription('Role to grant on verification').setRequired(true))
            .addChannelOption(o => o.setName('channel').setDescription('Channel to send the gateway message').setRequired(true))
            .addStringOption(o => o.setName('trigger_word').setDescription('Trigger word users must type').setRequired(true))
            .addStringOption(o => o.setName('instruction_text').setDescription('Instruction text to show in the embed').setRequired(false))
            .addChannelOption(o => o.setName('log_channel').setDescription('Channel to log verifications').setRequired(false))
        )

        .addSubcommand(sc => sc
            .setName('slash')
            .setDescription('Deploy an instruction to use the /verify command')
            .addRoleOption(o => o.setName('role').setDescription('Role to grant on verification').setRequired(true))
            .addChannelOption(o => o.setName('channel').setDescription('Channel to send the gateway message').setRequired(true))
            .addStringOption(o => o.setName('instruction_text').setDescription('Instruction text to show in the embed').setRequired(false))
            .addChannelOption(o => o.setName('log_channel').setDescription('Channel to log verifications').setRequired(false))
        ),

    async execute(interaction) {
        // Validate guild context
        if (!interaction.inGuild() || !interaction.guild) {
            return interaction.reply({
                content: '❌ This command must be used in a server.',
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const subcommand = interaction.options.getSubcommand();
            const guildId = interaction.guildId;
            const role = interaction.options.getRole('role');
            const channel = interaction.options.getChannel('channel');
            const logChannel = interaction.options.getChannel('log_channel') || null;

            // Validate channel
            if (!channel || !channel.send) {
                return interaction.editReply({
                    content: '❌ Please provide a valid text channel.',
                    ephemeral: true
                });
            }

            // Validate role
            if (!role) {
                return interaction.editReply({
                    content: '❌ Please provide a valid role.',
                    ephemeral: true
                });
            }

            let mode = '';
            let configData = {
                guildId,
                enabled: true,
                roleId: role.id,
                channelId: channel.id,
                logChannelId: logChannel?.id || null,
                embedData: {
                    title: 'Gate Verification',
                    description: 'Please verify to access this server.',
                    color: '5865F2',
                    footer: 'Guardian Bot v4.0'
                }
            };

            // Collect settings based on subcommand
            switch (subcommand) {
                case 'button': {
                    mode = 'BUTTON';
                    const buttonLabel = interaction.options.getString('button_label') || 'Verify';
                    const buttonStyle = interaction.options.getString('button_style') || 'Primary';
                    const embedText = interaction.options.getString('embed_text');

                    configData.mode = mode;
                    configData.buttonConfig = {
                        label: buttonLabel,
                        style: buttonStyle
                    };
                    if (embedText) {
                        configData.embedData.description = embedText;
                    }
                    break;
                }
                case 'reaction': {
                    mode = 'REACTION';
                    const emoji = interaction.options.getString('emoji') || '✅';
                    const embedText = interaction.options.getString('embed_text');

                    configData.mode = mode;
                    configData.reactionConfig = { emoji };
                    if (embedText) {
                        configData.embedData.description = embedText;
                    }
                    break;
                }
                case 'trigger': {
                    mode = 'TRIGGER';
                    const triggerWord = interaction.options.getString('trigger_word') || 'verify';
                    const instructionText = interaction.options.getString('instruction_text');

                    configData.mode = mode;
                    configData.triggerConfig = {
                        triggerWord,
                        instructionText: instructionText || `Type **${triggerWord}** to verify.`
                    };
                    if (instructionText) {
                        configData.embedData.description = instructionText;
                    }
                    break;
                }
                case 'slash': {
                    mode = 'SLASH';
                    const instructionText = interaction.options.getString('instruction_text') || 'Please use the /verify command to verify.';

                    configData.mode = mode;
                    configData.slashConfig = { instructionText };
                    configData.embedData.description = instructionText;
                    break;
                }
                default: {
                    return interaction.editReply({
                        content: '❌ Unknown subcommand.',
                        ephemeral: true
                    });
                }
            }

            // Step 1: Save to database AND cache using gateway module
            const saveResult = await gatewayModule.saveConfiguration(guildId, configData);

            if (!saveResult.success) {
                return interaction.editReply({
                    content: `❌ Failed to save gateway configuration: ${saveResult.error}`,
                    ephemeral: true
                });
            }

            logger.info(`✓ Gateway config saved for guild ${guildId} as type ${mode}`);

            // Step 2: Deploy the gateway message using gatewayManager
            try {
                // Prepare settings for gatewayManager
                const settings = {
                    embedText: configData.embedData.description,
                    ...configData.buttonConfig,
                    ...configData.reactionConfig,
                    ...configData.triggerConfig,
                    ...configData.slashConfig
                };

                await gatewayManager.deploy(interaction.guild, channel, mode, settings);
                
                return interaction.editReply({
                    content: `✅ Gateway deployed as **${mode}** in ${channel}!`,
                    ephemeral: true
                });
            } catch (deployError) {
                logger.error(`Failed to deploy gateway message: ${deployError.message}`);
                return interaction.editReply({
                    content: `⚠️ Configuration saved, but failed to deploy gateway message: ${deployError.message}`,
                    ephemeral: true
                });
            }

        } catch (error) {
            logger.error(`admin/setup-gateway failed: ${error.message}`);
            try {
                await interaction.editReply({
                    content: '❌ An error occurred while deploying the gateway. Check logs.',
                    ephemeral: true
                });
            } catch (e) {
                logger.error(`Failed to send error reply: ${e.message}`);
            }
        }
    }
};
