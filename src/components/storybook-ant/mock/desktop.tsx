// DesktopScreen — the procurement desk, designed as an Ant Design Pro back-office rather than a stack of blocks.
//
// Where the first Ant deck drew the Tailwind frame in a different colour (a bright-blue sidebar with huge
// gaps between items, an undecorated table, details as loose text lines, half the canvas empty), this is
// the layout an Ant Pro product actually has:
//   • a compact dark Sider with a grouped `Menu`; a header with Breadcrumb, search, bell and user;
//   • a PAGE HEADER: the title, the screen's action as a real Button (or its date as a chip), and the
//     status Tabs — with counts computed from the table's own rows, never invented;
//   • a KPI row of statistic cards at the top;
//   • the body packed into a 24-column grid by `planDesktop`: tables beside their details, charts in
//     pairs, read-only details as bordered Descriptions, forms in two columns;
//   • tables with Tag-rendered statuses, right-aligned numbers, a toolbar and pagination;
//   • the screen's closing button(s) docked in a footer bar.
// Chapters supply the content; everything about its arrangement is decided here.

import { useMemo, type ReactNode } from 'react';
import {
  Alert,
  Avatar,
  Badge,
  Breadcrumb,
  Button,
  Card,
  ConfigProvider,
  Descriptions,
  Flex,
  Form,
  Input,
  Menu,
  Pagination,
  Progress,
  Result,
  Segmented,
  Select,
  Space,
  Steps,
  Table,
  Tabs,
  Tag,
  Typography,
  type MenuProps,
} from 'antd';
import {
  BarChartOutlined,
  CarOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  BellOutlined,
  CalendarOutlined,
  CameraOutlined,
  CheckCircleFilled,
  DashboardOutlined,
  DownloadOutlined,
  EllipsisOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  FilterOutlined,
  FormOutlined,
  HomeOutlined,
  InboxOutlined,
  InfoCircleOutlined,
  LineChartOutlined,
  LockOutlined,
  PlusOutlined,
  RightOutlined,
  RiseOutlined,
  SearchOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  WarningFilled,
} from '@ant-design/icons';

import type { Block, ScreenSpec, Tone } from '@/lib/storybook/types';
import { DESKTOP_HEIGHT, DESKTOP_WIDTH } from '@/components/storybook/DesktopFrame';
import { ANT_HEX, ANT_PRIMARY, ANT_STATUS } from '../ant-tokens';
import { antIcon } from '../ant-shared';
import { BarChart, Donut, LineChart, QrSvg } from './charts';
import ScrollArea from './ScrollArea';
import { isNumeric, statusPreset, tint, toneHex } from './tone';

const MUTED = 'rgba(0,0,0,0.45)';
const SECONDARY = 'rgba(0,0,0,0.65)';
const SIDER = '#001529';

/* ================================================================================================
   Navigation: the same four groups and ten sections as the Tailwind frame, with Ant icons
================================================================================================ */

const NAV: { heading: string; items: { label: string; icon: ReactNode }[] }[] = [
  { heading: 'Overview', items: [{ label: 'Dashboard', icon: <DashboardOutlined /> }, { label: 'Purchase Requirements', icon: <FormOutlined /> }] },
  { heading: 'Sourcing', items: [{ label: 'Market Prices', icon: <LineChartOutlined /> }, { label: 'Suppliers', icon: <ShopOutlined /> }, { label: 'Quotations', icon: <FileSearchOutlined /> }] },
  { heading: 'Transactions', items: [{ label: 'Purchase Orders', icon: <ShoppingCartOutlined /> }, { label: 'Receiving', icon: <InboxOutlined /> }] },
  { heading: 'Insights', items: [{ label: 'Price Prediction', icon: <RiseOutlined /> }, { label: 'Analytics', icon: <BarChartOutlined /> }, { label: 'Reports', icon: <FileTextOutlined /> }] },
  { heading: 'Admin', items: [{ label: 'Truck Loads', icon: <CarOutlined /> }, { label: 'Approvals', icon: <SafetyCertificateOutlined /> }, { label: 'Settings', icon: <SettingOutlined /> }] },
];

const MENU_ITEMS: MenuProps['items'] = NAV.map((g) => ({
  type: 'group' as const,
  key: g.heading,
  label: g.heading,
  children: g.items.map((i) => ({ key: i.label, icon: i.icon, label: i.label })),
}));

/* ================================================================================================
   Planning: flat blocks → page header, KPI row, a grid of sections, a docked footer
================================================================================================ */

type Sec = { want: number; render: (span: number) => ReactNode };
interface Plan {
  tabs: Extract<Block, { kind: 'tabs' }> | null;
  /** Per-tab counts from the first table's own Status column; empty when there is none. */
  tabCounts: Record<string, number>;
  kpi: Block | null;
  rows: Sec[][];
  dock: Extract<Block, { kind: 'buttons' }> | null;
}

/** How many of the grid's 24 columns a block would like. Neighbours are stretched to fill the row. */
function want(b: Block): number {
  switch (b.kind) {
    case 'table':
      return b.head.length > 5 ? 24 : 15;
    case 'chartLine':
    case 'chartBars':
    case 'chartDonut':
      return 9;
    case 'fields':
      return 9;
    case 'rows':
      return b.items.length <= 2 ? 8 : 24;
    case 'chain':
      return 16;
    case 'result':
    case 'photos':
    case 'progress':
    case 'qr':
    case 'gradeRows':
      return 8;
    default:
      return 24;
  }
}

function planDesktop(blocks: Block[]): Plan {
  const list = [...blocks];
  const tabs = list[0]?.kind === 'tabs' ? (list.shift() as Extract<Block, { kind: 'tabs' }>) : null;
  const dock = list[list.length - 1]?.kind === 'buttons' ? (list.pop() as Extract<Block, { kind: 'buttons' }>) : null;

  // KPI cards always lead the page body, wherever the chapter happened to place them.
  const kpiAt = list.findIndex((b) => b.kind === 'statCards');
  const kpi = kpiAt >= 0 ? list.splice(kpiAt, 1)[0] : null;

  const secs: Sec[] = [];
  let tabsUsed = false;
  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    if (b.kind === 'select' || b.kind === 'field') {
      const cluster: Extract<Block, { kind: 'select' | 'field' }>[] = [b];
      while (list[i + 1] && (list[i + 1].kind === 'select' || list[i + 1].kind === 'field')) cluster.push(list[++i] as never);
      const beforeTable = list[i + 1]?.kind === 'table';
      // Two controls or fewer, or any controls sitting above a table, are a filter row. A real form has
      // more fields than that and gets its own two-column card.
      const filterBar = beforeTable || cluster.length <= 2;
      secs.push({ want: beforeTable ? 24 : filterBar ? 16 : 16, render: () => (filterBar ? <FilterBar controls={cluster} /> : <FormPanel controls={cluster} />) });
      continue;
    }
    if (b.kind === 'table') {
      const bound = !tabsUsed && tabs ? tabs : null;
      if (bound) tabsUsed = true;
      secs.push({ want: want(b), render: () => <DataTable block={b} tabs={bound} /> });
      continue;
    }
    secs.push({ want: want(b), render: (span) => <DeskBlock block={b} span={span} /> });
  }

  // Pack into rows of 24 columns, then stretch each row so it always fills the width.
  const rows: Sec[][] = [];
  let row: Sec[] = [];
  let sum = 0;
  const flush = () => {
    if (row.length) rows.push(row);
    row = [];
    sum = 0;
  };
  for (const s of secs) {
    if (s.want >= 24) {
      flush();
      rows.push([s]);
    } else if (sum + s.want <= 24) {
      row.push(s);
      sum += s.want;
    } else {
      flush();
      row.push(s);
      sum = s.want;
    }
  }
  flush();
  return { tabs, tabCounts: countTabs(tabs, list), kpi, rows, dock };
}

/** "Open (3)" — counted from the table's rows, so a tab count can never disagree with what is on screen. */
function countTabs(tabs: Plan['tabs'], list: Block[]): Record<string, number> {
  if (!tabs) return {};
  const table = list.find((b) => b.kind === 'table') as Extract<Block, { kind: 'table' }> | undefined;
  if (!table) return {};
  const statusCol = table.head.findIndex((h) => /status/i.test(h));
  if (statusCol < 0) return {};
  const out: Record<string, number> = {};
  for (const t of tabs.items) {
    out[t] = /^all$/i.test(t) ? table.rows.length : table.rows.filter((r) => (r.cells[statusCol] ?? '').toLowerCase() === t.toLowerCase()).length;
  }
  return out;
}

function spansFor(row: Sec[]): number[] {
  const total = row.reduce((s, r) => s + r.want, 0);
  const spans = row.map((r) => Math.max(5, Math.round((r.want / total) * 24)));
  const diff = 24 - spans.reduce((a, b) => a + b, 0);
  spans[spans.indexOf(Math.max(...spans))] += diff;
  return spans;
}

/* ================================================================================================
   The screen
================================================================================================ */

export default function DesktopScreen({ screen }: { screen: ScreenSpec }) {
  const plan = useMemo(() => planDesktop(screen.blocks), [screen.blocks]);
  let idx = 0;

  return (
    <Chrome screen={screen} tabsBlock={plan.tabs} tabCounts={plan.tabCounts} dock={plan.dock}>
      <Flex vertical gap={16}>
        {plan.kpi && plan.kpi.kind === 'statCards' && (
          <div className="sba-rise" style={{ animationDelay: '0ms' }}>
            <KpiRow items={plan.kpi.items} />
          </div>
        )}
        {plan.rows.map((row, r) => {
          const spans = spansFor(row);
          return (
            <div key={r} style={{ display: 'grid', gridTemplateColumns: 'repeat(24, minmax(0, 1fr))', gap: 16, alignItems: 'start' }}>
              {row.map((s, c) => (
                <div key={c} className="sba-rise" style={{ gridColumn: `span ${spans[c]}`, minWidth: 0, animationDelay: `${Math.min(++idx, 8) * 60}ms` }}>
                  {s.render(spans[c])}
                </div>
              ))}
            </div>
          );
        })}
      </Flex>
    </Chrome>
  );
}

/* ================================================================================================
   Chrome: Sider · header · page header · scroll body · docked footer
================================================================================================ */

const looksLikeDate = (s: string) => /\d{1,2}\s\w{3}\s\d{4}|\d{4}\s?[–-]\s?\w{3}\s\d{4}|^\w{3}\s\d{4}\s?[–-]/.test(s);

function Chrome({
  screen,
  tabsBlock,
  tabCounts,
  dock,
  children,
}: {
  screen: ScreenSpec;
  tabsBlock: Plan['tabs'];
  tabCounts: Record<string, number>;
  dock: Plan['dock'];
  children: ReactNode;
}) {
  const section = screen.sidebar ?? 'Dashboard';
  const group = NAV.find((g) => g.items.some((i) => i.label === section))?.heading ?? 'Overview';
  const crumbs = [{ title: <HomeOutlined /> }, { title: group }, { title: section }];
  if (screen.title && screen.title !== section) crumbs.push({ title: screen.title });

  const right = screen.right;
  const isDate = !!right && looksLikeDate(right);
  const primaryAction = !!right && !isDate && /^(new|add|create)\b/i.test(right);

  return (
    <div style={{ width: DESKTOP_WIDTH, height: DESKTOP_HEIGHT, boxSizing: 'border-box', display: 'flex', overflow: 'hidden', background: '#f5f5f5', border: '1px solid #d9d9d9', borderRadius: 10 }}>
      {/* ---- Sider ---- */}
      <div style={{ width: 236, flex: 'none', background: SIDER, display: 'flex', flexDirection: 'column' }}>
        <Flex align="center" gap={10} style={{ height: 56, padding: '0 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <Avatar shape="square" size={28} style={{ background: ANT_PRIMARY, fontWeight: 800 }}>J</Avatar>
          <div style={{ lineHeight: 1.15 }}>
            <div style={{ color: '#fff', fontWeight: 800, letterSpacing: 1.2, fontSize: 13 }}>JAYSHANKAR</div>
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, letterSpacing: 1 }}>PROCUREMENT</div>
          </div>
        </Flex>
        <ConfigProvider
          theme={{
            components: {
              Menu: { itemHeight: 34, itemMarginBlock: 2, itemMarginInline: 8, groupTitleFontSize: 11, iconSize: 14, fontSize: 13, darkItemBg: SIDER, darkGroupTitleColor: 'rgba(255,255,255,0.4)' },
            },
          }}
        >
          <Menu theme="dark" mode="inline" selectedKeys={[section]} items={MENU_ITEMS} style={{ flex: 1, minHeight: 0, borderInlineEnd: 0, overflow: 'hidden', paddingTop: 6 }} />
        </ConfigProvider>
      </div>

      {/* ---- main column ---- */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* header */}
        <Flex align="center" justify="space-between" gap={12} style={{ height: 52, padding: '0 20px', background: '#fff', borderBottom: '1px solid #f0f0f0', flex: 'none' }}>
          <Breadcrumb items={crumbs} />
          <Flex align="center" gap={14}>
            <Input prefix={<SearchOutlined style={{ color: MUTED }} />} placeholder={screen.search ?? 'Search…'} readOnly style={{ width: 230, borderRadius: 16, pointerEvents: 'none' }} />
            <Badge count={3} size="small">
              <BellOutlined style={{ fontSize: 17, color: SECONDARY }} />
            </Badge>
            <Flex align="center" gap={8}>
              <Avatar size={26} style={{ background: tint(ANT_PRIMARY, 0.16), color: ANT_PRIMARY, fontWeight: 700 }}>P</Avatar>
              <Typography.Text style={{ fontSize: 13 }}>Procurement</Typography.Text>
            </Flex>
          </Flex>
        </Flex>

        {/* page header */}
        <div style={{ background: '#fff', padding: tabsBlock ? '12px 24px 0' : '12px 24px', borderBottom: '1px solid #f0f0f0', flex: 'none' }}>
          <Flex align="center" justify="space-between" gap={12} style={{ minHeight: 34 }}>
            <Typography.Title level={4} style={{ margin: 0, fontSize: 19 }}>
              {screen.title}
            </Typography.Title>
            {right &&
              (isDate ? (
                <Flex align="center" gap={6} style={{ border: '1px solid #d9d9d9', borderRadius: 6, padding: '4px 12px', fontSize: 13, color: SECONDARY }}>
                  <CalendarOutlined style={{ color: MUTED }} />
                  {right}
                </Flex>
              ) : (
                <Button type={primaryAction ? 'primary' : 'default'} icon={primaryAction ? <PlusOutlined /> : /^export/i.test(right) ? <DownloadOutlined /> : undefined}>
                  {right.replace(/^\+\s*/, '')}
                </Button>
              ))}
          </Flex>
          {tabsBlock && <PageTabs block={tabsBlock} counts={tabCounts} />}
        </div>

        {/* scroll body */}
        <ScrollArea>
          <div style={{ padding: 16 }}>{children}</div>
        </ScrollArea>

        {/* docked footer */}
        {dock && (
          <Flex justify="flex-end" gap={8} style={{ flex: 'none', background: '#fff', borderTop: '1px solid #f0f0f0', padding: '10px 24px', boxShadow: '0 -4px 12px rgba(0,0,0,0.04)' }}>
            {dock.items.map((b, i) => {
              const last = i === dock.items.length - 1;
              const danger = b.variant === 'danger';
              const warning = b.variant === 'warning';
              return (
                <Button
                  key={b.label}
                  type={last || danger || warning ? 'primary' : 'default'}
                  danger={danger}
                  style={warning ? { background: ANT_HEX.amber, borderColor: ANT_HEX.amber } : undefined}
                >
                  {b.label}
                </Button>
              );
            })}
          </Flex>
        )}
      </div>
    </div>
  );
}

/** Status tabs for the page header. Counts come from the table that follows, only if it has a Status column. */
function PageTabs({ block, counts }: { block: Extract<Block, { kind: 'tabs' }>; counts: Record<string, number> }) {
  return (
    <Tabs
      size="middle"
      activeKey={block.items[block.active ?? 0]}
      items={block.items.map((label) => ({
        key: label,
        label: counts[label] === undefined ? label : <Space size={6}>{label}<Badge count={counts[label]} showZero color={label === block.items[block.active ?? 0] ? ANT_PRIMARY : '#bfbfbf'} size="small" /></Space>,
      }))}
      tabBarStyle={{ margin: 0 }}
      style={{ pointerEvents: 'none' }}
    />
  );
}

/* ================================================================================================
   KPI row
================================================================================================ */

function KpiRow({ items }: { items: Extract<Block, { kind: 'statCards' }>['items'] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(Math.max(items.length, 4), 6)}, minmax(0, 1fr))`, gap: 12 }}>
      {items.map((c) => (
        <Card key={c.label} variant="borderless" styles={{ body: { padding: 12 } }}>
          <Flex gap={9} align="flex-start">
            <span style={{ display: 'inline-grid', placeItems: 'center', width: 34, height: 34, borderRadius: 10, background: tint(toneHex(c.tone), 0.13), color: toneHex(c.tone), fontSize: 17, flex: 'none' }}>
              {antIcon(c.icon)}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.2 }}>{c.value}</div>
              <div style={{ fontSize: 11, lineHeight: 1.3, color: MUTED }}>{c.label}</div>
              {c.sub && <div style={{ fontSize: 10, lineHeight: 1.3, color: MUTED, opacity: 0.85 }}>{c.sub}</div>}
            </div>
          </Flex>
        </Card>
      ))}
    </div>
  );
}

/* ================================================================================================
   Tables
================================================================================================ */

type Row = { cells: string[]; tone?: Tone; footer?: boolean; key: number };

function DataTable({ block, tabs }: { block: Extract<Block, { kind: 'table' }>; tabs: Plan['tabs'] }) {
  const data: Row[] = block.rows.map((r, i) => ({ ...r, key: i }));
  const footer = block.footer ? { ...block.footer, footer: true, key: data.length } : null;
  const numeric = block.head.map((_, c) => block.rows.every((r) => !r.cells[c] || isNumeric(r.cells[c])) && c > 0);
  const listPage = !!tabs;

  const columns = block.head.map((h, c) => ({
    title: h,
    key: h + c,
    align: numeric[c] ? ('right' as const) : undefined,
    ellipsis: false,
    render: (_: unknown, rec: Row) => {
      const v = rec.cells[c] ?? '';
      // "Select · Best Price": a call to action plus a badge, not one run-on string.
      if (/action/i.test(h) && !rec.footer) {
        const parts = v.split('·').map((x) => x.trim()).filter(Boolean);
        return (
          <Space size={6}>
            {parts.map((part) => (/best/i.test(part) ? <Tag key={part} color="success" variant="filled" style={{ marginInlineEnd: 0 }}>{part}</Tag> : <Typography.Link key={part}>{part}</Typography.Link>))}
          </Space>
        );
      }
      const preset = rec.footer ? undefined : statusPreset(v);
      if (preset) return <Tag color={preset === 'default' ? undefined : preset} variant="filled" style={{ marginInlineEnd: 0 }}>{v}</Tag>;
      if (/trend/i.test(h) && /[↑↓]/.test(v)) return <span style={{ color: /↑/.test(v) ? ANT_HEX.emerald : ANT_HEX.red, fontWeight: 600 }}>{v}</span>;
      return <span style={{ fontWeight: c === 0 || rec.footer ? 700 : 400 }}>{v}</span>;
    },
  }));
  if (listPage) {
    columns.push({ title: '', key: 'action', align: 'right' as const, ellipsis: false, render: () => <Button type="text" size="small" icon={<EllipsisOutlined />} /> });
  }

  return (
    <Card variant="borderless" styles={{ body: { padding: 0 } }}>
      {(block.title || listPage) && (
        <Flex align="center" justify="space-between" gap={10} style={{ padding: '12px 16px' }}>
          <Typography.Text strong style={{ fontSize: 14 }}>
            {block.title ?? ''}
          </Typography.Text>
          {listPage && (
            <Space size={8}>
              <Input prefix={<SearchOutlined style={{ color: MUTED }} />} placeholder="Search" readOnly style={{ width: 170, pointerEvents: 'none' }} />
              <Button icon={<FilterOutlined />}>Filter</Button>
            </Space>
          )}
        </Flex>
      )}
      <Table
        size="small"
        pagination={false}
        dataSource={footer ? [...data, footer] : data}
        columns={columns}
        rowKey="key"
        onRow={(rec) => ({ style: { background: rec.footer ? '#fafafa' : rec.tone === 'red' ? '#fff1f0' : undefined } })}
        style={{ pointerEvents: 'none' }}
      />
      {listPage && (
        <Flex justify="space-between" align="center" style={{ padding: '10px 16px', borderTop: '1px solid #f5f5f5' }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {statusSummary(block, tabs)}
          </Typography.Text>
          <Pagination size="small" defaultCurrent={1} total={data.length} pageSize={Math.max(data.length, 1)} showSizeChanger={false} />
        </Flex>
      )}
    </Card>
  );
}

/** "3 open · 1 in progress · 1 completed" — counted from the table's own Status column, or just the total. */
function statusSummary(block: Extract<Block, { kind: 'table' }>, tabs: Plan['tabs']): string {
  const n = block.rows.length;
  const statusCol = block.head.findIndex((h) => /status/i.test(h));
  if (statusCol < 0 || !tabs) return `${n} records`;
  const parts = tabs.items
    .filter((t) => !/^all$/i.test(t))
    .map((t) => ({ t, c: block.rows.filter((r) => (r.cells[statusCol] ?? '').toLowerCase() === t.toLowerCase()).length }))
    .filter((p) => p.c > 0)
    .map((p) => `${p.c} ${p.t.toLowerCase()}`);
  return `${n} records · ${parts.join(' · ')}`;
}

/* ================================================================================================
   Forms and filters
================================================================================================ */

type Control = Extract<Block, { kind: 'select' | 'field' }>;

function controlOf(b: Control, inline?: boolean) {
  if (b.kind === 'select') {
    return (
      <Select
        open={false}
        value={b.placeholder ? undefined : b.value}
        placeholder={b.value}
        options={[{ value: b.value, label: b.value }]}
        suffixIcon={b.icon ? <span style={{ color: ANT_PRIMARY }}>{antIcon(b.icon)}</span> : undefined}
        style={{ width: inline ? Math.max(150, b.value.length * 9 + 56) : '100%' }}
      />
    );
  }
  return (
    <Input
      readOnly
      disabled={b.locked}
      value={b.value}
      prefix={b.locked ? <LockOutlined style={{ color: MUTED }} /> : undefined}
      suffix={b.suffix ? <span style={{ color: MUTED, fontSize: 12 }}>{b.suffix}</span> : undefined}
      style={{ width: inline ? 150 : '100%' }}
    />
  );
}

function FormPanel({ controls }: { controls: Control[] }) {
  return (
    <Card variant="borderless" title={<span style={{ fontSize: 14 }}>Details</span>} styles={{ body: { padding: '16px 20px 6px' } }}>
      <Form layout="vertical" requiredMark={false} style={{ pointerEvents: 'none' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: 20 }}>
          {controls.map((c, i) => (
            <Form.Item key={i} label={c.label} style={{ marginBottom: 14 }}>
              {controlOf(c)}
            </Form.Item>
          ))}
        </div>
      </Form>
    </Card>
  );
}

function FilterBar({ controls }: { controls: Control[] }) {
  return (
    <Card variant="borderless" styles={{ body: { padding: '12px 16px' } }}>
      <Form layout="inline" style={{ pointerEvents: 'none', rowGap: 8 }}>
        {controls.map((c, i) => (
          <Form.Item key={i} label={<span style={{ fontSize: 12, color: SECONDARY }}>{c.label}</span>} style={{ marginInlineEnd: 20, marginBottom: 0 }}>
            {controlOf(c, true)}
          </Form.Item>
        ))}
      </Form>
    </Card>
  );
}

/* ================================================================================================
   Every other block, drawn for a wide canvas
================================================================================================ */

function CardTitle({ children, extra }: { children: ReactNode; extra?: ReactNode }) {
  return (
    <Flex justify="space-between" align="center" style={{ marginBottom: 10 }}>
      <Typography.Text strong style={{ fontSize: 14 }}>{children}</Typography.Text>
      {extra}
    </Flex>
  );
}

function DeskBlock({ block, span }: { block: Block; span: number }) {
  switch (block.kind) {
    case 'alert':
      return (
        <Alert
          showIcon
          type={ANT_STATUS[block.tone]}
          icon={block.icon ? <span>{antIcon(block.icon)}</span> : undefined}
          title={<span style={{ fontWeight: 600 }}>{block.title}</span>}
          description={block.detail}
        />
      );

    case 'note':
      return (
        <Flex gap={8} align="flex-start" style={{ padding: '2px 4px' }}>
          <InfoCircleOutlined style={{ color: ANT_PRIMARY, marginTop: 3, fontSize: 12 }} />
          <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>{block.text}</Typography.Text>
        </Flex>
      );

    case 'stats':
      return (
        <Card variant="borderless" styles={{ body: { padding: 0 } }}>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${block.items.length}, minmax(0, 1fr))` }}>
            {block.items.map((s, i) => (
              <div key={s.label} style={{ padding: '14px 20px', borderInlineStart: i === 0 ? undefined : '1px solid #f0f0f0' }}>
                <div style={{ fontSize: 12, color: MUTED }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.3, color: s.tone ? toneHex(s.tone) : undefined }}>{s.value}</div>
                {s.sub && <div style={{ fontSize: 11, color: MUTED }}>{s.sub}</div>}
              </div>
            ))}
          </div>
        </Card>
      );

    case 'fields': {
      const cols = span >= 20 ? 3 : span >= 14 ? 2 : 1;
      return (
        <Card variant="borderless" styles={{ body: { padding: 0 } }}>
          <Descriptions
            bordered
            size="small"
            column={cols}
            styles={{ label: { whiteSpace: 'nowrap', color: SECONDARY, background: '#fafafa' }, content: { fontWeight: 600 } }}
            items={block.items.map((f, i) => ({
              key: i,
              label: f.label,
              children: f.locked ? (
                <span style={{ color: MUTED }}>
                  <LockOutlined style={{ marginInlineEnd: 6 }} />
                  {f.value}
                </span>
              ) : (
                f.value
              ),
            }))}
          />
        </Card>
      );
    }

    case 'gradeRows': {
      const sum = block.items.reduce((s, i) => s + i.value, 0) || 1;
      const palette = [ANT_HEX.emerald, ANT_PRIMARY, ANT_HEX.amber, ANT_HEX.red];
      return (
        <Card variant="borderless" title={<span style={{ fontSize: 14 }}>Grade split</span>} styles={{ body: { padding: 16 } }}>
          <Flex vertical gap={12}>
            {block.items.map((g, i) => (
              <div key={g.label}>
                <Flex justify="space-between" style={{ marginBottom: 4 }}>
                  <Tag color={['green', 'blue', 'gold', 'red'][i % 4]} variant="filled" style={{ marginInlineEnd: 0, fontWeight: 700 }}>{g.label}</Tag>
                  <span style={{ fontWeight: 700 }}>{g.value} <span style={{ color: MUTED, fontWeight: 400, fontSize: 12 }}>KG</span></span>
                </Flex>
                <Progress percent={Math.round((g.value / sum) * 100)} showInfo={false} size={['100%', 6]} strokeColor={palette[i % 4]} />
              </div>
            ))}
            <Flex justify="space-between" style={{ borderTop: '1px dashed #e8e8e8', paddingTop: 10 }}>
              <span style={{ color: SECONDARY }}>Total</span>
              <span style={{ fontWeight: 800, fontSize: 16 }}>{block.total}</span>
            </Flex>
          </Flex>
        </Card>
      );
    }

    case 'rows': {
      const two = block.items.length >= 6 && span >= 20;
      return (
        <Card variant="borderless" styles={{ body: { padding: '4px 0' } }} title={block.title ? <span style={{ fontSize: 14 }}>{block.title}</span> : undefined}>
          <div style={{ display: 'grid', gridTemplateColumns: two ? '1fr 1fr' : '1fr' }}>
            {block.items.map((it, i) => (
              <Flex key={`${it.label}-${i}`} align="center" gap={12} style={{ padding: '10px 20px', borderTop: i < (two ? 2 : 1) ? undefined : '1px solid #f5f5f5' }}>
                {it.icon ? (
                  <span style={{ display: 'inline-grid', placeItems: 'center', width: 34, height: 34, borderRadius: 10, background: tint(toneHex(it.tone), 0.13), color: toneHex(it.tone), fontSize: 16, flex: 'none' }}>{antIcon(it.icon)}</span>
                ) : (
                  <Avatar size={34} style={{ background: tint(toneHex(it.tone), 0.16), color: toneHex(it.tone), fontWeight: 700 }}>{it.label.charAt(0)}</Avatar>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Typography.Text strong ellipsis style={{ display: 'block', color: it.tone === 'red' ? ANT_HEX.red : undefined }}>{it.label}</Typography.Text>
                  {it.sub && <Typography.Text type="secondary" ellipsis style={{ display: 'block', fontSize: 12 }}>{it.sub}</Typography.Text>}
                </div>
                {it.value && <span style={{ fontWeight: 700, whiteSpace: 'nowrap', color: it.tone ? toneHex(it.tone) : undefined }}>{it.value}</span>}
                {block.items.length > 1 && it.trailing !== 'none' && (it.trailing === 'check' ? <CheckCircleFilled style={{ color: ANT_HEX.emerald }} /> : <RightOutlined style={{ fontSize: 10, color: '#bfbfbf' }} />)}
              </Flex>
            ))}
          </div>
        </Card>
      );
    }

    case 'tabs':
      return <Segmented value={block.items[block.active ?? 0]} options={block.items} style={{ pointerEvents: 'none' }} />;

    case 'timeline': {
      const done = block.doneThrough ?? block.items.length - 1;
      return (
        <Card variant="borderless" styles={{ body: { padding: 20 } }}>
          {block.title && <CardTitle>{block.title}</CardTitle>}
          <Steps
            current={Math.min(done + 1, block.items.length - 1)}
            items={block.items.map((it, i) => ({ title: it.label, content: it.time, status: i <= done ? ('finish' as const) : i === done + 1 ? ('process' as const) : ('wait' as const) }))}
          />
        </Card>
      );
    }

    case 'chain':
      return (
        <Card variant="borderless" title={<span style={{ fontSize: 14 }}>Traceability</span>} styles={{ body: { padding: 20 } }}>
          <Steps
            current={block.items.length}
            items={block.items.map((it) => ({
              title: <span style={{ fontSize: 11, color: MUTED, letterSpacing: 0.6 }}>{it.label}</span>,
              content: <Tag variant="filled" style={{ marginInlineStart: 0, background: tint(toneHex(it.tone), 0.12), color: toneHex(it.tone), fontWeight: 700 }}>{it.value}</Tag>,
              status: 'finish' as const,
            }))}
          />
        </Card>
      );

    case 'result': {
      const warn = block.tone === 'amber' || block.tone === 'red';
      const color = toneHex(block.tone ?? 'emerald');
      return (
        <Card variant="borderless" styles={{ body: { padding: 8 } }}>
          <Result
            icon={warn ? <WarningFilled style={{ color, fontSize: 48 }} /> : <CheckCircleFilled style={{ color, fontSize: 48 }} />}
            title={<span style={{ fontSize: 18 }}>{block.title}</span>}
            subTitle={block.caption}
            style={{ padding: '20px 8px 12px' }}
            extra={
              block.rows && (
                <div style={{ background: '#fafafa', borderRadius: 8, padding: '4px 12px', textAlign: 'left' }}>
                  {block.rows.map((r, i) => (
                    <Flex key={r.label} justify="space-between" style={{ padding: '6px 0', borderTop: i === 0 ? undefined : '1px solid #f0f0f0' }}>
                      <span style={{ color: MUTED, fontSize: 12.5 }}>{r.label}</span>
                      <span style={{ fontWeight: 600 }}>{r.value}</span>
                    </Flex>
                  ))}
                </div>
              )
            }
          />
        </Card>
      );
    }

    case 'chartLine':
      return (
        <Card variant="borderless" styles={{ body: { padding: 16 } }}>
          <CardTitle extra={block.highlight ? <Tag color="blue" variant="filled" style={{ marginInlineEnd: 0, fontWeight: 700 }}>{block.highlight}</Tag> : undefined}>{block.title}</CardTitle>
          <LineChart points={block.points} labels={block.labels} height={150} />
        </Card>
      );

    case 'chartBars':
      return (
        <Card variant="borderless" styles={{ body: { padding: 16 } }}>
          {block.title && <CardTitle>{block.title}</CardTitle>}
          <BarChart items={block.items} height={150} />
        </Card>
      );

    case 'chartDonut':
      return (
        <Card variant="borderless" styles={{ body: { padding: 16 } }}>
          {block.title && <CardTitle>{block.title}</CardTitle>}
          <Donut items={block.items} center={block.center} centerSub={block.centerSub} size={112} />
        </Card>
      );

    case 'qr':
      return (
        <Card variant="borderless" styles={{ body: { padding: 16 } }}>
          <Flex vertical align="center" gap={6}>
            <QrSvg value={block.value} size={120} />
            <Typography.Text strong style={{ letterSpacing: 1.5 }}>{block.value}</Typography.Text>
            {block.caption && <Typography.Text type="secondary" style={{ fontSize: 12 }}>{block.caption}</Typography.Text>}
          </Flex>
        </Card>
      );

    case 'photos': {
      const count = block.count ?? 3;
      return (
        <Card variant="borderless" title={<span style={{ fontSize: 14 }}>{block.caption ?? 'Photos'}</span>} styles={{ body: { padding: 16 } }}>
          <Flex gap={10} wrap>
            {Array.from({ length: count }).map((_, i) => (
              <div key={i} style={{ width: 84, height: 70, display: 'grid', placeItems: 'center', border: '1px dashed #d9d9d9', borderRadius: 8, background: '#fafafa' }}>
                <CameraOutlined style={{ fontSize: 18, color: '#bfbfbf' }} />
              </div>
            ))}
            <div style={{ width: 84, height: 70, display: 'grid', placeItems: 'center', border: '1px dashed #bfbfbf', borderRadius: 8, color: MUTED }}>
              <PlusOutlined />
            </div>
          </Flex>
        </Card>
      );
    }

    case 'progress': {
      const pct = Math.min(100, Math.round((block.value / (block.max || 1)) * 100));
      return (
        <Card variant="borderless" styles={{ body: { padding: 16 } }}>
          <CardTitle extra={<span style={{ fontWeight: 700 }}>{block.value} <span style={{ color: MUTED, fontWeight: 400 }}>/ {block.max} {block.unit}</span></span>}>{block.label}</CardTitle>
          <Progress percent={pct} size={['100%', 8]} strokeColor={{ from: ANT_HEX.sky, to: ANT_PRIMARY }} />
        </Card>
      );
    }

    case 'select':
    case 'field':
      return <FormPanel controls={[block]} />;

    case 'buttons':
      return (
        <Flex gap={8} justify="flex-end">
          {block.items.map((b) => (
            <Button key={b.label} type={b.variant === 'outline' ? 'default' : 'primary'} danger={b.variant === 'danger'}>{b.label}</Button>
          ))}
        </Flex>
      );

    default:
      return null;
  }
}
