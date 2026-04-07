import mongoose from 'mongoose';
import { ShopItemModel } from '../src/modules/Shop/ShopModel.js';
import { config } from 'dotenv';

config();

async function populateSampleShopItems() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing items
    await ShopItemModel.deleteMany({});
    console.log('🧹 Cleared existing shop items');

    // Sample shop items
    const sampleItems = [
      {
        guildId: '1449104671737380915', // From .env GUILD_ID
        itemId: 'vip_role_001',
        createdBy: 'system',
        name: 'VIP Role',
        description: 'Get access to exclusive VIP channels and perks',
        price: 500,
        currency: 'coins',
        type: 'role',
        roleId: 'vip_role_id_here', // Replace with actual role ID
        category: 'roles',
        stock: -1, // Unlimited
        isEnabled: true,
        embedColor: 0xFFD700
      },
      {
        guildId: '1449104671737380915',
        itemId: 'custom_nickname_001',
        createdBy: 'system',
        name: 'Custom Nickname',
        description: 'Change your nickname to anything you want (within reason)',
        price: 200,
        currency: 'coins',
        type: 'cosmetic',
        category: 'cosmetics',
        stock: -1,
        isEnabled: true,
        embedColor: 0xFF69B4
      },
      {
        guildId: '1449104671737380915',
        itemId: 'level_boost_001',
        createdBy: 'system',
        name: 'Level Boost',
        description: 'Instantly gain 5 levels in the leveling system',
        price: 1000,
        currency: 'coins',
        type: 'item',
        category: 'utilities',
        stock: 50,
        isEnabled: true,
        embedColor: 0x00FF00
      },
      {
        guildId: '1449104671737380915',
        itemId: 'mystery_box_001',
        createdBy: 'system',
        name: 'Mystery Box',
        description: 'Open for a random reward - could be coins, gems, or special items!',
        price: 150,
        currency: 'coins',
        type: 'item',
        category: 'utilities',
        stock: 100,
        isEnabled: true,
        embedColor: 0x8A2BE2
      },
      {
        guildId: '1449104671737380915',
        itemId: 'premium_gem_001',
        createdBy: 'system',
        name: 'Premium Gem',
        description: 'Rare gem that can be used for special purchases',
        price: 50,
        currency: 'gems',
        type: 'item',
        category: 'premium',
        stock: 25,
        isEnabled: true,
        embedColor: 0xFF4500
      },
      {
        guildId: '1449104671737380915',
        itemId: 'color_red_001',
        createdBy: 'system',
        name: 'Color Role - Red',
        description: 'Get a red color role to stand out in chat',
        price: 300,
        currency: 'coins',
        type: 'role',
        roleId: 'red_color_role_id_here', // Replace with actual role ID
        category: 'cosmetics',
        stock: -1,
        isEnabled: true,
        embedColor: 0xFF0000
      },
      {
        guildId: '1449104671737380915',
        itemId: 'color_blue_001',
        createdBy: 'system',
        name: 'Color Role - Blue',
        description: 'Get a blue color role to stand out in chat',
        price: 300,
        currency: 'coins',
        type: 'role',
        roleId: 'blue_color_role_id_here', // Replace with actual role ID
        category: 'cosmetics',
        stock: -1,
        isEnabled: true,
        embedColor: 0x0000FF
      },
      {
        guildId: '1449104671737380915',
        itemId: 'server_banner_001',
        createdBy: 'system',
        name: 'Server Banner',
        description: 'Commission a custom server banner (contact staff after purchase)',
        price: 2000,
        currency: 'coins',
        type: 'item',
        category: 'premium',
        stock: 5,
        isEnabled: true,
        embedColor: 0xDAA520
      }
    ];

    // Insert sample items
    const insertedItems = await ShopItemModel.insertMany(sampleItems);
    console.log(`✅ Added ${insertedItems.length} sample shop items`);

    // Display added items
    console.log('\n📦 Sample Shop Items Added:');
    insertedItems.forEach((item, index) => {
      console.log(`${index + 1}. ${item.name} - ${item.price} ${item.currency}`);
    });

  } catch (error) {
    console.error('❌ Error populating shop items:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the script
populateSampleShopItems();