import { VisualParser } from '../../core/VisualEngine/Parser.js';

export class GatewayManager {
  constructor(client) {
    this.client = client;
    this.states = {
      EASY: 'easy',
      NORMAL: 'normal',
      HARD: 'hard',
    };
  }

  async render(member, riskScore = null) {
    try {
      if (riskScore === null) {
        const { calculateRiskScore } = await import('./RiskEngine.js');
        riskScore = calculateRiskScore(member);
      }

      const riskLevel = this.getRiskLevel(riskScore);
      const state = this.getStateFromRisk(riskLevel);
      const result = await this.buildGatewayResponse(member, riskScore, state);
      return {
        ...result,
        state,
        riskScore,
      };
    } catch (error) {
      console.error('[GatewayManager] render failed:', error);
      return this.getFallbackResponse(member);
    }
  }

  getRiskLevel(riskScore) {
    if (riskScore < 33) return 'LOW';
    if (riskScore < 66) return 'MEDIUM';
    return 'HIGH';
  }

  getStateFromRisk(riskLevel) {
    switch (riskLevel) {
      case 'LOW':
        return this.states.EASY;
      case 'MEDIUM':
        return this.states.NORMAL;
      case 'HIGH':
        return this.states.HARD;
      default:
        return this.states.NORMAL;
    }
  }

  async buildGatewayResponse(member, riskScore, state) {
    const title = `Welcome to ${member.guild.name}`;
    const baseDescription = `Hello ${member.user.username}! Please verify yourself to access the server.`;
    const payload = {
      title,
      description:
        state === this.states.EASY
          ? `${baseDescription}\n\n**Easy Verification:** Click the button below to verify instantly.`
          : state === this.states.NORMAL
          ? `${baseDescription}\n\n**Normal Verification:** Solve a simple captcha or answer a question.`
          : `${baseDescription}\n\n**Strict Verification:** Complete multiple verification steps.`,
      color: state === this.states.EASY ? '#2ecc71' : state === this.states.NORMAL ? '#f39c12' : '#e74c3c',
      footer: { text: `Risk Score: ${riskScore}` },
      timestamp: new Date(),
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: state === this.states.EASY ? 'Success' : state === this.states.NORMAL ? 'Primary' : 'Danger',
              customId:
                state === this.states.EASY
                  ? 'gateway_verify_easy'
                  : state === this.states.NORMAL
                  ? 'gateway_verify_normal'
                  : 'gateway_verify_hard',
              label:
                state === this.states.EASY
                  ? 'Verify (Easy)'
                  : state === this.states.NORMAL
                  ? 'Start Verification'
                  : 'Start Strict Verification',
            },
          ],
        },
      ],
    };

    const parser = new VisualParser();
    return parser.parse(payload, {
      user: `<@${member.user.id}>`,
      guild: member.guild.name,
      member_count: member.guild.memberCount,
    });
  }

  async getFallbackResponse(member) {
    const payload = {
      title: 'Welcome!',
      description: 'Please verify yourself to continue.',
      color: '#95a5a6',
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 'Primary',
              customId: 'gateway_verify_fallback',
              label: 'Verify',
            },
          ],
        },
      ],
    };

    const parser = new VisualParser();
    const parsed = await parser.parse(payload, {
      user: `<@${member.user.id}>`,
      guild: member.guild.name,
      member_count: member.guild.memberCount,
    });

    return {
      ...parsed,
      state: 'fallback',
      riskScore: 0,
    };
  }
}

export default GatewayManager;
