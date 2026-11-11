// shadcn/ui Collapsible — Radix disclosure primitives re-exported as-is (upstream file is
// exactly this). The "More" tile on the Phase A home screen uses it so the panel gets real
// aria-expanded/aria-controls wiring from Radix instead of a hand-rolled useState toggle.
import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';

const Collapsible = CollapsiblePrimitive.Root;

const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger;

const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent;

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
