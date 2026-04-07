import { SlashCommandBuilder } from 'discord.js';
import { GuildConfigService } from '../../services/GuildConfigService.js';
import { PLANS } from '../../config/plans.js';

export const data = new SlashCommandBuilder()
  .setName('plan')
    .setDescription('Manage server plan')
      .addSubcommand(sub =>
          sub.setName('set')
                .setDescription('Set server plan')
                      .addStringOption(opt =>
                              opt.setName('type')
                                        .setDescription('Plan type')
                                                  .setRequired(true)
                                                            .addChoices(
                                                                            { name: 'Free', value: 'free' },
                                                                                        { name: 'Pro', value: 'pro' }
                                                            )
                      )
      )
        .addSubcommand(sub =>
            sub.setName('info')
                  .setDescription('Show current plan info')
                    )
                      .addSubcommand(sub =>
                          sub.setName('reset')
                                .setDescription('Reset to free plan')
                                  );

                                  export async function execute(interaction) {
                                      const sub = interaction.options.getSubcommand();
                                        const guildId = interaction.guildId;

                                          if (!guildId) {
                                                return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
                                          }

                                            // 🔐 تأكد إنه Admin
                                              if (!interaction.memberPermissions.has('Administrator')) {
                                                    return interaction.reply({ content: '❌ You must be an admin.', ephemeral: true });
                                              }

                                                if (sub === 'set') {
                                                        const type = interaction.options.getString('type');

                                                            const config = GuildConfigService.getConfig(guildId);
                                                                config.plan = type;

                                                                    return interaction.reply({
                                                                              content: `✅ Plan updated to **${type}**`,
                                                                                    ephemeral: true
                                                                    });
                                                }

                                                  if (sub === 'info') {
                                                        const config = GuildConfigService.getConfig(guildId);
                                                            const plan = GuildConfigService.getPlan(guildId);

                                                                return interaction.reply({
                                                                          content:
                                                                          `📊 Current Plan: **${config.plan}**
                                                                          Max Daily: ${plan.maxDailyVerifications}
                                                                          Max Sessions: ${plan.maxConcurrentSessions}
                                                                          DM Verification: ${plan.features.dmVerification ? 'Yes' : 'No'}
                                                                          Custom Flows: ${plan.features.customFlows ? 'Yes' : 'No'}`,
                                                                                ephemeral: true
                                                                });
                                                  }

                                                    if (sub === 'reset') {
                                                            const config = GuildConfigService.getConfig(guildId);
                                                                config.plan = 'free';

                                                                    return interaction.reply({
                                                                              content: '🔄 Plan reset to Free.',
                                                                                    ephemeral: true
                                                                    });
                                                    }
                                  }