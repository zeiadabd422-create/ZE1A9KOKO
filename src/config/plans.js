export const PLANS = {
      free: {
            maxConcurrentSessions: 2,
                maxDailyVerifications: 20,
                    queuePriority: "low",
                        features: {
                                  dmVerification: false,
                                        customFlows: false
                        }
      },

        pro: {
                maxConcurrentSessions: 10,
                    maxDailyVerifications: 200,
                        queuePriority: "high",
                            features: {
                                      dmVerification: true,
                                            customFlows: true
                            }
        }
};
