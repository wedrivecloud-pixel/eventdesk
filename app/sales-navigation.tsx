'use client';
import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { salesGroups } from '@/lib/sales';
import { Fragment } from 'react';
export function SalesMenu({ onNavigate }: { onNavigate: (s: string) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="sales-menu-trigger">
        Sales <ChevronDown size={15} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="sales-menu">
        {salesGroups.map((group, i) => (
          <Fragment key={i}>
            {i > 0 && <DropdownMenuSeparator />}
            {group.map((name) => (
              <DropdownMenuItem key={name} onClick={() => onNavigate(name)}>
                {name}
              </DropdownMenuItem>
            ))}
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
