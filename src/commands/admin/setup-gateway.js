import { SlashCommandBuilder } from 'discord.js';
import gatewayManager from '../../modules/gateway/gatewayManager.js';
import { updateGuildConfig, getGuildConfig } from '../../core/database.js';
import { logger } from '../../core/logger.js';

/**
 * Setup Gateway Slash Command
 * Handles interaction and database updates only
 * Delegates gateway message deployment to gatewayManager
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
        )

        .addSubcommand(sc => sc
            .setName('reaction')
            .setDescription('Deploy a reaction-based gateway')
            .addRoleOption(o => o.setName('role').setDescription('Role to grant on verification').setRequired(true))
            .addChannelOption(o => o.setName('channel').setDescription('Channel to send the gateway message').setRequired(true))
            .addStringOption(o => o.setName('embed_text').setDescription('Embed text/description').setRequired(false))
            .addStringOption(o => o.setName('emoji').setDescription('Emoji to react with (unicode or <:name:id>)').setRequired(false))
        )

        .addSubcommand(sc => sc
            .setName('trigger')
            .setDescription('Deploy a trigger-word gateway')
            .addRoleOption(o => o.setName('role').setDescription('Role to grant on verification').setRequired(true))
            .addChannelOption(o => o.setName('channel').setDescription('Channel to send the gateway message').setRequired(true))
            .addStringOption(o => o.setName('trigger_word').setDescription('Trigger word users must type').setRequired(true))
            .addStringOption(o => o.setName('instruction_text').setDescription('Instruction text to show in the embed').setRequired(false))
        )

        .addSubcommand(sc => sc
            .setName('slash')
            .setDescription('Deploy an instruction to use the /verify command')
            .addRoleOption(o => o.setName('role').setDescription('Role to grant on verification').setRequired(true))
            .addChannelOption(o => o.setName('channel').setDescription('Channel to send the gateway message').setRequired(true))
            .addStringOption(o => o.setName('instruction_text').setDescription('Instruction text to show in the embed').setRequired(false))
        ),

    async execute(interaction) {
        // Validate guild context
        if (!interaction.inGuild() || !interaction.guild) {
            return interaction.reply({
                content: 'This command must be used in a server.',
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const subcommand = interaction.options.getSubcommand();
            const guildId = interaction.guildId;
            const role = interaction.options.getRole('role');
            const channel = interaction.options.getChannel('channel');

            // Validate channel
            if (!channel || !channel.send) {
                return interaction.editReply({
                    content: 'Please provide a valid text channel.',
                    ephemeral: true
                });
            }

            // Validate role
            if (!role) {
                return interaction.editReply({
                    content: 'Please provide a valid role.',
                    ephemeral: true
                });
            }

            let typeKey = '';
            let settings = {};

            // Collect settings based on subcommand
            switch (subcommand) {
                case 'button': {
                    typeKey = 'BUTTON';
                    settings = {
                        roleId: role.id,
                        channelId: channel.id,
                        embedText: interaction.options.getString('embed_text') || null,
                        buttonLabel: interaction.options.getString('button_label') || 'Verify',
                        buttonStyle: interaction.options.getString('button_style') || 'Primary'
                    };
                    break;
                }
                case 'reaction': {
                    typeKey = 'REACTION';
                    settings = {
                        roleId: role.id,
                        channelId: channel.id,
                        embedText: interaction.options.getString('embed_text') || null,
                        emoji: interaction.options.getString('emoji') || '✅'
                    };
                    break;
                }
                case 'trigger': {
                    typeKey = 'TRIGGER';
                    settings = {
                        roleId: role.id,
                        channelId: channel.id,
                        triggerWord: interaction.options.getString('trigger_word') || 'verify',
                        instructionText: interaction.options.getString('instruction_text') || null
                    };
                    break;
                }
                case 'slash': {
                    typeKey = 'SLASH';
                    settings = {
                        roleId: role.id,
                        channelId: channel.id,
                        instructionText: interaction.options.getString('instruction_text') || 'Please use the /verify command to verify.'
                    };
                    break;
                }
                default: {
                    return interaction.editReply({
                        content: 'Unknown subcommand.',
                        ephemeral: true
                    });
                }
            }

            // Persist configuration to database
            const updateData = {
                'gateway.type': typeKey,
                'gateway.enabled': true,
                [`gateway.settings.${typeKey}`]: settings
            };

            if (role?.id) {
                updateData['gateway.verifiedRoleId'] = role.id;
            }

            const savedConfig = await updateGuildConfig(guildId, updateData);
            if (!savedConfig) {
                return interaction.editReply({
                    content: 'Failed to save gateway configuration to database.',
                    ephemeral: true
                });
            }

            logger.info(`Gateway config saved for guild ${guildId} as type ${typeKey}`);

            // Deploy the gateway message using gatewayManager
            try {
                await gatewayManager.deploy(interaction.guild, channel, typeKey, settings);
                
                return interaction.editReply({
                    content: `✅ Gateway deployed as **${typeKey}** in ${channel}!`,
                    ephemeral: true
                });
            } catch (deployError) {
                logger.error(`Failed to deploy gateway: ${deployError.message}`);
                return interaction.editReply({
                    content: `Configuration saved, but failed to deploy gateway message: ${deployError.message}`,
                    ephemeral: true
                });
            }

        } catch (error) {
            logger.error(`admin/setup-gateway failed: ${error.message}`);
            try {
                await interaction.editReply({
                    content: 'An error occurred while deploying the gateway. Check logs.',
                    ephemeral: true
                });
            } catch (e) {
                logger.error(`Failed to send error reply: ${e.message}`);
            }
        }
    }
};
