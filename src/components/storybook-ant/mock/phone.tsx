// PhoneScreen — the phone app, designed as an Ant Design mobile product rather than converted block by block.
//
// WHAT "DESIGNED" MEANS HERE. The chapters are a flat list of blocks, and the first Ant deck drew them in
// order, one widget each — which reads as a list of widgets. A real Ant product composes them:
//   • a NavBar (back · title · date chip) and a TabBar with a rounded active indicator;
//   • consecutive form blocks become ONE `Form` card with proper labelled controls;
//   • the screen's closing button(s) are lifted out of the scroll area into a docked action bar above the
//     tab bar — the primary action stays reachable however long the screen is;
//   • read-only fields become a cell list (label left, value right) instead of floating text;
//   • tiles become a service grid with tinted icon chips; stats sit in one divided card;
//   • traceability and lifecycle use `Steps`; money tables use right-aligned columns with status Tags.
// Nothing here reads data the chapters do not supply: colours, icons and copy all come from the blocks.

import { useMemo, type ReactNode } from 'react';
import {
  Avatar,
  Button,
  Card,
  ConfigProvider,
  Flex,
  Form,
  Input,
  Progress,
  Result,
  Segmented,
  Select,
  Steps,
  Table,
  Tag,
  Timeline,
  Typography,
} from 'antd';
import {
  ArrowLeftOutlined,
  BarChartOutlined,
  CalendarOutlined,
  CameraOutlined,
  CheckCircleFilled,
  CheckOutlined,
  DownOutlined,
  EllipsisOutlined,
  HomeOutlined,
  InfoCircleFilled,
  LockOutlined,
  PlusOutlined,
  RightOutlined,
  ShopOutlined,
  ShoppingOutlined,
  WarningFilled,
} from '@ant-design/icons';

import type { Block, ScreenSpec, Tone } from '@/lib/storybook/types';
import { ANT_HEX, ANT_PHONE_HEIGHT, ANT_PHONE_WIDTH, ANT_PRIMARY, ANT_STATUS } from '../ant-tokens';
import { antIcon } from '../ant-shared';
import { BarChart, Donut, LineChart, QrSvg } from './charts';
import ScrollArea from './ScrollArea';
import { isNumeric, statusPreset, tint, toneHex } from './tone';

const TABS = [
  { label: 'Home', Icon: HomeOutlined },
  { label: 'Procurement', Icon: ShoppingOutlined },
  { label: 'Market Price', Icon: BarChartOutlined },
  { label: 'Suppliers', Icon: ShopOutlined },
  { label: 'More', Icon: EllipsisOutlined },
] as const;

const MUTED = 'rgba(0,0,0,0.45)';
const SECONDARY = 'rgba(0,0,0,0.65)';
const TEXT = 'rgba(0,0,0,0.88)';

/** Dates and "Today" in a screen's right slot are shown as a chip; anything else is an action link. */
const looksLikeDate = (s: string) => /\d{1,2}\s\w{3}\s\d{4}|^today$/i.test(s.trim());

/* ================================================================================================
   Composition: flat blocks → the screen's regions
================================================================================================ */

type FormBlock = Extract<Block, { kind: 'select' | 'field' }>;
type Node = { type: 'block'; block: Block } | { type: 'form'; blocks: FormBlock[] };

function compose(blocks: Block[]): { nodes: Node[]; dock: Extract<Block, { kind: 'buttons' }> | null } {
  const list = [...blocks];
  // The closing `buttons` block is the screen's primary action: it docks, it does not scroll.
  const last = list[list.length - 1];
  const dock = last && last.kind === 'buttons' ? (list.pop() as Extract<Block, { kind: 'buttons' }>) : null;

  const nodes: Node[] = [];
  for (const block of list) {
    const prev = nodes[nodes.length - 1];
    if (block.kind === 'select' || block.kind === 'field') {
      if (prev && prev.type === 'form') prev.blocks.push(block);
      else nodes.push({ type: 'form', blocks: [block] });
    } else {
      nodes.push({ type: 'block', block });
    }
  }
  return { nodes, dock };
}

/* ================================================================================================
   The screen
================================================================================================ */

export default function PhoneScreen({ screen }: { screen: ScreenSpec }) {
  const { nodes, dock } = useMemo(() => compose(screen.blocks), [screen.blocks]);

  return (
    <PhoneChrome title={screen.title} back={screen.back} right={screen.right} tab={screen.tab} dock={dock}>
      {nodes.map((n, i) => (
        <div key={i} className="sba-rise" style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}>
          {n.type === 'form' ? <FormCard blocks={n.blocks} /> : <PhoneBlock block={n.block} />}
        </div>
      ))}
    </PhoneChrome>
  );
}

/* ================================================================================================
   Chrome: status bar, NavBar, docked action bar, TabBar
================================================================================================ */

function PhoneChrome({
  title,
  back,
  right,
  tab,
  dock,
  children,
}: {
  title?: string;
  back?: boolean;
  right?: string;
  tab?: string;
  dock: Extract<Block, { kind: 'buttons' }> | null;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        width: ANT_PHONE_WIDTH,
        height: ANT_PHONE_HEIGHT,
        boxSizing: 'border-box',
        border: '6px solid #141414',
        borderRadius: 34,
        overflow: 'hidden',
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* status bar */}
      <Flex justify="space-between" align="center" style={{ padding: '7px 18px 0', height: 22, fontSize: 10, fontWeight: 700, color: TEXT }}>
        <span>9:41</span>
        <Flex gap={5} align="center" style={{ fontSize: 9, fontWeight: 600 }}>
          <span>LTE</span>
          <span style={{ display: 'inline-flex', width: 18, height: 9, border: '1px solid rgba(0,0,0,.55)', borderRadius: 3, padding: 1 }}>
            <span style={{ flex: 1, background: TEXT, borderRadius: 1 }} />
          </span>
        </Flex>
      </Flex>

      {/* NavBar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '64px 1fr 96px',
          alignItems: 'center',
          height: 42,
          padding: '0 12px',
          borderBottom: '1px solid #f0f0f0',
          flex: 'none',
        }}
      >
        <div>
          {back ? (
            <span style={{ display: 'inline-grid', placeItems: 'center', width: 28, height: 28, borderRadius: 14, background: '#f5f5f5' }}>
              <ArrowLeftOutlined style={{ fontSize: 13, color: TEXT }} />
            </span>
          ) : (
            <Avatar shape="square" size={26} style={{ background: ANT_PRIMARY, fontWeight: 800, fontSize: 13 }}>
              J
            </Avatar>
          )}
        </div>
        <Typography.Text strong ellipsis style={{ textAlign: 'center', fontSize: 15 }}>
          {title ?? ''}
        </Typography.Text>
        <div style={{ textAlign: 'right' }}>
          {right &&
            (looksLikeDate(right) ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#e6f4ff', color: '#0958d9', borderRadius: 12, padding: '2px 8px', fontSize: 10.5, fontWeight: 600, whiteSpace: 'nowrap' }}>
                <CalendarOutlined style={{ fontSize: 10 }} />
                {right}
              </span>
            ) : (
              <Typography.Link style={{ fontSize: 12, fontWeight: 600 }}>{right}</Typography.Link>
            ))}
        </div>
      </div>

      {/* scroll area */}
      <ScrollArea style={{ background: '#f5f5f5' }}>
        <Flex vertical gap={8} style={{ padding: 10 }}>
          {children}
        </Flex>
      </ScrollArea>

      {/* docked action bar */}
      {dock && <DockBar block={dock} />}

      {/* TabBar */}
      <div style={{ flex: 'none', borderTop: '1px solid #f0f0f0', background: '#fff', padding: '4px 4px 6px' }}>
        <Flex>
          {TABS.map(({ label, Icon }) => {
            const active = tab === label;
            return (
              <Flex key={label} vertical align="center" gap={2} style={{ flex: 1, position: 'relative', paddingTop: 5 }}>
                {active && <span style={{ position: 'absolute', top: 0, width: 18, height: 3, borderRadius: 2, background: ANT_PRIMARY }} />}
                <Icon style={{ fontSize: 17, color: active ? ANT_PRIMARY : '#bfbfbf' }} />
                <span style={{ fontSize: 9, lineHeight: 1, fontWeight: active ? 700 : 400, color: active ? ANT_PRIMARY : '#bfbfbf' }}>{label}</span>
              </Flex>
            );
          })}
        </Flex>
        <div style={{ width: 84, height: 3, borderRadius: 2, background: '#d9d9d9', margin: '5px auto 0' }} />
      </div>
    </div>
  );
}

function DockBar({ block }: { block: Extract<Block, { kind: 'buttons' }> }) {
  const items = block.items;
  const solo = items.length === 1;
  return (
    <div style={{ flex: 'none', background: '#fff', padding: '8px 12px', boxShadow: '0 -6px 14px rgba(0,0,0,0.06)' }}>
      <Flex gap={8}>
        {items.map((b, i) => {
          const primary = b.variant === 'primary' || b.variant === undefined;
          const danger = b.variant === 'danger';
          const warning = b.variant === 'warning';
          return (
            <Button
              key={b.label}
              size="large"
              block
              type={primary || danger || warning ? 'primary' : 'default'}
              danger={danger}
              style={{
                flex: solo ? 1 : i === items.length - 1 ? 1.4 : 1,
                fontWeight: 700,
                ...(warning ? { background: ANT_HEX.amber, borderColor: ANT_HEX.amber } : null),
              }}
            >
              {b.label}
            </Button>
          );
        })}
      </Flex>
    </div>
  );
}

/* ================================================================================================
   Building blocks
================================================================================================ */

const Panel = ({ children, pad = 10 }: { children: ReactNode; pad?: number }) => (
  <Card variant="borderless" styles={{ body: { padding: pad } }} style={{ borderRadius: 12 }}>
    {children}
  </Card>
);

const SectionLabel = ({ children }: { children: ReactNode }) => (
  <Typography.Text strong style={{ display: 'block', fontSize: 12.5, color: SECONDARY, margin: '2px 2px 6px' }}>
    {children}
  </Typography.Text>
);

/** A small, calm notice — the caption lines under screens are not alerts, so they must not shout like one. */
function Notice({ text, tone }: { text: string; tone?: Tone }) {
  const color = tone && tone !== 'navy' && tone !== 'slate' ? toneHex(tone) : ANT_PRIMARY;
  return (
    <Flex gap={8} align="flex-start" style={{ background: `color-mix(in srgb, ${color} 9%, #fff)`, borderRadius: 10, padding: '6px 9px' }}>
      <InfoCircleFilled style={{ color, fontSize: 13, marginTop: 2 }} />
      <Typography.Text style={{ fontSize: 11.5, lineHeight: 1.45, color: SECONDARY }}>{text}</Typography.Text>
    </Flex>
  );
}

function IconChip({ icon, tone, size = 34 }: { icon?: string; tone?: Tone; size?: number }) {
  const color = toneHex(tone);
  return (
    <span
      style={{
        display: 'inline-grid',
        placeItems: 'center',
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.3),
        background: tint(color, 0.13),
        color,
        fontSize: Math.round(size * 0.5),
        flex: 'none',
      }}
    >
      {antIcon(icon)}
    </span>
  );
}

/* ---- the form card ------------------------------------------------------------------------------ */

/** Two neighbouring short, plain text fields (a quantity and a date) share a row instead of stacking. */
function pairUp(blocks: FormBlock[]): FormBlock[][] {
  const plain = (b: FormBlock) => b.kind === 'field' && !b.big && !b.locked && b.value.length <= 16;
  const out: FormBlock[][] = [];
  for (let i = 0; i < blocks.length; i++) {
    if (plain(blocks[i]) && blocks[i + 1] && plain(blocks[i + 1])) {
      out.push([blocks[i], blocks[i + 1]]);
      i++;
    } else out.push([blocks[i]]);
  }
  return out;
}

function FormCard({ blocks }: { blocks: FormBlock[] }) {
  return (
    <Panel pad={12}>
      {/* A phone form is dense: tighter label padding and item spacing than Ant's desktop defaults, set
          here so only this card changes. */}
      <ConfigProvider theme={{ token: { controlHeight: 34 }, components: { Form: { verticalLabelPadding: '0 0 3px', itemMarginBottom: 8 } } }}>
      <Form layout="vertical" requiredMark={false} size="middle" style={{ pointerEvents: 'none' }}>
        {pairUp(blocks).map((group, gi) => {
          if (group.length === 2) {
            return (
              <div key={gi} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 8 }}>
                {group.map((b, i) => (
                  <Form.Item key={i} label={<span style={{ fontSize: 12, color: SECONDARY }}>{b.label}</span>} style={{ marginBottom: 8 }}>
                    <Input readOnly value={(b as Extract<FormBlock, { kind: 'field' }>).value} suffix={(b as Extract<FormBlock, { kind: 'field' }>).suffix ? <span style={{ color: MUTED, fontSize: 11, fontWeight: 600 }}>{(b as Extract<FormBlock, { kind: 'field' }>).suffix}</span> : undefined} />
                  </Form.Item>
                ))}
              </div>
            );
          }
          const b = group[0];
          const i = gi;
          if (b.kind === 'select') {
            return (
              <Form.Item key={i} label={<span style={{ fontSize: 12, color: SECONDARY }}>{b.label}</span>} style={{ marginBottom: 8 }}>
                <Select
                  open={false}
                  value={b.placeholder ? undefined : b.value}
                  placeholder={b.value}
                  options={[{ value: b.value, label: b.value }]}
                  suffixIcon={b.icon ? <span style={{ color: ANT_PRIMARY }}>{antIcon(b.icon)}</span> : <DownOutlined />}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            );
          }
          return (
            <Form.Item key={i} label={<span style={{ fontSize: 12, color: SECONDARY }}>{b.label}</span>} style={{ marginBottom: 8 }}>
              <Input
                readOnly
                value={b.value}
                size={b.big ? 'large' : 'middle'}
                disabled={b.locked}
                prefix={b.locked ? <LockOutlined style={{ color: MUTED }} /> : undefined}
                suffix={b.suffix ? <span style={{ color: MUTED, fontSize: b.big ? 13 : 12, fontWeight: 600 }}>{b.suffix}</span> : undefined}
                style={b.big ? { fontSize: 22, fontWeight: 600, height: 46 } : undefined}
              />
            </Form.Item>
          );
        })}
      </Form>
      </ConfigProvider>
    </Panel>
  );
}

/* ---- every other block --------------------------------------------------------------------------- */

function PhoneBlock({ block }: { block: Block }) {
  switch (block.kind) {
    case 'hero':
      return (
        <div
          style={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 16,
            padding: '12px 14px 14px',
            color: '#fff',
            background: `linear-gradient(135deg, ${ANT_PRIMARY} 0%, #0958d9 60%, #003eb3 100%)`,
          }}
        >
          <svg viewBox="0 0 300 70" preserveAspectRatio="none" style={{ position: 'absolute', insetInline: 0, bottom: 0, width: '100%', height: 46, opacity: 0.16 }} aria-hidden="true">
            <path d="M0 40 C 50 10, 100 70, 150 40 S 250 10, 300 36 L300 70 L0 70 Z" fill="#fff" />
          </svg>
          <Flex gap={12} align="center" style={{ position: 'relative' }}>
            <span style={{ display: 'grid', placeItems: 'center', width: 38, height: 38, borderRadius: 11, background: 'rgba(255,255,255,0.18)', fontSize: 19 }}>
              {antIcon(block.icon ?? 'package')}
            </span>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: 1.2, lineHeight: 1.15 }}>{block.title}</div>
              {block.subtitle && <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>{block.subtitle}</div>}
            </div>
          </Flex>
        </div>
      );

    case 'tagline':
      return (
        <Typography.Text type="secondary" style={{ display: 'block', textAlign: 'center', fontSize: 10.5, letterSpacing: 1.6, textTransform: 'uppercase' }}>
          {block.text}
        </Typography.Text>
      );

    case 'tiles': {
      const cols = block.columns ?? 2;
      return (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 6 }}>
          {block.items.map((t) =>
            cols === 2 ? (
              <Flex key={t.label} align="center" gap={10} style={{ background: '#fff', borderRadius: 12, padding: '8px 9px' }}>
                <IconChip icon={t.icon} tone={t.tone} size={30} />
                <Typography.Text strong style={{ fontSize: 12, lineHeight: 1.2, flex: 1, minWidth: 0 }}>
                  {t.label}
                </Typography.Text>
              </Flex>
            ) : (
              <Flex key={t.label} vertical align="center" gap={6} style={{ background: '#fff', borderRadius: 12, padding: '9px 4px' }}>
                <IconChip icon={t.icon} tone={t.tone} size={34} />
                <Typography.Text style={{ fontSize: 11, textAlign: 'center', lineHeight: 1.2 }}>{t.label}</Typography.Text>
              </Flex>
            ),
          )}
        </div>
      );
    }

    case 'stats': {
      const cols = block.items.length > 3 ? 2 : block.items.length;
      return (
        <Panel pad={0}>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {block.items.map((st, i) => (
              <div
                key={st.label}
                style={{
                  padding: '9px 10px',
                  textAlign: 'center',
                  borderInlineStart: i % cols === 0 ? undefined : '1px solid #f0f0f0',
                  borderTop: i < cols ? undefined : '1px solid #f0f0f0',
                }}
              >
                <div style={{ fontSize: 10.5, color: MUTED }}>{st.label}</div>
                <div style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.2, whiteSpace: 'nowrap', color: st.tone ? toneHex(st.tone) : TEXT }}>{st.value}</div>
                {st.sub && <div style={{ fontSize: 10, color: MUTED, marginTop: 1, lineHeight: 1.3 }}>{st.sub}</div>}
              </div>
            ))}
          </div>
        </Panel>
      );
    }

    case 'statCards':
      return (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${block.columns ?? 1}, minmax(0, 1fr))`, gap: 8 }}>
          {block.items.map((c) => (
            <Flex key={c.label} align="center" gap={10} style={{ background: '#fff', borderRadius: 12, padding: 12 }}>
              <IconChip icon={c.icon} tone={c.tone} size={36} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 10.5, color: MUTED }}>{c.label}</div>
                <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.25 }}>{c.value}</div>
                {c.sub && <div style={{ fontSize: 10, color: MUTED }}>{c.sub}</div>}
              </div>
            </Flex>
          ))}
        </div>
      );

    case 'alert': {
      // Drawn directly rather than with antd's <Alert>: at 304px wide, Alert's icon column and generous
      // padding made a two-line alert as tall as a form field. Same status palette, tighter geometry.
      const status = ANT_STATUS[block.tone];
      const color = { success: ANT_HEX.emerald, info: ANT_PRIMARY, warning: ANT_HEX.amber, error: ANT_HEX.red }[status];
      const icon = block.icon ?? (status === 'error' ? 'xCircle' : status === 'success' ? 'checkCircle' : 'alert');
      return (
        <Flex
          gap={9}
          align="flex-start"
          style={{ background: `color-mix(in srgb, ${color} 10%, #fff)`, border: `1px solid color-mix(in srgb, ${color} 35%, #fff)`, borderRadius: 12, padding: '8px 10px' }}
        >
          <span style={{ color, fontSize: 17, lineHeight: 1, marginTop: 1, flex: 'none' }}>{antIcon(icon)}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.3 }}>{block.title}</div>
            {block.detail && <div style={{ fontSize: 11.5, lineHeight: 1.4, color: SECONDARY, marginTop: 1 }}>{block.detail}</div>}
          </div>
        </Flex>
      );
    }

    case 'note':
      return <Notice text={block.text} tone={block.tone} />;

    case 'fields': {
      const cols = block.columns ?? 1;
      return (
        <Panel pad={0}>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {block.items.map((f, i) => (
              <div
                key={f.label}
                style={{
                  padding: '6px 14px',
                  borderTop: i < cols ? undefined : '1px solid #f5f5f5',
                  ...(cols === 1 ? null : { borderInlineStart: i % cols === 0 ? undefined : '1px solid #f5f5f5' }),
                }}
              >
                {cols === 1 ? (
                  <Flex justify="space-between" align="center" gap={10}>
                    <span style={{ fontSize: 12, color: MUTED }}>{f.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, textAlign: 'right', color: f.locked ? MUTED : TEXT }}>
                      {f.locked && <LockOutlined style={{ marginInlineEnd: 5, fontSize: 11 }} />}
                      {f.value}
                    </span>
                  </Flex>
                ) : (
                  <>
                    <div style={{ fontSize: 10.5, color: MUTED }}>{f.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: f.locked ? MUTED : TEXT }}>
                      {f.locked && <LockOutlined style={{ marginInlineEnd: 4, fontSize: 10 }} />}
                      {f.value}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </Panel>
      );
    }

    case 'gradeRows': {
      const sum = block.items.reduce((s, i) => s + i.value, 0) || 1;
      const palette = [ANT_HEX.emerald, ANT_PRIMARY, ANT_HEX.amber, ANT_HEX.red];
      return (
        <Panel pad={12}>
          <Flex vertical gap={9}>
            {block.items.map((g, i) => (
              <div key={g.label}>
                <Flex justify="space-between" align="baseline" style={{ marginBottom: 4 }}>
                  <Flex align="center" gap={8}>
                    <Tag variant="filled" color={['green', 'blue', 'gold', 'red'][i % 4]} style={{ marginInlineEnd: 0, fontWeight: 700 }}>
                      {g.label}
                    </Tag>
                  </Flex>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>
                    {g.value} <span style={{ fontSize: 11, color: MUTED, fontWeight: 500 }}>KG</span>
                  </span>
                </Flex>
                <Progress percent={Math.round((g.value / sum) * 100)} showInfo={false} size={['100%', 6]} strokeColor={palette[i % 4]} />
              </div>
            ))}
            <Flex justify="space-between" align="center" style={{ borderTop: '1px dashed #e8e8e8', paddingTop: 10 }}>
              <span style={{ fontSize: 12, color: SECONDARY }}>Total</span>
              <span style={{ fontSize: 16, fontWeight: 800 }}>{block.total}</span>
            </Flex>
          </Flex>
        </Panel>
      );
    }

    case 'rows':
      return (
        <div>
          {block.title && <SectionLabel>{block.title}</SectionLabel>}
          <Panel pad={0}>
            {block.items.map((it, i) => (
              <Flex key={`${it.label}-${i}`} align="center" gap={10} style={{ padding: '8px 12px', borderTop: i === 0 ? undefined : '1px solid #f5f5f5' }}>
                {it.icon ? <IconChip icon={it.icon} tone={it.tone} size={30} /> : <span style={{ width: 8, height: 8, borderRadius: 4, background: toneHex(it.tone), flex: 'none' }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Typography.Text strong ellipsis style={{ display: 'block', fontSize: 12.5, color: it.tone === 'red' ? ANT_HEX.red : TEXT }}>
                    {it.label}
                  </Typography.Text>
                  {it.sub && (
                    <Typography.Text type="secondary" ellipsis style={{ display: 'block', fontSize: 10.5 }}>
                      {it.sub}
                    </Typography.Text>
                  )}
                </div>
                {it.value && <span style={{ fontSize: 12.5, fontWeight: 700, color: it.tone ? toneHex(it.tone) : TEXT, whiteSpace: 'nowrap' }}>{it.value}</span>}
                {it.trailing === 'check' ? (
                  <CheckOutlined style={{ color: ANT_HEX.emerald, fontSize: 12 }} />
                ) : it.trailing === 'none' ? null : (
                  <RightOutlined style={{ fontSize: 9, color: '#bfbfbf' }} />
                )}
              </Flex>
            ))}
          </Panel>
        </div>
      );

    case 'table':
      return (
        <div>
          {block.title && <SectionLabel>{block.title}</SectionLabel>}
          <Panel pad={0}>
            <MiniTable block={block} />
          </Panel>
        </div>
      );

    case 'tabs':
      return (
        <Segmented
          block
          size="middle"
          value={block.items[block.active ?? 0]}
          options={block.items}
          style={{ pointerEvents: 'none' }}
        />
      );

    case 'timeline':
      return (
        <Panel pad={14}>
          {block.title && <SectionLabel>{block.title}</SectionLabel>}
          <Timeline
            style={{ marginBlockStart: 6 }}
            items={block.items.map((it, i) => {
              const done = block.doneThrough === undefined || i <= block.doneThrough;
              return {
                color: done ? 'green' : 'gray',
                content: (
                  <Flex justify="space-between" gap={8}>
                    <span style={{ fontSize: 12.5, fontWeight: done ? 600 : 400, color: done ? TEXT : MUTED }}>{it.label}</span>
                    <span style={{ fontSize: 11, color: MUTED }}>{it.time}</span>
                  </Flex>
                ),
              };
            })}
          />
        </Panel>
      );

    case 'result': {
      const tone = block.tone ?? 'emerald';
      const warn = tone === 'amber' || tone === 'red';
      const color = toneHex(tone);
      return (
        <Panel pad={10}>
          <Result
            icon={warn ? <WarningFilled style={{ color, fontSize: 52 }} /> : <CheckCircleFilled style={{ color, fontSize: 52 }} />}
            title={<span style={{ fontSize: 17 }}>{block.title}</span>}
            subTitle={block.caption ? <span style={{ fontSize: 12 }}>{block.caption}</span> : undefined}
            style={{ padding: '14px 4px 6px' }}
            extra={
              block.rows && block.rows.length > 0 ? (
                <div style={{ background: '#fafafa', borderRadius: 10, padding: '4px 12px', textAlign: 'left' }}>
                  {block.rows.map((r, i) => (
                    <Flex key={r.label} justify="space-between" style={{ padding: '6px 0', borderTop: i === 0 ? undefined : '1px solid #f0f0f0' }}>
                      <span style={{ fontSize: 12, color: MUTED }}>{r.label}</span>
                      <span style={{ fontSize: 12.5, fontWeight: 600 }}>{r.value}</span>
                    </Flex>
                  ))}
                </div>
              ) : undefined
            }
          />
        </Panel>
      );
    }

    case 'chartLine':
      return (
        <Panel>
          <Flex justify="space-between" align="center" style={{ marginBottom: 6 }}>
            <Typography.Text strong style={{ fontSize: 12.5 }}>{block.title}</Typography.Text>
            {block.highlight && <Tag color="blue" variant="filled" style={{ marginInlineEnd: 0, fontWeight: 700 }}>{block.highlight}</Tag>}
          </Flex>
          <LineChart points={block.points} labels={block.labels} height={150} />
        </Panel>
      );

    case 'chartBars':
      return (
        <Panel>
          {block.title && <Typography.Text strong style={{ display: 'block', fontSize: 12.5, marginBottom: 6 }}>{block.title}</Typography.Text>}
          <BarChart items={block.items} height={150} />
        </Panel>
      );

    case 'chartDonut':
      return (
        <Panel>
          {block.title && <Typography.Text strong style={{ display: 'block', fontSize: 12.5, marginBottom: 8 }}>{block.title}</Typography.Text>}
          <Donut items={block.items} center={block.center} centerSub={block.centerSub} size={104} />
        </Panel>
      );

    case 'qr':
      return (
        <Panel pad={12}>
          <Flex vertical align="center" gap={6}>
            <div style={{ padding: 8, background: '#fff', border: '1px solid #f0f0f0', borderRadius: 12 }}>
              <QrSvg value={block.value} size={104} />
            </div>
            <Typography.Text strong style={{ letterSpacing: 1.5, fontSize: 13 }}>{block.value}</Typography.Text>
            {block.caption && <Typography.Text type="secondary" style={{ fontSize: 11, textAlign: 'center' }}>{block.caption}</Typography.Text>}
          </Flex>
        </Panel>
      );

    case 'photos': {
      const count = block.count ?? 3;
      return (
        <Panel pad={12}>
          {block.caption && <SectionLabel>{block.caption}</SectionLabel>}
          <Flex gap={8}>
            {Array.from({ length: count }).map((_, i) => (
              <div key={i} style={{ flex: 1, height: 48, display: 'grid', placeItems: 'center', border: '1px dashed #d9d9d9', borderRadius: 10, background: '#fafafa' }}>
                <CameraOutlined style={{ fontSize: 17, color: '#bfbfbf' }} />
              </div>
            ))}
            <div style={{ width: 40, height: 48, display: 'grid', placeItems: 'center', border: '1px solid #f0f0f0', borderRadius: 10 }}>
              <PlusOutlined style={{ fontSize: 14, color: ANT_PRIMARY }} />
            </div>
          </Flex>
        </Panel>
      );
    }

    case 'progress': {
      const pct = Math.min(100, Math.round((block.value / (block.max || 1)) * 100));
      return (
        <Panel pad={14}>
          <Flex justify="space-between" align="baseline" style={{ marginBottom: 6 }}>
            <Typography.Text strong style={{ fontSize: 12.5 }}>{block.label}</Typography.Text>
            <span style={{ fontSize: 12.5, fontWeight: 700 }}>
              {block.value} <span style={{ color: MUTED, fontWeight: 500 }}>/ {block.max} {block.unit}</span>
            </span>
          </Flex>
          <Progress percent={pct} size={['100%', 8]} strokeColor={{ from: ANT_HEX.sky, to: ANT_PRIMARY }} format={(p) => `${p}%`} />
        </Panel>
      );
    }

    case 'chain':
      return (
        <Panel pad={14}>
          <Steps
            orientation="vertical"
            size="small"
            current={block.items.length}
            items={block.items.map((it) => ({
              title: <span style={{ fontSize: 10.5, color: MUTED, letterSpacing: 0.6 }}>{it.label}</span>,
              content: <Tag variant="filled" color={undefined} style={{ marginInlineStart: 0, background: tint(toneHex(it.tone), 0.12), color: toneHex(it.tone), fontWeight: 700, fontSize: 12 }}>{it.value}</Tag>,
              status: 'finish' as const,
            }))}
          />
        </Panel>
      );

    case 'select':
    case 'field':
      return <FormCard blocks={[block]} />;

    case 'buttons':
      // Only reached when a `buttons` block is NOT the screen's last block; those stay in the flow.
      return (
        <Flex gap={8}>
          {block.items.map((b) => (
            <Button key={b.label} block type={b.variant === 'outline' ? 'default' : 'primary'} danger={b.variant === 'danger'}>
              {b.label}
            </Button>
          ))}
        </Flex>
      );

    default:
      return null;
  }
}

/** A compact money/quantity table: first column strong, numbers right-aligned, statuses as Tags. */
function MiniTable({ block }: { block: Extract<Block, { kind: 'table' }> }) {
  const rows = block.footer ? [...block.rows, { cells: block.footer.cells, tone: block.footer.tone, footer: true }] : block.rows;
  const numericCol = block.head.map((_, c) => block.rows.every((r) => !r.cells[c] || isNumeric(r.cells[c])));
  return (
    <Table
      size="small"
      pagination={false}
      tableLayout="fixed"
      rowKey="key"
      dataSource={rows.map((r, i) => ({ ...r, key: i }))}
      columns={block.head.map((h, c) => ({
        title: h,
        dataIndex: ['cells', c],
        align: numericCol[c] && c > 0 ? ('right' as const) : undefined,
        ellipsis: true,
        render: (v: string, rec: { footer?: boolean }) => {
          const preset = statusPreset(v ?? '');
          if (preset && !rec.footer) return <Tag color={preset === 'default' ? undefined : preset} variant="filled" style={{ marginInlineEnd: 0, fontSize: 10.5 }}>{v}</Tag>;
          return <span style={{ fontWeight: c === 0 || rec.footer ? 700 : 400, fontSize: 11.5 }}>{v}</span>;
        },
      }))}
      onRow={(rec: { tone?: Tone; footer?: boolean }) => ({
        style: { background: rec.footer ? '#fafafa' : rec.tone === 'red' ? '#fff1f0' : undefined },
      })}
    />
  );
}
