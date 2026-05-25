import mongoose from 'mongoose';

import { connectDb, disconnectDb } from '../config/db.js';
import { validateEnv } from '../config/env.js';
import PlatformAccount from '../models/PlatformAccount.js';
import User from '../models/User.js';
import Workspace from '../models/Workspace.js';
import { DEFAULT_PLATFORM_FORMAT_RULES, ensureDefaultPlatformRules } from '../services/platformFormat.service.js';

const DEMO_WORKSPACE_NAME = 'CreatorOps Demo Workspace';
const DEMO_USERS = [
  {
    name: 'Demo Editor',
    email: 'editor@creatorops.dev',
    password: 'password123',
    role: 'editor'
  },
  {
    name: 'Demo Admin',
    email: 'admin@creatorops.dev',
    password: 'password123',
    role: 'creator_admin'
  }
];

const DEMO_PLATFORM_ACCOUNTS = [
  { platform: 'facebook', accountName: 'CodeSprint Facebook', accountHandle: '@codesprint.fb', accountType: 'page' },
  { platform: 'instagram', accountName: 'CodeSprint Instagram', accountHandle: '@codesprint_main', accountType: 'brand' },
  { platform: 'tiktok', accountName: 'CodeSprint TikTok', accountHandle: '@codesprint_campus', accountType: 'creator' },
  { platform: 'youtube_shorts', accountName: 'CodeSprint Shorts', accountHandle: '@codesprint_shorts', accountType: 'creator' },
  { platform: 'youtube', accountName: 'CodeSprint Academy', accountHandle: '@codesprintacademy', accountType: 'brand' },
  { platform: 'threads', accountName: 'CodeSprint Threads', accountHandle: '@codesprint_threads', accountType: 'brand' },
  { platform: 'linkedin', accountName: 'CodeSprint Academy', accountHandle: 'CodeSprint Academy', accountType: 'page' },
  { platform: 'x', accountName: 'CodeSprint X', accountHandle: '@codesprint_x', accountType: 'brand' },
  { platform: 'pinterest', accountName: 'CodeSprint Pins', accountHandle: 'CodeSprint Pins', accountType: 'brand' },
  { platform: 'blog', accountName: 'CodeSprint Blog', accountHandle: 'blog.codesprint.local', accountType: 'blog' },
  { platform: 'shopify', accountName: 'CodeSprint Shop', accountHandle: 'codesprint-shop', accountType: 'shop' }
];

const seed = async () => {
  validateEnv();
  await connectDb();

  const workspaceId = new mongoose.Types.ObjectId();
  const adminId = new mongoose.Types.ObjectId();

  await User.deleteMany({ email: { $in: DEMO_USERS.map(user => user.email) } });
  await Workspace.deleteOne({ name: DEMO_WORKSPACE_NAME });

  await Workspace.create({
    _id: workspaceId,
    name: DEMO_WORKSPACE_NAME,
    ownerId: adminId
  });

  await User.create([
    {
      _id: new mongoose.Types.ObjectId(),
      name: DEMO_USERS[0].name,
      email: DEMO_USERS[0].email,
      passwordHash: DEMO_USERS[0].password,
      role: DEMO_USERS[0].role,
      workspaceId
    },
    {
      _id: adminId,
      name: DEMO_USERS[1].name,
      email: DEMO_USERS[1].email,
      passwordHash: DEMO_USERS[1].password,
      role: DEMO_USERS[1].role,
      workspaceId
    }
  ]);

  await ensureDefaultPlatformRules();
  await PlatformAccount.deleteMany({ workspaceId });
  await PlatformAccount.create(
    DEMO_PLATFORM_ACCOUNTS.map(account => ({
      ...account,
      workspaceId,
      createdBy: adminId,
      status: 'connected',
      isActive: true
    }))
  );

  console.log('Seed complete.');
  console.log(`Workspace: ${DEMO_WORKSPACE_NAME}`);
  console.log(`Platform format rules available: ${DEFAULT_PLATFORM_FORMAT_RULES.length}`);
  console.log(`Demo platform accounts: ${DEMO_PLATFORM_ACCOUNTS.length}`);
  console.log('Demo users:');
  DEMO_USERS.forEach(user => {
    console.log(`- ${user.email} / ${user.password} / ${user.role}`);
  });
};

seed()
  .catch(error => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDb();
  });
