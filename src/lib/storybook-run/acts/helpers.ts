// Tiny constructors so the act files read like a script, not like a pile of object literals.
import type { Block, RoleId, Screen, View } from '../types';

export const phone = (role: RoleId, screen: Screen, cap?: string): View => ({ role, device: 'phone', screen, cap });
export const desk = (role: RoleId, screen: Screen, cap?: string): View => ({ role, device: 'desktop', screen, cap });

export const REP_NAV = ['Home', 'Buy', 'Load', 'Tasks', 'More'];
export const RECV_NAV = ['Home', 'Receive', 'Stock', 'Alerts', 'More'];
export const ADMIN_SIDE = ['Dashboard', 'Warehouses', 'Truck loads', 'Approvals', 'Access', 'Reports'];

export const note = (text: string, o: Partial<Extract<Block, { k: 'note' }>> = {}): Block => ({ k: 'note', text, ...o });
