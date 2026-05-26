import express from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import User from '../models/User.js';
import BrandProfile from '../models/BrandProfile.js';
import Review from '../models/Review.js';

const router = express.Router();

router.use(authenticate);

router.get('/profile/:id', async (req, res, next) => {
  try {
    const userId = req.params.id === 'me' ? req.auth.userId : req.params.id;
    console.log(`[PROFILE] Fetching profile for id: ${req.params.id}, resolved userId: ${userId}`);
    
    const user = await User.findById(userId).select('-passwordHash');
    if (!user) {
      console.log(`[PROFILE] User not found for userId: ${userId}`);
      return res.status(404).json({ message: 'User not found' });
    }

    let brandProfile = null;
    if (user.role === 'brand_rep') {
      brandProfile = await BrandProfile.findOne({ workspaceId: user.workspaceId });
    }

    const reviews = await Review.find({ targetUserId: user._id })
      .populate('reviewerId', 'name role profile.avatarUrl')
      .sort({ createdAt: -1 })
      .limit(10);

    return res.json({
      user,
      brandProfile,
      reviews
    });
  } catch (error) {
    return next(error);
  }
});

router.put('/profile', async (req, res, next) => {
  try {
    const { name, bio, location, avatarUrl, socialLinks, brandDetails } = req.body;
    
    const user = await User.findById(req.auth.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.name = name || user.name;
    if (bio !== undefined) user.profile.bio = bio;
    if (location !== undefined) user.profile.location = location;
    if (avatarUrl !== undefined) user.profile.avatarUrl = avatarUrl;
    if (socialLinks !== undefined) user.profile.socialLinks = socialLinks;

    await user.save();

    let brandProfile = null;
    if (user.role === 'brand_rep' && brandDetails) {
      brandProfile = await BrandProfile.findOne({ workspaceId: user.workspaceId });
      if (brandProfile) {
        brandProfile.brandName = brandDetails.brandName || brandProfile.brandName;
        brandProfile.description = brandDetails.description || brandProfile.description;
        brandProfile.industry = brandDetails.industry || brandProfile.industry;
        brandProfile.website = brandDetails.website || brandProfile.website;
        brandProfile.logoUrl = brandDetails.logoUrl || brandProfile.logoUrl;
        await brandProfile.save();
      }
    }

    return res.json({ message: 'Profile updated', user, brandProfile });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/reviews', async (req, res, next) => {
  try {
    const targetUserId = req.params.id;
    const { rating, comment, collaborationContext } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    if (targetUserId === req.auth.userId.toString()) {
      return res.status(400).json({ message: 'Cannot review yourself' });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ message: 'Target user not found' });
    }

    const review = await Review.create({
      reviewerId: req.auth.userId,
      targetUserId,
      rating,
      comment,
      collaborationContext
    });

    // Update aggregate ratings
    const allReviews = await Review.find({ targetUserId });
    const totalReviews = allReviews.length;
    const averageRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews;

    targetUser.totalReviews = totalReviews;
    targetUser.averageRating = Math.round(averageRating * 10) / 10;
    await targetUser.save();

    return res.status(201).json({ message: 'Review submitted', review });
  } catch (error) {
    return next(error);
  }
});

export default router;
