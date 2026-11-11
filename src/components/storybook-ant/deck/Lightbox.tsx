// Lightbox — "tap the screen to enlarge".
//
// The shared Tailwind player only ever offered a "Magnify to read" button, and only on desktop-layout
// chapters on a phone. Here the *screen itself* is the control: tap (or Enter) on the device opens a
// Modal that gives the frame the whole viewport, with the chapter's steps one swipe, arrow key or
// button away. A Fit / 100% toggle covers the case Fit cannot: a 1180px desktop panel on a 390px phone
// is legible only at 100%, panned sideways.

import { useRef, useState } from 'react';
import { Button, Flex, Modal, Segmented, Space, Typography } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';

import type { Chapter } from '@/lib/storybook/types';
import AntScreen, { FRAME_DIMENSIONS } from './AntScreen';
import ScaledFrame from './ScaledFrame';
import { useWindowHeight } from './hooks';

export interface LightboxProps {
  open: boolean;
  onClose: () => void;
  chapter: Chapter;
  stepIndex: number;
  onStep: (index: number) => void;
  narrow: boolean;
}

/** Horizontal travel, in px, that counts as a swipe rather than a tap or a scroll. */
const SWIPE_PX = 56;

export default function Lightbox({ open, onClose, chapter, stepIndex, onStep, narrow }: LightboxProps) {
  const layout = chapter.layout === 'desktop' ? 'desktop' : 'phone';
  const size = FRAME_DIMENSIONS[layout];
  const step = chapter.steps[stepIndex];
  const last = chapter.steps.length - 1;
  const winH = useWindowHeight();
  const [mode, setMode] = useState<'fit' | 'actual'>('fit');
  const touchStart = useRef<number | null>(null);

  // The frame may take most of the viewport height; the rest is the toolbar and the caption.
  const maxHeight = Math.max(240, winH - (narrow ? 250 : 270));
  const modalWidth = layout === 'desktop' ? 'min(96vw, 1280px)' : 'min(96vw, 560px)';

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      destroyOnHidden
      width={modalWidth}
      title={
        <Flex align="center" justify="space-between" gap={8} wrap style={{ paddingInlineEnd: 24 }}>
          <Typography.Text strong ellipsis style={{ maxWidth: '60%' }}>
            {chapter.number}. {chapter.title}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontWeight: 400, fontSize: 13 }}>
            Step {stepIndex + 1} of {chapter.steps.length}
          </Typography.Text>
        </Flex>
      }
      styles={{ body: { paddingTop: 8 } }}
    >
      <Flex vertical gap={14}>
        <Flex justify="space-between" align="center" gap={8} wrap>
          <Segmented<'fit' | 'actual'>
            size="small"
            value={mode}
            onChange={setMode}
            options={[
              { label: 'Fit to screen', value: 'fit' },
              { label: 'Actual size', value: 'actual' },
            ]}
          />
          <Space.Compact>
            <Button size="small" icon={<LeftOutlined />} disabled={stepIndex === 0} onClick={() => onStep(stepIndex - 1)}>
              Prev
            </Button>
            <Button size="small" disabled={stepIndex === last} onClick={() => onStep(stepIndex + 1)}>
              Next <RightOutlined />
            </Button>
          </Space.Compact>
        </Flex>

        {/* Swipe works in Fit mode only; in Actual size a horizontal drag is the pan gesture. */}
        <div
          onTouchStart={(e) => {
            touchStart.current = mode === 'fit' ? e.touches[0].clientX : null;
          }}
          onTouchEnd={(e) => {
            if (touchStart.current === null) return;
            const dx = e.changedTouches[0].clientX - touchStart.current;
            touchStart.current = null;
            if (dx <= -SWIPE_PX && stepIndex < last) onStep(stepIndex + 1);
            else if (dx >= SWIPE_PX && stepIndex > 0) onStep(stepIndex - 1);
          }}
          style={{ maxHeight, overflow: mode === 'actual' ? 'auto' : 'hidden', touchAction: mode === 'actual' ? 'auto' : 'pan-y' }}
        >
          <ScaledFrame width={size.width} height={size.height} mode={mode} maxHeight={maxHeight}>
            <AntScreen layout={layout} screen={step.screen} />
          </ScaledFrame>
        </div>

        {/* A 1180px desktop panel fitted into a phone is a picture of a screen, not a screen you can read. */}
        {narrow && layout === 'desktop' && mode === 'fit' && (
          <Typography.Text type="secondary" style={{ textAlign: 'center', fontSize: 12 }}>
            Too small to read? Choose <strong>Actual size</strong> and drag across the screen — or turn your phone sideways.
          </Typography.Text>
        )}

        <Typography.Paragraph style={{ margin: 0, textAlign: 'center' }}>{step.caption}</Typography.Paragraph>
      </Flex>
    </Modal>
  );
}
