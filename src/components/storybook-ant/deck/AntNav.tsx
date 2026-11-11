// AntNav — the chapter navigator: an Ant `Menu` grouped exactly like the deck.
//
// One component, two homes: it fills the Sider on a desktop and the Drawer on a phone, so a reviewer
// jumps between the 32 chapters the same way at any width. The groups and their order come from the
// same GROUP_META / GROUP_ORDER the Tailwind deck's index uses.

import { Menu, type MenuProps } from 'antd';
import { DesktopOutlined, MobileOutlined } from '@ant-design/icons';

import { CHAPTERS } from '@/lib/storybook/chapters';
import { GROUP_META, GROUP_ORDER } from '@/lib/storybook/types';
import { ANT_HEX } from '../ant-tokens';

type Items = NonNullable<MenuProps['items']>;

export function buildChapterMenu(): Items {
  return GROUP_ORDER.flatMap((group) => {
    const chapters = CHAPTERS.filter((c) => c.group === group);
    if (chapters.length === 0) return [];
    const meta = GROUP_META[group];
    return [
      {
        type: 'group' as const,
        key: `g-${group}`,
        label: <span style={{ color: ANT_HEX[meta.tone], fontWeight: 700 }}>{meta.label}</span>,
        children: chapters.map((c) => ({
          key: c.id,
          icon: c.layout === 'desktop' ? <DesktopOutlined /> : <MobileOutlined />,
          label: `${c.number}. ${c.title}`,
        })),
      },
    ];
  });
}

const ITEMS = buildChapterMenu();

export default function AntNav({ selected, onSelect }: { selected?: string; onSelect: (chapterId: string) => void }) {
  return (
    <Menu
      mode="inline"
      items={ITEMS}
      selectedKeys={selected ? [selected] : []}
      onClick={({ key }) => onSelect(String(key))}
      style={{ borderInlineEnd: 0, background: 'transparent' }}
    />
  );
}
