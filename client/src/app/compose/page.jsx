'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, ImagePlus, Sparkles, Send, X, Trash2, CheckCircle2, AlertCircle, LayoutPanelTop, ZoomIn, ZoomOut, Crop } from 'lucide-react';
import AppShell from '../../components/layout/AppShell';
import VisibilitySelector from '../../components/publish/VisibilitySelector';
import { api } from '../../lib/api';
import { getUser } from '../../lib/auth';
import { formatDuration } from '../../lib/duration';
import { formatPlatform, getPlatformCaptionLimit, getPlatformDetails, platformCapabilities } from '../../lib/platforms';
import { canPublish } from '../../lib/roles';
import Cropper from 'react-easy-crop';

const aspectOptions = [
  { label: '9:16', value: '9:16', className: 'aspect-[9/16]' },
  { label: '1:1', value: '1:1', className: 'aspect-square' },
  { label: '4:5', value: '4:5', className: 'aspect-[4/5]' },
  { label: '16:9', value: '16:9', className: 'aspect-video' },
  { label: 'original', value: 'original', className: 'aspect-auto min-h-[360px]' }
];

const createPostGroupId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `post_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const formatBytes = bytes => {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) return 'unknown size';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size >= 10 || unitIndex === 0 ? Math.round(size) : size.toFixed(1)} ${units[unitIndex]}`;
};

const createConnectionTarget = (connection, platform = connection.platform) => ({
  ...connection,
  platform,
  sourcePlatform: connection.platform,
  platformConnectionId: connection.platformConnectionId || connection._id,
  targetKey: `${connection.platformConnectionId || connection._id}:${platform}`,
  isSharedYouTubeConnection: connection.platform === 'youtube' && platform === 'youtube_shorts'
});

const expandConnectionTargets = connections =>
  connections.flatMap(connection => {
    const targets = [createConnectionTarget(connection)];
    if (connection.platform === 'youtube') {
      targets.push(createConnectionTarget(connection, 'youtube_shorts'));
    }
    return targets;
  });

const createDefaultMediaSettings = asset => ({
  crop: {
    x: asset?.cropMetadata?.cropX || 0,
    y: asset?.cropMetadata?.cropY || 0
  },
  zoom: asset?.cropMetadata?.zoom || 1,
  croppedAreaPixels: asset?.cropMetadata?.croppedAreaPixels || null,
  croppedAreaPercentages: asset?.cropMetadata?.croppedAreaPercentages || null
});

const detectMediaType = file => {
  if (file.type?.startsWith('image/')) return 'image';
  if (file.type?.startsWith('video/')) return 'video';
  return '';
};

const createLocalMediaAsset = file => {
  const mediaType = detectMediaType(file);
  return {
    _id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    file,
    originalName: file.name,
    mimeType: file.type,
    size: file.size,
    mediaType,
    width: null,
    height: null,
    durationSeconds: null,
    publicUrl: URL.createObjectURL(file),
    status: 'local_preview',
    isLocalPreview: true
  };
};

const loadLocalVideoMetadata = asset => {
  if (asset.mediaType !== 'video') return Promise.resolve(asset);

  return new Promise(resolve => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      resolve({
        ...asset,
        width: video.videoWidth,
        height: video.videoHeight,
        durationSeconds: video.duration
      });
    };
    video.onerror = () => resolve(asset);
    video.src = asset.publicUrl;
  });
};

const getAspectRatioValue = aspectRatio => {
  if (aspectRatio === '9:16') return 9 / 16;
  if (aspectRatio === '1:1') return 1;
  if (aspectRatio === '4:5') return 4 / 5;
  if (aspectRatio === '16:9') return 16 / 9;
  return undefined;
};

const buildCropMetadata = ({ asset, settings, aspectRatio }) => {
  const cropSettings = settings || createDefaultMediaSettings(asset);
  const percentages = cropSettings.croppedAreaPercentages || {};

  return {
    aspectRatio,
    objectFit: aspectRatio === 'original' ? 'contain' : 'cover',
    positionX: typeof percentages.x === 'number' ? percentages.x : 50,
    positionY: typeof percentages.y === 'number' ? percentages.y : 50,
    cropX: cropSettings.crop?.x || 0,
    cropY: cropSettings.crop?.y || 0,
    zoom: cropSettings.zoom || 1,
    croppedAreaPixels: cropSettings.croppedAreaPixels || undefined,
    croppedAreaPercentages: cropSettings.croppedAreaPercentages || undefined
  };
};

export default function ComposePage() {
  const [user, setUser] = useState(null);
  const [connections, setConnections] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [baseCaption, setBaseCaption] = useState('');
  
  // Multi-media states
  const [mediaAssets, setMediaAssets] = useState([]);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [coverIndex, setCoverIndex] = useState(0);
  const [mediaSettings, setMediaSettings] = useState({});
  const [globalAspect, setGlobalAspect] = useState('9:16');

  const [captions, setCaptions] = useState([]);
  const [scheduledAt, setScheduledAt] = useState(() => new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 16));
  const [visibility, setVisibility] = useState('public');
  const [message, setMessage] = useState('');
  const [publishResults, setPublishResults] = useState([]);
  const [busy, setBusy] = useState('');
  const [publishSettings, setPublishSettings] = useState({ temporaryMediaRetentionSeconds: 7 * 24 * 60 * 60 });

  const load = async () => {
    const [connectionsResult, settingsResult] = await Promise.allSettled([
      api.get('/api/platform-connections'),
      api.get('/api/publish/settings')
    ]);

    if (connectionsResult.status === 'rejected') {
      throw connectionsResult.reason;
    }

    const payload = connectionsResult.value;
    setConnections(expandConnectionTargets((payload.data.connections || []).filter(c => c.status === 'connected')));

    if (settingsResult.status === 'fulfilled') {
      setPublishSettings(settingsResult.value.data.settings);
    }
  };

  useEffect(() => {
    setUser(getUser());
    load().catch(err => setMessage(err.message));
  }, []);

  const activeAsset = mediaAssets[activeMediaIndex];
  const activeSettings = activeAsset ? mediaSettings[activeAsset._id] || createDefaultMediaSettings(activeAsset) : null;

  const selectedConnections = useMemo(
    () => connections.filter(connection => selectedIds.includes(connection.targetKey)),
    [connections, selectedIds]
  );
  const temporaryMediaRetentionLabel = formatDuration(publishSettings.temporaryMediaRetentionSeconds);

  const updateActiveSettings = (updates) => {
    if (!activeAsset) return;
    setMediaSettings(prev => ({
      ...prev,
      [activeAsset._id]: { ...(prev[activeAsset._id] || createDefaultMediaSettings(activeAsset)), ...updates }
    }));
  };

  const getCropMetadataForUpload = asset => {
    if (asset.mediaType !== 'image') return null;

    return buildCropMetadata({
      asset,
      settings: mediaSettings[asset._id] || createDefaultMediaSettings(asset),
      aspectRatio: globalAspect
    });
  };

  // Eligibility Check
  const getPlatformEligibility = (platform) => {
    const caps = platformCapabilities[platform];
    if (!caps) return { eligible: true }; 
    
    if (mediaAssets.length > 1 && !caps.multiMedia) {
      return { eligible: false, reason: 'Does not support multiple media.' };
    }
    if (mediaAssets.length > caps.maxMedia) {
      return { eligible: false, reason: `Max ${caps.maxMedia} media files.` };
    }
    for (const asset of mediaAssets) {
      if (!caps.types.includes(asset.mediaType)) {
         return { eligible: false, reason: `Does not support ${asset.mediaType}.` };
      }
    }
    if (platform === 'youtube_shorts') {
      const video = mediaAssets.find(asset => asset.mediaType === 'video');
      const issues = [];
      if (video?.width && video?.height && video.width > video.height) {
        issues.push('square or vertical video');
      }
      if (video?.durationSeconds && video.durationSeconds > 3 * 60) {
        issues.push('a duration of 3 minutes or less');
      }
      if (issues.length) {
        return { eligible: false, reason: `YouTube Shorts requires ${issues.join(' and ')}.` };
      }
    }
    return { eligible: true };
  };

  const toggleConnection = (id, platform) => {
    const eligibility = getPlatformEligibility(platform);
    if (!eligibility.eligible && !selectedIds.includes(id)) {
      setMessage(`Cannot select ${formatPlatform(platform)}: ${eligibility.reason}`);
      return;
    }
    setSelectedIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  };

  // Auto-deselect if they become ineligible due to adding media
  useEffect(() => {
    if (mediaAssets.length === 0) return;
    let changed = false;
    const newSelected = selectedIds.filter(id => {
      const conn = connections.find(c => c.targetKey === id);
      if (!conn) return false;
      const valid = getPlatformEligibility(conn.platform).eligible;
      if (!valid) changed = true;
      return valid;
    });
    if (changed) {
      setSelectedIds(newSelected);
      setMessage('Some platforms were deselected because they do not support the current media selection.');
    }
  }, [mediaAssets, connections]);

  const upload = async event => {
    const files = Array.from(event.target.files);
    if (!files.length) return;
    setBusy('upload');
    setMessage('');
    try {
      const newAssets = (await Promise.all(files.map(file => loadLocalVideoMetadata(createLocalMediaAsset(file)))))
        .filter(asset => asset.mediaType);

      if (newAssets.length !== files.length) {
        setMessage('Only image and video files can be selected.');
      }

      setMediaSettings(prev => {
        const next = { ...prev };
        newAssets.forEach(asset => {
          next[asset._id] = createDefaultMediaSettings(asset);
        });
        return next;
      });
      setMediaAssets(prev => {
        const combined = [...prev, ...newAssets];
        if (prev.length === 0) setActiveMediaIndex(0);
        return combined;
      });
      if (newAssets.length) {
        setMessage(`${newAssets.length} file(s) selected for temporary upload when you publish or schedule.`);
      }
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy('');
      event.target.value = '';
    }
  };

  const removeMedia = (index) => {
    setMediaAssets(prev => {
      const next = [...prev];
      const removed = next.splice(index, 1)[0];
      if (removed?.isLocalPreview && removed.publicUrl) {
        URL.revokeObjectURL(removed.publicUrl);
      }
      setMediaSettings(s => {
        const newS = { ...s };
        delete newS[removed._id];
        return newS;
      });
      return next;
    });
    
    let newActive = activeMediaIndex;
    if (activeMediaIndex === index) {
      newActive = Math.max(0, index - 1);
    } else if (activeMediaIndex > index) {
      newActive = activeMediaIndex - 1;
    }
    setActiveMediaIndex(newActive);

    let newCover = coverIndex;
    if (coverIndex === index) {
      newCover = 0;
    } else if (coverIndex > index) {
      newCover = coverIndex - 1;
    }
    setCoverIndex(newCover);
  };

  const customizeCaptions = async () => {
    setBusy('ai');
    setMessage('');
    try {
      const payload = await api.post('/api/ai/customize-captions', {
        baseCaption,
        connectionTargets: selectedConnections.map(connection => ({
          connectionId: connection.platformConnectionId,
          platform: connection.platform
        })),
        mediaAssetIds: []
      });
      setCaptions(payload.data.results || []);
      setMessage('Captions customized per selected platform/account.');
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy('');
    }
  };

  const handleCropComplete = (croppedAreaPercentages, croppedAreaPixels) => {
    updateActiveSettings({ croppedAreaPercentages, croppedAreaPixels });
  };

  const updateCaption = (targetKey, value) => {
    const connection = connections.find(item => item.targetKey === targetKey);
    setCaptions(current => {
      if (current.some(item => item.connectionId === connection?.platformConnectionId && item.platform === connection?.platform)) {
        return current.map(item =>
          item.connectionId === connection.platformConnectionId && item.platform === connection.platform
            ? { ...item, caption: value }
            : item
        );
      }
      return [
        ...current,
        {
          connectionId: connection?.platformConnectionId || '',
          platform: connection?.platform || '',
          accountHandle: connection?.accountHandle || '',
          caption: value,
          hashtags: [],
          hook: '',
          cta: '',
          brandScore: 0,
          readinessScore: 0,
          warnings: [],
          suggestions: [],
          aiProvider: 'manual'
        }
      ];
    });
  };

  const describePublishJob = publishJob => {
    if (!publishJob) return 'No publish job returned.';
    if (publishJob.status === 'published') {
      return publishJob.providerPostUrl ? `Published: ${publishJob.providerPostUrl}` : 'Published through the connected platform API.';
    }
    if (publishJob.status === 'blocked' || publishJob.status === 'failed') {
      return publishJob.errorMessage || `Job ${publishJob.status}.`;
    }
    return `Job ${publishJob.status}.`;
  };

  const deleteUploadedMedia = async mediaAssetIds => {
    await Promise.allSettled(mediaAssetIds.map(mediaAssetId => api.delete(`/api/media/${mediaAssetId}`)));
  };

  const getMediaProcessingDecisions = async () => {
    if (mediaAssets.length === 0 || selectedConnections.length === 0) return {};

    const payload = await api.post('/api/publish/media-plan', {
      mediaItems: mediaAssets.map(asset => ({
        originalName: asset.originalName,
        mimeType: asset.mimeType,
        size: asset.size,
        mediaType: asset.mediaType
      })),
      connectionTargets: selectedConnections.map(connection => ({
        connectionId: connection.platformConnectionId,
        platform: connection.platform
      }))
    });

    const decisions = {};
    for (const target of payload.data.plan.targets || []) {
      const exactOversizedMedia = (target.oversizedMedia || []).filter(item => item.compressionAvailable && item.maxBytes);
      const unknownLimitMedia = (target.oversizedMedia || []).filter(item => item.compressionAvailable && !item.maxBytes);
      if (unknownLimitMedia.length > 0) {
        window.alert([
          `${formatPlatform(target.platform)} ${target.accountHandle ? `(${target.accountHandle}) ` : ''}reported media is too large, but its provider API did not return an exact max byte limit.`,
          'CreatorOps will not compress to a guessed size. Publish may fail until the media is reduced manually or the provider returns an exact max.'
        ].join('\n\n'));
      }

      if (!target.promptForCompression || !target.compressionSupported || exactOversizedMedia.length === 0) continue;

      const promptText = [
        `${formatPlatform(target.platform)} ${target.accountHandle ? `(${target.accountHandle}) ` : ''}provider API says these media files exceed its supported upload size:`,
        exactOversizedMedia
          .map(item => `${item.originalName || 'media'}: selected ${formatBytes(item.size)}, provider max ${formatBytes(item.maxBytes)}`)
          .join('\n'),
        'Allow CreatorOps to create a temporary compressed copy for this platform only, keep it under that provider max size, upload it, and delete that compressed copy after the attempt?'
      ].filter(Boolean).join('\n\n');
      const accepted = window.confirm(promptText);
      decisions[target.targetKey] = {
        compressOnOversize: accepted,
        compressBeforeUpload: accepted
      };
    }

    return decisions;
  };

  const uploadMediaForPublish = async postGroupId => {
    const mediaAssetIds = [];
    const uploadedMediaIds = [];

    try {
      for (const asset of mediaAssets) {
        if (!asset.file) {
          mediaAssetIds.push(asset._id);
          continue;
        }

        const formData = new FormData();
        formData.append('media', asset.file);
        formData.append('storageIntent', 'temporary_publish');
        formData.append('cleanupGroupId', postGroupId);

        const cropMetadata = getCropMetadataForUpload(asset);
        if (cropMetadata) {
          formData.append('cropMetadata', JSON.stringify(cropMetadata));
        }

        const payload = await api.upload('/api/media/upload', formData);
        const mediaAssetId = payload.data.mediaAsset._id;
        mediaAssetIds.push(mediaAssetId);
        uploadedMediaIds.push(mediaAssetId);
      }
    } catch (error) {
      await deleteUploadedMedia(uploadedMediaIds);
      throw error;
    }

    return { mediaAssetIds, uploadedMediaIds };
  };

  const publish = async ({ mode }) => {
    if (!canPublish(user)) {
      setMessage('Your current roles cannot publish from this workspace.');
      return;
    }
    setBusy(mode);
    setMessage('');
    setPublishResults([]);
    try {
      const endpoint = mode === 'now' ? '/api/publish/now' : '/api/publish/schedule';
      const postGroupId = createPostGroupId();
      const mediaProcessingDecisions = await getMediaProcessingDecisions();
      const { mediaAssetIds, uploadedMediaIds } = await uploadMediaForPublish(postGroupId);
      const groupTargetCount = selectedConnections.length;

      const results = await Promise.all(selectedConnections.map(async connection => {
        const platformConnectionId = connection.platformConnectionId || connection._id;
        const customizedForTarget = captions.find(
          item => item.connectionId === platformConnectionId && item.platform === connection.platform
        );
        try {
          const payload = await api.post(endpoint, {
            postGroupId,
            groupTargetCount,
            platformConnectionId,
            targetPlatform: connection.platform,
            mediaAssetIds,
            mediaProcessing: mediaProcessingDecisions[connection.targetKey] || { compressOnOversize: false, compressBeforeUpload: false },
            coverIndex: coverIndex,
            caption: customizedForTarget?.caption || baseCaption,
            visibility,
            scheduledAt: new Date(scheduledAt).toISOString()
          });
          const publishJob = payload.data.publishJob;
          return {
            ok: !['blocked', 'failed'].includes(publishJob?.status),
            platform: connection.platform,
            accountHandle: connection.accountHandle,
            status: publishJob?.status || 'queued',
            jobId: publishJob?._id,
            detail: describePublishJob(publishJob)
          };
        } catch (err) {
          return {
            ok: false,
            platform: connection.platform,
            accountHandle: connection.accountHandle,
            status: 'blocked',
            detail: err.message
          };
        }
      }));
      const acceptedCount = results.filter(result => result.jobId).length;
      if (acceptedCount === 0) {
        await deleteUploadedMedia(uploadedMediaIds);
      }
      setPublishResults(results);
      const successCount = results.filter(result => result.ok).length;
      const action = mode === 'now' ? 'publish' : 'schedule';
      setMessage(`${successCount}/${results.length} ${action} request${results.length === 1 ? '' : 's'} accepted. See per-account results below.`);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <p className="text-sm uppercase tracking-[0.18em] text-mint">Advanced Compose</p>
          <h1 className="mt-2 text-3xl font-bold text-[var(--text)]">Compose & Publish</h1>
          <p className="mt-2 max-w-4xl text-sm text-[var(--muted)]">
            Select multiple media files, manage cover and aspect ratios, customize captions with AI, and intelligently deploy to supported platforms. Media uploads only start when you publish or schedule.
          </p>
          <p className="mt-3 max-w-4xl rounded-xl border border-gold/30 bg-gold/10 p-3 text-sm text-gold">
            Temporary publish media is auto-deleted after {temporaryMediaRetentionLabel} once every platform in the post group is no longer queued or publishing. Retry is unavailable after the media expires.
          </p>
        </header>

        {message && <div className="rounded-xl border border-mint/30 bg-mint/10 p-3 text-sm text-mint">{message}</div>}

        {publishResults.length > 0 && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h2 className="text-sm font-semibold text-[var(--text)]">Publish Results</h2>
            <div className="mt-3 grid gap-2">
              {publishResults.map(result => (
                <div key={`${result.platform}-${result.accountHandle}`} className={`rounded-xl border p-3 text-sm ${result.ok ? 'border-mint/30 bg-mint/10 text-mint' : 'border-rose/30 bg-rose/10 text-rose'}`}>
                  <div className="font-semibold">
                    {formatPlatform(result.platform)} {result.accountHandle ? `- ${result.accountHandle}` : ''} · {result.status}
                  </div>
                  <p className="mt-1 text-xs text-[var(--text)]">{result.detail}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {connections.length === 0 ? (
          <div className="rounded-2xl border border-gold/30 bg-gold/10 p-5 text-sm text-gold">
            Connect real accounts first. <Link href="/accounts" className="underline">Open Accounts</Link>
          </div>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[1fr_420px]">
          {/* LEFT COLUMN: Media Management & Base Text */}
          <div className="space-y-4">
            
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="text-base font-semibold text-[var(--text)]">Media Gallery</h2>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-4 py-2 text-sm text-[var(--text)] hover:border-mint transition">
                  <ImagePlus size={16} />
                  {busy === 'upload' ? 'Selecting...' : 'Add Media'}
                  <input type="file" accept="image/*,video/*" multiple onChange={upload} className="hidden" />
                </label>
              </div>

              {mediaAssets.length > 0 ? (
                <div className="space-y-4">
                  {/* Thumbnail Row */}
                  <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                    {mediaAssets.map((asset, idx) => (
                      <div 
                        key={asset._id} 
                        onClick={() => setActiveMediaIndex(idx)}
                        className={`group relative h-20 w-20 shrink-0 cursor-pointer overflow-hidden rounded-xl border-2 transition-all ${activeMediaIndex === idx ? 'border-mint shadow-md' : 'border-transparent opacity-70 hover:opacity-100'}`}
                      >
                        {asset.mediaType === 'video' ? (
                          <video src={asset.publicUrl} className="h-full w-full object-cover" />
                        ) : (
                          <img src={asset.publicUrl} className="h-full w-full object-cover" />
                        )}
                        {coverIndex === idx && (
                          <div className="absolute left-1 top-1 rounded bg-[#05130d]/80 px-1 text-[10px] font-bold text-mint backdrop-blur">COVER</div>
                        )}
                        <button 
                          onClick={(e) => { e.stopPropagation(); removeMedia(idx); }}
                          className="absolute right-1 top-1 hidden rounded-full bg-rose p-1 text-white shadow group-hover:flex hover:bg-red-600"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Active media controls */}
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface2)] p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-semibold text-[var(--text)]">Edit {activeMediaIndex + 1} of {mediaAssets.length}</div>
                      <div className="flex gap-2">
                        {coverIndex !== activeMediaIndex && (
                          <button onClick={() => setCoverIndex(activeMediaIndex)} className="flex items-center gap-1 rounded border border-gold/30 px-2 py-1 text-xs text-gold hover:bg-gold/10">
                            <LayoutPanelTop size={12} /> Set Cover
                          </button>
                        )}
                        <button onClick={() => removeMedia(activeMediaIndex)} className="flex items-center gap-1 rounded border border-rose/30 px-2 py-1 text-xs text-rose hover:bg-rose/10">
                          <Trash2 size={12} /> Remove
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col items-center gap-6">
                      {/* Big Preview */}
                      <div className="relative h-[400px] w-full max-w-[360px] overflow-hidden rounded-2xl border-2 border-[var(--border)] bg-black/40 shadow-inner group">
                        {activeAsset.mediaType === 'image' ? (
                          <>
                            <Cropper
                              key={`${activeAsset._id}-${activeAsset.mediaType}`}
                              image={activeAsset.publicUrl}
                              crop={activeSettings.crop}
                              zoom={activeSettings.zoom}
                              aspect={getAspectRatioValue(globalAspect)}
                              objectFit={globalAspect === 'original' ? 'contain' : 'cover'}
                              onCropChange={crop => updateActiveSettings({ crop })}
                              onZoomChange={zoom => updateActiveSettings({ zoom })}
                              onCropComplete={handleCropComplete}
                              showGrid={true}
                              style={{ containerStyle: { background: 'transparent' } }}
                            />
                            <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-md rounded-full px-2.5 py-1 flex items-center gap-1.5 text-[10px] font-bold text-mint border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                              <Crop size={12} /> Drag to position image
                            </div>
                          </>
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-black">
                            <video src={activeAsset.publicUrl} className="max-h-full max-w-full object-contain" controls />
                            <div className="absolute top-3 left-3 rounded-full border border-white/10 bg-black/50 px-2.5 py-1 text-[10px] font-bold text-mint backdrop-blur-md">
                              Original video preview - crop disabled
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Controls */}
                      <div className="w-full space-y-6">
                        {activeAsset.mediaType === 'image' ? (
                          <>
                            <div>
                              <label className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-3 block">Image Aspect Ratio</label>
                              <div className="flex flex-wrap gap-2">
                                {aspectOptions.map(option => {
                                  const isActive = globalAspect === option.value;
                                  return (
                                    <button 
                                      key={option.value} 
                                      type="button" 
                                      onClick={() => setGlobalAspect(option.value)} 
                                      className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-300 ${
                                        isActive 
                                          ? 'bg-mint text-[#05130d] shadow-[0_0_15px_rgba(var(--color-mint-rgb),0.3)] border-transparent' 
                                          : 'bg-[var(--surface)] text-[var(--muted)] border border-[var(--border)] hover:bg-[var(--border)] hover:text-[var(--text)]'
                                      }`}
                                    >
                                      {option.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="bg-[var(--surface)] p-4 rounded-2xl border border-[var(--border)] shadow-sm">
                              <div className="flex items-center justify-between mb-3">
                                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text)]">
                                  Zoom Level
                                </label>
                                <span className="text-xs font-medium text-mint bg-mint/10 px-2 py-0.5 rounded-md">
                                  {Math.round(activeSettings.zoom * 100)}%
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-3">
                                <button 
                                  type="button"
                                  onClick={() => updateActiveSettings({ zoom: Math.max(1, activeSettings.zoom - 0.1) })}
                                  className="p-1.5 rounded-full hover:bg-[var(--surface2)] text-[var(--muted)] hover:text-mint transition"
                                >
                                  <ZoomOut size={16} />
                                </button>
                                
                                <input 
                                  type="range" 
                                  min="1" max="3" step="0.1" 
                                  value={activeSettings.zoom} 
                                  onChange={e => updateActiveSettings({ zoom: Number(e.target.value) })} 
                                  className="w-full h-1.5 bg-[var(--surface2)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-mint [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(var(--color-mint-rgb),0.5)] [&::-webkit-slider-thumb]:transition-transform hover:[&::-webkit-slider-thumb]:scale-125" 
                                />
                                
                                <button 
                                  type="button"
                                  onClick={() => updateActiveSettings({ zoom: Math.min(3, activeSettings.zoom + 0.1) })}
                                  className="p-1.5 rounded-full hover:bg-[var(--surface2)] text-[var(--muted)] hover:text-mint transition"
                                >
                                  <ZoomIn size={16} />
                                </button>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-xs text-[var(--muted)]">
                            Video crop and zoom are disabled. The original uploaded video is preserved for real platform upload.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] text-sm text-[var(--muted)]">
                  <ImagePlus size={32} className="mb-2 opacity-50" />
                  <p>Drag & drop or upload media here</p>
                  <p className="text-xs opacity-70">Supports images & videos (multiple allowed)</p>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <h2 className="text-base font-semibold text-[var(--text)] mb-3">Base Content</h2>
              <textarea
                value={baseCaption}
                onChange={event => setBaseCaption(event.target.value)}
                placeholder="Write your main caption, script, or idea here..."
                rows={6}
                className="focus-ring w-full rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 text-sm text-[var(--text)]"
              />
            </div>
          </div>

          {/* RIGHT COLUMN: Platforms, Captions & Publish */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-[var(--text)]">Select Platforms</h2>
                <span className="rounded-full bg-[var(--surface2)] px-2 py-1 text-xs text-[var(--muted)]">{selectedIds.length} selected</span>
              </div>
              
              <div className="grid gap-2 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
                {connections.map(connection => {
                  const eligibility = getPlatformEligibility(connection.platform);
                  const isSelected = selectedIds.includes(connection.targetKey);
                  const platformDetail = getPlatformDetails(connection.platform);
                  return (
                    <div
                      key={connection.targetKey}
                      onClick={() => toggleConnection(connection.targetKey, connection.platform)}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition-all ${
                        !eligibility.eligible 
                          ? 'border-[var(--border)] bg-[var(--surface2)] opacity-50 cursor-not-allowed' 
                          : isSelected 
                            ? 'border-mint bg-mint/5 shadow-sm' 
                            : 'border-[var(--border)] bg-[var(--surface2)] hover:border-[var(--muted)]'
                      }`}
                    >
                      <input 
                        type="checkbox" 
                        checked={isSelected} 
                        readOnly 
                        className="mt-0.5" 
                        disabled={!eligibility.eligible}
                      />
                      <div className="flex-1">
                        <div className={`font-semibold ${isSelected ? 'text-mint' : 'text-[var(--text)]'}`}>
                          {formatPlatform(connection.platform)}
                        </div>
                        <div className="text-xs text-[var(--muted)]">
                          {connection.accountName} · {connection.accountHandle}
                          {connection.isSharedYouTubeConnection ? ' · shared YouTube channel' : ''}
                        </div>
                        <div className="mt-1 text-[10px] text-[var(--muted)]">{platformDetail.contentStyle}</div>
                        {!eligibility.eligible && (
                          <div className="mt-1 flex items-center gap-1 text-[10px] font-medium text-rose">
                            <AlertCircle size={10} /> {eligibility.reason}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                disabled={busy === 'ai' || !baseCaption || selectedIds.length === 0}
                onClick={customizeCaptions}
                className="focus-ring mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-mint px-3 py-2.5 text-sm font-semibold text-[#05130d] transition hover:brightness-110 disabled:opacity-50"
              >
                <Sparkles size={16} />
                {busy === 'ai' ? 'Customizing...' : 'Tailor Captions with AI'}
              </button>
            </div>

            {selectedConnections.length > 0 && (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 max-h-[400px] overflow-y-auto scrollbar-thin">
                <h2 className="text-base font-semibold text-[var(--text)] mb-3">Customized Captions</h2>
                <div className="grid gap-3">
                  {selectedConnections.map(connection => {
                    const customized = captions.find(
                      item => item.connectionId === connection.platformConnectionId && item.platform === connection.platform
                    );
                    const platformDetail = getPlatformDetails(connection.platform);
                    const captionValue = customized?.caption ?? baseCaption;
                    const maxCaptionLength = customized?.maxCaptionLength || getPlatformCaptionLimit(connection.platform);
                    const captionLength = captionValue.length;
                    const captionOverLimit = captionLength > maxCaptionLength;
                    const hashtags = customized?.hashtags || [];
                    const platformNotes = customized?.platformNotes?.length ? customized.platformNotes : [platformDetail.contentStyle, `CTA style: ${platformDetail.ctaStyle}`];
                    return (
                      <article key={connection.targetKey} className="rounded-xl border border-[var(--border)] bg-[var(--surface2)] p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text)]">
                            <span className="h-2 w-2 rounded-full bg-mint"></span>
                            {formatPlatform(connection.platform)}
                          </span>
                          <span className={`text-[10px] ${captionOverLimit ? 'text-rose font-bold' : 'text-[var(--muted)]'}`}>
                            {captionLength}/{maxCaptionLength}
                          </span>
                        </div>
                        <textarea
                          value={captionValue}
                          onChange={event => updateCaption(connection.targetKey, event.target.value)}
                          rows={3}
                          className={`focus-ring w-full rounded-lg border bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--text)] ${captionOverLimit ? 'border-rose focus:border-rose' : 'border-[var(--border)] focus:border-mint'}`}
                        />

                        {customized ? (
                          <div className="mt-2 grid gap-2 text-[10px]">
                            <div className="grid grid-cols-3 gap-2">
                              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 text-[var(--muted)]">
                                Provider
                                <div className="font-semibold text-[var(--text)]">{customized.aiProvider || 'manual'}</div>
                              </div>
                              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 text-[var(--muted)]">
                                Brand
                                <div className="font-semibold text-[var(--text)]">{customized.brandScore ?? 0}/100</div>
                              </div>
                              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 text-[var(--muted)]">
                                Ready
                                <div className="font-semibold text-[var(--text)]">{customized.readinessScore ?? 0}/100</div>
                              </div>
                            </div>

                            {(customized.hook || customized.cta) && (
                              <div className="space-y-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 text-[var(--muted)]">
                                {customized.hook && <p><span className="font-semibold text-[var(--text)]">Hook:</span> {customized.hook}</p>}
                                {customized.cta && <p><span className="font-semibold text-[var(--text)]">CTA:</span> {customized.cta}</p>}
                              </div>
                            )}
                          </div>
                        ) : null}

                        {hashtags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {hashtags.map(tag => (
                              <span key={tag} className="rounded-full border border-mint/20 bg-mint/10 px-2 py-0.5 text-[10px] text-mint">{tag}</span>
                            ))}
                          </div>
                        )}

                        <div className="mt-2 space-y-1 text-[10px] text-[var(--muted)]">
                          {platformNotes.slice(0, 3).map(note => (
                            <p key={note}>{note}</p>
                          ))}
                          {platformDetail.requirements?.length > 0 && (
                            <p>Requires: {platformDetail.requirements.join(', ')}</p>
                          )}
                        </div>

                        {customized?.warnings?.length > 0 && (
                          <div className="mt-1.5 space-y-1 text-[10px] text-gold">
                            {customized.warnings.map(warning => <p key={warning}>Warning: {warning}</p>)}
                          </div>
                        )}
                        {customized?.suggestions?.length > 0 && (
                          <div className="mt-1.5 space-y-1 text-[10px] text-[var(--muted)]">
                            {customized.suggestions.map(suggestion => <p key={suggestion}>Suggestion: {suggestion}</p>)}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <h2 className="text-base font-semibold text-[var(--text)] mb-3">Publish Setup</h2>
              <div className="mb-4">
                <VisibilitySelector value={visibility} onChange={setVisibility} mediaType={mediaAssets[0]?.mediaType || ''} />
              </div>
              <label className="mb-4 block">
                <span className="text-xs text-[var(--muted)]">Scheduled Date & Time</span>
                <input type="datetime-local" value={scheduledAt} onChange={event => setScheduledAt(event.target.value)} className="focus-ring mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 text-sm text-[var(--text)]" />
              </label>
              <div className="grid gap-2">
                <button type="button" disabled={busy === 'now' || selectedIds.length === 0 || (!baseCaption && mediaAssets.length === 0)} onClick={() => publish({ mode: 'now' })} className="focus-ring flex items-center justify-center gap-2 rounded-xl bg-mint px-3 py-2.5 text-sm font-semibold text-[#05130d] transition hover:brightness-110 disabled:opacity-50">
                  <Send size={15} /> Publish Now
                </button>
                <button type="button" disabled={busy === 'schedule' || selectedIds.length === 0 || (!baseCaption && mediaAssets.length === 0)} onClick={() => publish({ mode: 'schedule' })} className="focus-ring flex items-center justify-center gap-2 rounded-xl border border-mint text-mint px-3 py-2.5 text-sm font-semibold hover:bg-mint/10 transition disabled:opacity-50">
                  <CalendarClock size={15} /> Schedule Later
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
