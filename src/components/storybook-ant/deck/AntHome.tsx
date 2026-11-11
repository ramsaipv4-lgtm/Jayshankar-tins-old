// AntHome — the deck's front page, built as an Ant Design dashboard rather than a list of links.
//
// The shared deck's index is six headings over a grid of text cards. Here the index does what an Ant
// "overview" page does: it gives the headline numbers (Statistic), lets the reader narrow the set
// (Input.Search, Segmented, Tabs by group), shows what is inside each chapter instead of describing it
// (every card's cover is a live, scaled render of that chapter's first screen), and teaches the deck
// with a guided Tour instead of a paragraph of instructions.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Collapse,
  Empty,
  Flex,
  Input,
  Row,
  Segmented,
  Skeleton,
  Space,
  Statistic,
  Tabs,
  Tag,
  Tour,
  Typography,
  theme,
  type TourProps,
} from 'antd';
import { CompassOutlined, DesktopOutlined, MobileOutlined, PlayCircleOutlined, RightOutlined } from '@ant-design/icons';

import { CHAPTERS } from '@/lib/storybook/chapters';
import { GROUP_META, GROUP_ORDER, type Chapter, type ChapterGroup } from '@/lib/storybook/types';
import { ANT_HEX, ANT_TAG_COLOR } from '../ant-tokens';
import AntScreen, { FRAME_DIMENSIONS } from './AntScreen';
import ScaledFrame from './ScaledFrame';

type LayoutFilter = 'all' | 'phone' | 'desktop';

const TOTAL_SCREENS = CHAPTERS.reduce((sum, c) => sum + c.steps.length, 0);
const COVER_HEIGHT = 196;

export default function AntHome({
  onOpen,
  tailwindDeck,
}: {
  onOpen: (id: string) => void;
  /** Deck 1's published URL, for the side-by-side. */
  tailwindDeck: string;
}) {
  const { token } = theme.useToken();
  const [query, setQuery] = useState('');
  const [layout, setLayout] = useState<LayoutFilter>('all');
  const [group, setGroup] = useState<'all' | ChapterGroup>('journeys');
  const [touring, setTouring] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const matches = (c: Chapter) => {
    const q = query.trim().toLowerCase();
    const text = `${c.number} ${c.title} ${c.subtitle} ${c.tag}`.toLowerCase();
    return (
      (layout === 'all' || (c.layout === 'desktop' ? 'desktop' : 'phone') === layout) &&
      (q === '' || text.includes(q))
    );
  };

  const visible = useMemo(
    () => CHAPTERS.filter(matches).filter((c) => group === 'all' || c.group === group),
    // `matches` closes over query/layout, which are the real inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, layout, group],
  );
  const countFor = (g: 'all' | ChapterGroup) => CHAPTERS.filter(matches).filter((c) => g === 'all' || c.group === g).length;

  const tourSteps: TourProps['steps'] = [
    {
      title: 'Find a chapter',
      description: 'Search by title or number, or show only the phone screens or only the desktop panels.',
      target: () => searchRef.current as HTMLElement,
    },
    {
      title: 'Browse by group',
      description: 'The 32 chapters are grouped the way the business runs: the daily spine, containers, quality, money, people, and the procurement desk.',
      target: () => tabsRef.current as HTMLElement,
    },
    {
      title: 'Open any chapter',
      description: 'Each card previews the chapter’s first screen. Open one to flip through its steps.',
      target: () => gridRef.current as HTMLElement,
    },
    {
      title: 'Inside a chapter',
      description: 'Tap or click the screen itself to enlarge it. Press Play to watch a chapter run on its own, or click a step to jump. Feedback can name the chapter and step — “chapter 3, step 2”.',
    },
  ];

  return (
    <Flex vertical gap={24}>
      {/* ---- hero: what this is, the headline numbers, the two ways in ---------------------------- */}
      <Card
        variant="borderless"
        styles={{ body: { padding: 28 } }}
        style={{ background: `linear-gradient(135deg, ${token.colorPrimaryBg} 0%, ${token.colorBgContainer} 70%)` }}
      >
        <Row gutter={[24, 24]} align="middle">
          <Col xs={24} lg={14}>
            <Typography.Title level={2} style={{ marginTop: 0 }}>
              The workflow, page by page
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ fontSize: 15, marginBottom: 20 }}>
              Every screen of the fish business, drawn from the client’s own reference decks — this time as an
              Ant Design workbench. Pick a person and walk their day on the device they actually use, or open any
              chapter and flip through it.
            </Typography.Paragraph>
            <Space wrap>
              <Button type="primary" size="large" icon={<PlayCircleOutlined />} onClick={() => setGroup('journeys')}>
                Walk it as someone
              </Button>
              <Button size="large" onClick={() => onOpen(CHAPTERS.find((c) => c.group !== 'journeys')!.id)}>
                Start at chapter 1
              </Button>
              <Button size="large" icon={<CompassOutlined />} onClick={() => setTouring(true)}>
                Take a 30-second tour
              </Button>
            </Space>
          </Col>
          <Col xs={24} lg={10}>
            <Row gutter={[12, 12]}>
              {[
                { title: 'Chapters', value: CHAPTERS.length },
                { title: 'Screens', value: TOTAL_SCREENS },
                { title: 'Groups', value: GROUP_ORDER.length },
              ].map((s) => (
                <Col key={s.title} span={8}>
                  <Card size="small" variant="borderless" styles={{ body: { padding: 14 } }}>
                    <Statistic title={s.title} value={s.value} styles={{ content: { fontWeight: 700 } }} />
                  </Card>
                </Col>
              ))}
            </Row>
          </Col>
        </Row>
      </Card>

      <Alert
        type="info"
        showIcon
        title="Every figure here is a sample"
        description="Nothing on this deck reads the database, and no screen is wired to a route. It is a design proposal, not the working app."
      />

      {/* ---- finder: search + layout filter + group tabs --------------------------------------------- */}
      <Flex vertical gap={4}>
        <div ref={searchRef}>
          <Flex gap={12} wrap align="center">
            <Input.Search
              allowClear
              placeholder="Search chapters — try “receiving” or “QR”"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ maxWidth: 420, flex: '1 1 260px' }}
            />
            <Segmented<LayoutFilter>
              value={layout}
              onChange={setLayout}
              options={[
                { label: 'All screens', value: 'all' },
                { label: <Space size={4}><MobileOutlined />Phone</Space>, value: 'phone' },
                { label: <Space size={4}><DesktopOutlined />Desktop</Space>, value: 'desktop' },
              ]}
            />
          </Flex>
        </div>
        <div ref={tabsRef}>
          <Tabs
            activeKey={group}
            onChange={(k) => setGroup(k as 'all' | ChapterGroup)}
            items={[
              { key: 'all', label: <Space size={6}>All<Badge count={countFor('all')} color="#8c8c8c" showZero /></Space> },
              ...GROUP_ORDER.map((g) => ({
                key: g,
                label: (
                  <Space size={6}>
                    {GROUP_META[g].label}
                    <Badge count={countFor(g)} color={ANT_HEX[GROUP_META[g].tone]} showZero />
                  </Space>
                ),
              })),
            ]}
          />
        </div>
        {group !== 'all' && (
          <Typography.Text type="secondary" style={{ marginTop: -4 }}>
            {GROUP_META[group].blurb}
          </Typography.Text>
        )}
      </Flex>

      {/* ---- the chapters --------------------------------------------------------------------------- */}
      <div ref={gridRef}>
        {visible.length === 0 ? (
          <Empty description="No chapter matches that search" style={{ padding: 40 }}>
            <Button onClick={() => { setQuery(''); setLayout('all'); setGroup('all'); }}>Clear filters</Button>
          </Empty>
        ) : (
          <Row gutter={[16, 16]}>
            {visible.map((c) => (
              <Col key={c.id} xs={24} sm={12} xl={8}>
                <ChapterCard chapter={c} onOpen={() => onOpen(c.id)} />
              </Col>
            ))}
          </Row>
        )}
      </div>

      <Collapse
        ghost
        items={[
          {
            key: 'how',
            label: <Typography.Text strong>How to read this deck</Typography.Text>,
            children: (
              <Typography.Paragraph style={{ marginBottom: 0 }}>
                Every screen is a design proposal, not the working app — the figures are samples. Chapters and steps
                are numbered, so feedback can be given as “chapter 3, step 2” and it will be unambiguous. This is the{' '}
                <strong>same chapter data</strong> as the Tailwind deck you may already have seen, presented through
                Ant Design’s own patterns; comparing them side by side at{' '}
                <Typography.Link href={tailwindDeck} target="_blank" rel="noreferrer">
                  the Tailwind version
                </Typography.Link>{' '}
                is the point.
              </Typography.Paragraph>
            ),
          },
          {
            key: 'real',
            label: <Typography.Text strong>What would make these screens real</Typography.Text>,
            children: (
              <Typography.Paragraph style={{ marginBottom: 0 }}>
                This deck is a design artifact. What each screen would need in order to work for real is written down
                in <Typography.Text code>docs/BACKEND-REQUIREMENTS-phase-b.md</Typography.Text>. Once the client locks
                the flow, these same chapters become the spec for the real build.
              </Typography.Paragraph>
            ),
          },
        ]}
      />

      <Tour open={touring} onClose={() => setTouring(false)} steps={tourSteps} />
    </Flex>
  );
}

/* ------------------------------------------------------------------------------------------------
   One chapter card: a live preview of its first screen as the cover, then title, subtitle and facts.
------------------------------------------------------------------------------------------------ */

function ChapterCard({ chapter, onOpen }: { chapter: Chapter; onOpen: () => void }) {
  const meta = GROUP_META[chapter.group];
  const accent = ANT_HEX[meta.tone];
  const layout = chapter.layout === 'desktop' ? 'desktop' : 'phone';
  const size = FRAME_DIMENSIONS[layout];

  return (
    <Badge.Ribbon text={`#${chapter.number}`} color={accent}>
      <Card
        hoverable
        variant="outlined"
        onClick={onOpen}
        style={{ height: '100%' }}
        styles={{ body: { padding: 16 } }}
        cover={
          <div
            style={{
              height: COVER_HEIGHT,
              display: 'grid',
              placeItems: 'center',
              overflow: 'hidden',
              background: `linear-gradient(160deg, ${accent}24, ${accent}08)`,
            }}
          >
            <LazyMount placeholder={<Skeleton.Node active style={{ width: 96, height: 150 }}>{null}</Skeleton.Node>}>
              {/* A preview, not a control: the card is the control. */}
              <div aria-hidden="true" style={{ width: '100%', pointerEvents: 'none' }}>
                <ScaledFrame width={size.width} height={size.height} maxHeight={COVER_HEIGHT - 24}>
                  <AntScreen layout={layout} screen={chapter.steps[0].screen} />
                </ScaledFrame>
              </div>
            </LazyMount>
          </div>
        }
      >
        <Flex vertical gap={8}>
          <Typography.Text strong style={{ fontSize: 15 }}>
            {chapter.title}
          </Typography.Text>
          <Typography.Paragraph type="secondary" style={{ margin: 0, minHeight: 44 }} ellipsis={{ rows: 2 }}>
            {chapter.subtitle}
          </Typography.Paragraph>
          <Flex justify="space-between" align="center">
            <Space size={6}>
              <Tag color={ANT_TAG_COLOR[meta.tone]} style={{ marginInlineEnd: 0 }}>
                {chapter.steps.length} steps
              </Tag>
              <Tag icon={layout === 'desktop' ? <DesktopOutlined /> : <MobileOutlined />} style={{ marginInlineEnd: 0 }}>
                {layout === 'desktop' ? 'Desktop' : 'Phone'}
              </Tag>
            </Space>
            <RightOutlined style={{ color: accent }} />
          </Flex>
        </Flex>
      </Card>
    </Badge.Ribbon>
  );
}

/**
 * Renders its children only once scrolled near the viewport. Thirty-two cards each draw a full device
 * frame; deferring the off-screen ones keeps the first paint fast on a phone.
 */
function LazyMount({ children, placeholder }: { children: ReactNode; placeholder: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    const el = ref.current;
    if (shown || !el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: '240px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown]);

  return (
    <div ref={ref} style={{ width: '100%', display: 'grid', placeItems: 'center' }}>
      {shown ? children : placeholder}
    </div>
  );
}
