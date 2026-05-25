import mongoose from 'mongoose';

import { connectDb, disconnectDb } from '../config/db.js';
import { validateEnv } from '../config/env.js';
import User from '../models/User.js';
import Workspace from '../models/Workspace.js';

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

  console.log('Seed complete.');
  console.log(`Workspace: ${DEMO_WORKSPACE_NAME}`);
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
