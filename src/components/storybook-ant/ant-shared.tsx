// Icon and tone helpers for the Ant deck: chapters name icons and tones as plain strings so the
// data stays plain data; this file turns those strings into Ant Design icons and hex colours.

import * as React from 'react';
import {
  AlertOutlined,
  AppstoreOutlined,
  AuditOutlined,
  BankOutlined,
  BarChartOutlined,
  BellOutlined,
  CalendarOutlined,
  CarOutlined,
  CarryOutOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloudOutlined,
  ContainerOutlined,
  CreditCardOutlined,
  DatabaseOutlined,
  DownloadOutlined,
  EllipsisOutlined,
  EnvironmentOutlined,
  ExperimentOutlined,
  FieldTimeOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  HeatMapOutlined,
  HomeOutlined,
  InboxOutlined,
  MoneyCollectOutlined,
  NotificationOutlined,
  PercentageOutlined,
  PhoneOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  ShareAltOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  ShoppingOutlined,
  SwapOutlined,
  TrophyOutlined,
  UserOutlined,
  WalletOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  DashboardOutlined,
  RiseOutlined,
  FallOutlined,
} from '@ant-design/icons';

import type { IconName, Tone } from '@/lib/storybook/types';
import { ANT_HEX } from './ant-tokens';

/**
 * Ant twin for every icon name the chapters use.
 *
 * SIX ARE SUBSTITUTIONS, because Ant Design has no glyph for them — this table is the honest list,
 * so nobody reads a shopping cart as a fish:
 *   fish        → ShoppingOutlined   (the tile means Procurement; Ant has no fish)
 *   scale       → ExperimentOutlined (measuring/sorting; Ant has no weighing scale)
 *   layers      → DatabaseOutlined   (stacked layers)
 *   thermometer → HeatMapOutlined    (temperature)
 *   waves       → CloudOutlined      (water/weather)
 *   snowflake   → CloudOutlined      (cold; shares the glyph with waves, as above)
 */
const ICONS: Record<IconName, React.ComponentType<{ style?: React.CSSProperties }>> = {
  alert: AlertOutlined,
  arrowDownToLine: DownloadOutlined,
  arrowLeftRight: SwapOutlined,
  award: TrophyOutlined,
  bars: BarChartOutlined,
  bell: BellOutlined,
  boxes: AppstoreOutlined,
  calendar: CalendarOutlined,
  checkCircle: CheckCircleOutlined,
  clipboardCheck: CarryOutOutlined,
  clock: ClockCircleOutlined,
  complaint: WarningOutlined,
  container: ContainerOutlined,
  creditCard: CreditCardOutlined,
  ellipsis: EllipsisOutlined,
  fileText: FileTextOutlined,
  fish: ShoppingOutlined,
  gauge: DashboardOutlined,
  home: HomeOutlined,
  indianRupee: MoneyCollectOutlined,
  layers: DatabaseOutlined,
  mapPin: EnvironmentOutlined,
  megaphone: NotificationOutlined,
  package: InboxOutlined,
  packageCheck: SafetyCertificateOutlined,
  percent: PercentageOutlined,
  phone: PhoneOutlined,
  receipt: FileDoneOutlined,
  rotateCcw: ReloadOutlined,
  scale: ExperimentOutlined,
  settings: SettingOutlined,
  share: ShareAltOutlined,
  shoppingCart: ShoppingCartOutlined,
  snowflake: CloudOutlined,
  store: ShopOutlined,
  thermometer: HeatMapOutlined,
  timer: FieldTimeOutlined,
  trendingDown: FallOutlined,
  trendingUp: RiseOutlined,
  truck: CarOutlined,
  user: UserOutlined,
  wallet: WalletOutlined,
  warehouse: BankOutlined,
  waves: CloudOutlined,
  xCircle: CloseCircleOutlined,
};

/** Resolve a data-declared icon name, with a neutral fallback rather than a crash. */
export function antIcon(name?: IconName, style?: React.CSSProperties): React.ReactNode {
  const Icon = (name && ICONS[name]) || AuditOutlined;
  return <Icon style={style} />;
}

/** Hex for a tone, for the places Ant wants a raw colour (charts, borders). */
export function antColor(tone?: Tone): string {
  return ANT_HEX[tone ?? 'navy'];
}
