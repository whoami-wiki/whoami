import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertTriangle, AlertOctagon, HelpCircle } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
  kind: 'open' | 'closed' | 'superseded' | 'gap';
  children?: ReactNode;
}

const PRESETS = {
  open:       { icon: HelpCircle,    label: 'Open',       className: 'border-yellow-500 [&>svg]:text-yellow-600' },
  closed:     { icon: CheckCircle2,  label: 'Closed',     className: 'border-green-500 [&>svg]:text-green-600' },
  superseded: { icon: AlertOctagon,  label: 'Superseded', className: 'border-red-500 [&>svg]:text-red-600' },
  gap:        { icon: AlertTriangle, label: 'Gap',        className: 'border-amber-500 [&>svg]:text-amber-600' },
} as const;

export function Admonition({ kind, children }: Props) {
  const p = PRESETS[kind];
  const Icon = p.icon;
  return (
    <Alert className={p.className}>
      <Icon className="h-4 w-4" />
      <AlertDescription>
        <span className="font-semibold mr-2">{p.label}.</span>
        {children}
      </AlertDescription>
    </Alert>
  );
}
