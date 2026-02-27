/**
 * Welcome Module - Professional Member Onboarding & Goodbye System (Mimu Style)
 * Features:
 *   - Automatic "Unverified" role assignment on member join
 *   - Interactive embed editor with Modals (Mimu-style popups)
 *   - Placeholder support: {user}, {server}, {member_count}
 *   - Comprehensive error handling with try-catch blocks
 *   - Only sends messages if module is enabled
 */

import WelcomeConfig from './schema.js';
import { parsePlaceholders } from '../../utils/placeholders.js';

export default function WelcomeModule(client) {
  return {
    /**
     * Build embed from config with placeholder parsing
     */
    buildEmbed(embedConfig, member, guild) {
      try {
        if (!embedConfig) return null;

        const title = parsePlaceholders(embedConfig.title || '', member, guild);
        const description = parsePlaceholders(embedConfig.description || '', member, guild);
        const footerText = parsePlaceholders(embedConfig.footer_text || '', member, guild);
        const authorName = parsePlaceholders(embedConfig.author_name || '', member, guild);

        const embed = {
          title: title || 'Welcome',
          description: description || 'Welcome to the server!',
          color: parseInt((embedConfig.color || '#4f3ff0').replace('#', ''), 16),
          footer: { text: footerText || 'Welcome' },
        };

        // Add author if author_name is provided
        if (authorName && authorName.trim()) {
          embed.author = { name: authorName };
        }

        // Add thumbnail if user avatar is available and toggle is enabled
        try {
          if (embedConfig.thumbnail_toggle && member && member.user && typeof member.user.displayAvatarURL === 'function') {
            embed.thumbnail = { url: member.user.displayAvatarURL({ dynamic: true }) };
          }
        } catch (thumbErr) {
          console.warn('[Welcome] Failed to add thumbnail:', thumbErr.message);
        }

        // Add image if URL is provided
        if (embedConfig.image_url && embedConfig.image_url.trim() && typeof embedConfig.image_url === 'string') {
          try {
            // Basic URL validation
            new URL(embedConfig.image_url);
            embed.image = { url: embedConfig.image_url };
          } catch (urlErr) {
            console.warn('[Welcome] Invalid image URL:', urlErr.message);
          }
        }

        return embed;
      } catch (err) {
        console.error('[Welcome] buildEmbed error:', err);
        return null;
      }
    },

    /**
     * Handle member join - assign Unverified role and send welcome embed
     * Gateway will handle removing this role upon verification
     */
    async handleMemberAdd(member) {
      try {
        const config = await WelcomeConfig.findOne({ guildId: member.guild.id });
        
        // Module must be enabled
        if (!config || !config.enabled) {
          console.log(`[Welcome] Module not configured or disabled for guild ${member.guild.id}`);
          return;
        }

        // Step 1: Assign Unverified role if configured
        if (config.autoRole) {
          try {
            const role = member.guild.roles.cache.get(config.autoRole);
            if (role) {
              if (!member.roles.cache.has(role.id)) {
                await member.roles.add(role.id, '[Welcome] Auto-assign Unverified role on join');
                console.log(`[Welcome] ✅ Assigned autoRole "${role.name}" to ${member.user.tag}`);
              } else {
                console.log(`[Welcome] Member ${member.user.tag} already has autoRole`);
              }
            } else {
              console.warn(`[Welcome] AutoRole ${config.autoRole} not found in guild`);
            }
          } catch (roleErr) {
            console.error('[Welcome] Failed to assign autoRole:', roleErr.message || roleErr);
            // Continue execution even if role assignment fails
          }
        }

        // Step 2: Send welcome embed to configured channel
        if (config.welcomeEmbed && config.welcomeEmbed.channel) {
          try {
            const guild = member.guild;
            const channel = guild.channels.cache.get(config.welcomeEmbed.channel);
            
            if (!channel) {
              console.warn(`[Welcome] Welcome channel ${config.welcomeEmbed.channel} not found`);
              return;
            }

            if (!channel.send || !channel.isTextBased()) {
              console.warn(`[Welcome] Welcome channel ${channel.name} is not text-based or is not writable`);
              return;
            }

            const embed = this.buildEmbed(config.welcomeEmbed, member, guild);
            if (embed) {
              try {
                await channel.send({ embeds: [embed] });
                console.log(`[Welcome] ✅ Sent welcome embed for ${member.user.tag} to #${channel.name}`);
              } catch (sendErr) {
                console.error('[Welcome] Failed to send welcome embed:', sendErr.message || sendErr);
              }
            }
          } catch (channelErr) {
            console.error('[Welcome] Error accessing welcome channel:', channelErr.message || channelErr);
          }
        }
      } catch (err) {
        console.error('[Welcome] handleMemberAdd error:', err);
        // Do not crash the bot if welcome handling fails
      }
    },

    /**
     * Handle member leave - send goodbye embed to configured channel
     */
    async handleMemberRemove(member) {
      try {
        const config = await WelcomeConfig.findOne({ guildId: member.guild.id });
        
        // Module must be enabled and goodbye embed configured
        if (!config || !config.enabled) {
          console.log(`[Welcome] Module not configured or disabled for guild ${member.guild.id}`);
          return;
        }

        if (!config.goodbyeEmbed || !config.goodbyeEmbed.channel) {
          console.log(`[Welcome] Goodbye not configured for guild ${member.guild.id}`);
          return;
        }

        try {
          const guild = member.guild;
          const channel = guild.channels.cache.get(config.goodbyeEmbed.channel);
          
          if (!channel) {
            console.warn(`[Welcome] Goodbye channel ${config.goodbyeEmbed.channel} not found`);
            return;
          }

          if (!channel.send || !channel.isTextBased()) {
            console.warn(`[Welcome] Goodbye channel is not text-based or is not writable`);
            return;
          }

          const embed = this.buildEmbed(config.goodbyeEmbed, member, guild);
          if (embed) {
            try {
              await channel.send({ embeds: [embed] });
              console.log(`[Welcome] ✅ Sent goodbye embed for ${member.user.tag} to #${channel.name}`);
            } catch (sendErr) {
              console.error('[Welcome] Failed to send goodbye embed:', sendErr.message || sendErr);
            }
          }
        } catch (channelErr) {
          console.error('[Welcome] Error accessing goodbye channel:', channelErr.message || channelErr);
        }
      } catch (err) {
        console.error('[Welcome] handleMemberRemove error:', err);
        // Do not crash the bot if goodbye handling fails
      }
    },


    /**
     * Handle button interactions for Mimu-style welcome/goodbye editing
     * Buttons: [edit basic information], [edit author], [edit footer], [edit images]
     */
    async handleButtonInteraction(interaction) {
      try {
        if (!interaction.customId.startsWith('welcome_')) return;

        const config = await WelcomeConfig.findOne({ guildId: interaction.guild.id });
        if (!config) {
          try {
            await interaction.reply({ content: '❌ Welcome module not configured for this server.', ephemeral: true });
          } catch (replyErr) {
            console.error('[Welcome] Failed to reply to button:', replyErr);
          }
          return;
        }

        // Parse button ID: welcome_<embedType>_<buttonType>
        // e.g., welcome_welcome_basicinfo or welcome_goodbye_images
        const parts = interaction.customId.split('_');
        const embedType = parts[1]; // 'welcome' or 'goodbye'
        const buttonType = parts[2]; // 'basicinfo', 'author', 'footer', 'images'

        if (!embedType || !buttonType) {
          console.warn('[Welcome] Invalid button customId format:', interaction.customId);
          try {
            await interaction.reply({ content: '❌ Invalid button configuration.', ephemeral: true });
          } catch (replyErr) {
            console.error('[Welcome] Failed to reply with error:', replyErr);
          }
          return;
        }

        const embedKey = embedType === 'welcome' ? 'welcomeEmbed' : 'goodbyeEmbed';
        const embConfig = config[embedKey];

        // Create modal based on button type - Mimu style with individual modals
        let modal;

        if (buttonType === 'basicinfo') {
          // Modal 1: Basic Information (Color / Title / Description)
          modal = {
            custom_id: `welcome_modal_${embedType}_basicinfo`,
            title: `Edit ${embedType === 'welcome' ? 'Welcome' : 'Goodbye'} • Basic Information`,
            components: [
              {
                type: 1,
                components: [
                  {
                    type: 4,
                    custom_id: 'title',
                    label: 'Embed Title',
                    placeholder: 'Enter embed title',
                    style: 1,
                    value: embConfig?.title || '',
                    required: true,
                    min_length: 1,
                    max_length: 256,
                  },
                ],
              },
              {
                type: 1,
                components: [
                  {
                    type: 4,
                    custom_id: 'description',
                    label: 'Embed Description',
                    placeholder: 'Use {user}, {server}, {member_count} for placeholders',
                    style: 2,
                    value: embConfig?.description || '',
                    required: true,
                    min_length: 1,
                    max_length: 4000,
                  },
                ],
              },
              {
                type: 1,
                components: [
                  {
                    type: 4,
                    custom_id: 'color',
                    label: 'Color Hex Code',
                    placeholder: 'e.g., #4f3ff0 or #ff4d4d',
                    style: 1,
                    value: embConfig?.color || '#4f3ff0',
                    required: false,
                    min_length: 7,
                    max_length: 7,
                  },
                ],
              },
            ],
          };
        } else if (buttonType === 'author') {
          // Modal 2: Author (Author Name Field)
          modal = {
            custom_id: `welcome_modal_${embedType}_author`,
            title: `Edit ${embedType === 'welcome' ? 'Welcome' : 'Goodbye'} • Author`,
            components: [
              {
                type: 1,
                components: [
                  {
                    type: 4,
                    custom_id: 'author_name',
                    label: 'Author Name',
                    placeholder: 'Enter author/display name',
                    style: 1,
                    value: embConfig?.author_name || '',
                    required: false,
                    max_length: 256,
                  },
                ],
              },
            ],
          };
        } else if (buttonType === 'footer') {
          // Modal 3: Footer (Footer Text Only)
          modal = {
            custom_id: `welcome_modal_${embedType}_footer`,
            title: `Edit ${embedType === 'welcome' ? 'Welcome' : 'Goodbye'} • Footer`,
            components: [
              {
                type: 1,
                components: [
                  {
                    type: 4,
                    custom_id: 'footer_text',
                    label: 'Footer Text',
                    placeholder: 'Use {user}, {server}, {member_count} for placeholders',
                    style: 1,
                    value: embConfig?.footer_text || '',
                    required: false,
                    max_length: 256,
                  },
                ],
              },
            ],
          };
        } else if (buttonType === 'images') {
          // Modal 4: Images (Image URL, Channel ID, Thumbnail Toggle)
          modal = {
            custom_id: `welcome_modal_${embedType}_images`,
            title: `Edit ${embedType === 'welcome' ? 'Welcome' : 'Goodbye'} • Images`,
            components: [
              {
                type: 1,
                components: [
                  {
                    type: 4,
                    custom_id: 'image_url',
                    label: 'Banner Image URL',
                    placeholder: 'https://example.com/image.png',
                    style: 1,
                    value: embConfig?.image_url || '',
                    required: false,
                    max_length: 2000,
                  },
                ],
              },
              {
                type: 1,
                components: [
                  {
                    type: 4,
                    custom_id: 'channel_id',
                    label: 'Channel ID (where to post)',
                    placeholder: 'Paste the channel ID here',
                    style: 1,
                    value: embConfig?.channel || '',
                    required: true,
                    min_length: 17,
                    max_length: 20,
                  },
                ],
              },
              {
                type: 1,
                components: [
                  {
                    type: 4,
                    custom_id: 'thumbnail_toggle',
                    label: 'Show Member Avatar (Thumbnail)',
                    placeholder: 'true or false',
                    style: 1,
                    value: embConfig?.thumbnail_toggle ? 'true' : 'false',
                    required: false,
                    max_length: 5,
                  },
                ],
              },
            ],
          };
        } else {
          console.warn('[Welcome] Unknown button type:', buttonType);
          try {
            await interaction.reply({ content: '❌ Unknown button type.', ephemeral: true });
          } catch (replyErr) {
            console.error('[Welcome] Failed to reply:', replyErr);
          }
          return;
        }

        // Show the modal (popup) - Mimu style
        try {
          await interaction.showModal(modal);
        } catch (modalErr) {
          console.error('[Welcome] Failed to show modal:', modalErr);
          try {
            if (interaction.isRepliable() && !interaction.replied) {
              await interaction.reply({ content: '❌ Failed to open settings modal.', ephemeral: true });
            }
          } catch (replyErr) {
            console.error('[Welcome] Failed to send error reply:', replyErr);
          }
        }
      } catch (err) {
        console.error('[Welcome] Button interaction error:', err);
        try {
          if (interaction.isRepliable() && !interaction.replied) {
            await interaction.reply({ content: '❌ An error occurred processing your request.', ephemeral: true });
          }
        } catch (e) {
          console.error('[Welcome] Failed to send final error reply:', e);
        }
      }
    },

    /**
     * Handle modal submissions for embed editing (Mimu-style modals)
     * Separate modals for: basicinfo, author, footer, images
     */
    async handleModalSubmit(interaction) {
      try {
        if (!interaction.customId.startsWith('welcome_modal_')) return;

        // Parse modal ID: welcome_modal_<embedType>_<modalType>
        const parts = interaction.customId.split('_');
        const embedType = parts[2]; // 'welcome' or 'goodbye'
        const modalType = parts[3]; // 'basicinfo', 'author', 'footer', 'images'

        if (!embedType || !modalType) {
          console.warn('[Welcome] Invalid modal customId format:', interaction.customId);
          try {
            await interaction.reply({ content: '❌ Invalid modal configuration.', ephemeral: true });
          } catch (replyErr) {
            console.error('[Welcome] Failed to reply:', replyErr);
          }
          return;
        }

        // Fetch current config
        const config = await WelcomeConfig.findOne({ guildId: interaction.guild.id });
        if (!config) {
          try {
            await interaction.reply({ content: '❌ Welcome module not configured.', ephemeral: true });
          } catch (replyErr) {
            console.error('[Welcome] Failed to reply:', replyErr);
          }
          return;
        }

        // Build update object based on modal type
        const update = {};
        const embedKey = embedType === 'welcome' ? 'welcomeEmbed' : 'goodbyeEmbed';
        let successMessage = 'Updated successfully!';

        try {
          if (modalType === 'basicinfo') {
            // Modal: Basic Information (Title, Description, Color)
            const title = interaction.fields.getTextInputValue('title');
            const description = interaction.fields.getTextInputValue('description');
            const color = interaction.fields.getTextInputValue('color') || (embedType === 'welcome' ? '#4f3ff0' : '#ff4d4d');

            // Validate color format
            if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
              try {
                await interaction.reply({ content: '❌ Invalid color format. Use #RRGGBB (e.g., #4f3ff0)', ephemeral: true });
              } catch (replyErr) {
                console.error('[Welcome] Failed to reply:', replyErr);
              }
              return;
            }

            update[`${embedKey}.title`] = title;
            update[`${embedKey}.description`] = description;
            update[`${embedKey}.color`] = color;
            successMessage = `${embedType === 'welcome' ? 'Welcome' : 'Goodbye'} • Basic Information updated!`;

          } else if (modalType === 'author') {
            // Modal: Author (Author Name Field)
            const authorName = interaction.fields.getTextInputValue('author_name');

            if (!authorName || !authorName.trim()) {
              update[`${embedKey}.author_name`] = '';
            } else {
              update[`${embedKey}.author_name`] = authorName;
            }
            successMessage = `${embedType === 'welcome' ? 'Welcome' : 'Goodbye'} • Author updated!`;

          } else if (modalType === 'footer') {
            // Modal: Footer (Footer Text Only)
            const footerText = interaction.fields.getTextInputValue('footer_text');

            update[`${embedKey}.footer_text`] = footerText;
            successMessage = `${embedType === 'welcome' ? 'Welcome' : 'Goodbye'} • Footer updated!`;

          } else if (modalType === 'images') {
            // Modal: Images (Image URL, Channel ID, Thumbnail Toggle)
            const imageUrl = interaction.fields.getTextInputValue('image_url');
            const channelId = interaction.fields.getTextInputValue('channel_id');
            const thumbnailToggleStr = interaction.fields.getTextInputValue('thumbnail_toggle') || 'false';

            // Validate channel ID format (snowflake: 17-20 digits)
            if (channelId && !/^\d{17,20}$/.test(channelId)) {
              try {
                await interaction.reply({ content: '❌ Invalid Channel ID. Use the numeric ID (right-click > Copy ID)', ephemeral: true });
              } catch (replyErr) {
                console.error('[Welcome] Failed to reply:', replyErr);
              }
              return;
            }

            // Validate image URL if provided
            if (imageUrl && imageUrl.trim()) {
              try {
                new URL(imageUrl);
              } catch (urlErr) {
                try {
                  await interaction.reply({ content: '❌ Invalid image URL. Make sure it starts with https://', ephemeral: true });
                } catch (replyErr) {
                  console.error('[Welcome] Failed to reply:', replyErr);
                }
                return;
              }
            }

            // Parse thumbnail toggle input (true/false, yes/no, 1/0, etc.)
            const thumbnailToggle = thumbnailToggleStr.toLowerCase() === 'true' || 
                                   thumbnailToggleStr.toLowerCase() === 'yes' || 
                                   thumbnailToggleStr === '1';

            update[`${embedKey}.image_url`] = imageUrl;
            update[`${embedKey}.channel`] = channelId;
            update[`${embedKey}.thumbnail_toggle`] = thumbnailToggle;
            successMessage = `${embedType === 'welcome' ? 'Welcome' : 'Goodbye'} • Images updated!`;
          }
        } catch (fieldsErr) {
          console.error('[Welcome] Error extracting modal fields:', fieldsErr);
          try {
            await interaction.reply({ content: '❌ Failed to process form submission.', ephemeral: true });
          } catch (replyErr) {
            console.error('[Welcome] Failed to reply:', replyErr);
          }
          return;
        }

        // Update database
        try {
          const updated = await WelcomeConfig.findOneAndUpdate(
            { guildId: interaction.guild.id },
            update,
            { new: true }
          );

          if (!updated) {
            try {
              await interaction.reply({ content: '❌ Failed to update configuration.', ephemeral: true });
            } catch (replyErr) {
              console.error('[Welcome] Failed to reply:', replyErr);
            }
            return;
          }

          // Send success response
          try {
            await interaction.reply({
              content: `✅ ${successMessage}`,
              ephemeral: true,
            });
          } catch (replyErr) {
            console.error('[Welcome] Failed to send success reply:', replyErr);
          }
          
          console.log(`[Welcome] ✅ Updated ${embedKey} (${modalType}) for guild ${interaction.guild.id}`);
        } catch (updateErr) {
          console.error('[Welcome] Database update error:', updateErr);
          try {
            await interaction.reply({ content: '❌ Failed to save changes to database.', ephemeral: true });
          } catch (replyErr) {
            console.error('[Welcome] Failed to send error reply:', replyErr);
          }
        }
      } catch (err) {
        console.error('[Welcome] Modal submit error:', err);
        try {
          if (interaction.isRepliable() && !interaction.replied) {
            await interaction.reply({ content: '❌ An error occurred processing your submission.', ephemeral: true });
          }
        } catch (e) {
          console.error('[Welcome] Failed to send final error reply:', e);
        }
      }
    },


    /**
     * Setup welcome module - Admin command helper
     * Configures channel and auto-role assignment
     */
    async setup(guildId, channelId, autoRoleId) {
      try {
        if (!guildId) {
          return { success: false, error: 'Guild ID is required' };
        }

        if (!channelId) {
          return { success: false, error: 'Channel ID is required' };
        }

        const update = {
          guildId,
          autoRole: autoRoleId || '',
          'welcomeEmbed.channel': channelId || '',
          enabled: true,
        };

        try {
          const cfg = await WelcomeConfig.findOneAndUpdate(
            { guildId },
            update,
            { upsert: true, new: true }
          );
          
          console.log(`[Welcome] ✅ Setup complete for guild ${guildId}`);
          return { success: true, config: cfg };
        } catch (dbErr) {
          console.error('[Welcome] Database error during setup:', dbErr);
          return { success: false, error: `Database error: ${dbErr.message}` };
        }
      } catch (err) {
        console.error('[Welcome] Setup error:', err);
        return { success: false, error: err.message || 'Unknown error' };
      }
    },
  };
}
