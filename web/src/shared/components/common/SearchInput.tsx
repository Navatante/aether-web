import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
}

export function SearchInput({ value, onChange, placeholder, className }: Props) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={cn(
          "bg-card border-input border focus:border-ring focus:outline-none transition-all",
          "placeholder:text-muted-foreground text-foreground w-full pl-10 pr-4 py-2.5 rounded-xl",
          className
        )}
      />
    </div>
  );
}
