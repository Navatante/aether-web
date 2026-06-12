import { cva, type VariantProps } from "class-variance-authority";

const variants = cva(
  "sticky z-20 border-b border-border bg-table-header backdrop-blur-md shadow-sm",
  {
    variants: {
      offset: {
        none: "top-0",
        topbar: "-top-6"
      }
    },
    defaultVariants: { offset: "none" }
  }
);

interface Props extends VariantProps<typeof variants> {
  children: React.ReactNode;
}

export function StickyTableHeader({ offset, children }: Props) {
  return <thead className={variants({ offset })}>{children}</thead>;
}
