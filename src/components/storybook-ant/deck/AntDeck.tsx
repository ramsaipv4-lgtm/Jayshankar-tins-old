// AntDeck — the Ant Design review deck as a whole: header, navigation, and the two pages.
//
// This replaces "ChapterPlayer with an Ant surface" as deck 2's experience. The two decks still share
// everything that is DATA — the 32 chapters, their steps, captions and screens, and the device-frame
// drawings — but deck 2's shell is built from Ant's own patterns (Layout/Sider/Menu/Drawer, Breadcrumb,
// Steps, Modal, Tour, Tabs, Statistic, Segmented, dark algorithm), because the question the client is
// answering (D67) is "what would the app feel like in Ant Design", not "what do Ant buttons look like".
//
// Deep links are unchanged: `#/review?c=<chapter id>&s=<step>`, so every link already sent still works.
//
// antd is imported here and under components/storybook-ant/ only — never by the app (D67 is open).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ConfigProvider, Drawer, Dropdown, Flex, Layout, Switch, Tag, Typography, Button, theme, type ThemeConfig } from 'antd';
import { MenuOutlined, MoonOutlined, SunOutlined, SwapOutlined } from '@ant-design/icons';

import { CHAPTERS } from '@/lib/storybook/chapters';
import { DECKS, compareHref, deckHref } from '@/lib/storybook/decks';
import { ANT_PRIMARY } from '../ant-tokens';
import AntChapterView from './AntChapterView';
import AntScreen, { FRAME_DIMENSIONS } from './AntScreen';
import ScaledFrame from './ScaledFrame';
import AntHome from './AntHome';
import AntNav from './AntNav';
import { useIsNarrow, usePersistedFlag } from './hooks';

const HEADER_HEIGHT = 56;
const SIDER_WIDTH = 300;

/** The workbench's own theme. The device frames carry their own (light) theme — see AntScreen. */
function shellTheme(dark: boolean): ThemeConfig {
  return {
    algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: { colorPrimary: ANT_PRIMARY, borderRadius: 10, fontSize: 14, wireframe: false },
    components: { Layout: { headerHeight: HEADER_HEIGHT, headerPadding: '0 16px' } },
  };
}

export default function AntDeck({ tailwindDeck }: { tailwindDeck?: string }) {
  const [dark, setDark] = usePersistedFlag('jayshankar-ant-dark', false);
  return (
    <ConfigProvider theme={shellTheme(dark)}>
      <DeckBody dark={dark} setDark={setDark} tailwindDeck={tailwindDeck} />
    </ConfigProvider>
  );
}

function DeckBody({ dark, setDark, tailwindDeck }: { dark: boolean; setDark: (v: boolean) => void; tailwindDeck?: string }) {
  const { token } = theme.useToken();
  const narrow = useIsNarrow();
  const [params, setParams] = useSearchParams();
  const [navOpen, setNavOpen] = useState(false);

  const chapterId = params.get('c');
  const chapter = useMemo(() => CHAPTERS.find((c) => c.id === chapterId) ?? null, [chapterId]);
  const stepParam = Number(params.get('s') ?? '0');
  const stepIndex = chapter ? Math.min(Math.max(Number.isFinite(stepParam) ? stepParam : 0, 0), chapter.steps.length - 1) : 0;

  const openChapter = useCallback(
    (id: string | null) => {
      setParams(id ? { c: id, s: '0' } : {});
      setNavOpen(false);
    },
    [setParams],
  );
  const goToStep = useCallback(
    (next: number) => {
      if (!chapter) return;
      setParams({ c: chapter.id, s: String(Math.min(Math.max(next, 0), chapter.steps.length - 1)) });
    },
    [chapter, setParams],
  );

  // The page background follows the theme (antd styles components, not <body>), and a new chapter or
  // the home page always starts at the top.
  useEffect(() => {
    document.body.style.background = token.colorBgLayout;
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  }, [token.colorBgLayout, dark]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [chapterId]);

  const showSider = !!chapter && !narrow;
  const embed = params.get('embed') === '1';

  // Compare page: just the device and its caption — no header, sider, steps or controls.
  if (embed && chapter) {
    const layout = chapter.layout ?? 'phone';
    const size = FRAME_DIMENSIONS[layout];
    return (
      <div style={{ padding: 8, background: 'transparent' }}>
        <ScaledFrame width={size.width} height={size.height} maxHeight={layout === 'phone' ? 640 : undefined}>
          <AntScreen layout={layout} screen={chapter.steps[stepIndex].screen} />
        </ScaledFrame>
        <Typography.Paragraph style={{ textAlign: 'center', margin: '8px 4px 0', fontSize: 13 }} type="secondary">
          {chapter.steps[stepIndex].caption}
        </Typography.Paragraph>
      </div>
    );
  }

  return (
    // hasSider is explicit on every Layout here. antd otherwise auto-detects a Sider by letting any
    // descendant Sider register with its NEAREST Layout — and the desktop device frame draws a Sider of
    // its own, which once flipped the whole page into a row layout (decision 95).
    <Layout hasSider={false} style={{ minHeight: '100vh', background: 'transparent' }}>
      <Layout.Header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 30,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          lineHeight: `${HEADER_HEIGHT}px`,
        }}
      >
        {narrow && chapter && <Button type="text" icon={<MenuOutlined />} aria-label="Chapters" onClick={() => setNavOpen(true)} />}
        <a onClick={() => openChapter(null)} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <Typography.Text strong style={{ fontSize: 16, letterSpacing: 1.4, whiteSpace: 'nowrap' }}>
            JAYSHANKAR
          </Typography.Text>
          {!narrow && <Typography.Text type="secondary">Workflow review</Typography.Text>}
        </a>
        <Tag color="blue" style={{ marginInlineEnd: 0, fontWeight: 700, whiteSpace: 'nowrap' }}>
          Ant Design 6
        </Tag>
        <Flex gap={12} align="center" style={{ marginInlineStart: 'auto' }}>
          {/* The same screen in the other looks — or all three side by side. */}
          <Dropdown
            menu={{
              items: [
                { key: 'tw', label: <a href={chapter ? deckHref('tailwind', chapter.id, stepIndex) : (tailwindDeck ?? DECKS.tailwind.url)}>{DECKS.tailwind.short} deck</a> },
                { key: 'run', label: <a href={deckHref('run', chapter?.id ?? null, stepIndex)}>{DECKS.run.short} deck</a> },
                { type: 'divider' },
                { key: 'cmp', label: <a href={compareHref(chapter?.id ?? null, stepIndex)}>Compare all three side by side</a> },
              ],
            }}
          >
            <Button type="link" icon={<SwapOutlined />}>{narrow ? 'Looks' : 'Same screen in…'}</Button>
          </Dropdown>
          <Switch
            checked={dark}
            onChange={setDark}
            checkedChildren={<MoonOutlined />}
            unCheckedChildren={<SunOutlined />}
            aria-label="Dark mode"
          />
        </Flex>
      </Layout.Header>

      <Layout hasSider={showSider} style={{ background: 'transparent' }}>
        {showSider && (
          <Layout.Sider
            width={SIDER_WIDTH}
            theme={dark ? 'dark' : 'light'}
            style={{
              position: 'sticky',
              top: HEADER_HEIGHT,
              height: `calc(100vh - ${HEADER_HEIGHT}px)`,
              overflow: 'auto',
              borderInlineEnd: `1px solid ${token.colorBorderSecondary}`,
              background: token.colorBgContainer,
            }}
          >
            <AntNav selected={chapter?.id} onSelect={openChapter} />
          </Layout.Sider>
        )}
        <Layout.Content style={{ padding: narrow ? 12 : 24, minWidth: 0 }}>
          <div style={{ maxWidth: 1240, margin: '0 auto' }}>
            {chapter ? (
              <AntChapterView
                key={chapter.id}
                chapter={chapter}
                stepIndex={stepIndex}
                onStep={goToStep}
                onExit={() => openChapter(null)}
                onOpenChapter={openChapter}
                narrow={narrow}
              />
            ) : (
              <AntHome onOpen={openChapter} tailwindDeck={tailwindDeck ?? DECKS.tailwind.url} />
            )}
          </div>
        </Layout.Content>
      </Layout>

      {!chapter && (
        <Layout.Footer style={{ background: 'transparent', textAlign: 'center' }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Design proposal · sample data · Ant Design 6
          </Typography.Text>
        </Layout.Footer>
      )}

      <Drawer open={navOpen} onClose={() => setNavOpen(false)} placement="left" size={320} title="Chapters" styles={{ body: { padding: 0 } }}>
        <AntNav selected={chapter?.id} onSelect={openChapter} />
      </Drawer>
    </Layout>
  );
}
