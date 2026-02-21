import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Gateway Database Schema
 * Stores gateway configuration per guild
 * DDD: Domain Layer - Pure data structure
 */
const GatewaySchema = new Schema(
    {
        guildId: {
            type: String,
            required: true,
            unique: true,
            index: true,
            description: 'Discord Guild ID'
        },
        enabled: {
            type: Boolean,
            default: false,
            description: 'Whether gateway is active'
        },
        mode: {
            type: String,
            enum: ['BUTTON', 'REACTION', 'TRIGGER', 'SLASH'],
            default: 'BUTTON',
            description: 'Gateway verification type'
        },
        roleId: {
            type: String,
            default: null,
            description: 'Role to assign on verification'
        },
        logChannelId: {
            type: String,
            default: null,
            description: 'Channel to log verification actions'
        },
        embedData: {
            title: { type: String, default: 'Gate Verification' },
            description: { type: String, default: 'Please verify to access this server.' },
            color: { type: String, default: '5865F2' },
            thumbnail: { type: String, default: null },
            footer: { type: String, default: 'Guardian Bot v4.0' }
        },
        buttonConfig: {
            label: { type: String, default: 'Verify' },
            style: { type: String, enum: ['Primary', 'Secondary', 'Success', 'Danger'], default: 'Primary' }
        },
        reactionConfig: {
            emoji: { type: String, default: '✅' }
        },
        triggerConfig: {
            triggerWord: { type: String, default: 'verify' },
            instructionText: { type: String, default: null }
        },
        slashConfig: {
            instructionText: { type: String, default: 'Please use the /verify command to verify.' }
        },
        messageId: {
            type: String,
            default: null,
            description: 'Message ID of the gateway message'
        },
        channelId: {
            type: String,
            default: null,
            description: 'Channel ID where gateway message is sent'
        },
        verificationCount: {
            type: Number,
            default: 0,
            description: 'Number of successful verifications'
        },
        lastUpdated: {
            type: Date,
            default: Date.now,
            description: 'Last configuration update'
        }
    },
    { timestamps: true, strict: true, versionKey: false }
);

// Indexes for performance
GatewaySchema.index({ guildId: 1 });
GatewaySchema.index({ enabled: 1 });
GatewaySchema.index({ lastUpdated: -1 });

const GatewayModel = mongoose.models.Gateway || mongoose.model('Gateway', GatewaySchema);

export default GatewayModel;
