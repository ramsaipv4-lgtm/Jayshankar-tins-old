// AntScreen — one step's screen, drawn inside the right Ant device frame.
//
// The device frame and the blocks inside it are the "app" the client is judging, so they stay the same
// whatever the deck's own chrome is doing. Two consequences:
//   1. The frame sits in its OWN ConfigProvider with `inherit: false` and the original light tokens,
//      so switching the deck to dark mode darkens the workbench around the screen but never the
//      screen itself. A dark-mode "app" would be a different design, not a different viewing mode.
//   2. Sizes come from ant-tokens / DesktopFrame, so ScaledFrame can be told exactly how big it is.

import { ConfigProvider } from 'antd';

import type { ScreenSpec } from '@/lib/storybook/types';
import { DESKTOP_HEIGHT, DESKTOP_WIDTH } from '@/components/storybook/DesktopFrame';
import { ANT_PHONE_HEIGHT, ANT_PHONE_WIDTH, antTheme } from '../ant-tokens';
import PhoneScreen from '../mock/phone';
import DesktopScreen from '../mock/desktop';

export type DeckLayout = 'phone' | 'desktop';

/** The natural size of each device, for ScaledFrame. */
export const FRAME_DIMENSIONS: Record<DeckLayout, { width: number; height: number }> = {
  phone: { width: ANT_PHONE_WIDTH, height: ANT_PHONE_HEIGHT },
  desktop: { width: DESKTOP_WIDTH, height: DESKTOP_HEIGHT },
};

export default function AntScreen({ layout, screen }: { layout: DeckLayout; screen: ScreenSpec }) {
  return (
    <ConfigProvider theme={{ ...antTheme, inherit: false }}>
      {layout === 'desktop' ? <DesktopScreen screen={screen} /> : <PhoneScreen screen={screen} />}
    </ConfigProvider>
  );
}
