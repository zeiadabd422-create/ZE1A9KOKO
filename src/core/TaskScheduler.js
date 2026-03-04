const mongoose = require('mongoose');

class TaskScheduler {
        constructor(client) {
                    this.client = client;
        }

            start() {
                        setInterval(async () => {
                                        if (mongoose.connection.readyState !== 1) {
                                                            return console.warn('[SCHEDULER-GUARD] DB disconnected. Skipping task.');
                                        }

                                                    try {
                                                                        await this.checkExpiredRoles();
                                                    } catch (error) {
                                                                        console.error('[SCHEDULER-ERROR] Critical failure in task:', error);
                                                    }
                        }, 60000);
            }

                async checkExpiredRoles() {
                            // Log logic for future implementation
                }
}

module.exports = TaskScheduler;
