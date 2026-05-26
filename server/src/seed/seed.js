import mongoose from 'mongoose';

import { connectDb, disconnectDb } from '../config/db.js';
import { validateEnv } from '../config/env.js';
import User from '../models/User.js';
import Workspace from '../models/Workspace.js';
import { CONTENT_CREATOR_ROLE } from '../constants/roles.js';
import { DEFAULT_PLATFORM_FORMAT_RULES, ensureDefaultPlatformRules } from '../services/platformFormat.service.js';

const DEMO_WORKSPACE_NAME = 'CreatorOps Demo Workspace';
const DEMO_USERS = [
  {
    name: 'Demo Content Creator',
    email: 'editor@creatorops.dev',
    password: 'password123',
    role: CONTENT_CREATOR_ROLE
  },
  {
    name: 'Demo Server Manager',
    email: 'admin@creatorops.dev',
    password: 'password123',
    role: CONTENT_CREATOR_ROLE
  },
  {
    name: 'Demo Brand Rep',
    email: 'brand@creatorops.dev',
    password: 'password123',
    role: 'brand_rep'
  }
];

const seed = async () => {
  validateEnv();
  await connectDb();

  let workspace = await Workspace.findOne({ name: DEMO_WORKSPACE_NAME });
  if (!workspace) {
    workspace = await Workspace.create({
      _id: new mongoose.Types.ObjectId(),
      name: DEMO_WORKSPACE_NAME,
      ownerId: new mongoose.Types.ObjectId()
    });
  }

  for (const demoUser of DEMO_USERS) {
    let user = await User.findOne({ email: demoUser.email }).select('+passwordHash');
    if (!user) {
      user = new User({
        _id: new mongoose.Types.ObjectId(),
        workspaceId: workspace._id
      });
    }
    user.name = demoUser.name;
    user.email = demoUser.email;
    user.passwordHash = demoUser.password;
    user.role = demoUser.role;
    user.workspaceId = workspace._id;
    await user.save();
    if (demoUser.email === 'admin@creatorops.dev') {
      workspace.ownerId = user._id;
      await workspace.save();
    }
  }

  await ensureDefaultPlatformRules();

  console.log('Seed complete.');
  console.log(`Workspace: ${DEMO_WORKSPACE_NAME}`);
  console.log(`Platform format rules available: ${DEFAULT_PLATFORM_FORMAT_RULES.length}`);
  console.log('Demo platform connections: seed does not create or delete real connections.');
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
