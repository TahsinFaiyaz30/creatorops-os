import SiteNavbar from '../components/marketing/site-navbar';
import HeroSection from '../components/marketing/hero-section';
import {
  SocialProof,
  ShowcaseScroll,
} from '../components/marketing/feature-sections';
import {
  WorkflowTimeline,
  GlobalReach,
  SiteFooter,
} from '../components/marketing/story-sections';

export default function HomePage() {
  /* `dark` is set explicitly: ThemeProvider only adds it in a mount effect, so
     without it every Aceternity `dark:` variant would render light on first paint. */
  return (
    <main className="min-h-screen bg-[var(--bg)]">
      <SiteNavbar />
      <HeroSection />
      <SocialProof />
      <ShowcaseScroll />
      <WorkflowTimeline />
      <GlobalReach />
      <SiteFooter />
    </main>
  );
}
