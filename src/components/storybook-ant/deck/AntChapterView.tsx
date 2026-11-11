// AntChapterView — one chapter, laid out the way an Ant Design product would lay it out.
//
// WHAT CHANGED FROM THE SHARED PLAYER, AND WHY: deck 1's player is a vertical stack — header, a phone,
// a caption, a row of buttons, a filmstrip. Re-drawing its buttons in Ant would still be that player.
// This view re-thinks the *structure* using the components Ant is built around:
//   • Breadcrumb + chapter header with Prev/Next chapter, so the 32 chapters read as one navigable set;
//   • the screen on a stage Card — the screen itself is the tap target for the lightbox;
//   • a Steps walk-through (clickable) instead of a caption line plus dot strip plus filmstrip: the
//     captions are the story, so they are laid out as the story, all visible at once;
//   • transport controls as a Space.Compact group with a Progress clock for autoplay;
//   • on a phone, those controls move to a sticky bottom bar within thumb reach.
// The data (chapters, steps, captions, screens) is exactly the shared deck's.

import { useCallback, useEffect, useState } from 'react';
import {
  Avatar,
  Breadcrumb,
  Button,
  Card,
  Col,
  Flex,
  Progress,
  Row,
  Space,
  Steps,
  Tag,
  Tooltip,
  Typography,
  theme,
} from 'antd';
import {
  CaretRightOutlined,
  DesktopOutlined,
  ExpandOutlined,
  LeftOutlined,
  MobileOutlined,
  PauseOutlined,
  ReloadOutlined,
  RightOutlined,
  StepBackwardOutlined,
  StepForwardOutlined,
} from '@ant-design/icons';

import { CHAPTERS } from '@/lib/storybook/chapters';
import { GROUP_META, type Chapter } from '@/lib/storybook/types';
import { ANT_HEX, ANT_TAG_COLOR } from '../ant-tokens';
import AntScreen, { FRAME_DIMENSIONS } from './AntScreen';
import Lightbox from './Lightbox';
import ScaledFrame from './ScaledFrame';
import { useAutoplay } from './hooks';

export interface AntChapterViewProps {
  chapter: Chapter;
  stepIndex: number;
  onStep: (index: number) => void;
  onExit: () => void;
  onOpenChapter: (id: string) => void;
  narrow: boolean;
}

export default function AntChapterView({ chapter, stepIndex, onStep, onExit, onOpenChapter, narrow }: AntChapterViewProps) {
  const { token } = theme.useToken();
  const layout = chapter.layout === 'desktop' ? 'desktop' : 'phone';
  const meta = GROUP_META[chapter.group];
  const accent = ANT_HEX[meta.tone];
  const last = chapter.steps.length - 1;
  const step = chapter.steps[stepIndex];

  const [playing, setPlaying] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  // Chapters are sorted by number, so the neighbours in the array are the neighbours in the deck.
  const at = CHAPTERS.findIndex((c) => c.id === chapter.id);
  const prevChapter = at > 0 ? CHAPTERS[at - 1] : null;
  const nextChapter = at >= 0 && at < CHAPTERS.length - 1 ? CHAPTERS[at + 1] : null;

  // A different chapter is a fresh start: stop the clock and close the lightbox.
  useEffect(() => {
    setPlaying(false);
    setZoomed(false);
  }, [chapter.id]);

  const next = useCallback(() => {
    if (stepIndex < last) onStep(stepIndex + 1);
    else setPlaying(false);
  }, [stepIndex, last, onStep]);
  const prev = useCallback(() => {
    if (stepIndex > 0) onStep(stepIndex - 1);
  }, [stepIndex, onStep]);
  const restart = useCallback(() => {
    onStep(0);
    setPlaying(true);
  }, [onStep]);
  const togglePlay = useCallback(() => {
    if (stepIndex === last && !playing) restart();
    else setPlaying((p) => !p);
  }, [stepIndex, last, playing, restart]);

  const progress = useAutoplay(playing, stepIndex, next);

  // Keyboard: arrows flip, space plays, E enlarges. Escape belongs to the lightbox while it is open
  // (the Modal closes itself); with it shut, Escape leaves the chapter.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (e.key === 'ArrowRight') { setPlaying(false); next(); }
      else if (e.key === 'ArrowLeft') { setPlaying(false); prev(); }
      else if (e.key === ' ' && !zoomed) { e.preventDefault(); togglePlay(); }
      else if ((e.key === 'e' || e.key === 'E') && !e.metaKey && !e.ctrlKey) setZoomed((z) => !z);
      else if (e.key === 'Escape' && !zoomed) onExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, togglePlay, onExit, zoomed]);

  const jump = (i: number) => {
    setPlaying(false);
    onStep(i);
  };

  const size = FRAME_DIMENSIONS[layout];

  const controls = (
    <Controls
      playing={playing}
      progress={progress}
      atStart={stepIndex === 0}
      atEnd={stepIndex === last}
      onPrev={() => { setPlaying(false); prev(); }}
      onNext={() => { setPlaying(false); next(); }}
      onToggle={togglePlay}
      onRestart={restart}
      block={narrow}
    />
  );

  // ---- the stage: the screen, on a dotted backdrop, and the whole thing is the enlarge button ---------
  const stage = (
    <Card
      variant="borderless"
      title={
        <Space size={8} wrap>
          <Tag color={ANT_TAG_COLOR[meta.tone]} style={{ marginInlineEnd: 0, fontWeight: 700 }}>
            Step {stepIndex + 1} / {chapter.steps.length}
          </Tag>
          <Tag icon={layout === 'desktop' ? <DesktopOutlined /> : <MobileOutlined />} style={{ marginInlineEnd: 0 }}>
            {layout === 'desktop' ? 'Desktop' : 'Phone'}
          </Tag>
        </Space>
      }
      extra={
        <Tooltip title="Enlarge (E)">
          <Button icon={<ExpandOutlined />} onClick={() => setZoomed(true)}>
            {narrow ? null : 'Enlarge'}
          </Button>
        </Tooltip>
      }
      styles={{ body: { padding: narrow ? 12 : 20 } }}
    >
      <div
        style={{
          borderRadius: token.borderRadiusLG,
          padding: narrow ? 12 : 24,
          background: token.colorFillQuaternary,
          backgroundImage: `radial-gradient(${token.colorBorder} 1px, transparent 1px)`,
          backgroundSize: '18px 18px',
        }}
      >
        <div
          key={`${chapter.id}-${stepIndex}`}
          className="sba-enter"
          role="button"
          tabIndex={0}
          aria-label={`Enlarge step ${stepIndex + 1}: ${step.caption}`}
          onClick={() => setZoomed(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setZoomed(true);
          }}
          style={{ cursor: 'zoom-in', borderRadius: 24 }}
        >
          <ScaledFrame width={size.width} height={size.height} maxHeight={layout === 'phone' ? 640 : undefined}>
            <AntScreen layout={layout} screen={step.screen} />
          </ScaledFrame>
        </div>
      </div>
      <Typography.Text type="secondary" style={{ display: 'block', textAlign: 'center', marginTop: 10, fontSize: 12 }}>
        {narrow ? 'Tap the screen to enlarge' : 'Click the screen to enlarge · ← → to flip · space to play'}
      </Typography.Text>
    </Card>
  );

  // ---- the story: every caption, in order, as clickable steps ------------------------------------------
  const story = (
    <Card
      variant="borderless"
      title="Walk-through"
      extra={<Tag style={{ marginInlineEnd: 0 }}>{chapter.steps.length} steps</Tag>}
      styles={{ body: { padding: narrow ? 14 : 20 } }}
    >
      {narrow ? (
        <>
          <Steps
            size="small"
            current={stepIndex}
            onChange={jump}
            items={chapter.steps.map((_, i) => ({ title: `Step ${i + 1}` }))}
          />
          <Typography.Paragraph key={stepIndex} className="sba-enter" style={{ margin: '14px 0 0', fontSize: 15 }}>
            {step.caption}
          </Typography.Paragraph>
        </>
      ) : (
        <Steps
          orientation={layout === 'desktop' && !narrow ? 'horizontal' : 'vertical'}
          size="small"
          current={stepIndex}
          onChange={jump}
          items={chapter.steps.map((s, i) => ({ title: `Step ${i + 1}`, content: s.caption }))}
        />
      )}
      {!narrow && <div style={{ marginTop: 20 }}>{controls}</div>}
    </Card>
  );

  return (
    <Flex vertical gap={16} style={{ paddingBottom: narrow ? 72 : 0 }}>
      <Breadcrumb
        items={[
          { title: <a onClick={onExit}>All chapters</a> },
          { title: meta.label },
          { title: `${chapter.number}. ${chapter.title}` },
        ]}
      />

      <Flex justify="space-between" align="flex-start" gap={12} wrap>
        <Flex gap={12} align="center" style={{ minWidth: 0 }}>
          <Avatar size={narrow ? 36 : 44} style={{ background: accent, fontWeight: 800, flex: 'none' }}>
            {chapter.number}
          </Avatar>
          <div style={{ minWidth: 0 }}>
            <Typography.Title level={narrow ? 4 : 3} style={{ margin: 0 }}>
              {chapter.title}
            </Typography.Title>
            <Typography.Text type="secondary">{chapter.subtitle}</Typography.Text>
          </div>
        </Flex>
        <Space.Compact>
          <Button icon={<LeftOutlined />} disabled={!prevChapter} onClick={() => prevChapter && onOpenChapter(prevChapter.id)}>
            {narrow ? null : 'Previous chapter'}
          </Button>
          <Button disabled={!nextChapter} onClick={() => nextChapter && onOpenChapter(nextChapter.id)}>
            {narrow ? null : 'Next chapter'} <RightOutlined />
          </Button>
        </Space.Compact>
      </Flex>

      {layout === 'desktop' || narrow ? (
        <Flex vertical gap={16}>
          {stage}
          {story}
        </Flex>
      ) : (
        <Row gutter={[20, 20]} align="top">
          <Col lg={11} xl={10}>
            {stage}
          </Col>
          <Col lg={13} xl={14}>
            {story}
          </Col>
        </Row>
      )}

      {nextChapter && (
        <Card variant="outlined" styles={{ body: { padding: 14 } }}>
          <Flex justify="space-between" align="center" gap={12} wrap>
            <Typography.Text type="secondary">
              Up next · {nextChapter.number}. {nextChapter.title}
            </Typography.Text>
            <Button type="primary" onClick={() => onOpenChapter(nextChapter.id)}>
              Continue <RightOutlined />
            </Button>
          </Flex>
        </Card>
      )}

      {/* Phone: the transport controls live in a sticky bar at the bottom edge, in thumb reach. */}
      {narrow && (
        <div
          style={{
            position: 'fixed',
            insetInline: 0,
            bottom: 0,
            zIndex: 20,
            padding: '10px 12px calc(10px + env(safe-area-inset-bottom))',
            background: token.colorBgContainer,
            borderTop: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          {controls}
        </div>
      )}

      <Lightbox open={zoomed} onClose={() => setZoomed(false)} chapter={chapter} stepIndex={stepIndex} onStep={jump} narrow={narrow} />
    </Flex>
  );
}

/* ------------------------------------------------------------------------------------------------
   Transport controls: previous / play / next as one group, restart beside it, and the autoplay clock.
------------------------------------------------------------------------------------------------ */

function Controls({
  playing,
  progress,
  atStart,
  atEnd,
  onPrev,
  onNext,
  onToggle,
  onRestart,
  block,
}: {
  playing: boolean;
  progress: number;
  atStart: boolean;
  atEnd: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToggle: () => void;
  onRestart: () => void;
  block: boolean;
}) {
  return (
    <Flex vertical gap={10}>
      <Flex gap={8} align="center">
        <Space.Compact block={block} style={{ flex: block ? 1 : undefined }}>
          <Button icon={<StepBackwardOutlined />} disabled={atStart} onClick={onPrev} aria-label="Previous step" />
          <Button
            type="primary"
            icon={playing ? <PauseOutlined /> : <CaretRightOutlined />}
            onClick={onToggle}
            style={{ flex: block ? 1 : undefined }}
          >
            {playing ? 'Pause' : atEnd ? 'Replay' : 'Play'}
          </Button>
          <Button icon={<StepForwardOutlined />} disabled={atEnd} onClick={onNext} aria-label="Next step" />
        </Space.Compact>
        <Tooltip title="Start again from step 1">
          <Button type="text" icon={<ReloadOutlined />} onClick={onRestart} aria-label="Restart">
            {block ? null : 'Restart'}
          </Button>
        </Tooltip>
      </Flex>
      {/* The clock fills over exactly one dwell, so the pace is visible; an idle bar stays empty. */}
      <Progress percent={playing ? progress : 0} showInfo={false} size={['100%', 4]} status="normal" />
    </Flex>
  );
}
