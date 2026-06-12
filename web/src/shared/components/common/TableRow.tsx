import { cn } from "@/lib/utils";

interface Props {
  index: number;
  isSelected?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}

export function TableRow({ index, isSelected, onClick, children, className }: Props) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        "border-b border-border hover:bg-table-row-hover transition-colors cursor-pointer",
        index % 2 === 0 ? "bg-table-row-even" : "bg-table-row-odd",
        isSelected && "bg-table-row-selected",
        className
      )}
    >
      {children}
    </tr>
  );
}
