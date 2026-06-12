interface Props {
  colSpan: number;
  children: React.ReactNode;
}

export function DetailsRow({ colSpan, children }: Props) {
  return (
    <tr className="bg-gradient-to-br from-details-from to-details-to">
      <td colSpan={colSpan}>
        <div className="p-8 border-t border-details-border">
          {children}
        </div>
      </td>
    </tr>
  );
}
