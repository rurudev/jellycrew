import type { ReactNode } from "react";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  /** One action at most: a button or a link. */
  action?: ReactNode;
  className?: string;
}

/** Nothing to show yet: a title, one line of explanation, one action. */
export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <Empty className={cn("py-8", className)}>
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        {description ? <EmptyDescription>{description}</EmptyDescription> : null}
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}

/** The same, as the only row of a table. */
function Row({ colSpan, ...props }: EmptyStateProps & { colSpan: number }) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="p-0 whitespace-normal">
        <EmptyState {...props} />
      </TableCell>
    </TableRow>
  );
}

EmptyState.Row = Row;
