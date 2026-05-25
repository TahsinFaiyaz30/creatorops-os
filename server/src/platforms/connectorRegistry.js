import { PLATFORM_LABELS, SUPPORTED_PLATFORMS } from '../constants/platforms.js';
import FacebookConnector from './facebook/FacebookConnector.js';
import InstagramConnector from './instagram/InstagramConnector.js';
import LinkedInConnector from './linkedin/LinkedInConnector.js';
import PinterestConnector from './pinterest/PinterestConnector.js';
import ShopifyConnector from './shopify/ShopifyConnector.js';
import ThreadsConnector from './threads/ThreadsConnector.js';
import TikTokConnector from './tiktok/TikTokConnector.js';
import WordPressConnector from './wordpress/WordPressConnector.js';
import XConnector from './x/XConnector.js';
import YouTubeConnector from './youtube/YouTubeConnector.js';

const connectors = {
  facebook: new FacebookConnector(),
  instagram: new InstagramConnector(),
  tiktok: new TikTokConnector(),
  youtube: new YouTubeConnector('youtube', 'YouTube'),
  youtube_shorts: new YouTubeConnector('youtube_shorts', 'YouTube Shorts'),
  threads: new ThreadsConnector(),
  linkedin: new LinkedInConnector(),
  x: new XConnector(),
  pinterest: new PinterestConnector(),
  wordpress: new WordPressConnector(),
  shopify: new ShopifyConnector()
};

export const getConnector = platform => connectors[platform] || null;

export const listConnectors = () =>
  SUPPORTED_PLATFORMS.map(platform => {
    const connector = connectors[platform];
    return {
      platform,
      displayName: connector?.getDisplayName() || PLATFORM_LABELS[platform] || platform,
      helperText: connector?.getHelperText() || `Connect ${PLATFORM_LABELS[platform] || platform}`,
      configured: connector?.isConfigured() || false,
      requiredEnv: connector?.getRequiredEnv() || [],
      requiredScopes: connector?.getRequiredScopes() || [],
      capabilities: connector?.getCapabilities() || {},
      connectionMode:
        platform === 'wordpress' ? 'app_password' : platform === 'shopify' ? 'admin_token' : 'oauth'
    };
  });

export default connectors;
