import type { Metadata } from 'next';
import Workspace from '../workspace';
export const metadata: Metadata = {
  title: 'Your workspace | EventDeskly',
  robots: { index: false, follow: false },
};
export default function AppPage() {
  return <Workspace />;
}
