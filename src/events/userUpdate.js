import Member from '../models/Member.js';

export default {
  name: 'userUpdate',
  async execute(oldUser, newUser) {
    try {
      if (!newUser || !newUser.id) return;

      const newHash = Member.computeChangeHash(newUser);
      if (!newHash) return;

      // Update any guild member records whose changeHash is stale
      const result = await Member.updateMany(
        { userId: newUser.id, changeHash: { $ne: newHash } },
        { $set: { changeHash: newHash, lastSeen: new Date() } }
      );

      if (result.modifiedCount > 0) {
        console.log(`[userUpdate] Updated changeHash for ${newUser.tag || newUser.id} across ${result.modifiedCount} member records.`);
      }
    } catch (err) {
      console.error('[userUpdate] Handler failed:', err);
    }
  },
};