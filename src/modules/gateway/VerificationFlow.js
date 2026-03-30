const MODE_CONFIG = {
  EASY: { timeoutMs: 240_000, retries: 3 },
  NORMAL: { timeoutMs: 120_000, retries: 2 },
  HARD: { timeoutMs: 90_000, retries: 1 },
};

function shuffleArray(items) {
  return items.slice().sort(() => Math.random() - 0.5);
}

function buildAnswerButton(value) {
  return {
    label: String(value),
    customId: `gateway_v3_answer_${value}`,
    style: 'primary',
  };
}

export default class VerificationFlow {
  constructor(client) {
    this.client = client;
    this.activeFlows = new Map();
  }

  cleanupExpired() {
    const now = Date.now();
    for (const [memberId, flow] of this.activeFlows.entries()) {
      if (flow.timeoutAt <= now) {
        this.activeFlows.delete(memberId);
      }
    }
  }

  createFlow(member, risk, config = {}) {
    this.cleanupExpired();

    const mode = risk.level === 'HIGH' ? 'HARD' : risk.level === 'MEDIUM' ? 'NORMAL' : 'EASY';
    const rule = config?.verification?.[mode.toLowerCase()] || MODE_CONFIG[mode];
    const challenge = this.generateChallenge(mode);
    const flow = {
      memberId: member.id,
      guildId: member.guild.id,
      mode,
      attemptsLeft: rule.retries,
      timeoutAt: Date.now() + rule.timeoutMs,
      startedAt: Date.now(),
      challenge,
      risk,
      config,
      status: 'pending',
    };

    this.activeFlows.set(member.id, flow);
    return flow;
  }

  getFlow(memberId) {
    this.cleanupExpired();
    return this.activeFlows.get(memberId) || null;
  }

  generateChallenge(mode) {
    if (mode === 'EASY') {
      return {
        prompt: 'Press the verification button to prove you are a human visitor.',
        expected: 'confirm',
        options: [
          {
            label: 'Confirm Human',
            customId: 'gateway_v3_easy_confirm',
            style: 'success',
          },
        ],
      };
    }

    const first = Math.floor(Math.random() * 8) + 2;
    const second = Math.floor(Math.random() * 8) + 2;
    const answer = first + second;
    const choices = shuffleArray([answer, answer + 1, answer - 1]).slice(0, 3);

    return {
      prompt: `Solve this challenge to continue: **${first} + ${second} = ?**`,
      expected: String(answer),
      options: choices.map(buildAnswerButton),
    };
  }

  validateResponse(memberId, rawAnswer) {
    const flow = this.getFlow(memberId);
    if (!flow) return { status: 'missing' };

    const now = Date.now();
    if (flow.timeoutAt <= now) {
      this.activeFlows.delete(memberId);
      return { status: 'timeout', flow };
    }

    const answer = String(rawAnswer || '').trim().toLowerCase();
    const expected = String(flow.challenge.expected || '').trim().toLowerCase();

    if (answer === expected) {
      this.activeFlows.delete(memberId);
      return { status: 'success', flow };
    }

    flow.attemptsLeft -= 1;

    if (flow.attemptsLeft <= 0) {
      this.activeFlows.delete(memberId);
      return { status: 'failed', flow };
    }

    this.activeFlows.set(memberId, flow);
    return { status: 'retry', flow };
  }

  buildPromptPayload(flow, member) {
    return {
      embeds: [
        {
          title: 'Guardian Gateway Verification',
          description: 'Welcome **{user.username}**! Complete this verification to unlock server access.',
          color: '{risk.color}',
          fields: [
            { name: 'Mode', value: '{flow.mode}', inline: true },
            { name: 'Risk Level', value: '{risk.level}', inline: true },
            { name: 'Attempts Remaining', value: '{flow.attemptsLeft}', inline: true },
            { name: 'Challenge', value: '{flow.challenge.prompt}', inline: false },
          ],
          footer: { text: 'This flow will expire automatically if not completed in time.' },
        },
      ],
      components: flow.challenge.options,
    };
  }

  buildStatusPayload(flow, status) {
    const messages = {
      success: '✅ Verification complete. Welcome to the server.',
      failed: '❌ Verification failed. You have exhausted all allowed attempts.',
      timeout: '⌛ Verification timed out. Please rejoin or contact a moderator to retry.',
      missing: '⚠️ No active verification session found. Please rejoin the verification flow.',
    };

    const colorMap = {
      success: '#2ecc71',
      failed: '#e74c3c',
      timeout: '#f39c12',
      missing: '#7f8c8d',
    };

    return {
      embeds: [
        {
          title: 'Guardian Gateway',
          description: messages[status] || messages.missing,
          color: colorMap[status] || '#95a5a6',
          fields: flow
            ? [
                { name: 'Mode', value: flow.mode, inline: true },
                { name: 'Risk', value: flow.risk.level, inline: true },
                { name: 'Remaining Attempts', value: String(flow.attemptsLeft ?? 0), inline: true },
              ]
            : [],
        },
      ],
      components: [],
    };
  }
}
